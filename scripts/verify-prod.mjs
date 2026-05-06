import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.SILVERPASS_BASE_URL || 'https://silverpass-seoul.vercel.app'
const EXPECT_EMPTY_DB = process.argv.includes('--expect-empty-db')

const env = loadEnv()
const checks = []

function loadEnv() {
  const merged = { ...process.env }
  for (const file of ['.env', '.env.local', '.env.vercel.local']) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, raw] = match
      const value = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\\n$/g, '').trim()
      if (!value) continue
      merged[key] = value
    }
  }
  return merged
}

function add(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
}

function requireEnv(name) {
  add(`env:${name}`, Boolean(env[name]), env[name] ? 'set' : 'missing')
}

function optionalEnv(name, why) {
  add(`env:${name}`, true, env[name] ? 'set' : `not pulled locally; ${why}`)
}

async function fetchJson(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const started = Date.now()
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${res.status} non-json response from ${url}`)
  }
  return { res, json, ms: Date.now() - started }
}

async function checkProductionApis() {
  const claude = await fetchJson('/api/claude', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'parseUserQuery',
      payload: { query: '서울역 가고 싶어', profile: { allowStairs: false } },
    }),
  })
  add('api:claude', claude.res.ok && !claude.json._demo && Boolean(claude.json.result), `${claude.res.status} ${claude.ms}ms`)

  const gonggong = await fetchJson(`/api/gonggong?type=pharmacy&Q0=${encodeURIComponent('서울특별시')}&Q1=${encodeURIComponent('종로구')}&numOfRows=3`)
  const pharmacyItems = gonggong.json?.response?.body?.items?.item
  add('api:gonggong-pharmacy', gonggong.res.ok && !gonggong.json._demo && Boolean(pharmacyItems), `${gonggong.res.status} ${gonggong.ms}ms`)

  const air = await fetchJson(`/api/seoul?service=RealtimeCityAir&start=1&end=5&p0=${encodeURIComponent(' ')}&p1=${encodeURIComponent('종로구')}`)
  add('api:seoul-air', air.res.ok && !air.json._demo && Boolean(air.json?.RealtimeCityAir?.row?.length), `${air.res.status} ${air.ms}ms`)

  const subway = await fetchJson(`/api/subway?station=${encodeURIComponent('시청')}`)
  add('api:subway-arrival', subway.res.ok && !subway.json._demo && Boolean(subway.json?.realtimeArrivalList?.length), `${subway.res.status} ${subway.ms}ms`)
}

async function checkOdsay() {
  if (!env.VITE_ODSAY_API_KEY) {
    add('api:odsay-route', false, 'VITE_ODSAY_API_KEY missing locally')
    return
  }

  const params = new URLSearchParams({
    SX: '126.9779451',
    SY: '37.5662952',
    EX: '126.9706069',
    EY: '37.5546788',
    apiKey: env.VITE_ODSAY_API_KEY,
    lang: '0',
    output: 'json',
  })
  const { res, json, ms } = await fetchJson(`https://api.odsay.com/v1/api/searchPubTransPathT?${params}`, {
    headers: { Referer: `${BASE_URL}/` },
  })
  const count = Array.isArray(json?.result?.path) ? json.result.path.length : 0
  const reason = json?.error?.[0]?.message || json?.error?.message || ''
  add('api:odsay-route', res.ok && count > 0, `${res.status} ${ms}ms paths=${count}${reason ? ` ${reason}` : ''}`)
}

async function checkSupabase() {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    add('supabase:connect', false, 'Supabase env missing locally')
    return
  }

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  add('supabase:connect', true, 'client created')

  for (const table of ['profiles', 'links', 'history']) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    const ok = !error && (!EXPECT_EMPTY_DB || count === 0)
    add(`supabase:${table}`, ok, error ? error.message : `count=${count}`)
  }
}

for (const name of [
  'VITE_KAKAO_MAP_KEY',
  'VITE_ODSAY_API_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
]) {
  requireEnv(name)
}

for (const name of [
  'ANTHROPIC_API_KEY',
  'SEOUL_API_KEY',
  'SEOUL_SUBWAY_API_KEY',
  'GONGGONG_API_KEY',
]) {
  optionalEnv(name, 'production API smoke tests verify it')
}

try {
  await checkProductionApis()
  await checkOdsay()
  await checkSupabase()
} catch (error) {
  add('verify:runtime', false, error.message)
}

const failed = checks.filter(check => !check.ok)
for (const check of checks) {
  const marker = check.ok ? 'PASS' : 'FAIL'
  console.log(`${marker} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`)
}

if (failed.length) {
  console.error(`\n${failed.length} production verification check(s) failed.`)
  process.exit(1)
}

console.log('\nProduction verification passed.')

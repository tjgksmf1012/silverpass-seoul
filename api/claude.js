import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY ||
  process.env.VITE_ANTHROPIC_API_KEY ||
  ''

const client = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null

function sendJson(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.status(status).json(body)
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
}

async function createMessage(system, user, maxTokens = 512) {
  if (!client) throw new Error('Anthropic API key is not configured')

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })

  return res.content?.[0]?.text?.trim() || ''
}

async function parseUserQuery(query, profile = {}) {
  const system = `당신은 고령자 이동을 돕는 AI 코파일럿 '실버패스 서울 Care'입니다.
사용자의 이동 요청을 분석하여 JSON 형식으로만 반환하세요. 다른 설명은 절대 포함하지 마세요.

사용자 프로필:
- 최대 도보 시간: ${profile.maxWalkMin ?? 20}분
- 계단 허용: ${profile.allowStairs ? '가능' : '불가'}
- 보행보조기구: ${profile.mobilityAid ? '사용 중' : '없음'}
- 자주 가는 곳: ${(profile.favorites || []).map(f => f.name).join(', ')}
${profile.healthNotes ? `- 건강/이동 메모: ${profile.healthNotes}` : ''}

위 메모를 분석하여 preferences에 반드시 반영하세요.
예시: "휠체어" → ["계단 없음", "저상버스 우선"], "보행 느림" → ["덜 걷기", "환승 최소화"], "심장" → ["완만한 경로"]

응답 JSON 형식:
{
  "destination": "목적지명",
  "destinationType": "hospital|pharmacy|welfare|home|other",
  "urgency": "normal|urgent",
  "preferences": ["덜 걷기", "계단 없음", "빠른 길"]
}

응급 키워드(아파요, 쓰러짐 등)가 있으면 urgency를 "urgent"로 설정하세요.
JSON 객체만 반환하고, 마크다운 코드블록도 사용하지 마세요.`

  const text = await createMessage(system, query, 256)
  return JSON.parse(stripCodeFence(text))
}

async function generateRouteExplanation(routeData = {}, profile = {}) {
  const system = `당신은 고령자에게 이동 경로를 쉽고 친절하게 설명하는 AI입니다.

[반드시 지킬 규칙]
- 마크다운 절대 사용 금지: #, ##, **, *, -, > 등 기호를 쓰지 마세요.
- 이모지와 줄바꿈만 사용하세요.
- 반말 사용 금지. 존댓말로 설명하세요.
- 최대 3단계, 단계마다 1️⃣ 2️⃣ 3️⃣ 이모지로 시작하세요.
- 첫 줄은 반드시 📍 목적지명으로 시작하세요.
- 각 단계는 2줄 이내로 짧게 쓰세요.
- 이동 부담 요소(계단, 거리, 날씨, 대기질)를 솔직하게 알려주세요.`

  const user = `다음 경로 정보를 고령자에게 설명해주세요:
목적지: ${routeData.destination}
저상버스: ${routeData.lowFloorBus ? '있음' : '없음'}
승강기: ${routeData.elevator ? '정상' : '점검 중'}
날씨/대기: ${routeData.weather}
미세먼지: ${routeData.airQuality?.grade || '보통'}
예상 소요시간: ${routeData.duration}분
도보 거리: ${routeData.walkDistance}m
보행보조기구: ${profile.mobilityAid ? '사용' : '없음'}
${profile.healthNotes ? `건강/이동 메모: ${profile.healthNotes}` : ''}

메모에 언급된 신체 상태(휠체어, 보행 어려움, 심장 등)에 맞춰 주의사항을 안내에 포함하세요.`

  return createMessage(system, user, 512)
}

async function generateSubwayGuide(destination) {
  const system = `당신은 서울 지하철 안내 전문가입니다.
목적지가 주어지면 지하철로 가는 가장 현실적인 방법을 JSON으로만 반환하세요. 마크다운 코드블록 절대 사용 금지.

JSON 형식:
{
  "nearestStation": "내릴 역명 (예: 종로3가역)",
  "line": "호선 (예: 3호선)",
  "lineNumber": 3,
  "lineColor": "#hex",
  "direction": "방향 (예: 대화행)",
  "transferInfo": "환승 안내 (없으면 null)",
  "exitNumber": "출구 번호 (예: 5번 출구)",
  "walkFromExit": "출구에서 도보 시간 (예: 도보 3분)",
  "tip": "어르신을 위한 팁 한 줄 (예: 엘리베이터는 3번 출구에 있어요)"
}

서울 지하철 노선 색상:
1호선 #0052A4, 2호선 #009246, 3호선 #EF7C1C, 4호선 #00A5DE,
5호선 #996CAC, 6호선 #CD7C2F, 7호선 #747F00, 8호선 #E6186C,
9호선 #BDB092, 경의중앙선 #77C4A3, 수인분당선 #F5A200,
신분당선 #D4003B, 우이신설선 #B0CE2C`

  const text = await createMessage(system, `서울 ${destination}까지 지하철로 가는 방법을 알려주세요.`, 300)
  return JSON.parse(stripCodeFence(text))
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true })
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

  try {
    const { action, payload = {} } = await readBody(req)

    if (action === 'parseUserQuery') {
      return sendJson(res, 200, { result: await parseUserQuery(payload.query, payload.profile) })
    }
    if (action === 'generateRouteExplanation') {
      return sendJson(res, 200, { result: await generateRouteExplanation(payload.routeData, payload.profile) })
    }
    if (action === 'generateSubwayGuide') {
      return sendJson(res, 200, { result: await generateSubwayGuide(payload.destination) })
    }

    return sendJson(res, 400, { error: 'Unknown Claude action' })
  } catch (error) {
    console.error('[api/claude]', error)
    res.setHeader('Cache-Control', 'no-store')
    return sendJson(res, 200, {
      _demo: true,
      reason: error.message || 'Claude request failed',
    })
  }
}

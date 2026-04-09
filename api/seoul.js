/**
 * Vercel serverless proxy for 서울 열린데이터광장 OpenAPI
 * 서울 API는 HTTP만 지원하므로, HTTPS 환경(Vercel)에서는 서버사이드로 호출해야 함
 */
export default async function handler(req, res) {
  const { service, start = '1', end = '10', ...extra } = req.query

  const key = process.env.SEOUL_API_KEY
  if (!key || key === 'DEMO') {
    return res.status(200).json({ _demo: true })
  }

  // Build Seoul API URL: /{key}/json/{service}/{start}/{end}/{...pathParams}
  let url = `http://openapi.seoul.go.kr:8088/${key}/json/${service}/${start}/${end}/`

  // Append extra path segments (e.g. district filter like '종로구')
  const extras = Object.values(extra).filter(Boolean)
  if (extras.length) {
    url += extras.map(v => encodeURIComponent(v)).join('/') + '/'
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!resp.ok) {
      return res.status(502).json({ error: `Seoul API HTTP ${resp.status}` })
    }

    const data = await resp.json()
    // Cache for 60 seconds at CDN edge
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

/**
 * Vercel serverless proxy — 서울시 지하철 실시간 도착정보
 * swopenapi.seoul.go.kr (HTTP only → 서버사이드 호출 필요)
 * URL: /api/subway?station=종각역
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { station } = req.query
  if (!station) return res.status(400).json({ error: 'station required' })

  const key = process.env.SEOUL_API_KEY
  if (!key || key === 'DEMO') {
    return res.status(200).json({ _demo: true })
  }

  // 역명에서 '역' 제거 (API는 '종각' 형식을 받음, 또는 '종각역' 둘 다 허용)
  const stationName = encodeURIComponent(station.replace(/역$/, ''))
  const url = `http://swopenapi.seoul.go.kr/api/subway/${key}/json/realtimeStationArrival/0/10/${stationName}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!resp.ok) return res.status(502).json({ error: `Seoul Subway API ${resp.status}` })

    const data = await resp.json()
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

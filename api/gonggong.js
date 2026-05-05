/**
 * Vercel serverless proxy for 공공데이터포털 API
 * 공공데이터포털 API는 HTTP만 지원하므로, HTTPS 환경(Vercel)에서는 서버사이드로 호출
 *
 * Query params:
 *   type: 'pharmacy' | 'hospital'
 *   Q0: 시도명 (예: 서울특별시)
 *   Q1: 시군구명 (예: 종로구)
 *   numOfRows: 결과 개수
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { type, Q0 = '서울특별시', Q1 = '종로구', numOfRows = '5' } = req.query

  const key = process.env.GONGGONG_API_KEY
  if (!key) {
    return res.status(200).json({ _demo: true })
  }

  const encodedKey = encodeURIComponent(key)

  let url
  if (type === 'pharmacy') {
    // 약국 현황 조회 서비스
    url = `http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire?serviceKey=${encodedKey}&Q0=${encodeURIComponent(Q0)}&Q1=${encodeURIComponent(Q1)}&numOfRows=${numOfRows}&pageNo=1&_type=json`
  } else if (type === 'hospital') {
    // 응급의료기관 목록 조회
    url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire?serviceKey=${encodedKey}&Q0=${encodeURIComponent(Q0)}&Q1=${encodeURIComponent(Q1)}&numOfRows=${numOfRows}&pageNo=1&_type=json`
  } else {
    return res.status(400).json({ error: 'Invalid type. Use pharmacy or hospital.' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!resp.ok) {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({
        _demo: true,
        reason: `Gonggong API HTTP ${resp.status}`,
      })
    }

    const data = await resp.json()
    const header = data?.response?.header
    if (header?.resultCode && header.resultCode !== '00') {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({
        _demo: true,
        reason: header.resultMsg || `Gonggong API result ${header.resultCode}`,
      })
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.json(data)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ _demo: true, reason: e.message })
  }
}

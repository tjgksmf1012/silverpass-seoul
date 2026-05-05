// Emergency keywords that trigger immediate 119/guardian alert
const EMERGENCY_KEYWORDS = [
  '아파', '쓰러', '쓰러졌', '쓰러짐', '못 움직', '못움직', '다쳤', '다쳐',
  '응급', '119', '구급차', '심장', '호흡', '숨이', '어지럽', '기절',
  '넘어졌', '넘어짐', '골절', '출혈', '피가', '의식'
]

export function checkEmergency(text) {
  return EMERGENCY_KEYWORDS.some(kw => text.includes(kw))
}

async function callClaude(action, payload) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Claude proxy HTTP ${res.status}`)
  }

  const data = await res.json()
  if (data?._demo || !Object.prototype.hasOwnProperty.call(data, 'result')) {
    throw new Error(data?.reason || 'Claude proxy returned fallback data')
  }

  return data.result
}

export async function parseUserQuery(query, profile) {
  try {
    return await callClaude('parseUserQuery', { query, profile })
  } catch (err) {
    console.warn('Claude parse fallback:', err)
    return getMockRouteRecommendation(query, profile)
  }
}

export async function generateRouteExplanation(routeData, profile) {
  try {
    return await callClaude('generateRouteExplanation', { routeData, profile })
  } catch (err) {
    console.warn('Claude explain fallback:', err)
    return getMockExplanation(routeData, profile)
  }
}

export async function generateSubwayGuide(destination) {
  try {
    return await callClaude('generateSubwayGuide', { destination })
  } catch (err) {
    console.warn('Subway guide fallback:', err)
    return getMockSubwayGuide(destination)
  }
}

function getMockSubwayGuide(destination) {
  const dest = destination.toLowerCase()
  // 목적지에 따라 현실적인 mock 데이터 반환
  if (dest.includes('강남') || dest.includes('역삼') || dest.includes('삼성')) {
    return { nearestStation: '강남역', line: '2호선', lineNumber: 2, lineColor: '#009246', direction: '성수행', transferInfo: null, exitNumber: '11번 출구', walkFromExit: '도보 3분', tip: '11번 출구에 엘리베이터가 있어요' }
  }
  if (dest.includes('홍대') || dest.includes('마포')) {
    return { nearestStation: '홍대입구역', line: '2호선', lineNumber: 2, lineColor: '#009246', direction: '까치산행', transferInfo: null, exitNumber: '9번 출구', walkFromExit: '도보 5분', tip: '경의중앙선·공항철도로 환승 가능해요' }
  }
  if (dest.includes('명동') || dest.includes('을지로')) {
    return { nearestStation: '명동역', line: '4호선', lineNumber: 4, lineColor: '#00A5DE', direction: '당고개행', transferInfo: null, exitNumber: '6번 출구', walkFromExit: '도보 2분', tip: '6번 출구 앞에 엘리베이터 있어요' }
  }
  if (dest.includes('종로') || dest.includes('광화문') || dest.includes('청계')) {
    return { nearestStation: '종각역', line: '1호선', lineNumber: 1, lineColor: '#0052A4', direction: '청량리행', transferInfo: null, exitNumber: '4번 출구', walkFromExit: '도보 4분', tip: '에스컬레이터 이용 가능해요' }
  }
  if (dest.includes('이태원') || dest.includes('한남') || dest.includes('용산')) {
    return { nearestStation: '이태원역', line: '6호선', lineNumber: 6, lineColor: '#CD7C2F', direction: '봉화산행', transferInfo: null, exitNumber: '2번 출구', walkFromExit: '도보 3분', tip: '2번 출구 바로 앞이에요' }
  }
  // 기본값
  return {
    nearestStation: '서울역',
    line: '1호선',
    lineNumber: 1,
    lineColor: '#0052A4',
    direction: '청량리행',
    transferInfo: '4호선 환승 가능',
    exitNumber: '7번 출구',
    walkFromExit: '도보 약 5분',
    tip: '엘리베이터는 1번 출구를 이용하세요',
  }
}

function getMockRouteRecommendation(query, profile) {
  const q = query.toLowerCase()
  const notes = String(profile?.healthNotes || '').toLowerCase()
  let destination = query.trim()  // 입력값을 그대로 사용
  let destinationType = 'other'
  const preferences = []

  if (q.includes('병원') || q.includes('의원')) { destinationType = 'hospital' }
  else if (q.includes('약국')) { destinationType = 'pharmacy' }
  else if (q.includes('복지관') || q.includes('센터')) { destinationType = 'welfare' }
  else if (q.includes('집') || q.includes('귀가')) { destination = '집'; destinationType = 'home' }

  if (!profile?.allowStairs) preferences.push('계단 없음')
  if (/(휠체어|워커|지팡이|보행)/.test(notes)) preferences.push('승강기/저상버스 우선')
  if (/(심장|호흡|어지럼|무릎|허리|수술|천천히|쉬)/.test(notes)) preferences.push('짧은 도보와 쉬운 경로')

  return {
    destination,
    destinationType,
    urgency: 'normal',
    preferences,
  }
}

function getMockExplanation(routeData, profile = {}) {
  const noteGuidance = buildHealthNoteGuidance(profile.healthNotes)

  return `📍 ${routeData.destination}까지 안내드릴게요.

1️⃣ 가장 가까운 정류장에서 저상버스를 타세요.
   → 승강기 상태: ${routeData.elevator ? '✅ 정상 운행 중' : '⚠️ 점검 중 - 계단 이용'}

2️⃣ ${routeData.duration}분 정도 걸려요.
   → 날씨: ${routeData.weather}. 천천히 이동하세요.
${noteGuidance ? `   → 보호자 메모: ${noteGuidance}\n` : ''}

3️⃣ 목적지 도착 후 보호자에게 알림이 전송됩니다.`
}

function buildHealthNoteGuidance(healthNotes = '') {
  const notes = String(healthNotes).trim()
  if (!notes) return ''
  if (/(휠체어|워커|지팡이|보행)/.test(notes)) {
    return '승강기와 저상버스가 있는 길을 우선으로 확인하세요.'
  }
  if (/(심장|호흡|어지럼|수술)/.test(notes)) {
    return '무리하지 말고 중간에 쉬어가며 이동하세요.'
  }
  if (/(무릎|허리|관절|통증)/.test(notes)) {
    return '계단과 긴 도보를 피하고 천천히 이동하세요.'
  }
  return '등록된 주의사항을 참고해 천천히 이동하세요.'
}

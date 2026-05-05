import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

const client = ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true, // Demo only — production should proxy via backend
    })
  : null

// Emergency keywords that trigger immediate 119/guardian alert
const EMERGENCY_KEYWORDS = [
  '아파', '쓰러', '쓰러졌', '쓰러짐', '못 움직', '못움직', '다쳤', '다쳐',
  '응급', '119', '구급차', '심장', '호흡', '숨이', '어지럽', '기절',
  '넘어졌', '넘어짐', '골절', '출혈', '피가', '의식'
]

export function checkEmergency(text) {
  return EMERGENCY_KEYWORDS.some(kw => text.includes(kw))
}

export async function parseUserQuery(query, profile) {
  if (!client) return getMockRouteRecommendation(query, profile)

  const systemPrompt = `당신은 고령자 이동을 돕는 AI 코파일럿 '실버패스 서울 Care'입니다.
사용자의 이동 요청을 분석하여 JSON 형식으로만 반환하세요. 다른 설명은 절대 포함하지 마세요.

사용자 프로필:
- 최대 도보 시간: ${profile.maxWalkMin}분
- 계단 허용: ${profile.allowStairs ? '가능' : '불가'}
- 보행보조기구: ${profile.mobilityAid ? '사용 중' : '없음'}
- 자주 가는 곳: ${profile.favorites.map(f => f.name).join(', ')}
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

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    })
    const text = res.content[0].text.trim()
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('Claude parse error:', err)
    return getMockRouteRecommendation(query, profile)
  }
}

export async function generateRouteExplanation(routeData, profile) {
  if (!client) return getMockExplanation(routeData)

  const systemPrompt = `당신은 고령자에게 이동 경로를 쉽고 친절하게 설명하는 AI입니다.

[반드시 지킬 규칙]
- 마크다운 절대 사용 금지: #, ##, **, *, -, > 등 기호를 쓰지 마세요.
- 이모지와 줄바꿈만 사용하세요.
- 반말 사용 금지. 존댓말로 설명하세요.
- 최대 3단계, 단계마다 1️⃣ 2️⃣ 3️⃣ 이모지로 시작하세요.
- 첫 줄은 반드시 📍 목적지명으로 시작하세요.
- 각 단계는 2줄 이내로 짧게 쓰세요.
- 이동 부담 요소(계단, 거리, 날씨, 대기질)를 솔직하게 알려주세요.

[출력 형식 예시]
📍 가까운 약국까지 안내드릴게요.

1️⃣ 정류장에서 370번 저상버스를 타세요.
   손잡이를 꼭 잡고 승차하세요.

2️⃣ 8분 정도 이동합니다.
   오늘 날씨가 좋으니 천천히 이동하세요.

3️⃣ 내리신 후 약 250m 걸으시면 도착합니다.
   계단이 없는 편한 길이에요.`

  const userPrompt = `다음 경로 정보를 고령자에게 설명해주세요:
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

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    return res.content[0].text
  } catch (err) {
    console.error('Claude explain error:', err)
    return getMockExplanation(routeData)
  }
}

export async function generateSubwayGuide(destination) {
  if (!client) return getMockSubwayGuide(destination)

  const systemPrompt = `당신은 서울 지하철 안내 전문가입니다.
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

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: `서울 ${destination}까지 지하철로 가는 방법을 알려주세요.` }],
    })
    const text = res.content[0].text.trim()
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('Subway guide error:', err)
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
  let destination = query.trim()  // 입력값을 그대로 사용
  let destinationType = 'other'

  if (q.includes('병원') || q.includes('의원')) { destinationType = 'hospital' }
  else if (q.includes('약국')) { destinationType = 'pharmacy' }
  else if (q.includes('복지관') || q.includes('센터')) { destinationType = 'welfare' }
  else if (q.includes('집') || q.includes('귀가')) { destination = '집'; destinationType = 'home' }

  return {
    destination,
    destinationType,
    urgency: 'normal',
    preferences: profile.allowStairs ? [] : ['계단 없음'],
  }
}

function getMockExplanation(routeData) {
  return `📍 ${routeData.destination}까지 안내드릴게요.

1️⃣ 가장 가까운 정류장에서 저상버스를 타세요.
   → 승강기 상태: ${routeData.elevator ? '✅ 정상 운행 중' : '⚠️ 점검 중 - 계단 이용'}

2️⃣ ${routeData.duration}분 정도 걸려요.
   → 날씨: ${routeData.weather} — 천천히 이동하세요.

3️⃣ 목적지 도착 후 보호자에게 알림이 전송됩니다.`
}

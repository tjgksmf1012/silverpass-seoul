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
보행보조기구: ${profile.mobilityAid ? '사용' : '없음'}`

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

function getMockRouteRecommendation(query, profile) {
  const q = query.toLowerCase()
  let destination = '목적지'
  let destinationType = 'other'

  if (q.includes('병원') || q.includes('의원')) { destination = '가까운 병원'; destinationType = 'hospital' }
  else if (q.includes('약국')) { destination = '가까운 약국'; destinationType = 'pharmacy' }
  else if (q.includes('복지관') || q.includes('센터')) { destination = '복지관'; destinationType = 'welfare' }
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

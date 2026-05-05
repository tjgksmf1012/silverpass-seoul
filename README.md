# 실버패스 서울 Care

> 서울시 공공 빅데이터 기반 고령자 안전 이동 AI 서비스  
> **2026 서울시 빅데이터 활용 경진대회 · 창업부문 출품작**

**🔗 라이브 데모:** https://silverpass-seoul.vercel.app

---

## 서비스 소개

서울시 65세 이상 고령자 **168만 명**이 이동 중 겪는 문제를 해결합니다.

- 저상버스가 언제 오는지 모른다
- 역 승강기가 점검 중인지 미리 알 수 없다
- 미세먼지가 나쁜 날 무더위쉼터 위치를 모른다
- 응급 상황 시 주변 병원을 빠르게 찾기 어렵다

실버패스 서울 Care는 서울시 실시간 공공 빅데이터 **6종**과 Claude AI를 결합해  
고령자 맞춤 이동 경로와 주변 편의시설 정보를 한눈에 제공합니다.

---

## 활용 공공 빅데이터

| 데이터셋 | 출처 | 활용 내용 |
|---|---|---|
| 서울시 실시간 대기환경 | 서울 열린데이터광장 | PM10/PM2.5 실시간 측정, 이동 부담도 산정 |
| 서울교통공사 승강기 가동현황 | 서울 열린데이터광장 | 역 승강기 정상/점검 여부 실시간 확인 |
| 서울시 공중화장실 위치정보 | 서울 열린데이터광장 | 경로 주변 장애인 화장실 안내 |
| 서울시 무더위쉼터 현황 | 서울 열린데이터광장 | 폭염·미세먼지 시 인근 쉼터 자동 안내 |
| 약국 현황 조회 서비스 | 공공데이터포털 | 목적지 주변 약국 위치·전화번호 제공 |
| 응급의료기관 목록 정보 | 공공데이터포털 | 응급 시 인근 병원·응급실 즉시 안내 |

---

## 주요 기능

### 🗺️ AI 맞춤 경로 안내
- Claude AI(claude-haiku-4-5)가 개인 이동 조건(보행보조기구, 계단 허용 여부)에 맞춰 경로 설명
- 이동 부담도(쉬움/보통/힘듦) 자동 산정 및 시각화

### 📍 실시간 지도
- OpenStreetMap 기반 목적지 지도 + 현재 위치 동시 표시
- GPS 위치 감지로 현재 구(區) 자동 설정

### 🌬️ 대기질 실시간 모니터링
- 홈 화면에서 현재 구(區) 대기질 즉시 확인
- 나쁨/매우나쁨 시 경고 배너 + 무더위쉼터 자동 표시

### 🚨 응급 기능
- 119 즉시 연결 (원터치)
- 보호자 원터치 호출
- 현재 위치 기반 응급의료기관 목록 표시

### 👨‍👩‍👧 보호자 연결
- 이동 현황 공유 (문자/카카오톡)
- 이동 이력 자동 저장

---

## 기술 스택

```
Frontend   React 18 + Vite + Tailwind CSS
AI         Claude Haiku 4.5 (Anthropic API)
Map        Leaflet.js + OpenStreetMap
PWA        vite-plugin-pwa (홈 화면 설치, 오프라인 지원)
Deploy     Vercel (Serverless Functions 포함)
API Proxy  Vercel Edge Functions (공공API HTTP→HTTPS 변환)
```

---

## 사업화 모델

| 수익원 | 내용 |
|---|---|
| B2G | 서울시·자치구 어르신 이동 복지 서비스 위탁 운영 |
| B2B | 요양원·복지관·돌봄기관 구독 서비스 |
| B2C | 보호자 프리미엄 알림 구독 (월 2,900원) |

---

## 로컬 실행 방법

```bash
git clone https://github.com/tjgksmf1012/silverpass-seoul.git
cd silverpass-seoul
npm install

# .env 파일 생성
cp .env.example .env
# 아래 키 입력:
# ANTHROPIC_API_KEY=        # 서버 전용, 브라우저 번들에 포함하지 않음
# VITE_SEOUL_API_KEY=       # 로컬 Vite 직접 호출용
# VITE_GONGGONG_API_KEY=    # 로컬 Vite 직접 호출용
# VITE_KAKAO_MAP_KEY=
# VITE_ODSAY_API_KEY=
# VITE_SUPABASE_URL=
# VITE_SUPABASE_ANON_KEY=

npm run dev
```

## Vercel 환경변수

Production 배포에는 아래 서버 전용 키를 Vercel Project Settings > Environment Variables에 등록합니다.

```bash
ANTHROPIC_API_KEY=
SEOUL_API_KEY=
GONGGONG_API_KEY=
VITE_KAKAO_MAP_KEY=
VITE_ODSAY_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

AI 호출은 `/api/claude` 서버리스 프록시를 통해 처리되므로 Anthropic 키가 브라우저 JS 번들에 노출되지 않습니다.

## 작업 후 저장

```bash
git add .
git commit -m "작업 내용"
git push
```

## 다른 컴퓨터에서 최신 코드 받기

```bash
git pull
```

## 배포

```bash
npx vercel --prod --yes
```

---

## 폰에 설치 (PWA)

**Android:** 크롬 주소창 우측 점 3개 → "앱 설치"  
**iPhone:** 사파리 하단 공유 버튼(□↑) → "홈 화면에 추가"

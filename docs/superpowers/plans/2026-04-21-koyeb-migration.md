# Koyeb 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stock_chart_helper 백엔드를 Render(sleep 있음)에서 Koyeb + Neon + Upstash(sleep 없음, 완전 무료)로 이전한다.

**Architecture:** GitHub main 브랜치 push 시 Koyeb이 backend/Dockerfile로 자동 빌드·배포. DB는 Neon PostgreSQL, 캐시는 Upstash Redis를 환경변수로 연결한다.

**Tech Stack:** Koyeb (Docker PaaS), Neon (serverless PostgreSQL), Upstash (serverless Redis), FastAPI, asyncpg, aioredis

---

## 파일 맵

| 액션 | 경로 | 역할 |
|------|------|------|
| 신규 생성 | `koyeb.yaml` (레포 루트) | Koyeb CLI 배포 설정 |
| 수정 | `backend/.env.example` | Koyeb용 환경변수 문서화 |

---

### Task 1: 레포 로컬 클론

**Files:**
- 없음 (환경 준비)

- [ ] **Step 1: 바탕화면에 클론**

```bash
cd /c/Users/cyci/Desktop
git clone https://github.com/tjgksmf1012/stock_chart_helper.git
cd stock_chart_helper
```

- [ ] **Step 2: 구조 확인**

```bash
ls
# 확인: backend/  frontend/  docs/  scripts/ 가 보여야 함
ls backend/
# 확인: Dockerfile  railway.toml  requirements.txt  app/  .env.example
```

- [ ] **Step 3: Commit (없음 — 변경사항 없음)**

---

### Task 2: koyeb.yaml 생성

**Files:**
- Create: `koyeb.yaml` (레포 루트, `backend/` 와 같은 레벨)

- [ ] **Step 1: koyeb.yaml 작성**

`/c/Users/cyci/Desktop/stock_chart_helper/koyeb.yaml` 파일을 새로 만들고 아래 내용을 그대로 붙여넣기:

```yaml
name: stock-chart-helper
services:
  - name: api
    type: web
    git:
      repository: github.com/tjgksmf1012/stock_chart_helper
      branch: main
    docker:
      dockerfile: backend/Dockerfile
      context: backend
    instance_type: free
    ports:
      - port: 8000
        protocol: http
    routes:
      - port: 8000
        path: /
    health_checks:
      - protocol: http
        path: /health
        port: 8000
        grace_period: 10
        interval: 30
        timeout: 5
        restart_limit: 3
    env:
      - key: PORT
        value: "8000"
      - key: DEPLOYMENT_PLATFORM
        value: koyeb
      - key: ENABLE_PLATFORM_KEEPALIVE
        value: "false"
```

- [ ] **Step 2: 파일 확인**

```bash
cat koyeb.yaml
# 위 내용이 그대로 출력되어야 함
```

- [ ] **Step 3: Commit**

```bash
git add koyeb.yaml
git commit -m "feat: add koyeb deployment config"
```

---

### Task 3: backend/.env.example 업데이트

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: .env.example 전체 교체**

`/c/Users/cyci/Desktop/stock_chart_helper/backend/.env.example` 파일을 열고 전체 내용을 아래로 교체:

```dotenv
# ===================================================
# 로컬 개발용 기본값
# ===================================================
DATABASE_URL=postgresql+asyncpg://sch_user:sch_pass@localhost:5432/stock_chart_helper
REDIS_URL=redis://localhost:6379/0

SECRET_KEY=change-me-to-a-random-32-char-string-in-production
DEBUG=true

# ===================================================
# 배포 환경 설정
# ===================================================
# 플랫폼: local | render | railway | koyeb
DEPLOYMENT_PLATFORM=local

# Koyeb 배포 시: sleep이 없으므로 false
# Render 배포 시: sleep 방지를 위해 true + SELF_HEALTHCHECK_URL 설정
ENABLE_PLATFORM_KEEPALIVE=false
SELF_HEALTHCHECK_URL=

# ===================================================
# CORS — 프론트엔드 도메인 (쉼표 구분, * 로 전체 허용 가능)
# ===================================================
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
# Vercel 배포 시 예시:
# ALLOWED_ORIGINS=https://stock-chart-helper.vercel.app

# ===================================================
# Koyeb + Neon + Upstash 배포 시 설정값
# ===================================================
# Neon PostgreSQL: https://console.neon.tech
#   → 프로젝트 생성 후 "Connection string" → "asyncpg" 탭에서 복사
#   형식: postgresql+asyncpg://user:password@host/dbname?sslmode=require
# DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>/<dbname>?sslmode=require

# Upstash Redis: https://console.upstash.com
#   → 데이터베이스 생성 후 "Connect" → "rediss://" URL 복사
#   형식: rediss://default:password@host:port
# REDIS_URL=rediss://default:<password>@<host>:<port>

# ===================================================
# KIS API (한국투자증권) — 선택사항
# ===================================================
# KIS_APP_KEY=
# KIS_APP_SECRET=
# KIS_ACCOUNT_NO=
# KIS_ENV=auto
# KIS_BASE_URL=https://openapi.koreainvestment.com:9443
# KIS_MOCK_BASE_URL=https://openapivts.koreainvestment.com:29443
# KIS_TOKEN_CACHE_PATH=/tmp/kis_token.json
# KIS_MAX_CONCURRENT_REQUESTS=2
# KIS_REQUEST_SPACING_MS=350
# KIS_FAILURE_COOLDOWN_SECONDS=300

# ===================================================
# 캐시 TTL (초 단위)
# ===================================================
# DAILY_BARS_TTL=3600
# INTRADAY_BARS_TTL=60
# PATTERN_CACHE_TTL=300
# DASHBOARD_CACHE_TTL=30
# INTRADAY_RECENT_STORE_REUSE_MINUTES=2
# INTRADAY_LIVE_CANDIDATE_LIMIT=12
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs: update .env.example with koyeb/neon/upstash instructions"
```

---

### Task 4: GitHub에 push

**Files:**
- 없음 (git 작업)

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: GitHub에서 확인**

브라우저에서 https://github.com/tjgksmf1012/stock_chart_helper 열고
`koyeb.yaml` 파일이 루트에 생겼는지 확인.

---

### Task 5: Neon PostgreSQL 세팅

**Files:**
- 없음 (외부 서비스 설정)

- [ ] **Step 1: Neon 가입**

https://console.neon.tech 접속 → GitHub 계정으로 가입

- [ ] **Step 2: 프로젝트 생성**

1. "New Project" 클릭
2. Name: `stock-chart-helper`
3. PostgreSQL version: 16 (기본값)
4. Region: `AWS / ap-southeast-1 (Singapore)` — 한국에서 제일 가까운 무료 리전
5. "Create project" 클릭

- [ ] **Step 3: DATABASE_URL 복사**

1. 프로젝트 대시보드 → "Connection string" 클릭
2. **반드시 "Prisma" 말고 위에 있는 "Connection string" 탭에서** 드롭다운을 `asyncpg`로 선택
3. 형식: `postgresql+asyncpg://user:password@host/dbname?sslmode=require`
4. 이 값을 메모장에 임시 저장 (Task 7에서 Koyeb에 입력)

> ⚠️ `sslmode=require` 가 URL에 포함되어야 Neon에 연결됨.

---

### Task 6: Upstash Redis 세팅

**Files:**
- 없음 (외부 서비스 설정)

- [ ] **Step 1: Upstash 가입**

https://console.upstash.com 접속 → GitHub 계정으로 가입

- [ ] **Step 2: Redis 데이터베이스 생성**

1. "Create Database" 클릭
2. Name: `stock-chart-helper`
3. Type: `Regional`
4. Region: `ap-northeast-1 (Tokyo)` — 한국에서 제일 가까운 무료 리전
5. TLS: 활성화(기본값)
6. "Create" 클릭

- [ ] **Step 3: REDIS_URL 복사**

1. 데이터베이스 상세 → "Connect" 탭
2. `rediss://` 로 시작하는 URL 복사 (TLS 포함 버전)
3. 형식: `rediss://default:<password>@<host>:<port>`
4. 메모장에 임시 저장

---

### Task 7: Koyeb 서비스 생성 및 환경변수 설정

**Files:**
- 없음 (외부 서비스 설정)

- [ ] **Step 1: Koyeb 가입**

https://app.koyeb.com 접속 → GitHub 계정으로 가입 (카드 불필요)

- [ ] **Step 2: 새 서비스 생성**

1. "Create Service" 클릭
2. "GitHub" 선택
3. `tjgksmf1012/stock_chart_helper` 레포 선택
4. Branch: `main`
5. **Build settings:**
   - Builder: `Dockerfile`
   - Dockerfile path: `backend/Dockerfile`
   - Build context: `backend`
6. **Service settings:**
   - Service name: `stock-chart-helper-api`
   - Instance: `Free` (nano)
   - Region: `Washington, D.C.` (유일한 무료 리전)
   - Port: `8000`, Protocol: `HTTP`

- [ ] **Step 3: 환경변수 입력**

"Environment variables" 섹션에서 아래 변수들을 하나씩 추가:

| KEY | VALUE |
|-----|-------|
| `DATABASE_URL` | Task 5에서 복사한 Neon URL |
| `REDIS_URL` | Task 6에서 복사한 Upstash rediss:// URL |
| `DEPLOYMENT_PLATFORM` | `koyeb` |
| `ENABLE_PLATFORM_KEEPALIVE` | `false` |
| `SECRET_KEY` | 아래 명령으로 생성한 값 |
| `ALLOWED_ORIGINS` | `*` (임시) |
| `KIS_APP_KEY` | Render에서 사용하던 값 (선택) |
| `KIS_APP_SECRET` | Render에서 사용하던 값 (선택) |

SECRET_KEY 생성 (터미널에서 실행):
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

- [ ] **Step 4: 헬스체크 설정**

"Health checks" 섹션:
- Path: `/health`
- Port: `8000`
- Protocol: `HTTP`

- [ ] **Step 5: 배포 시작**

"Deploy" 클릭 → 빌드 로그 확인 (3~5분 소요)

---

### Task 8: 배포 확인

**Files:**
- 없음 (검증)

- [ ] **Step 1: Koyeb URL 확인**

Koyeb 대시보드 → 서비스 상세 → 상단의 `https://stock-chart-helper-api-<hash>.koyeb.app` URL 복사

- [ ] **Step 2: /health 엔드포인트 테스트**

브라우저 또는 터미널:
```bash
curl https://stock-chart-helper-api-<hash>.koyeb.app/health
```
기대 응답:
```json
{"status": "ok"}
```
또는 200 OK 응답이면 성공.

- [ ] **Step 3: DB 연결 확인**

```bash
curl https://stock-chart-helper-api-<hash>.koyeb.app/api/v1/symbols
```
빈 배열 `[]` 또는 데이터가 오면 DB 연결 성공.
`500 Internal Server Error` 이면 DATABASE_URL 재확인.

- [ ] **Step 4: 15분 후 재확인 (sleep 없음 검증)**

15분 대기 후 `/health` 재호출. 즉시 200 응답이 오면 sleep 없음 확인 완료.
(Render에서는 이 시점에 50초 이상 지연이 발생했음)

---

### Task 9: Vercel 프론트엔드 백엔드 URL 업데이트

**Files:**
- 없음 (Vercel 대시보드 설정)

- [ ] **Step 1: Vercel 대시보드에서 환경변수 변경**

1. https://vercel.com/dashboard 접속
2. `stock_chart_helper` 프론트 프로젝트 선택
3. Settings → Environment Variables
4. `VITE_API_BASE_URL` (또는 유사한 키) 값을 Koyeb URL로 변경:
   `https://stock-chart-helper-api-<hash>.koyeb.app`

- [ ] **Step 2: 재배포**

Vercel 대시보드 → Deployments → "Redeploy" 클릭

- [ ] **Step 3: 프론트엔드 전체 동작 확인**

브라우저에서 Vercel 프론트 URL 열고:
- 종목 목록 로드되는지 확인
- 차트 데이터 표시되는지 확인
- 브라우저 개발자 도구 Network 탭에서 API 요청이 Koyeb URL로 가는지 확인

---

## 성공 기준 체크리스트

- [ ] `/health` → 200 OK
- [ ] `/api/v1/symbols` → 정상 응답 (DB 연결)
- [ ] Koyeb 로그에서 APScheduler 스케줄 등록 로그 확인
- [ ] 15분 유휴 후에도 즉시 응답
- [ ] 프론트엔드 → Koyeb API 정상 호출

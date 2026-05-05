# stock_chart_helper 백엔드 배포 마이그레이션 설계

**날짜:** 2026-04-21  
**대상 레포:** https://github.com/tjgksmf1012/stock_chart_helper  
**목표:** Render 무료 플랜(15분 sleep) → Koyeb + Neon + Upstash (sleep 없는 무료 스택)

---

## 배경

현재 백엔드가 Render 무료 플랜에 배포되어 있어 15분간 요청이 없으면 서버가 자동으로 꺼진다.
APScheduler가 한국 장 시간(9:10, 13:30, 16:00 등)에 맞춰 스캔 작업을 실행하는 구조라,
서버가 꺼지면 스케줄 작업이 누락된다. 현재 코드에 `ENABLE_PLATFORM_KEEPALIVE` self-ping 로직이
있지만 근본적인 해결책이 아니다.

---

## 목표 아키텍처

```
GitHub (main 브랜치)
    └── push → Koyeb 자동 배포 (FastAPI 백엔드, Docker 기반)
                    ├── Neon PostgreSQL (무료, 500MB)
                    └── Upstash Redis (무료, 10k commands/day)

Vercel (프론트엔드) → 변경 없음
```

---

## 서비스 선택 근거

| 서비스 | 역할 | 이유 |
|--------|------|------|
| Koyeb | 백엔드 실행 | sleep 없음, Docker 지원, 카드 불필요, 512MB RAM |
| Neon | PostgreSQL | 무료 500MB, serverless, 카드 불필요 |
| Upstash | Redis | 무료 10k req/day, serverless Redis, 카드 불필요 |

---

## 코드 변경사항

### 신규 파일: `koyeb.yaml` (레포 루트)

Koyeb GitHub 자동 배포를 위한 설정 파일.
`backend/Dockerfile`을 빌드 소스로 지정하고, 포트 8000으로 HTTP 서비스 노출.
헬스체크 경로는 기존 `/health` 엔드포인트 재사용.

### 수정 파일: `backend/.env.example`

Koyeb 배포 환경에 필요한 환경변수 주석 추가.

### 환경변수 (Koyeb 대시보드에서 설정, 코드 변경 없음)

| 변수 | 값 |
|------|----|
| `DATABASE_URL` | Neon에서 발급한 PostgreSQL 접속 URL |
| `REDIS_URL` | Upstash에서 발급한 Redis 접속 URL (TLS) |
| `DEPLOYMENT_PLATFORM` | `koyeb` |
| `ENABLE_PLATFORM_KEEPALIVE` | `false` (Koyeb은 sleep 없으므로 불필요) |
| `SECRET_KEY` | 32자 이상 랜덤 문자열 |
| `ALLOWED_ORIGINS` | Vercel 프론트엔드 URL |

---

## 데이터 플로우

1. 사용자 요청 → Vercel 프론트 → Koyeb 백엔드 API
2. 백엔드 → Neon PostgreSQL (종목 데이터, 패턴 결과, 관심종목)
3. 백엔드 → Upstash Redis (차트 캐시, 스크리너 캐시)
4. Redis 연결 실패 시 → 기존 인메모리 fallback 자동 동작 (코드 변경 불필요)

---

## 주의사항

- **Neon 연결 문자열**: asyncpg 드라이버 사용 중이므로 `postgresql+asyncpg://...` 형식 필요.
  Neon 대시보드에서 "asyncpg" 옵션으로 복사할 것.
- **Upstash Redis TLS**: Upstash는 TLS 필수. `rediss://` 프로토콜 사용.
  기존 `redis.py`의 aioredis 클라이언트가 `rediss://` 지원하므로 변경 불필요.
- **DB 마이그레이션**: 현재 `init_db()`가 startup 시 테이블을 자동 생성하므로
  Neon DB에 첫 배포 시 자동으로 스키마가 만들어짐.
- **기존 Render 데이터**: 기존 PostgreSQL에 데이터가 있다면 pg_dump로 Neon에 이전 필요.
  없으면(주식 데이터는 실시간 조회) 그냥 새로 시작하면 됨.

---

## 진행 순서

1. Neon 가입 및 PostgreSQL DB 생성 → `DATABASE_URL` 확보
2. Upstash 가입 및 Redis DB 생성 → `REDIS_URL` 확보
3. `koyeb.yaml` 작성 후 main 브랜치에 push
4. `backend/.env.example` 업데이트 후 push
5. Koyeb 가입 → GitHub 레포 연결 → 환경변수 설정 → 배포
6. `/health` 엔드포인트로 정상 동작 확인
7. Vercel 프론트 환경변수에서 백엔드 URL을 Koyeb URL로 업데이트

---

## 성공 기준

- `/health` 응답 200 OK
- APScheduler 로그에서 스케줄 등록 확인
- 프론트엔드에서 API 정상 호출 확인
- 15분 이상 유휴 후에도 서버 활성 상태 유지

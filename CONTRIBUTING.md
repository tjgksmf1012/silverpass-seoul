# 기여 가이드

실버패스 서울 Care에 관심 가져주셔서 감사합니다. 이 문서는 로컬 개발 환경 설정과 기여 절차를 안내합니다.

## 개발 환경 설정

```bash
git clone https://github.com/tjgksmf1012/silverpass-seoul.git
cd silverpass-seoul
npm install
cp .env.example .env   # 필요한 API 키 입력 (README 참고)
npm run dev
```

API 키가 없어도 대부분의 화면은 각 서비스 모듈의 폴백(mock) 데이터로 동작합니다. 실제 API 연동을 확인하려면 `.env`에 해당 키를 채워주세요.

## 커밋 전 확인

```bash
npm test    # vitest 단위 테스트
npm run build   # 프로덕션 빌드 확인
```

## 이슈 / PR 절차

1. 버그 리포트나 기능 제안은 먼저 [Issues](https://github.com/tjgksmf1012/silverpass-seoul/issues)에 등록해 주세요.
2. 저장소를 fork하거나 브랜치를 생성해 작업합니다. 브랜치명은 `feat/...`, `fix/...`처럼 목적이 드러나게 지어주세요.
3. 커밋 메시지는 `feat:`, `fix:`, `refactor:`, `chore:`, `docs:` 접두사를 사용합니다 (기존 커밋 로그 참고).
4. 테스트와 빌드가 통과하는지 확인한 뒤 PR을 올려주세요. 변경 이유와 테스트 방법을 PR 설명에 적어주시면 리뷰가 빨라집니다.

## 코드 스타일

- 컴포넌트는 `src/pages`, 재사용 UI는 `src/components`, 외부 연동 로직은 `src/services`에 둡니다.
- 외부 AI/공공데이터 API를 새로 연동할 때는 `src/services/claude.js`처럼 실패 시 규칙 기반 폴백을 두어 서비스가 끊기지 않도록 해주세요.
- 서버 전용 비밀키(API 키 등)는 `api/` 아래 서버리스 함수에서만 사용하고, 클라이언트 번들에 노출하지 않습니다.

## 라이선스

이 프로젝트에 기여하면 해당 기여물이 프로젝트의 [MIT License](./LICENSE)로 배포되는 데 동의하는 것으로 간주합니다.

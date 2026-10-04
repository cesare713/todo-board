# 할 일 보드

일일 / 주간 / 1년 목표를 칸반 보드(todo · doing · done)로 관리하는 웹 앱. GitHub 계정으로 로그인해 본인 할 일만 관리합니다.

- 요구 사항: `docs/PRD.md`
- 구현 계획: `docs/PLAN.md`
- 로그인 요구 사항: `docs/LOGIN.md`
- **GitHub OAuth 설정 가이드: `docs/GITHUB_OAUTH.md`**

## 실행
```bash
cp .env.example .env   # GitHub OAuth 값 입력 (docs/GITHUB_OAUTH.md)
npm install
npm run dev            # API 서버(3000) + 화면(5173)
```
- Node.js 22.13 이상 필요 (내장 SQLite 사용)
- 브라우저: http://localhost:5173

| 명령 | 설명 |
|---|---|
| `npm run dev` | API 서버 + Vite 개발 서버 동시 실행 |
| `npm run dev:server` / `npm run dev:web` | 각각 따로 실행 |
| `npm test` | 화면 로직 테스트(Vitest) + 서버 테스트(node:test) |
| `npm run build` → `npm start` | 배포 빌드 후 3000 포트에서 화면·API 함께 제공 |

## 사용법
- `GitHub로 로그인` → 로그인 후 보드 표시 (비로그인 시 보드·API 접근 불가)
- `+ 할 일 추가`: 제목(필수), 설명, 기간 유형·날짜 → 상태 `todo`로 생성
- 카드를 다른 컬럼으로 드래그 → 상태 변경 후 즉시 저장
- 카드의 `수정` 버튼 또는 카드 클릭 → 수정 / `삭제` 버튼 또는 수정 창의 `삭제` → 확인 후 삭제
- 키보드: 카드에 포커스 후 `←` `→` 상태 이동, `Enter` 수정, `Delete` 삭제
- 상단 탭으로 일일 / 주간 / 1년 전환, `‹` `›`로 이전·다음 기간 이동
- 오른쪽 위 `로그아웃` → 서버 세션 삭제

## 데이터
- 서버 SQLite DB `data/todo.db` (`users`, `sessions`, `tasks.user_id`)
- 로그인 전 브라우저에 저장했던 할 일은 로그인 후 `내 계정으로 가져오기`로 이동
- 주간 기간 값은 해당 주 월요일로 저장

## 구조
```
server/        API 서버 (node:http + node:sqlite, 추가 패키지 없음)
  app.mjs        라우트 (/auth/*, /api/*)
  db.mjs         DB 연결 + 마이그레이션
  github.mjs     GitHub OAuth 호출
  test/          서버 테스트 (GitHub 응답은 모의)
src/           화면 (React)
  Root.tsx       로그인 상태 확인 → 로그인 화면 / 보드
  repository/    저장소 (apiTaskRepository: 서버, localTaskRepository: 기존 로컬)
```

## 알려진 제한
- 드래그 앤 드롭은 HTML5 방식이라 모바일 터치 드래그 미지원 (수정 창의 상태 선택으로 변경 가능)
- 같은 컬럼 안 순서 변경은 P1 범위

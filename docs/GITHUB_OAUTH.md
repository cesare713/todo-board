# GitHub OAuth 설정 가이드

## 1. GitHub OAuth App 만들기
1. GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**
   - 바로가기: https://github.com/settings/developers
2. 입력값 (개발용)
   | 항목 | 값 |
   |---|---|
   | Application name | 할 일 보드 (자유) |
   | Homepage URL | `http://localhost:5173` |
   | Authorization callback URL | `http://localhost:5173/auth/github/callback` |
3. **Register application** → `Client ID` 확인
4. **Generate a new client secret** → `Client secret` 복사 (한 번만 보임)

## 2. `.env` 설정
프로젝트 루트에서 `.env.example`을 `.env`로 복사하고 값을 채웁니다.
```
GITHUB_CLIENT_ID=발급받은_Client_ID
GITHUB_CLIENT_SECRET=발급받은_Client_secret
APP_URL=http://localhost:5173
```
- `CLIENT_SECRET`은 코드에 넣지 않고 `.env`로만 전달합니다. `.env`는 `.gitignore`에 포함되어 있습니다.
- 변수 이름이 위와 정확히 같아야 합니다.

## 3. 실행
```bash
npm install
npm run dev      # API 서버(3000) + 화면(5173) 동시 실행
```
브라우저에서 http://localhost:5173 → **GitHub로 로그인**

- Node.js **22.13 이상** 필요 (내장 SQLite 사용). `node -v`로 확인
- DB 파일: `data/todo.db` (첫 실행 시 자동 생성·마이그레이션)

## 4. 배포 빌드로 실행할 때
```bash
npm run build
npm start        # http://localhost:3000 에서 화면 + API 함께 제공
```
- `.env`의 `APP_URL=http://localhost:3000`으로 변경
- GitHub OAuth App의 콜백 URL도 `http://localhost:3000/auth/github/callback`으로 변경 (또는 배포용 OAuth App을 따로 생성)
- HTTPS 주소(`https://...`)를 쓰면 세션 쿠키에 `Secure`가 자동 적용됩니다.

## 5. 동작 방식
| 경로 | 설명 |
|---|---|
| `GET /auth/github` | state 생성(쿠키 보관) 후 GitHub 인증 페이지로 이동 |
| `GET /auth/github/callback` | state 검증 → code를 토큰으로 교환 → 사용자 조회 → `users`에 username·avatar_url 저장 → 세션 생성 |
| `POST /auth/logout` | DB 세션 행 삭제 + 세션 쿠키 삭제 |
| `GET /api/me` | 로그인 사용자 정보 (비로그인 401) |
| `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id` | 본인 할 일만 (비로그인 401, 남의 할 일 404) |
| `POST /api/tasks/import` | 로그인 전 브라우저에 저장한 할 일을 계정으로 가져오기 |

- GitHub 액세스 토큰은 사용자 조회에만 쓰고 저장하지 않습니다.
- 세션 토큰은 해시로만 DB에 저장합니다.
- 변경 요청은 같은 출처 + `X-Requested-With` 헤더를 확인합니다 (CSRF 방어).

## 6. DB 마이그레이션
`server/db.mjs`의 `MIGRATIONS`가 서버 시작 시 순서대로 한 번씩 적용됩니다 (`schema_migrations` 테이블에 기록).
- `001_create_tasks`: 기존 할 일 스키마
- `002_add_users_sessions_and_task_user_id`: `users`, `sessions` 생성 + `tasks.user_id` 컬럼·인덱스 추가

기존 브라우저 저장(localStorage) 데이터는 로그인 후 화면 상단의 **내 계정으로 가져오기**로 옮깁니다. 원본은 `todo-app:tasks:v1:imported` 키에 보관됩니다.

## 문제 해결
| 증상 | 확인 |
|---|---|
| 로그인 버튼 → `서버 설정 누락` | `.env`의 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| GitHub 화면에 `redirect_uri is not associated` | OAuth App 콜백 URL이 `{APP_URL}/auth/github/callback`과 정확히 같은지 |
| 로그인 후 `요청이 만료되었거나 올바르지 않습니다` | 같은 주소(localhost vs 127.0.0.1)로 접속했는지 |
| `서버에 연결할 수 없습니다` | `npm run dev`로 API 서버가 함께 실행 중인지, 3000 포트 충돌 |
| `Node.js 22.13 이상이 필요합니다` | Node 업그레이드 |

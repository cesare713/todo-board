const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'GitHub에서 로그인을 취소했습니다.',
  invalid_state: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.',
  github_error: 'GitHub 인증 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
  session_expired: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  server_unreachable: '서버에 연결할 수 없습니다. API 서버가 실행 중인지 확인해 주세요.',
}

interface Props {
  error: string | null
}

export default function LoginScreen({ error }: Props) {
  return (
    <div className="login">
      <div className="login-card">
        <h1>할 일 보드</h1>
        <p className="login-desc">일일 · 주간 · 1년 목표를 한 보드에서 관리하세요.</p>
        {error && (
          <p className="form-error" role="alert">
            {ERROR_MESSAGES[error] ?? `로그인에 실패했습니다. (${error})`}
          </p>
        )}
        {/* 서버 라우트로 이동해야 하므로 SPA 내부 이동이 아닌 일반 링크 */}
        <a className="btn btn-github" href="/auth/github">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          GitHub로 로그인
        </a>
      </div>
    </div>
  )
}

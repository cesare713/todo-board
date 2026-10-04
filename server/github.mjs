// GitHub OAuth (Authorization Code 흐름). fetch를 주입받아 테스트에서 모의 가능.
export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const GITHUB_USER_URL = 'https://api.github.com/user'

export function buildAuthorizeUrl(config, state) {
  const u = new URL(GITHUB_AUTHORIZE_URL)
  u.searchParams.set('client_id', config.githubClientId)
  u.searchParams.set('redirect_uri', config.callbackUrl)
  u.searchParams.set('scope', 'read:user')
  u.searchParams.set('state', state)
  u.searchParams.set('allow_signup', 'true')
  return u.toString()
}

export async function exchangeCodeForToken(config, code, fetchImpl = fetch) {
  const res = await fetchImpl(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: config.callbackUrl,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(`GitHub 토큰 교환 실패: ${data.error_description || data.error || res.status}`)
  }
  return data.access_token
}

export async function fetchGithubUser(token, fetchImpl = fetch) {
  const res = await fetchImpl(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'todo-board',
    },
  })
  if (!res.ok) throw new Error(`GitHub 사용자 조회 실패: ${res.status}`)
  const u = await res.json()
  if (typeof u.id !== 'number' || typeof u.login !== 'string') throw new Error('GitHub 사용자 응답 형식 오류')
  return { githubId: u.id, username: u.login, avatarUrl: typeof u.avatar_url === 'string' ? u.avatar_url : null }
}

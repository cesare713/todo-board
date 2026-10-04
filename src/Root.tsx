import { useCallback, useEffect, useState } from 'react'
import App from './App'
import LoginScreen from './components/LoginScreen'
import { api, setUnauthorizedHandler, UnauthorizedError, type User } from './lib/api'
import { createUserTaskStore } from './store'
import type { TaskStore } from './store/taskStore'

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; error: string | null }
  | { status: 'authenticated'; user: User; taskStore: TaskStore }

/** URL의 ?login_error=... 를 읽고 주소창에서 지움 */
function takeLoginError(): string | null {
  const url = new URL(window.location.href)
  const error = url.searchParams.get('login_error')
  if (error) {
    url.searchParams.delete('login_error')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
  return error
}

// StrictMode에서 effect가 두 번 실행돼도 오류 메시지를 잃지 않도록 모듈 로드 시 한 번만 읽음
const initialLoginError = typeof window !== 'undefined' ? takeLoginError() : null

export default function Root() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    const loginError = initialLoginError
    let cancelled = false
    setUnauthorizedHandler(() => setAuth({ status: 'anonymous', error: 'session_expired' }))

    ;(async () => {
      try {
        const user = await api.me()
        const tasks = await api.listTasks()
        if (!cancelled) setAuth({ status: 'authenticated', user, taskStore: createUserTaskStore(tasks) })
      } catch (e) {
        if (cancelled) return
        const error = e instanceof UnauthorizedError ? loginError : 'server_unreachable'
        setAuth({ status: 'anonymous', error })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // 서버 세션이 이미 없어도 화면은 로그아웃 상태로
    }
    setAuth({ status: 'anonymous', error: null })
  }, [])

  if (auth.status === 'loading') return <div className="splash" aria-busy="true" />
  if (auth.status === 'anonymous') return <LoginScreen error={auth.error} />
  return <App key={auth.user.id} user={auth.user} taskStore={auth.taskStore} onLogout={logout} />
}

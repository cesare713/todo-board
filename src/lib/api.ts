import type { Task } from '../domain/task'

export interface User {
  id: number
  username: string
  avatar_url: string | null
}

export class UnauthorizedError extends Error {
  constructor() {
    super('로그인이 필요합니다.')
    this.name = 'UnauthorizedError'
  }
}

type Handler = () => void
let onUnauthorized: Handler = () => {}

/** 세션 만료 등으로 401을 받았을 때 호출할 함수 등록 */
export function setUnauthorizedHandler(fn: Handler) {
  onUnauthorized = fn
}

export async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'fetch',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (res.status === 401) {
    onUnauthorized()
    throw new UnauthorizedError()
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`)
  return data as T
}

export const api = {
  me: () => request<{ user: User }>('/api/me').then((r) => r.user),
  listTasks: () => request<{ tasks: Task[] }>('/api/tasks').then((r) => r.tasks),
  createTask: (task: Task) => request<void>('/api/tasks', { method: 'POST', body: task }).then(() => {}),
  updateTask: (task: Task) =>
    request<void>(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'PUT', body: task }).then(() => {}),
  deleteTask: (id: string) => request<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  importTasks: (tasks: Task[]) =>
    request<{ imported: number; skipped: number }>('/api/tasks/import', { method: 'POST', body: { tasks } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

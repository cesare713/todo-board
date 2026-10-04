import type { Task } from '../domain/task'
import { LocalTaskRepository, STORAGE_KEY, resolveBrowserStorage } from '../repository/localTaskRepository'

/** 로그인 전(브라우저 저장)에 쓰던 할 일을 계정으로 옮기기 위한 도우미 */
const IMPORTED_KEY = 'todo-app:tasks:v1:imported'
const DISMISSED_KEY = 'todo-app:import-dismissed'

export function readLocalTasks(): Task[] {
  try {
    const { storage, persistent } = resolveBrowserStorage()
    if (!persistent || storage.getItem(DISMISSED_KEY)) return []
    return new LocalTaskRepository(storage).list()
  } catch {
    return []
  }
}

/** 가져오기 완료: 원본은 별도 키로 보관하고 목록 키는 비움 */
export function markLocalImported() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) localStorage.setItem(IMPORTED_KEY, raw)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 무시
  }
}

export function dismissLocalImport() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // 무시
  }
}

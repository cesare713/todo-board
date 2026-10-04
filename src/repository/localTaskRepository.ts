import { isTask, type Task } from '../domain/task'
import { CorruptedStorageError, StorageWriteError, type TaskRepository } from './taskRepository'

export const STORAGE_KEY = 'todo-app:tasks:v1'
export const BACKUP_KEY = 'todo-app:tasks:backup'

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  }
}

/** localStorage를 쓸 수 없으면(차단·사생활 보호 모드 등) 메모리 저장소로 대체 */
export function resolveBrowserStorage(): { storage: KeyValueStorage; persistent: boolean } {
  try {
    const ls = globalThis.localStorage
    const probe = '__todo-app-probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return { storage: ls, persistent: true }
  } catch {
    return { storage: createMemoryStorage(), persistent: false }
  }
}

export class LocalTaskRepository implements TaskRepository {
  private corrupted = false

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly persistent = true,
  ) {}

  list(): Task[] {
    const raw = this.storage.getItem(STORAGE_KEY)
    if (raw === null) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every(isTask)) {
        this.corrupted = false
        return parsed
      }
    } catch {
      // 아래에서 손상 처리
    }
    this.markCorrupted(raw)
    return []
  }

  create(task: Task): void {
    this.write([...this.readForWrite(), task])
  }

  update(task: Task): void {
    const tasks = this.readForWrite()
    if (!tasks.some((t) => t.id === task.id)) throw new Error('수정할 할 일을 찾을 수 없습니다.')
    this.write(tasks.map((t) => (t.id === task.id ? task : t)))
  }

  delete(id: string): void {
    this.write(this.readForWrite().filter((t) => t.id !== id))
  }

  isCorrupted(): boolean {
    return this.corrupted
  }

  getBackup(): string | null {
    return this.storage.getItem(BACKUP_KEY)
  }

  resetCorrupted(): void {
    this.storage.removeItem(STORAGE_KEY)
    this.corrupted = false
  }

  isPersistent(): boolean {
    return this.persistent
  }

  private markCorrupted(raw: string) {
    this.corrupted = true
    console.warn('[todo-app] 저장 데이터가 손상되어 원본을 백업했습니다:', BACKUP_KEY)
    try {
      this.storage.setItem(BACKUP_KEY, raw)
    } catch {
      // 백업 실패 시에도 원본 키는 덮어쓰지 않으므로 데이터는 그대로 남음
    }
  }

  private readForWrite(): Task[] {
    if (this.corrupted) throw new CorruptedStorageError()
    const tasks = this.list()
    if (this.corrupted) throw new CorruptedStorageError()
    return tasks
  }

  private write(tasks: Task[]) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch (e) {
      throw new StorageWriteError(e)
    }
  }
}

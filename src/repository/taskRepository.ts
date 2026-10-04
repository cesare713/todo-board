import type { Task } from '../domain/task'

export interface TaskRepository {
  /** 저장된 전체 할 일. 데이터가 손상되었으면 빈 목록을 반환하고 isCorrupted()가 true가 됨 */
  list(): Task[]
  /** 서버 저장소는 Promise를 반환 (실패 시 reject → store가 롤백) */
  create(task: Task): void | Promise<void>
  update(task: Task): void | Promise<void>
  delete(id: string): void | Promise<void>
  /** 서버 저장소: 최신 목록 다시 불러오기 (비동기 롤백 시 사용) */
  refresh?(): Promise<Task[]>

  /** 저장 데이터 손상 여부. true인 동안 쓰기는 CorruptedStorageError로 차단됨 */
  isCorrupted(): boolean
  /** 손상 시 보관해 둔 원본 문자열 */
  getBackup(): string | null
  /** 백업은 그대로 두고 저장 데이터를 비운 뒤 쓰기를 다시 허용 */
  resetCorrupted(): void
  /** 브라우저를 닫아도 데이터가 유지되는지 (localStorage 사용 가능 여부) */
  isPersistent(): boolean
}

export class CorruptedStorageError extends Error {
  constructor() {
    super('저장된 데이터가 손상되어 저장을 막았습니다. 백업을 내려받거나 초기화해 주세요.')
    this.name = 'CorruptedStorageError'
  }
}

export class StorageWriteError extends Error {
  constructor(cause?: unknown) {
    super('저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.')
    this.name = 'StorageWriteError'
    this.cause = cause
  }
}

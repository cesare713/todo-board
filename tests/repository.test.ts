import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../src/domain/task'
import {
  BACKUP_KEY,
  LocalTaskRepository,
  STORAGE_KEY,
  createMemoryStorage,
  type KeyValueStorage,
} from '../src/repository/localTaskRepository'
import { CorruptedStorageError, StorageWriteError } from '../src/repository/taskRepository'

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `할 일 ${id}`,
  description: '',
  status: 'todo',
  period_type: 'daily',
  period_value: '2026-10-04',
  order: 0,
  created_at: '2026-10-04T00:00:00.000Z',
  updated_at: '2026-10-04T00:00:00.000Z',
  ...extra,
})

let storage: KeyValueStorage
let repo: LocalTaskRepository

beforeEach(() => {
  storage = createMemoryStorage()
  repo = new LocalTaskRepository(storage)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('CRUD', () => {
  it('비어 있으면 빈 목록', () => {
    expect(repo.list()).toEqual([])
  })
  it('생성 / 수정 / 삭제', () => {
    repo.create(task('a'))
    repo.create(task('b'))
    expect(repo.list().map((t) => t.id)).toEqual(['a', 'b'])

    repo.update(task('a', { status: 'done' }))
    expect(repo.list().find((t) => t.id === 'a')?.status).toBe('done')

    repo.delete('a')
    expect(repo.list().map((t) => t.id)).toEqual(['b'])
  })
  it('새 인스턴스에서도 유지 (새로고침)', () => {
    repo.create(task('a'))
    expect(new LocalTaskRepository(storage).list()).toHaveLength(1)
  })
})

describe('손상 데이터 보호', () => {
  it('JSON 손상: 빈 목록 + 원본 백업 + 쓰기 차단', () => {
    storage.setItem(STORAGE_KEY, '{not json')
    expect(repo.list()).toEqual([])
    expect(repo.isCorrupted()).toBe(true)
    expect(storage.getItem(BACKUP_KEY)).toBe('{not json')

    expect(() => repo.create(task('a'))).toThrow(CorruptedStorageError)
    // 원본은 덮어써지지 않음
    expect(storage.getItem(STORAGE_KEY)).toBe('{not json')
  })
  it('형태가 잘못된 데이터도 손상으로 처리', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify([{ id: 1 }]))
    expect(repo.list()).toEqual([])
    expect(repo.isCorrupted()).toBe(true)
  })
  it('초기화하면 백업은 남기고 다시 쓸 수 있음', () => {
    storage.setItem(STORAGE_KEY, 'broken')
    repo.list()
    repo.resetCorrupted()
    repo.create(task('a'))
    expect(repo.list()).toHaveLength(1)
    expect(repo.getBackup()).toBe('broken')
  })
})

describe('쓰기 실패', () => {
  it('용량 초과 등은 StorageWriteError', () => {
    const failing: KeyValueStorage = {
      ...createMemoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => new LocalTaskRepository(failing).create(task('a'))).toThrow(StorageWriteError)
  })
})

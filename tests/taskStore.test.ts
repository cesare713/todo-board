import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LocalTaskRepository,
  STORAGE_KEY,
  createMemoryStorage,
  type KeyValueStorage,
} from '../src/repository/localTaskRepository'
import { createTaskStore, selectColumn, type TaskStore } from '../src/store/taskStore'

const NOW = () => new Date(2026, 9, 4, 12, 0, 0)

let storage: KeyValueStorage
let repo: LocalTaskRepository
let ts: TaskStore

beforeEach(() => {
  storage = createMemoryStorage()
  repo = new LocalTaskRepository(storage)
  ts = createTaskStore(repo, NOW)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const add = (title: string, period_type: 'daily' | 'weekly' | 'yearly' = 'daily', period_value = '2026-10-04') => {
  const r = ts.actions.create({ title, period_type, period_value })
  if (!r.ok || !r.task) throw new Error('create failed')
  return r.task
}
const col = (status: 'todo' | 'doing' | 'done') =>
  selectColumn(ts.store.getState().tasks, 'daily', '2026-10-04', status).map((t) => t.title)

describe('생성', () => {
  it('기본 상태 todo, 컬럼 맨 뒤 order', () => {
    const a = add('A')
    const b = add('B')
    expect(a.status).toBe('todo')
    expect(b.order).toBeGreaterThan(a.order)
    expect(col('todo')).toEqual(['A', 'B'])
  })
  it('제목 검증', () => {
    expect(ts.actions.create({ title: '  ', period_type: 'daily', period_value: '2026-10-04' }).ok).toBe(false)
    expect(ts.actions.create({ title: 'x'.repeat(101), period_type: 'daily', period_value: '2026-10-04' }).ok).toBe(false)
    expect(ts.store.getState().tasks).toHaveLength(0)
  })
  it('주간 기간 값은 월요일로 정규화', () => {
    expect(add('W', 'weekly', '2026-10-08').period_value).toBe('2026-10-05')
  })
  it('잘못된 기간 값은 거부', () => {
    expect(ts.actions.create({ title: 'X', period_type: 'daily', period_value: '2026-02-30' }).ok).toBe(false)
  })
})

describe('상태 이동 (드래그 앤 드롭)', () => {
  it('대상 컬럼 맨 뒤로 배치', () => {
    const a = add('A')
    const b = add('B')
    const c = add('C')
    ts.actions.move(b.id, 'doing')
    ts.actions.move(a.id, 'doing')
    expect(col('todo')).toEqual(['C'])
    expect(col('doing')).toEqual(['B', 'A'])
    ts.actions.move(c.id, 'done')
    expect(col('done')).toEqual(['C'])
  })
  it('즉시 저장되어 새로고침 후에도 유지', () => {
    const a = add('A')
    ts.actions.move(a.id, 'done')
    const reloaded = createTaskStore(new LocalTaskRepository(storage), NOW)
    expect(reloaded.store.getState().tasks[0].status).toBe('done')
  })
  it('저장 실패 시 롤백 + 오류 메시지', () => {
    const a = add('A')
    const spy = vi.spyOn(repo, 'update').mockImplementation(() => {
      throw new Error('저장 실패')
    })
    const r = ts.actions.move(a.id, 'done')
    expect(r.ok).toBe(false)
    expect(col('todo')).toEqual(['A'])
    expect(col('done')).toEqual([])
    expect(ts.store.getState().error).toBe('저장 실패')
    spy.mockRestore()
  })
})

describe('수정 / 삭제', () => {
  it('수정 시 updated_at 갱신, 기간 변경 시 정규화', () => {
    const a = add('A')
    const later = createTaskStore(new LocalTaskRepository(storage), () => new Date(2026, 9, 5))
    const r = later.actions.update(a.id, { title: 'A2', period_type: 'weekly', period_value: '2026-10-07' })
    expect(r.ok && r.task?.title).toBe('A2')
    expect(r.ok && r.task?.period_value).toBe('2026-10-05')
    expect(r.ok && r.task?.updated_at).not.toBe(a.updated_at)
  })
  it('삭제', () => {
    const a = add('A')
    add('B')
    ts.actions.remove(a.id)
    expect(col('todo')).toEqual(['B'])
  })
})

describe('손상 데이터', () => {
  it('손상 상태에서는 저장을 막고 롤백, 초기화 후 정상 동작', () => {
    storage.setItem(STORAGE_KEY, 'broken')
    const s = createTaskStore(new LocalTaskRepository(storage), NOW)
    expect(s.store.getState().corrupted).toBe(true)
    expect(s.actions.create({ title: 'A', period_type: 'daily', period_value: '2026-10-04' }).ok).toBe(false)
    expect(s.store.getState().tasks).toHaveLength(0)
    expect(storage.getItem(STORAGE_KEY)).toBe('broken')

    s.actions.resetCorrupted()
    expect(s.store.getState().corrupted).toBe(false)
    expect(s.actions.create({ title: 'A', period_type: 'daily', period_value: '2026-10-04' }).ok).toBe(true)
    expect(s.actions.getBackup()).toBe('broken')
  })
})

import { normalizePeriodValue } from '../domain/period'
import { newId, validateTitle, type PeriodType, type Status, type Task } from '../domain/task'
import { createStore, type Store } from '../lib/createStore'
import type { TaskRepository } from '../repository/taskRepository'

export interface TaskState {
  tasks: Task[]
  error: string | null
  corrupted: boolean
  persistent: boolean
}

export interface TaskInput {
  title: string
  description?: string
  period_type: PeriodType
  period_value: string
}

export interface TaskPatch {
  title?: string
  description?: string
  status?: Status
  period_type?: PeriodType
  period_value?: string
}

export type ActionResult = { ok: true; task?: Task } | { ok: false; error: string }

const sameColumn = (a: Pick<Task, 'status' | 'period_type' | 'period_value'>, b: Task) =>
  a.status === b.status && a.period_type === b.period_type && a.period_value === b.period_value

/** 대상 컬럼(같은 기간·같은 상태)의 마지막 order + 1 */
export function nextOrder(
  tasks: Task[],
  column: Pick<Task, 'status' | 'period_type' | 'period_value'>,
  excludeId?: string,
): number {
  let max = -1
  for (const t of tasks) {
    if (t.id !== excludeId && sameColumn(column, t) && t.order > max) max = t.order
  }
  return max + 1
}

/** 선택한 기간·상태의 할 일을 order 오름차순으로 반환 */
export function selectColumn(
  tasks: Task[],
  period_type: PeriodType,
  period_value: string,
  status: Status,
): Task[] {
  return tasks
    .filter((t) => sameColumn({ status, period_type, period_value }, t))
    .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at))
}

export function createTaskStore(repo: TaskRepository, now: () => Date = () => new Date()) {
  const loaded = repo.list()
  const store: Store<TaskState> = createStore<TaskState>({
    tasks: loaded,
    error: null,
    corrupted: repo.isCorrupted(),
    persistent: repo.isPersistent(),
  })

  /** 낙관적 업데이트: 화면 먼저 반영 → 저장 실패 시 이전 상태로 롤백 (동기·비동기 저장소 모두 지원) */
  function commit(nextTasks: Task[], persist: () => void | Promise<void>): ActionResult {
    const prev = store.getState().tasks
    store.setState((s) => ({ ...s, tasks: nextTasks, error: null }))

    const rollback = (e: unknown) => {
      const error = e instanceof Error ? e.message : '저장에 실패했습니다.'
      if (store.getState().tasks === nextTasks) {
        store.setState((s) => ({ ...s, tasks: prev, error, corrupted: repo.isCorrupted() }))
      } else {
        // 그사이 다른 변경이 있었으면 서버 기준으로 다시 맞춤
        store.setState((s) => ({ ...s, error }))
        repo.refresh?.().then(
          (tasks) => store.setState((s) => ({ ...s, tasks })),
          () => {},
        )
      }
      return error
    }

    try {
      const pending = persist()
      if (pending instanceof Promise) pending.catch(rollback)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: rollback(e) }
    }
  }

  /** 서버에서 목록을 다시 받아 교체 (가져오기 후 등) */
  async function reload(): Promise<void> {
    if (!repo.refresh) return
    const tasks = await repo.refresh()
    store.setState((s) => ({ ...s, tasks }))
  }

  const fail = (error: string): ActionResult => {
    store.setState((s) => ({ ...s, error }))
    return { ok: false, error }
  }

  const actions = {
    create(input: TaskInput): ActionResult {
      const titleError = validateTitle(input.title)
      if (titleError) return fail(titleError)
      const period_value = normalizePeriodValue(input.period_type, input.period_value)
      if (!period_value) return fail('기간 값이 올바르지 않습니다.')

      const { tasks } = store.getState()
      const ts = now().toISOString()
      const task: Task = {
        id: newId(),
        title: input.title.trim(),
        description: (input.description ?? '').trim(),
        status: 'todo',
        period_type: input.period_type,
        period_value,
        order: nextOrder(tasks, { status: 'todo', period_type: input.period_type, period_value }),
        created_at: ts,
        updated_at: ts,
      }
      const result = commit([...tasks, task], () => repo.create(task))
      return result.ok ? { ok: true, task } : result
    },

    update(id: string, patch: TaskPatch): ActionResult {
      const { tasks } = store.getState()
      const current = tasks.find((t) => t.id === id)
      if (!current) return fail('할 일을 찾을 수 없습니다.')

      const next: Task = { ...current }
      if (patch.title !== undefined) {
        const titleError = validateTitle(patch.title)
        if (titleError) return fail(titleError)
        next.title = patch.title.trim()
      }
      if (patch.description !== undefined) next.description = patch.description.trim()
      if (patch.status !== undefined) next.status = patch.status
      if (patch.period_type !== undefined) next.period_type = patch.period_type
      if (patch.period_value !== undefined || patch.period_type !== undefined) {
        const v = normalizePeriodValue(next.period_type, patch.period_value ?? next.period_value)
        if (!v) return fail('기간 값이 올바르지 않습니다.')
        next.period_value = v
      }
      // 컬럼(기간·상태)이 바뀌면 대상 컬럼의 맨 뒤로 배치
      if (!sameColumn(current, next)) next.order = nextOrder(tasks, next, id)
      next.updated_at = now().toISOString()

      const result = commit(
        tasks.map((t) => (t.id === id ? next : t)),
        () => repo.update(next),
      )
      return result.ok ? { ok: true, task: next } : result
    },

    /** 드래그 앤 드롭: 상태만 변경, 대상 컬럼 맨 뒤로 */
    move(id: string, status: Status): ActionResult {
      const current = store.getState().tasks.find((t) => t.id === id)
      if (!current) return fail('할 일을 찾을 수 없습니다.')
      if (current.status === status) return { ok: true, task: current }
      return actions.update(id, { status })
    },

    remove(id: string): ActionResult {
      const { tasks } = store.getState()
      if (!tasks.some((t) => t.id === id)) return fail('할 일을 찾을 수 없습니다.')
      return commit(
        tasks.filter((t) => t.id !== id),
        () => repo.delete(id),
      )
    },

    reload,

    clearError() {
      store.setState((s) => (s.error ? { ...s, error: null } : s))
    },

    getBackup(): string | null {
      return repo.getBackup()
    },

    /** 손상 데이터 초기화 (백업은 유지) */
    resetCorrupted() {
      repo.resetCorrupted()
      store.setState((s) => ({ ...s, tasks: repo.list(), corrupted: repo.isCorrupted(), error: null }))
    },
  }

  return { store, actions }
}

export type TaskStore = ReturnType<typeof createTaskStore>

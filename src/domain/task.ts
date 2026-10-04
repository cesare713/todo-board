export type Status = 'todo' | 'doing' | 'done'
export type PeriodType = 'daily' | 'weekly' | 'yearly'

export const STATUSES: readonly Status[] = ['todo', 'doing', 'done']
export const PERIOD_TYPES: readonly PeriodType[] = ['daily', 'weekly', 'yearly']

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Todo',
  doing: 'Doing',
  done: 'Done',
}

export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  daily: '일일',
  weekly: '주간',
  yearly: '1년 목표',
}

export const TITLE_MAX = 100

export interface Task {
  id: string
  title: string
  description: string
  status: Status
  period_type: PeriodType
  period_value: string
  order: number
  created_at: string
  updated_at: string
}

/** 제목 검증. 문제가 없으면 null, 있으면 오류 메시지 */
export function validateTitle(title: string): string | null {
  const t = title.trim()
  if (t.length === 0) return '제목을 입력해 주세요.'
  if (t.length > TITLE_MAX) return `제목은 ${TITLE_MAX}자 이하로 입력해 주세요.`
  return null
}

export function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v)
}

export function isPeriodType(v: unknown): v is PeriodType {
  return typeof v === 'string' && (PERIOD_TYPES as readonly string[]).includes(v)
}

/** 저장소에서 읽은 값이 Task 형태인지 검사 */
export function isTask(v: unknown): v is Task {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.description === 'string' &&
    isStatus(o.status) &&
    isPeriodType(o.period_type) &&
    typeof o.period_value === 'string' &&
    typeof o.order === 'number' &&
    typeof o.created_at === 'string' &&
    typeof o.updated_at === 'string'
  )
}

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // http://<내부 IP> 등 보안 컨텍스트가 아니면 randomUUID가 없음
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

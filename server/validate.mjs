// 서버 측 입력 검증 (src/domain 규칙과 동일)
const STATUSES = ['todo', 'doing', 'done']
const PERIOD_TYPES = ['daily', 'weekly', 'yearly']
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function validDate(s) {
  const m = DATE_RE.exec(s)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null
}

function validPeriodValue(type, v) {
  if (typeof v !== 'string') return false
  if (type === 'yearly') return /^\d{4}$/.test(v)
  const d = validDate(v)
  if (!d) return false
  return type === 'daily' || d.getUTCDay() === 1 // 주간은 월요일
}

/** 문제가 없으면 정리된 task, 있으면 { error } */
export function validateTask(input) {
  if (typeof input !== 'object' || input === null) return { error: '잘못된 요청입니다.' }
  const t = input
  const title = typeof t.title === 'string' ? t.title.trim() : ''
  if (typeof t.id !== 'string' || !t.id || t.id.length > 100) return { error: 'id가 올바르지 않습니다.' }
  if (title.length < 1 || title.length > 100) return { error: '제목은 1~100자여야 합니다.' }
  if (t.description !== undefined && typeof t.description !== 'string') return { error: '설명이 올바르지 않습니다.' }
  if ((t.description ?? '').length > 5000) return { error: '설명이 너무 깁니다.' }
  if (!STATUSES.includes(t.status)) return { error: '상태 값이 올바르지 않습니다.' }
  if (!PERIOD_TYPES.includes(t.period_type)) return { error: '기간 유형이 올바르지 않습니다.' }
  if (!validPeriodValue(t.period_type, t.period_value)) return { error: '기간 값이 올바르지 않습니다.' }
  if (typeof t.order !== 'number' || !Number.isFinite(t.order)) return { error: 'order가 올바르지 않습니다.' }
  if (typeof t.created_at !== 'string' || typeof t.updated_at !== 'string') return { error: '시각 값이 올바르지 않습니다.' }
  return {
    task: {
      id: t.id,
      title,
      description: t.description ?? '',
      status: t.status,
      period_type: t.period_type,
      period_value: t.period_value,
      order: t.order,
      created_at: t.created_at,
      updated_at: t.updated_at,
    },
  }
}

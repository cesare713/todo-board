import type { PeriodType } from './task'

/*
 * 기간 값 규칙 (사용자 로컬 시간대 기준)
 * - daily  : YYYY-MM-DD
 * - weekly : 해당 주 월요일 YYYY-MM-DD
 * - yearly : YYYY
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const YEAR_RE = /^(\d{4})$/
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → 로컬 Date. 존재하지 않는 날짜(2026-02-30 등)는 null */
export function parseDateStr(s: string): Date | null {
  const m = DATE_RE.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

export function startOfWeekMonday(d: Date): Date {
  const diff = (d.getDay() + 6) % 7 // 월=0 … 일=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
}

export function currentPeriodValue(type: PeriodType, now: Date = new Date()): string {
  switch (type) {
    case 'daily':
      return toDateStr(now)
    case 'weekly':
      return toDateStr(startOfWeekMonday(now))
    case 'yearly':
      return String(now.getFullYear())
  }
}

/**
 * 입력값을 기간 유형 규칙에 맞게 정규화. 해석할 수 없으면 null.
 * - weekly: 아무 날짜나 받아 그 주 월요일로 변환
 * - yearly: 'YYYY' 또는 'YYYY-MM-DD'를 받아 연도로 변환
 */
export function normalizePeriodValue(type: PeriodType, value: string): string | null {
  const v = value.trim()
  if (type === 'yearly') {
    const y = YEAR_RE.exec(v)
    if (y) return y[1]
    const d = parseDateStr(v)
    return d ? String(d.getFullYear()) : null
  }
  const d = parseDateStr(v)
  if (!d) return null
  return type === 'daily' ? toDateStr(d) : toDateStr(startOfWeekMonday(d))
}

/** 이전/다음 기간 값. delta = -1(이전), +1(다음) */
export function shiftPeriod(type: PeriodType, value: string, delta: number): string {
  if (type === 'yearly') {
    const y = Number(normalizePeriodValue('yearly', value) ?? new Date().getFullYear())
    return String(y + delta)
  }
  const base = parseDateStr(normalizePeriodValue(type, value) ?? currentPeriodValue(type))
  if (!base) return currentPeriodValue(type)
  const days = type === 'daily' ? delta : delta * 7
  return toDateStr(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days))
}

export function formatPeriodLabel(type: PeriodType, value: string): string {
  if (type === 'yearly') return `${value}년`
  const d = parseDateStr(value)
  if (!d) return value
  if (type === 'daily') {
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
  }
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ~ ${end.getFullYear() !== d.getFullYear() ? `${end.getFullYear()}.` : ''}${pad(end.getMonth() + 1)}.${pad(end.getDate())}`
}

export function isCurrentPeriod(type: PeriodType, value: string, now: Date = new Date()): boolean {
  return currentPeriodValue(type, now) === value
}

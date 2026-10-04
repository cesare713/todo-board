import { describe, expect, it } from 'vitest'
import {
  currentPeriodValue,
  formatPeriodLabel,
  normalizePeriodValue,
  parseDateStr,
  shiftPeriod,
} from '../src/domain/period'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('currentPeriodValue', () => {
  it('일일: 오늘 날짜', () => {
    expect(currentPeriodValue('daily', d(2026, 10, 4))).toBe('2026-10-04')
  })
  it('주간: 그 주 월요일 (일요일은 앞 주 월요일)', () => {
    expect(currentPeriodValue('weekly', d(2026, 10, 4))).toBe('2026-09-28')
    expect(currentPeriodValue('weekly', d(2026, 10, 5))).toBe('2026-10-05')
  })
  it('주간: 연초 주는 전년도 월요일', () => {
    expect(currentPeriodValue('weekly', d(2026, 1, 1))).toBe('2025-12-29')
  })
  it('1년: 연도', () => {
    expect(currentPeriodValue('yearly', d(2026, 10, 4))).toBe('2026')
  })
})

describe('normalizePeriodValue', () => {
  it('주간: 임의 날짜를 월요일로 맞춤', () => {
    expect(normalizePeriodValue('weekly', '2026-10-08')).toBe('2026-10-05')
    expect(normalizePeriodValue('weekly', '2026-10-05')).toBe('2026-10-05')
  })
  it('1년: 연도 또는 날짜를 연도로', () => {
    expect(normalizePeriodValue('yearly', '2027')).toBe('2027')
    expect(normalizePeriodValue('yearly', '2027-03-01')).toBe('2027')
  })
  it('존재하지 않는 날짜·잘못된 형식은 null', () => {
    expect(normalizePeriodValue('daily', '2026-02-30')).toBeNull()
    expect(normalizePeriodValue('daily', '2026-2-3')).toBeNull()
    expect(normalizePeriodValue('weekly', '')).toBeNull()
    expect(normalizePeriodValue('yearly', '26')).toBeNull()
  })
  it('윤년 2월 29일', () => {
    expect(normalizePeriodValue('daily', '2028-02-29')).toBe('2028-02-29')
    expect(normalizePeriodValue('daily', '2027-02-29')).toBeNull()
    expect(parseDateStr('2028-02-29')).not.toBeNull()
  })
})

describe('shiftPeriod', () => {
  it('일일: 연말 → 연초', () => {
    expect(shiftPeriod('daily', '2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftPeriod('daily', '2027-01-01', -1)).toBe('2026-12-31')
  })
  it('일일: 윤년', () => {
    expect(shiftPeriod('daily', '2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftPeriod('daily', '2028-02-29', 1)).toBe('2028-03-01')
  })
  it('주간: 7일 단위, 연도 경계', () => {
    expect(shiftPeriod('weekly', '2025-12-29', 1)).toBe('2026-01-05')
    expect(shiftPeriod('weekly', '2026-01-05', -1)).toBe('2025-12-29')
  })
  it('1년', () => {
    expect(shiftPeriod('yearly', '2026', 1)).toBe('2027')
    expect(shiftPeriod('yearly', '2026', -1)).toBe('2025')
  })
})

describe('formatPeriodLabel', () => {
  it('표시 문자열', () => {
    expect(formatPeriodLabel('daily', '2026-10-04')).toBe('2026년 10월 4일 (일)')
    expect(formatPeriodLabel('weekly', '2026-09-28')).toBe('2026.09.28 ~ 10.04')
    expect(formatPeriodLabel('weekly', '2025-12-29')).toBe('2025.12.29 ~ 2026.01.04')
    expect(formatPeriodLabel('yearly', '2026')).toBe('2026년')
  })
})

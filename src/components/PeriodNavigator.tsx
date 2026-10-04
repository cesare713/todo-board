import { formatPeriodLabel, isCurrentPeriod } from '../domain/period'
import type { PeriodType } from '../domain/task'

interface Props {
  type: PeriodType
  value: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

const TODAY_LABEL: Record<PeriodType, string> = { daily: '오늘', weekly: '이번 주', yearly: '올해' }

export default function PeriodNavigator({ type, value, onPrev, onNext, onToday }: Props) {
  const current = isCurrentPeriod(type, value)
  return (
    <div className="period-nav">
      <button className="btn btn-icon" onClick={onPrev} aria-label="이전 기간">
        ‹
      </button>
      <span className="period-label" aria-live="polite">
        {formatPeriodLabel(type, value)}
      </span>
      <button className="btn btn-icon" onClick={onNext} aria-label="다음 기간">
        ›
      </button>
      <button className="btn btn-ghost" onClick={onToday} disabled={current}>
        {TODAY_LABEL[type]}
      </button>
    </div>
  )
}

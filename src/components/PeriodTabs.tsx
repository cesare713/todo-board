import { PERIOD_TYPES, PERIOD_TYPE_LABEL, type PeriodType } from '../domain/task'

interface Props {
  value: PeriodType
  onChange: (type: PeriodType) => void
}

export default function PeriodTabs({ value, onChange }: Props) {
  return (
    <div className="tabs" role="tablist" aria-label="기간 유형">
      {PERIOD_TYPES.map((type) => (
        <button
          key={type}
          role="tab"
          aria-selected={value === type}
          className={`tab ${value === type ? 'is-active' : ''}`}
          onClick={() => onChange(type)}
        >
          {PERIOD_TYPE_LABEL[type]}
        </button>
      ))}
    </div>
  )
}

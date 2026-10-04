import { currentPeriodValue, normalizePeriodValue, shiftPeriod } from '../domain/period'
import type { PeriodType } from '../domain/task'
import { createStore } from '../lib/createStore'

export interface PeriodState {
  type: PeriodType
  /** 탭별로 보고 있던 기간 값을 기억 */
  values: Record<PeriodType, string>
}

export function createPeriodStore(now: () => Date = () => new Date()) {
  const today = now()
  const store = createStore<PeriodState>({
    type: 'daily',
    values: {
      daily: currentPeriodValue('daily', today),
      weekly: currentPeriodValue('weekly', today),
      yearly: currentPeriodValue('yearly', today),
    },
  })

  const actions = {
    setType(type: PeriodType) {
      store.setState((s) => ({ ...s, type }))
    },
    shift(delta: number) {
      store.setState((s) => ({
        ...s,
        values: { ...s.values, [s.type]: shiftPeriod(s.type, s.values[s.type], delta) },
      }))
    },
    goToday() {
      store.setState((s) => ({
        ...s,
        values: { ...s.values, [s.type]: currentPeriodValue(s.type, now()) },
      }))
    },
    /** 특정 기간 보드로 이동 (다른 기간에 할 일을 추가했을 때 등) */
    show(type: PeriodType, value: string) {
      const v = normalizePeriodValue(type, value)
      if (!v) return
      store.setState((s) => ({ type, values: { ...s.values, [type]: v } }))
    },
  }

  return { store, actions }
}

export type PeriodStore = ReturnType<typeof createPeriodStore>

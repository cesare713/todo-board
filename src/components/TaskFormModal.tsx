import { useState, type FormEvent } from 'react'
import { formatPeriodLabel, normalizePeriodValue } from '../domain/period'
import {
  PERIOD_TYPES,
  PERIOD_TYPE_LABEL,
  STATUSES,
  STATUS_LABEL,
  TITLE_MAX,
  validateTitle,
  type PeriodType,
  type Status,
  type Task,
} from '../domain/task'
import type { ActionResult } from '../store/taskStore'
import Modal from './Modal'

export interface TaskFormData {
  title: string
  description: string
  period_type: PeriodType
  period_value: string
  status?: Status
}

interface Props {
  task?: Task
  /** 새 할 일의 기본 기간 유형 = 현재 보고 있는 탭 */
  defaultPeriodType: PeriodType
  /** 탭별로 현재 보고 있는 기간 값 (폼 기본값으로 사용) */
  periodValues: Record<PeriodType, string>
  onSubmit: (data: TaskFormData) => ActionResult
  onClose: () => void
  /** 수정 모드에서 삭제 버튼을 누를 때 */
  onDelete?: () => void
}

export default function TaskFormModal({ task, defaultPeriodType, periodValues, onSubmit, onClose, onDelete }: Props) {
  const isEdit = !!task
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [periodType, setPeriodType] = useState<PeriodType>(task?.period_type ?? defaultPeriodType)
  const [periodValue, setPeriodValue] = useState(task?.period_value ?? periodValues[defaultPeriodType])
  const [status, setStatus] = useState<Status>(task?.status ?? 'todo')
  const [error, setError] = useState<string | null>(null)

  const normalized = normalizePeriodValue(periodType, periodValue)

  const changeType = (type: PeriodType) => {
    setPeriodType(type)
    // 유형을 바꾸면 그 유형에서 보고 있던 기간을 기본값으로
    setPeriodValue(task?.period_type === type ? task.period_value : periodValues[type])
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const titleError = validateTitle(title)
    if (titleError) return setError(titleError)
    if (!normalized) return setError('기간 값이 올바르지 않습니다.')
    const result = onSubmit({
      title,
      description,
      period_type: periodType,
      period_value: normalized,
      ...(isEdit ? { status } : {}),
    })
    if (!result.ok) setError(result.error)
  }

  return (
    <Modal title={isEdit ? '할 일 수정' : '할 일 추가'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">
            제목 <em>*</em>
          </span>
          <input
            data-autofocus
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => {
              setTitle(e.target.value)
              setError(null)
            }}
            placeholder="무엇을 해야 하나요?"
          />
          <span className="field-hint">
            {title.trim().length}/{TITLE_MAX}
          </span>
        </label>

        <label className="field">
          <span className="field-label">설명</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">기간 유형</span>
            <select value={periodType} onChange={(e) => changeType(e.target.value as PeriodType)}>
              {PERIOD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PERIOD_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">{periodType === 'yearly' ? '연도' : '날짜'}</span>
            {periodType === 'yearly' ? (
              <input
                type="number"
                min={1900}
                max={9999}
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value)}
              />
            ) : (
              <input type="date" value={periodValue} onChange={(e) => setPeriodValue(e.target.value)} />
            )}
          </label>

          {isEdit && (
            <label className="field">
              <span className="field-label">상태</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <p className="field-hint period-preview">
          {normalized
            ? `저장 기간: ${formatPeriodLabel(periodType, normalized)}${periodType === 'weekly' ? ' (월요일 시작 주)' : ''}`
            : '올바른 기간 값을 입력해 주세요.'}
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          {isEdit && onDelete && (
            <button type="button" className="btn btn-danger-ghost modal-actions-start" onClick={onDelete}>
              삭제
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn-primary">
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

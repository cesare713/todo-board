import { useMemo, useState } from 'react'
import { STATUSES, type PeriodType, type Status, type Task } from '../domain/task'
import { selectColumn } from '../store/taskStore'
import Column from './Column'

interface Props {
  tasks: Task[]
  periodType: PeriodType
  periodValue: string
  onMove: (id: string, status: Status) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export default function Board({ tasks, periodType, periodValue, onMove, onEdit, onDelete }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStatus, setOverStatus] = useState<Status | null>(null)

  const columns = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((s) => [s, selectColumn(tasks, periodType, periodValue, s)]),
      ) as Record<Status, Task[]>,
    [tasks, periodType, periodValue],
  )
  const total = STATUSES.reduce((n, s) => n + columns[s].length, 0)

  const endDrag = () => {
    setDraggingId(null)
    setOverStatus(null)
  }

  return (
    <main className="board-wrap">
      {total === 0 && (
        <p className="empty-hint">이 기간에 등록된 할 일이 없습니다. ‘+ 할 일 추가’로 시작해 보세요.</p>
      )}
      <div className="board">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columns[status]}
            draggingId={draggingId}
            isOver={overStatus === status}
            onDragStartCard={setDraggingId}
            onDragEndCard={endDrag}
            onDragOverColumn={() => setOverStatus(status)}
            onDragLeaveColumn={() => setOverStatus((cur) => (cur === status ? null : cur))}
            onDropCard={(id) => {
              onMove(id, status)
              endDrag()
            }}
            onMoveCard={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </main>
  )
}

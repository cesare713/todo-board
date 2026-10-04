import type { DragEvent } from 'react'
import { STATUS_LABEL, type Status, type Task } from '../domain/task'
import TaskCard, { DRAG_MIME } from './TaskCard'

interface Props {
  status: Status
  tasks: Task[]
  draggingId: string | null
  isOver: boolean
  onDragStartCard: (id: string) => void
  onDragEndCard: () => void
  onDragOverColumn: () => void
  onDragLeaveColumn: () => void
  onDropCard: (id: string) => void
  onMoveCard: (id: string, status: Status) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export default function Column(props: Props) {
  const { status, tasks, draggingId, isOver } = props

  const handleDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isOver) props.onDragOverColumn()
  }

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    // 컬럼 안의 자식 요소로 이동할 때는 무시
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    props.onDragLeaveColumn()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData(DRAG_MIME)
    if (id) props.onDropCard(id)
  }

  return (
    <section
      className={`column column-${status} ${isOver ? 'is-over' : ''}`}
      aria-label={`${STATUS_LABEL[status]} 컬럼`}
      data-status={status}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="column-header">
        <span className="column-dot" aria-hidden />
        <h2>{STATUS_LABEL[status]}</h2>
        <span className="column-count">{tasks.length}</span>
      </header>
      <ul className="card-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            dragging={draggingId === task.id}
            onDragStart={props.onDragStartCard}
            onDragEnd={props.onDragEndCard}
            onMove={props.onMoveCard}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
          />
        ))}
      </ul>
      {isOver && <div className="drop-indicator" aria-hidden />}
    </section>
  )
}

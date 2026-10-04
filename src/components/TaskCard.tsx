import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { STATUSES, STATUS_LABEL, type Status, type Task } from '../domain/task'

export const DRAG_MIME = 'application/x-todo-task'

interface Props {
  task: Task
  dragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onMove: (id: string, status: Status) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export default function TaskCard({ task, dragging, onDragStart, onDragEnd, onMove, onEdit, onDelete }: Props) {
  const idx = STATUSES.indexOf(task.status)
  // 버튼을 누르다 마우스가 살짝 움직여도 카드 드래그가 시작되지 않도록 표시
  const pressedOnButton = useRef(false)
  const markButtonPress = (e: PointerEvent) => {
    e.stopPropagation()
    pressedOnButton.current = true
  }
  const action = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    pressedOnButton.current = false
    fn()
  }

  const moveByKeyboard = (status: Status) => {
    onMove(task.id, status)
    // 다른 컬럼으로 다시 그려진 카드에 포커스 유지
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)?.focus()
    })
  }

  // 키보드 이동: ← → 로 상태 변경, Enter 수정, Delete 삭제
  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault()
      moveByKeyboard(STATUSES[idx - 1])
    } else if (e.key === 'ArrowRight' && idx < STATUSES.length - 1) {
      e.preventDefault()
      moveByKeyboard(STATUSES[idx + 1])
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onEdit(task)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onDelete(task)
    }
  }

  return (
    <li
      className={`card ${dragging ? 'is-dragging' : ''}`}
      draggable
      tabIndex={0}
      data-task-id={task.id}
      aria-label={`${task.title}, 상태 ${STATUS_LABEL[task.status]}. 좌우 화살표로 상태 이동, Enter로 수정`}
      onPointerDown={() => {
        pressedOnButton.current = false
      }}
      onDragStart={(e) => {
        if (pressedOnButton.current) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData(DRAG_MIME, task.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(task.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      onKeyDown={handleKeyDown}
    >
      <div className="card-body">
        <p className="card-title">{task.title}</p>
        {task.description && <p className="card-desc">{task.description}</p>}
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="card-action"
          draggable={false}
          aria-label={`'${task.title}' 수정`}
          onPointerDown={markButtonPress}
          onClick={action(() => onEdit(task))}
        >
          수정
        </button>
        <button
          type="button"
          className="card-action card-action-danger"
          draggable={false}
          aria-label={`'${task.title}' 삭제`}
          onPointerDown={markButtonPress}
          onClick={action(() => onDelete(task))}
        >
          삭제
        </button>
      </div>
    </li>
  )
}

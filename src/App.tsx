import { useState } from 'react'
import ImportBanner from './components/ImportBanner'
import UserMenu from './components/UserMenu'
import Board from './components/Board'
import ConfirmDialog from './components/ConfirmDialog'
import PeriodNavigator from './components/PeriodNavigator'
import PeriodTabs from './components/PeriodTabs'
import StorageBanner from './components/StorageBanner'
import TaskFormModal from './components/TaskFormModal'
import Toast from './components/Toast'
import type { Task } from './domain/task'
import type { User } from './lib/api'
import { useStore } from './lib/useStore'
import { periodStore } from './store'
import type { TaskStore } from './store/taskStore'

type FormState = { mode: 'create' } | { mode: 'edit'; task: Task } | null

interface Props {
  user: User
  taskStore: TaskStore
  onLogout: () => void
}

export default function App({ user, taskStore, onLogout }: Props) {
  const tasks = useStore(taskStore.store, (s) => s.tasks)
  const error = useStore(taskStore.store, (s) => s.error)
  const corrupted = useStore(taskStore.store, (s) => s.corrupted)
  const persistent = useStore(taskStore.store, (s) => s.persistent)
  const periodType = useStore(periodStore.store, (s) => s.type)
  const periodValues = useStore(periodStore.store, (s) => s.values)
  const periodValue = periodValues[periodType]

  const [form, setForm] = useState<FormState>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>할 일 보드</h1>
        <div className="app-header-actions">
          <button className="btn btn-primary" onClick={() => setForm({ mode: 'create' })}>
            + 할 일 추가
          </button>
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      <ImportBanner onImported={taskStore.actions.reload} />

      <StorageBanner
        corrupted={corrupted}
        persistent={persistent}
        getBackup={taskStore.actions.getBackup}
        onReset={taskStore.actions.resetCorrupted}
      />

      <nav className="period-bar">
        <PeriodTabs value={periodType} onChange={periodStore.actions.setType} />
        <PeriodNavigator
          type={periodType}
          value={periodValue}
          onPrev={() => periodStore.actions.shift(-1)}
          onNext={() => periodStore.actions.shift(1)}
          onToday={periodStore.actions.goToday}
        />
      </nav>

      <Board
        tasks={tasks}
        periodType={periodType}
        periodValue={periodValue}
        onMove={taskStore.actions.move}
        onEdit={(task) => setForm({ mode: 'edit', task })}
        onDelete={setDeleting}
      />

      {form && (
        <TaskFormModal
          task={form.mode === 'edit' ? form.task : undefined}
          defaultPeriodType={periodType}
          periodValues={periodValues}
          onClose={() => setForm(null)}
          onDelete={
            form.mode === 'edit'
              ? () => {
                  setDeleting(form.task)
                  setForm(null)
                }
              : undefined
          }
          onSubmit={(data) => {
            const result =
              form.mode === 'edit'
                ? taskStore.actions.update(form.task.id, data)
                : taskStore.actions.create(data)
            if (result.ok) {
              setForm(null)
              // 다른 기간에 저장했다면 그 기간 보드로 이동
              if (result.task) periodStore.actions.show(result.task.period_type, result.task.period_value)
            }
            return result
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="할 일 삭제"
          message={`'${deleting.title}'을(를) 삭제할까요? 삭제하면 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            taskStore.actions.remove(deleting.id)
            setDeleting(null)
          }}
        />
      )}

      <Toast message={error} onClose={taskStore.actions.clearError} />
    </div>
  )
}

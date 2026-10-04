import type { Task } from '../domain/task'
import { api } from '../lib/api'
import type { TaskRepository } from './taskRepository'

/** 서버(로그인한 사용자 본인의 할 일)에 저장하는 Repository */
export class ApiTaskRepository implements TaskRepository {
  constructor(private readonly initial: Task[]) {}

  list(): Task[] {
    return this.initial
  }
  create(task: Task) {
    return api.createTask(task)
  }
  update(task: Task) {
    return api.updateTask(task)
  }
  delete(id: string) {
    return api.deleteTask(id)
  }
  refresh() {
    return api.listTasks()
  }

  isCorrupted() {
    return false
  }
  getBackup() {
    return null
  }
  resetCorrupted() {}
  isPersistent() {
    return true
  }
}

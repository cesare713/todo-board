import type { Task } from '../domain/task'
import { ApiTaskRepository } from '../repository/apiTaskRepository'
import { createPeriodStore } from './periodStore'
import { createTaskStore } from './taskStore'

export const periodStore = createPeriodStore()

/** 로그인 후 서버에서 받은 할 일로 store 생성 */
export function createUserTaskStore(tasks: Task[]) {
  return createTaskStore(new ApiTaskRepository(tasks))
}

import { useSyncExternalStore } from 'react'
import type { Store } from './createStore'

/** selector는 매번 새 객체가 아닌, state 안의 값을 그대로 반환해야 함 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}

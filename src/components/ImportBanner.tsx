import { useState } from 'react'
import { api } from '../lib/api'
import { dismissLocalImport, markLocalImported, readLocalTasks } from '../lib/localImport'

interface Props {
  onImported: () => Promise<void>
}

/** 로그인 전 브라우저에 저장했던 할 일을 계정으로 옮기기 */
export default function ImportBanner({ onImported }: Props) {
  const [localTasks, setLocalTasks] = useState(readLocalTasks)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (localTasks.length === 0) return null

  const importNow = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.importTasks(localTasks)
      markLocalImported()
      await onImported()
      setLocalTasks([])
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오기에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="banner banner-info" role="status">
      <span>
        이 브라우저에 로그인 전 저장한 할 일 {localTasks.length}개가 있습니다.
        {error && <strong className="banner-error"> {error}</strong>}
      </span>
      <div className="banner-actions">
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            dismissLocalImport()
            setLocalTasks([])
          }}
        >
          무시
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={importNow}>
          {busy ? '가져오는 중…' : '내 계정으로 가져오기'}
        </button>
      </div>
    </div>
  )
}

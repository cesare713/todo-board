import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  corrupted: boolean
  persistent: boolean
  getBackup: () => string | null
  onReset: () => void
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function StorageBanner({ corrupted, persistent, getBackup, onReset }: Props) {
  const [confirming, setConfirming] = useState(false)

  if (corrupted) {
    const backup = getBackup()
    return (
      <div className="banner banner-danger" role="alert">
        <span>
          저장된 데이터를 읽을 수 없어 저장을 잠시 막았습니다. 원본은 백업해 두었습니다.
        </span>
        <div className="banner-actions">
          {backup && (
            <button className="btn btn-ghost" onClick={() => downloadText('todo-backup.json', backup)}>
              백업 내려받기
            </button>
          )}
          <button className="btn btn-danger" onClick={() => setConfirming(true)}>
            초기화하고 새로 시작
          </button>
        </div>
        {confirming && (
          <ConfirmDialog
            title="데이터 초기화"
            message="손상된 데이터를 비우고 새로 시작합니다. 백업 원본은 브라우저에 그대로 남습니다."
            confirmLabel="초기화"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              onReset()
              setConfirming(false)
            }}
          />
        )}
      </div>
    )
  }

  if (!persistent) {
    return (
      <div className="banner banner-warn" role="status">
        이 브라우저에서는 저장소를 쓸 수 없어, 창을 닫으면 할 일이 사라집니다.
      </div>
    )
  }

  return null
}

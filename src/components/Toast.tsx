import { useEffect } from 'react'

interface Props {
  message: string | null
  onClose: () => void
  duration?: number
}

export default function Toast({ message, onClose, duration = 4000 }: Props) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [message, onClose, duration])

  if (!message) return null
  return (
    <div className="toast" role="alert">
      <span>{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="닫기">
        ×
      </button>
    </div>
  )
}

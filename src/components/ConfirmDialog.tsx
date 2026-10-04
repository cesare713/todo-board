import Modal from './Modal'

interface Props {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <p className="modal-message">{message}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel} data-autofocus>
          취소
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

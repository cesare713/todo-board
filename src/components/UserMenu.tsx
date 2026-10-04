import { useState } from 'react'
import type { User } from '../lib/api'

interface Props {
  user: User
  onLogout: () => void
}

export default function UserMenu({ user, onLogout }: Props) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="user-menu">
      {user.avatar_url && <img className="avatar" src={user.avatar_url} alt="" width={28} height={28} />}
      <span className="user-name">{user.username}</span>
      <button
        className="btn btn-ghost"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          onLogout()
        }}
      >
        로그아웃
      </button>
    </div>
  )
}

import { useCallback, useState } from 'react'
import { useAppState } from '../state/AppState.jsx'
import PinConfirmModal from '../components/PinConfirmModal.jsx'

// const { confirmPin, pinConfirmModal } = usePinConfirm()
// ...
// const ok = await confirmPin()
// if (!ok) return
// <>{pinConfirmModal}</> somewhere in the page's JSX
export function usePinConfirm() {
  const { user } = useAppState()
  const [pending, setPending] = useState(null)

  const confirmPin = useCallback(() => new Promise((resolve) => setPending({ resolve })), [])

  const pinConfirmModal = pending ? (
    <PinConfirmModal
      email={user.email}
      onSuccess={() => { pending.resolve(true); setPending(null) }}
      onCancel={() => { pending.resolve(false); setPending(null) }}
    />
  ) : null

  return { confirmPin, pinConfirmModal }
}

import { useNavigate } from 'react-router-dom'
import { flushSync } from 'react-dom'

// Tracks the in-flight transition across the whole document (there's only ever
// one). Starting a second one before the first finishes is what produced a
// ghosting/double-render artifact in testing, so overlapping calls just skip
// straight to a plain navigate instead of stacking transitions.
let activeTransition = null

// Wraps react-router's navigate with the View Transitions API so route changes
// get a smooth native crossfade instead of an instant cut. Browsers without
// support (Firefox, older Safari) just fall through to a plain navigate — no
// broken states either way.
export function useTransitionNavigate() {
  const navigate = useNavigate()

  return (to, options) => {
    if (!document.startViewTransition || activeTransition) {
      navigate(to, options)
      return
    }
    activeTransition = document.startViewTransition(() => {
      flushSync(() => navigate(to, options))
    })
    activeTransition.finished.finally(() => { activeTransition = null })
  }
}

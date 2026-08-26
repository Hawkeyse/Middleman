import { useEffect, useRef } from 'react'

const LENGTH = 5

function PinBoxes({ value, shake }) {
  return (
    <div className={`pin-boxes${shake ? ' shake' : ''}`}>
      {Array.from({ length: LENGTH }).map((_, i) => (
        <div key={i} className={`pin-box${value[i] ? ' filled' : ''}`}>{value[i] || ''}</div>
      ))}
    </div>
  )
}

// One hidden numeric input drives all 5 boxes — far more robust than
// juggling refs/focus across five separate inputs (still handles paste,
// backspace, and a real numeric keyboard on mobile for free).
function PinInput({ value, onChange, autoFocus, shake, disabled }) {
  const inputRef = useRef(null)
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])
  return (
    <div className="pin-input-wrap" onClick={() => inputRef.current?.focus()}>
      <PinBoxes value={value} shake={shake} />
      <input
        ref={inputRef}
        className="pin-hidden-input"
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, LENGTH))}
      />
    </div>
  )
}

export default PinInput
export { LENGTH as PIN_LENGTH }

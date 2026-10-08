import { useState } from 'react'
import { sha256 } from '../../lib/format'

/** Numeric PIN pad. In "create" mode asks for the PIN twice and returns its hash. */
export function PinGate({
  pinHash,
  onUnlock,
  onCreate,
}: {
  pinHash?: string
  onUnlock: () => void
  onCreate: (hash: string) => Promise<void>
}) {
  const creating = !pinHash
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const title = creating ? (first ? 'PIN dobara likhein' : 'Naya PIN banayein') : 'PIN likhein'
  const hint = creating ? '4 se 6 number. Ghar ka hisab sirf is PIN se khulega.' : 'Ghar ka hisab locked hai'

  function fail(msg: string) {
    setError(msg)
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  async function submit(value: string) {
    if (value.length < 4) return fail('Kam az kam 4 number')
    if (creating) {
      if (!first) {
        setFirst(value)
        setPin('')
        setError(null)
        return
      }
      if (value !== first) {
        setFirst(null)
        return fail('Dono PIN match nahi hue, dobara koshish karein')
      }
      await onCreate(await sha256(value))
      onUnlock()
      return
    }
    if ((await sha256(value)) === pinHash) onUnlock()
    else fail('Galat PIN')
  }

  function press(k: string) {
    setError(null)
    if (k === '⌫') return setPin((p) => p.slice(0, -1))
    if (k === '✓') return submit(pin)
    if (pin.length >= 6) return
    const next = pin + k
    setPin(next)
    // Auto-submit once the stored PIN length could be reached (unlock only).
    if (!creating && next.length >= 4) {
      sha256(next).then((h) => {
        if (h === pinHash) onUnlock()
      })
    }
  }

  return (
    <div className="pinWrap">
      <div className="pinLock">🔒</div>
      <div className="pinTitle">{title}</div>
      <div className="pinHint">{hint}</div>
      <div className={`pinDots ${shake ? 'shake' : ''}`}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      {error && <div className="pinError">{error}</div>}
      <div className="pinPad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => (
          <button key={k} className={`pinKey ${k === '✓' ? 'ok' : ''}`} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

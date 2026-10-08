import { useState } from 'react'
import { deleteField } from 'firebase/firestore'
import type { Settings } from '../types'
import { settingsDoc } from '../lib/paths'
import { mergeDoc } from '../hooks/useData'
import { COPY_TYPES } from '../lib/catalog'
import { sha256 } from '../lib/format'
import { Field, MoneyInput, num } from './ui/kit'
import { Sheet } from './ui/Sheet'

export function SettingsSheet({
  uid,
  email,
  settings,
  onClose,
  onSignOut,
  onPinReset,
}: {
  uid: string
  email: string | null
  settings: Settings
  onClose: () => void
  onSignOut: () => void
  onPinReset: () => void
}) {
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(COPY_TYPES.map((t) => [t, String(settings.rates[t] ?? '')])),
  )
  const [oldPin, setOldPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveRates() {
    setBusy(true)
    await mergeDoc(settingsDoc(uid), { rates: Object.fromEntries(COPY_TYPES.map((t) => [t, num(rates[t])])) })
    setBusy(false)
    setMsg('Rates saved ✓')
  }

  async function resetPin() {
    if (settings.pinHash && (await sha256(oldPin)) !== settings.pinHash) {
      setMsg('Current PIN is incorrect')
      return
    }
    await mergeDoc(settingsDoc(uid), { pinHash: deleteField() })
    onPinReset()
    setOldPin('')
    setMsg('PIN removed. You will set a new PIN when you next open Home Accounts.')
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      {msg && <div className="errorBanner successBanner">{msg}</div>}

      <div className="settingsGroup">
        <div className="settingsHead">Photocopy / Print rates (Rs)</div>
        <div className="twoFields wrap">
          {COPY_TYPES.map((t) => (
            <Field key={t} label={t}>
              <MoneyInput value={rates[t]} onChange={(v) => setRates((r) => ({ ...r, [t]: v }))} />
            </Field>
          ))}
        </div>
        <button className="btnPrimary full" disabled={busy} onClick={saveRates}>
          Save rates
        </button>
      </div>

      <div className="settingsGroup">
        <div className="settingsHead">Home Accounts PIN</div>
        {settings.pinHash ? (
          <>
            <Field label="Enter your current PIN to change it">
              <input type="password" inputMode="numeric" value={oldPin} onChange={(e) => setOldPin(e.target.value)} placeholder="••••" />
            </Field>
            <button className="btnGhost full" onClick={resetPin}>
              Change PIN
            </button>
          </>
        ) : (
          <div className="sheetText">No PIN yet. You will create one when you open Home Accounts.</div>
        )}
      </div>

      <div className="settingsGroup">
        <div className="settingsHead">Account</div>
        <div className="sheetText">{email}</div>
        <button className="btnDanger full" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </Sheet>
  )
}

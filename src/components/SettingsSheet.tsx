import { useState } from 'react'
import { arrayRemove, arrayUnion, deleteField } from 'firebase/firestore'
import type { Settings } from '../types'
import { settingsDoc } from '../lib/paths'
import { mergeDoc } from '../hooks/useData'
import { COPY_TYPES, HOME_ACCOUNTS, NETWORKS } from '../lib/catalog'
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
  const [bizName, setBizName] = useState(settings.businessName ?? '')
  const [oldPin, setOldPin] = useState('')
  const [net, setNet] = useState('')
  const [acc, setAcc] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveRates() {
    setBusy(true)
    await mergeDoc(settingsDoc(uid), { rates: Object.fromEntries(COPY_TYPES.map((t) => [t, num(rates[t])])) })
    setBusy(false)
    setMsg('Rates saved ✓')
  }

  async function saveName() {
    setBusy(true)
    await mergeDoc(settingsDoc(uid), { businessName: bizName.trim() })
    setBusy(false)
    setMsg('Business name saved ✓')
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
        <div className="settingsHead">Business name</div>
        <Field label="Shown at the top of the app">
          <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="e.g. Aslam Mobile & Photostat" maxLength={40} />
        </Field>
        <button className="btnPrimary full" disabled={busy} onClick={saveName}>
          Save name
        </button>
      </div>

      <div className="settingsGroup">
        <div className="settingsHead">Home accounts (cash, wallets, banks)</div>
        <div className="netList">
          {HOME_ACCOUNTS.map((n) => (
            <span key={n} className="netChip">
              {n}
            </span>
          ))}
          {(settings.homeAccounts ?? []).map((n) => (
            <span key={n} className="netChip custom">
              {n}
              <button aria-label={`Remove ${n}`} onClick={() => mergeDoc(settingsDoc(uid), { homeAccounts: arrayRemove(n) })}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="inlineAdd">
          <input value={acc} onChange={(e) => setAcc(e.target.value)} placeholder="Add a bank, e.g. HBL, Meezan" maxLength={24} />
          <button
            className="btnPrimary"
            disabled={!acc.trim()}
            onClick={async () => {
              await mergeDoc(settingsDoc(uid), { homeAccounts: arrayUnion(acc.trim()) })
              setAcc('')
              setMsg('Account added ✓')
            }}
          >
            Add
          </button>
        </div>
      </div>

      {(settings.owners ?? []).length > 0 && (
        <div className="settingsGroup">
          <div className="settingsHead">People whose money you keep</div>
          <div className="netList">
            {(settings.owners ?? []).map((n) => (
              <span key={n} className="netChip custom">
                {n}
                <button aria-label={`Remove ${n}`} onClick={() => mergeDoc(settingsDoc(uid), { owners: arrayRemove(n) })}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="settingsGroup">
        <div className="settingsHead">Load networks</div>
        <div className="netList">
          {NETWORKS.map((n) => (
            <span key={n} className="netChip">
              {n}
            </span>
          ))}
          {(settings.networks ?? []).map((n) => (
            <span key={n} className="netChip custom">
              {n}
              <button
                aria-label={`Remove ${n}`}
                onClick={() => mergeDoc(settingsDoc(uid), { networks: arrayRemove(n) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="inlineAdd">
          <input value={net} onChange={(e) => setNet(e.target.value)} placeholder="Add a network, e.g. SCOM" maxLength={20} />
          <button
            className="btnPrimary"
            disabled={!net.trim()}
            onClick={async () => {
              await mergeDoc(settingsDoc(uid), { networks: arrayUnion(net.trim()) })
              setNet('')
              setMsg('Network added ✓')
            }}
          >
            Add
          </button>
        </div>
      </div>

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

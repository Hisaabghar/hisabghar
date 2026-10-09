import { useState } from 'react'
import { arrayRemove, arrayUnion } from 'firebase/firestore'
import type { Settings } from '../types'
import { settingsDoc } from '../lib/paths'
import { mergeDoc } from '../hooks/useData'
import { COPY_TYPES, HOME_ACCOUNTS, NETWORKS } from '../lib/catalog'
import { sha256 } from '../lib/format'
import { setSoundOn, soundOn } from '../lib/sound'
import { Field, MoneyInput, num } from './ui/kit'
import { Sheet } from './ui/Sheet'

export function SettingsSheet({
  uid,
  email,
  settings,
  onClose,
  onSignOut,
  onPinReset,
  privacy,
  onPrivacyChange,
  homeLock,
  onHomeLockChange,
}: {
  homeLock: boolean
  onHomeLockChange: (on: boolean) => void
  privacy: boolean
  onPrivacyChange: (on: boolean) => void
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
  const [sound, setSound] = useState(soundOn())
  const [oldPin, setOldPin] = useState('')
  const [pinStep, setPinStep] = useState<'old' | 'new'>('old')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
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

  async function checkOldPin() {
    if ((await sha256(oldPin)) !== settings.pinHash) {
      setMsg('Current PIN is incorrect')
      return
    }
    setMsg(null)
    setPinStep('new')
  }

  async function saveNewPin() {
    if (!/^\d{4,6}$/.test(newPin)) return setMsg('New PIN must be 4 to 6 digits')
    if (newPin !== newPin2) return setMsg("New PINs don't match")
    await mergeDoc(settingsDoc(uid), { pinHash: await sha256(newPin) })
    onPinReset()
    setOldPin('')
    setNewPin('')
    setNewPin2('')
    setPinStep('old')
    setMsg('PIN changed ✓')
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      {msg && <div className={`errorBanner ${msg.includes('✓') ? 'successBanner' : ''}`}>{msg}</div>}

      <div className="settingsGroup">
        <label className="checkRow soundRow">
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => {
              setSound(e.target.checked)
              setSoundOn(e.target.checked)
            }}
          />
          🔊 Click sounds (this device)
        </label>
        <label className="checkRow soundRow">
          <input type="checkbox" checked={privacy} onChange={(e) => onPrivacyChange(e.target.checked)} />
          🙈 Privacy mode — hide amounts behind “Show amounts” (this device)
        </label>
        <div className="statHint">
          {privacy
            ? 'On: amounts stay hidden or shown exactly as you last left them, even after closing the app.'
            : 'Off: amounts are always shown. Turning it off asks for your PIN.'}
        </div>
      </div>

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
              await mergeDoc(settingsDoc(uid), { homeAccounts: arrayUnion(acc.trim()), hiddenAccounts: arrayRemove(acc.trim()) })
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

      {(settings.customBiz ?? []).length > 0 && (
        <div className="settingsGroup">
          <div className="settingsHead">Your business categories</div>
          <div className="netList">
            {(settings.customBiz ?? []).map((b) => (
              <span key={b.name} className="netChip custom">
                {b.icon} {b.name}
                <button
                  aria-label={`Remove ${b.name}`}
                  onClick={() => {
                    if (confirm(`Remove "${b.name}" from the menu? Its saved entries are kept.`))
                      mergeDoc(settingsDoc(uid), { customBiz: arrayRemove(b) })
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {[...(settings.expenseCats ?? []), ...(settings.incomeCats ?? [])].length > 0 && (
        <div className="settingsGroup">
          <div className="settingsHead">Your home categories</div>
          <div className="netList">
            {(settings.expenseCats ?? []).map((n) => (
              <span key={'e' + n} className="netChip custom">
                🧾 {n}
                <button aria-label={`Remove ${n}`} onClick={() => mergeDoc(settingsDoc(uid), { expenseCats: arrayRemove(n) })}>
                  ×
                </button>
              </span>
            ))}
            {(settings.incomeCats ?? []).map((n) => (
              <span key={'i' + n} className="netChip custom">
                💰 {n}
                <button aria-label={`Remove ${n}`} onClick={() => mergeDoc(settingsDoc(uid), { incomeCats: arrayRemove(n) })}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="statHint">Removing a category keeps old entries as they are.</div>
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
        <label className="checkRow soundRow">
          <input type="checkbox" checked={homeLock} onChange={(e) => onHomeLockChange(e.target.checked)} />
          🔒 Ask for PIN to open Home Accounts
        </label>
        <div className="statHint">
          {homeLock ? 'On: Home Accounts and Mentor ask for your PIN.' : 'Off: Home Accounts open without a PIN. Turning it off asks for your PIN once.'}
        </div>
        {settings.pinHash ? (
          <>
            {pinStep === 'old' ? (
              <>
                <Field label="Step 1: enter your current PIN">
                  <input type="password" inputMode="numeric" maxLength={6} value={oldPin} onChange={(e) => setOldPin(e.target.value)} placeholder="••••" />
                </Field>
                <button className="btnGhost full" disabled={oldPin.length < 4} onClick={checkOldPin}>
                  Next
                </button>
              </>
            ) : (
              <>
                <div className="twoFields">
                  <Field label="Step 2: new PIN">
                    <input type="password" inputMode="numeric" maxLength={6} autoFocus value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="4–6 digits" />
                  </Field>
                  <Field label="Confirm new PIN">
                    <input type="password" inputMode="numeric" maxLength={6} value={newPin2} onChange={(e) => setNewPin2(e.target.value)} placeholder="••••" />
                  </Field>
                </div>
                <button className="btnPrimary full" disabled={newPin.length < 4 || newPin2.length < 4} onClick={saveNewPin}>
                  Save new PIN
                </button>
              </>
            )}
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

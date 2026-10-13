import { useEffect, useState } from 'react'
import { hasAppPassword, setAppPassword } from '../hooks/useAuth'
import { isNative } from '../lib/saveFile'
import { APK_URL, exactAlarmStatus, openExactAlarmSetting } from '../lib/native'
import { Field } from './ui/kit'

/** Settings → Android app: download link and app password (browser), alarm permissions (in the app). */
export function AndroidSettings() {
  const native = isNative()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [has, setHas] = useState(hasAppPassword())
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [exact, setExact] = useState<'granted' | 'denied' | 'na'>('na')

  useEffect(() => {
    if (!native) return
    void exactAlarmStatus().then(setExact)
    const onFocus = () => void exactAlarmStatus().then(setExact)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [native])

  if (native)
    return (
      <div className="settingsGroup">
        <div className="settingsHead">📱 Phone alarms</div>
        <div className="statHint">Note alarms and bill reminders are set on your phone, so they ring even when the app is closed.</div>
        {exact === 'denied' && (
          <>
            <div className="errorBanner">Alarms may ring a few minutes late. Allow “Alarms & reminders” for on-time alarms.</div>
            <button className="btnPrimary full" onClick={() => void openExactAlarmSetting()}>
              Allow exact alarms
            </button>
          </>
        )}
        {exact === 'granted' && <div className="errorBanner successBanner">Exact alarms allowed ✓</div>}
      </div>
    )

  return (
    <div className="settingsGroup">
      <div className="settingsHead">📱 Android app</div>
      <div className="statHint">
        Install Mera Khata as an app on your Android phone. Alarms and bill reminders then ring on time even when the app is closed.
      </div>
      <a className="btnPrimary full" href={APK_URL} target="_blank" rel="noreferrer">
        ⬇️ Download Android app (APK)
      </a>
      <div className="statHint">
        After downloading, open the file and tap Install. If the phone asks, allow “Install unknown apps” for Chrome.
      </div>
      <div className="settingsSub">App login password {has && <span className="okTag">✓ set</span>}</div>
      <div className="statHint">
        Google doesn’t allow its login inside apps, so the app uses your Gmail address + this password. It opens the same account and data.
      </div>
      {msg && <div className={`errorBanner ${msg.ok ? 'successBanner' : ''}`}>{msg.text}</div>}
      <div className="twoFields">
        <Field label={has ? 'New password' : 'Password'}>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
        </Field>
        <Field label="Confirm">
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Again" />
        </Field>
      </div>
      <button
        className="btnGhost full"
        disabled={busy || pw.length < 6}
        onClick={async () => {
          if (pw !== pw2) return setMsg({ ok: false, text: "Passwords don't match" })
          setBusy(true)
          setMsg(null)
          try {
            await setAppPassword(pw)
            setHas(true)
            setPw('')
            setPw2('')
            setMsg({ ok: true, text: 'App password saved ✓ — use it with your Gmail in the Android app' })
          } catch (e) {
            setMsg({ ok: false, text: (e as Error).message })
          } finally {
            setBusy(false)
          }
        }}
      >
        {has ? 'Change app password' : 'Set app password'}
      </button>
    </div>
  )
}

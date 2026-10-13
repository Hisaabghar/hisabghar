import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isNative } from '../lib/saveFile'

/** Google blocks its login inside apps, so the Android app logs in with email + app password. */
function EmailLogin({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form
      className="emailLogin"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setMsg(null)
        try {
          await auth.signInWithEmail(email, password)
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message })
        } finally {
          setBusy(false)
        }
      }}
    >
      {msg && <div className={`errorBanner ${msg.ok ? 'successBanner' : ''}`}>{msg.text}</div>}
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your Gmail address"
        required
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="App password"
        required
      />
      <button className="btnPrimary full" disabled={busy}>
        {busy ? 'Please wait…' : 'Log in'}
      </button>
      <button
        type="button"
        className="linkBtn"
        onClick={async () => {
          if (!email.trim()) return setMsg({ ok: false, text: 'Type your email first.' })
          try {
            await auth.resetPassword(email)
            setMsg({ ok: true, text: 'Password reset link sent to your email ✓' })
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message })
          }
        }}
      >
        Forgot password?
      </button>
      <div className="statHint authHelp">
        First time? Open <b>mera-khata-30f9b.web.app</b> in Chrome, log in with Google, then go to ⚙️ Settings → 📱 Android app and set an
        app password. Use the same Gmail and that password here.
      </div>
    </form>
  )
}

export function AuthScreen({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await auth.signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong, please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <img className="authLogo" src="/favicon.svg" alt="Mera Khata" />
        <div className="authTitle">Mera Khata</div>
        <div className="authSubtitle">Home budget and shop accounts in one place — synced on all your devices.</div>
        {isNative() ? (
          <EmailLogin auth={auth} />
        ) : (
          <>
            {error && <div className="errorBanner">{error}</div>}
            <button className="btnGoogle" type="button" onClick={onGoogle} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
                />
              </svg>
              {busy ? 'Please wait…' : 'Continue with Google'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

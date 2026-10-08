import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'

export function AuthScreen({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signedUpMsg, setSignedUpMsg] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signIn') {
        await auth.signIn(email, password)
      } else {
        await auth.signUp(email, password)
        setSignedUpMsg(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="mark">L</div>
        <div className="authTitle">Ledger</div>
        <div className="authSubtitle">your money, your voice — sign in to your cashbook</div>
        {error && <div className="errorBanner">{error}</div>}
        {signedUpMsg && (
          <div className="errorBanner successBanner">
            Account created. Check your email to confirm, then sign in.
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btnPrimary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="authToggle">
          {mode === 'signIn' ? (
            <>
              New here? <button onClick={() => { setMode('signUp'); setError(null) }}>Create an account</button>
            </>
          ) : (
            <>
              Already have an account? <button onClick={() => { setMode('signIn'); setError(null) }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

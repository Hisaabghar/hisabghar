import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '../lib/firebase'

const AUTH_MESSAGES: Record<string, string> = {
  'auth/too-many-requests': 'Bohat zyada koshishein. Thori dair baad try karein.',
  'auth/network-request-failed': 'Internet check karein.',
  'auth/popup-closed-by-user': 'Google login cancel ho gaya.',
  'auth/operation-not-allowed': 'Firebase mein Google login on nahi hai.',
}

function friendly(err: unknown): Error {
  if (err instanceof FirebaseError) return new Error(AUTH_MESSAGES[err.code] ?? err.message)
  return err instanceof Error ? err : new Error('Something went wrong')
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (err) {
      // Some in-app browsers / WebViews block popups; fall back to a full-page redirect.
      if (err instanceof FirebaseError && err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider)
        return
      }
      throw friendly(err)
    }
  }

  async function signOut() {
    await fbSignOut(auth)
  }

  return { user: user ? { id: user.uid, email: user.email } : null, loading, signInWithGoogle, signOut }
}

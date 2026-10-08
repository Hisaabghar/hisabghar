import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '../lib/firebase'

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase Authentication.',
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

  async function signIn(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      throw friendly(err)
    }
  }

  async function signUp(email: string, password: string) {
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      throw friendly(err)
    }
  }

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

  return { user: user ? { id: user.uid, email: user.email } : null, loading, signIn, signUp, signInWithGoogle, signOut }
}

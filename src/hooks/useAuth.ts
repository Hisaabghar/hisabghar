import { useEffect, useState } from 'react'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '../lib/firebase'

const AUTH_MESSAGES: Record<string, string> = {
  'auth/too-many-requests': 'Too many attempts. Please try again in a moment.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/operation-not-allowed': 'This login type is not switched on in Firebase yet (Authentication → Sign-in method).',
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'No account with this email.',
  'auth/invalid-email': 'Please enter a valid email.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/requires-recent-login': 'For safety, log out and log in again with Google, then set the password.',
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

  async function signInWithEmail(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      throw friendly(err)
    }
  }

  async function resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email.trim())
    } catch (err) {
      throw friendly(err)
    }
  }

  async function signOut() {
    await fbSignOut(auth)
  }

  return {
    user: user ? { id: user.uid, email: user.email, name: user.displayName, photo: user.photoURL } : null,
    loading,
    signInWithGoogle,
    signInWithEmail,
    resetPassword,
    signOut,
  }
}

/** Whether the signed-in account already has an app (email) password. */
export const hasAppPassword = () => !!auth.currentUser?.providerData.some((p) => p.providerId === 'password')

/** Adds or changes the password used to log in to the Android app with the same account. */
export async function setAppPassword(password: string) {
  const u = auth.currentUser
  if (!u?.email) throw new Error('No email on this account')
  try {
    if (hasAppPassword()) await updatePassword(u, password)
    else await linkWithCredential(u, EmailAuthProvider.credential(u.email, password))
  } catch (err) {
    throw friendly(err)
  }
}

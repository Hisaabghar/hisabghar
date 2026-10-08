import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// When no VITE_FIREBASE_* values are baked in, use the config Firebase Hosting serves for
// the project's web app at this reserved URL, so a hosting deploy needs no .env file.
async function loadConfig() {
  if (envConfig.apiKey) return envConfig
  try {
    const res = await fetch('/__/firebase/init.json')
    if (res.ok) return await res.json()
  } catch {
    // fall through
  }
  // eslint-disable-next-line no-console
  console.warn('Missing Firebase config. Set VITE_FIREBASE_* in .env or serve the app from Firebase Hosting.')
  return envConfig
}

const firebaseConfig = await loadConfig()

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

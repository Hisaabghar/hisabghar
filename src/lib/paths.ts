import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

// Every user's data lives under users/{uid}/..., which the Firestore rules lock to that user.
export const homeCol = (uid: string) => collection(db, 'users', uid, 'home')
export const loansCol = (uid: string) => collection(db, 'users', uid, 'loans')
export const bizCol = (uid: string) => collection(db, 'users', uid, 'biz')
export const investCol = (uid: string) => collection(db, 'users', uid, 'invest')
export const stockCol = (uid: string) => collection(db, 'users', uid, 'stock')
export const stockLogCol = (uid: string) => collection(db, 'users', uid, 'stockLog')
export const dayDoc = (uid: string, date: string) => doc(db, 'users', uid, 'days', date)
export const settingsDoc = (uid: string) => doc(db, 'users', uid, 'meta', 'settings')

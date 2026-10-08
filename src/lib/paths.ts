import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

// Every user's data lives under users/{uid}/..., which the Firestore rules lock to that user.
export const accountsCol = (uid: string) => collection(db, 'users', uid, 'accounts')
export const accountDoc = (uid: string, id: string) => doc(db, 'users', uid, 'accounts', id)
export const txnsCol = (uid: string) => collection(db, 'users', uid, 'transactions')
export const txnDoc = (uid: string, id: string) => doc(db, 'users', uid, 'transactions', id)

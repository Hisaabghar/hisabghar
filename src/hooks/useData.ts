import { useEffect, useState } from 'react'
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentReference,
  type Query,
} from 'firebase/firestore'

type WithId = { id: string }

/** Live list of documents for a query; re-subscribes when `key` changes. */
export function useLiveQuery<T extends WithId>(q: Query | null, key: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q) return
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { items, loading, error }
}

export function useLiveDoc<T>(ref: DocumentReference | null, key: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!ref) return
    return onSnapshot(ref, (snap) => {
      setData(snap.exists() ? (snap.data() as T) : null)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { data, loading }
}

export const byDateRange = (col: CollectionReference, from: string, to: string) =>
  query(col, where('date', '>=', from), where('date', '<=', to), orderBy('date', 'desc'))

export const allByDate = (col: CollectionReference) => query(col, orderBy('date', 'desc'))

export async function addItem<T extends object>(col: CollectionReference, data: T) {
  await addDoc(col, { ...data, createdAt: Date.now() })
}

export async function removeItem(col: CollectionReference, id: string) {
  await deleteDoc(doc(col, id))
}

export async function patchItem(col: CollectionReference, id: string, data: object) {
  await updateDoc(doc(col, id), data)
}

export async function mergeDoc(ref: DocumentReference, data: object) {
  await setDoc(ref, data, { merge: true })
}

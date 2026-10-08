import { useCallback, useEffect, useRef, useState } from 'react'
import { addDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore'
import { txnDoc, txnsCol } from '../lib/paths'
import type { Transaction, TxnType } from '../types'

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong'
}

export interface NewTxnInput {
  type: TxnType
  amount: number
  category: string
  note: string
  voiceNoteUrl: string | null
}

export function useTransactions(userId: string | null, accountId: string | null) {
  const cache = useRef<Record<string, Transaction[]>>({})
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (accId: string, force = false) => {
      if (!userId || (!force && cache.current[accId])) return
      setLoading(true)
      setError(null)
      try {
        // Sorted client-side so no composite Firestore index is needed.
        const snap = await getDocs(query(txnsCol(userId), where('accountId', '==', accId)))
        cache.current[accId] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }))
          .sort((a, b) => b.createdAt - a.createdAt)
        setVersion((v) => v + 1)
      } catch (err) {
        setError(errMsg(err))
      } finally {
        setLoading(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    if (accountId) load(accountId)
  }, [accountId, load])

  async function addTransaction(accId: string, input: NewTxnInput) {
    if (!userId) return
    const data: Omit<Transaction, 'id'> = { accountId: accId, ...input, createdAt: Date.now() }
    try {
      const ref = await addDoc(txnsCol(userId), data)
      cache.current[accId] = [{ id: ref.id, ...data }, ...(cache.current[accId] ?? [])]
      setVersion((v) => v + 1)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  async function deleteTransaction(accId: string, id: string) {
    if (!userId) return
    try {
      await deleteDoc(txnDoc(userId, id))
      cache.current[accId] = (cache.current[accId] ?? []).filter((t) => t.id !== id)
      setVersion((v) => v + 1)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  function purgeAccount(accId: string) {
    delete cache.current[accId]
    setVersion((v) => v + 1)
  }

  const txnsFor = (accId: string | null): Transaction[] => (accId ? cache.current[accId] ?? [] : [])

  return {
    txnsFor,
    loading,
    error,
    clearError: () => setError(null),
    addTransaction,
    deleteTransaction,
    purgeAccount,
    reload: load,
    version,
  }
}

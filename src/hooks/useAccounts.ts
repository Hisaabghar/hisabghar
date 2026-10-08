import { useCallback, useEffect, useState } from 'react'
import { addDoc, deleteDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { accountDoc, accountsCol, txnsCol } from '../lib/paths'
import type { Account } from '../types'

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong'
}

async function createAccount(uid: string, name: string): Promise<Account> {
  const createdAt = Date.now()
  const ref = await addDoc(accountsCol(uid), { name, createdAt })
  return { id: ref.id, name, createdAt }
}

export function useAccounts(userId: string | null) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(accountsCol(userId))
      let mapped: Account[] = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name as string, createdAt: d.data().createdAt as number }))
        .sort((a, b) => a.createdAt - b.createdAt)
      if (mapped.length === 0) {
        mapped = [await createAccount(userId, 'Main Ledger')]
      }
      setAccounts(mapped)
      setActiveAccountId((prev) => (prev && mapped.some((a) => a.id === prev) ? prev : mapped[0].id))
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function addAccount(name: string) {
    const trimmed = name.trim()
    if (!trimmed || !userId) return
    try {
      const acc = await createAccount(userId, trimmed)
      setAccounts((prev) => [...prev, acc])
      setActiveAccountId(acc.id)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  async function renameAccount(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed || !userId) return
    try {
      await updateDoc(accountDoc(userId, id), { name: trimmed })
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, name: trimmed } : a)))
    } catch (err) {
      setError(errMsg(err))
    }
  }

  async function deleteAccount(id: string) {
    if (!userId) return false
    if (accounts.length <= 1) {
      setError('You need at least one account — create another before deleting this one.')
      return false
    }
    try {
      // Firestore has no cascading deletes, so remove the account's entries first.
      const txns = await getDocs(query(txnsCol(userId), where('accountId', '==', id)))
      for (let i = 0; i < txns.docs.length; i += 450) {
        const batch = writeBatch(db)
        txns.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
      await deleteDoc(accountDoc(userId, id))
    } catch (err) {
      setError(errMsg(err))
      return false
    }
    const remaining = accounts.filter((a) => a.id !== id)
    setAccounts(remaining)
    setActiveAccountId((prev) => (prev === id ? remaining[0]?.id ?? null : prev))
    return true
  }

  return {
    accounts,
    activeAccountId,
    setActiveAccountId,
    loading,
    error,
    clearError: () => setError(null),
    addAccount,
    renameAccount,
    deleteAccount,
    reload: load,
  }
}

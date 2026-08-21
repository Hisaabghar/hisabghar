import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { txnFromRow, type TransactionRow } from '../lib/mappers'
import type { Transaction, TxnType } from '../types'

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

  const load = useCallback(async (accId: string, force = false) => {
    if (!force && cache.current[accId]) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accId)
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    cache.current[accId] = ((data ?? []) as TransactionRow[]).map(txnFromRow)
    setVersion((v) => v + 1)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (accountId) load(accountId)
  }, [accountId, load])

  async function addTransaction(accId: string, input: NewTxnInput) {
    if (!userId) return
    const { data, error: err } = await supabase
      .from('transactions')
      .insert({
        account_id: accId,
        user_id: userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        note: input.note,
        voice_note_url: input.voiceNoteUrl,
      })
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    const txn = txnFromRow(data as TransactionRow)
    cache.current[accId] = [txn, ...(cache.current[accId] ?? [])]
    setVersion((v) => v + 1)
  }

  async function deleteTransaction(accId: string, id: string) {
    const { error: err } = await supabase.from('transactions').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    cache.current[accId] = (cache.current[accId] ?? []).filter((t) => t.id !== id)
    setVersion((v) => v + 1)
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

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { accountFromRow, type AccountRow } from '../lib/mappers'
import type { Account } from '../types'

export function useAccounts(userId: string | null) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    let rows = (data ?? []) as AccountRow[]
    if (rows.length === 0) {
      const { data: created, error: createErr } = await supabase
        .from('accounts')
        .insert({ name: 'Main Ledger', user_id: userId })
        .select('*')
        .single()
      if (createErr) {
        setError(createErr.message)
        setLoading(false)
        return
      }
      rows = [created as AccountRow]
    }
    const mapped = rows.map(accountFromRow)
    setAccounts(mapped)
    setActiveAccountId((prev) => (prev && mapped.some((a) => a.id === prev) ? prev : mapped[0].id))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function addAccount(name: string) {
    const trimmed = name.trim()
    if (!trimmed || !userId) return
    const { data, error: err } = await supabase
      .from('accounts')
      .insert({ name: trimmed, user_id: userId })
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    const acc = accountFromRow(data as AccountRow)
    setAccounts((prev) => [...prev, acc])
    setActiveAccountId(acc.id)
  }

  async function renameAccount(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { error: err } = await supabase.from('accounts').update({ name: trimmed }).eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, name: trimmed } : a)))
  }

  async function deleteAccount(id: string) {
    if (accounts.length <= 1) {
      setError('You need at least one account — create another before deleting this one.')
      return false
    }
    const { error: err } = await supabase.from('accounts').delete().eq('id', id)
    if (err) {
      setError(err.message)
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

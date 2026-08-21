import type { Account, Transaction, TxnType } from '../types'

export interface AccountRow {
  id: string
  name: string
  created_at: string
}

export interface TransactionRow {
  id: string
  account_id: string
  type: TxnType
  amount: number | string
  category: string
  note: string
  voice_note_url: string | null
  created_at: string
}

export function accountFromRow(row: AccountRow): Account {
  return { id: row.id, name: row.name, createdAt: new Date(row.created_at).getTime() }
}

export function txnFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    note: row.note,
    voiceNoteUrl: row.voice_note_url,
    createdAt: new Date(row.created_at).getTime(),
  }
}

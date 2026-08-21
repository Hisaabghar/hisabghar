export type TxnType = 'in' | 'out'

export interface Account {
  id: string
  name: string
  createdAt: number
}

export interface Transaction {
  id: string
  accountId: string
  type: TxnType
  amount: number
  category: string
  note: string
  voiceNoteUrl: string | null
  createdAt: number
}

export interface TxnDraft {
  type: TxnType
  amount: string
  category: string
  note: string
}

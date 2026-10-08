export type Period = { mode: 'day' | 'month'; date: string } // date = YYYY-MM-DD

// ---------- Ghar ka hisab ----------
export type HomeType = 'income' | 'expense'
export interface HomeEntry {
  id: string
  type: HomeType
  category: string
  amount: number
  note: string
  date: string
  createdAt: number
}

export type LoanKind = 'diya' | 'liya' | 'wapasMila' | 'wapasKiya'
export interface LoanEntry {
  id: string
  person: string
  kind: LoanKind
  amount: number
  note: string
  date: string
  createdAt: number
}

// ---------- Dukaan ----------
export type BizKind = 'wallet' | 'load' | 'copy' | 'acc' | 'online'
export type Wallet = 'easypaisa' | 'jazzcash'

export interface BizEntry {
  id: string
  kind: BizKind
  date: string
  createdAt: number
  /** Money handled: transfer amount, load amount, sale value or fee. */
  amount: number
  /** What the shop earned from this entry (commission / profit). */
  profit: number
  note: string
  // wallet
  wallet?: Wallet
  dir?: 'send' | 'withdraw'
  // load
  network?: string
  // photocopy
  copyType?: string
  qty?: number
  rate?: number
  // accessories
  item?: string
  cost?: number
  // online kaam
  service?: string
  customer?: string
  status?: 'pending' | 'done'
}

export interface DayOpening {
  cash: number
  easypaisa: number
  jazzcash: number
}

export interface Settings {
  pinHash?: string
  rates: Record<string, number>
}

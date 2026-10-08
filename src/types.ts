export type Period = { mode: 'day' | 'month'; date: string } // date = YYYY-MM-DD

// ---------- Home accounts ----------
export type HomeType = 'income' | 'expense' | 'transfer'
export interface HomeEntry {
  id: string
  type: HomeType
  category: string
  amount: number
  note: string
  date: string
  /** HH:MM the money moved. */
  time?: string
  /** Where the money came into or went out of (income/expense), or the source of a transfer. */
  account?: string
  /** Destination of a transfer. */
  toAccount?: string
  /** Whose money this is; absent means the user's own. */
  owner?: string
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

// ---------- Shop / business ----------
export type BizKind = 'wallet' | 'load' | 'copy' | 'acc' | 'online' | 'custom'
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
  // sale taken from stock (accessories)
  productId?: string
  // user-defined business (kind 'custom')
  biz?: string
  // online kaam
  service?: string
  customer?: string
  status?: 'pending' | 'done'
}

/** Money put into starting or growing the business (machines, stock, setup). */
export interface InvestEntry {
  id: string
  item: string
  category: string
  amount: number
  note: string
  date: string
  createdAt: number
}

export interface DayOpening {
  cash: number
  easypaisa: number
  jazzcash: number
}

/** A product kept in stock. `qty` is the live count, changed with Firestore increments. */
export interface Product {
  id: string
  name: string
  category: string
  unit: string
  costPrice: number
  salePrice: number
  qty: number
  /** Warn when qty falls to this level or below. */
  minQty: number
  createdAt: number
}

export type StockReason = 'opening' | 'purchase' | 'sale' | 'adjust'
export interface StockMove {
  id: string
  productId: string
  name: string
  change: number
  reason: StockReason
  unitCost?: number
  note: string
  date: string
  createdAt: number
}

/** A business category the user added (e.g. Tea stall, Bike repair). */
export interface CustomBiz {
  name: string
  icon: string
}

export interface Settings {
  customBiz?: CustomBiz[]
  pinHash?: string
  businessName?: string
  /** Extra load networks the user added on top of the built-in ones. */
  networks?: string[]
  /** Extra personal accounts (banks etc.) on top of cash, Easypaisa and JazzCash. */
  homeAccounts?: string[]
  /** People whose money the user keeps (uncle, father…). */
  owners?: string[]
  rates: Record<string, number>
}

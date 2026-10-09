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
  /** List price per item before discount. */
  price?: number
  /** Discount given on this line (Rs). */
  discount?: number
  /** Groups the lines of one sale. */
  saleId?: string
  /** Sold on udhaar: no money came in yet (it's in the customer khata). */
  onCredit?: boolean
  // user-defined business (kind 'custom')
  biz?: string
  // online kaam
  service?: string
  customer?: string
  phone?: string
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

export type Till = 'cash' | 'easypaisa' | 'jazzcash'

/** Money spent to run the shop (rent, bills, salary…). */
export interface ShopExpense {
  id: string
  category: string
  amount: number
  note: string
  paidFrom: Till
  date: string
  createdAt: number
}

/** Customer khata: 'credit' = customer took goods/money on udhaar, 'payment' = customer paid back. */
export interface CreditEntry {
  id: string
  customer: string
  phone?: string
  kind: 'credit' | 'payment'
  amount: number
  note: string
  paidTo?: Till
  date: string
  createdAt: number
}

export interface DayClosing {
  cash: number
  easypaisa: number
  jazzcash: number
  expectedCash: number
  expectedEasypaisa: number
  expectedJazzcash: number
  note: string
  at: number
}

export interface DayOpening {
  cash: number
  easypaisa: number
  jazzcash: number
  closing?: DayClosing
}

/** One delivery of a product at one cost price. Oldest batches are sold first. */
export interface StockBatch {
  qty: number
  cost: number
  /** Selling price for this batch; becomes the product's price when it is the oldest. */
  sale?: number
  date: string
}

/** A product kept in stock. `qty` is the total count across batches. */
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
  /** Remaining stock by purchase, oldest first. Missing on products from before batches existed. */
  batches?: StockBatch[]
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
  /** Accounts the user deleted; hidden from lists. */
  hiddenAccounts?: string[]
  /** People whose money the user keeps (uncle, father…). */
  owners?: string[]
  rates: Record<string, number>
}

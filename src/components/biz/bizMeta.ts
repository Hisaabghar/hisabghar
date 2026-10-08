import type { BizEntry, BizKind, CreditEntry, DayOpening, ShopExpense, Till } from '../../types'
import { rs, sum } from '../../lib/format'

export const KIND_LABEL: Record<BizKind, string> = {
  wallet: 'Easypaisa / JazzCash',
  load: 'Load',
  copy: 'Photocopy / Print',
  acc: 'Product sales',
  online: 'Online services',
  custom: 'Other business',
}
/** Short names for tight spots such as chart legends. */
export const KIND_SHORT: Record<BizKind, string> = {
  wallet: 'Easypaisa/JazzCash',
  load: 'Load',
  copy: 'Photocopy',
  acc: 'Sales',
  online: 'Online',
  custom: 'Other',
}
export const KIND_ICON: Record<BizKind, string> = { wallet: '💸', load: '📶', copy: '🖨️', acc: '🛍️', online: '📝', custom: '🧩' }

export const BIZ_ICONS = ['🧩', '🍵', '🔧', '🧵', '💇', '🍔', '🛒', '🚲', '📚', '🎂', '🧴', '📦', '💻', '🧹', '🚚', '🌾']

export const WALLET_LABEL = { easypaisa: 'Easypaisa', jazzcash: 'JazzCash' } as const

export function entryTitle(e: BizEntry): string {
  switch (e.kind) {
    case 'wallet':
      return `${WALLET_LABEL[e.wallet ?? 'easypaisa']} — ${e.dir === 'withdraw' ? 'Withdrawal' : 'Sent'}`
    case 'load':
      return `${e.network} load`
    case 'copy':
      return `${e.copyType} × ${e.qty}`
    case 'acc':
      return `${e.item}${e.qty && e.qty > 1 ? ` × ${e.qty}` : ''}`
    case 'online':
      return e.service ?? 'Online service'
    case 'custom':
      return `${e.biz ?? 'Business'}${e.item ? ' — ' + e.item : ''}`
  }
}

export function entrySub(e: BizEntry): string | undefined {
  const parts: string[] = []
  if (e.customer) parts.push(e.customer)
  if (e.phone) parts.push(e.phone)
  if (e.note) parts.push(e.note)
  if (e.discount) parts.push(`Discount ${rs(e.discount)}`)
  if (e.kind === 'wallet') parts.push(`Commission ${rs(e.profit)}`)
  else if (e.kind !== 'copy') parts.push(`Profit ${rs(e.profit)}`)
  return parts.join(' · ') || undefined
}

/** Cash that came into (or left) the drawer because of this entry. */
export function cashEffect(e: BizEntry): number {
  if (e.onCredit) return 0 // sold on udhaar: the money comes later through the customer khata
  switch (e.kind) {
    case 'wallet':
      return (e.dir === 'withdraw' ? -e.amount : e.amount) + e.profit
    case 'online':
      return e.profit // fee received minus what was paid out (challan etc.)
    default:
      return e.amount
  }
}

/** Where the day's money should be: opening + shop entries − expenses + udhaar collected. */
export function walletClosing(entries: BizEntry[], opening: DayOpening, expenses: ShopExpense[] = [], credit: CreditEntry[] = []) {
  const w = entries.filter((e) => e.kind === 'wallet')
  const out = (till: Till) => sum(expenses.filter((x) => (x.paidFrom ?? 'cash') === till), (x) => x.amount)
  const collected = (till: Till) => sum(credit.filter((c) => c.kind === 'payment' && (c.paidTo ?? 'cash') === till), (c) => c.amount)
  const delta = (name: 'easypaisa' | 'jazzcash') =>
    sum(
      w.filter((e) => e.wallet === name),
      (e) => (e.dir === 'withdraw' ? e.amount : -e.amount),
    )
  return {
    cash: opening.cash + sum(entries, cashEffect) - out('cash') + collected('cash'),
    easypaisa: opening.easypaisa + delta('easypaisa') - out('easypaisa') + collected('easypaisa'),
    jazzcash: opening.jazzcash + delta('jazzcash') - out('jazzcash') + collected('jazzcash'),
  }
}

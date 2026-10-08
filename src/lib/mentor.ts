// Mentor: a free, on-device assistant that answers plain-language questions
// (English or Roman Urdu) from the user's own Mera Khata data. No AI service
// is called; questions are matched to intents and answered with real numbers.
import type { BizEntry, HomeEntry, LoanEntry, Product } from '../types'
import { addDays, groupSum, monthRange, rs, shortDate, sum, today, toISO } from './format'
import { isLow } from './stock'

export interface MentorData {
  biz: BizEntry[]
  stock: Product[]
  home: HomeEntry[] | null // null while Home Accounts are locked
  loans: LoanEntry[] | null
  customs: string[]
}

export interface MentorAnswer {
  lines: string[]
  links?: { label: string; url: string }[]
  needsUnlock?: boolean
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const has = (q: string, words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(q))

/** Works out which dates a question is about. Defaults to today. */
export function parsePeriod(q: string, now = today()): { from: string; to: string; label: string } {
  const y = Number(now.slice(0, 4))
  if (has(q, ['yesterday', 'kal', 'guzishta din'])) {
    const d = addDays(now, -1)
    return { from: d, to: d, label: 'yesterday' }
  }
  if (has(q, ['last month', 'pichle mahine', 'pichla mahina', 'pichhle mahine', 'previous month'])) {
    const d = new Date(y, Number(now.slice(5, 7)) - 2, 1)
    const [from, to] = monthRange(toISO(d))
    return { from, to, label: 'last month' }
  }
  if (has(q, ['this month', 'is mahine', 'is mahina', 'month', 'mahine', 'mahina'])) {
    const [from, to] = monthRange(now)
    return { from, to, label: 'this month' }
  }
  if (has(q, ['this week', 'is hafte', 'week', 'hafte', 'hafta'])) {
    return { from: addDays(now, -6), to: now, label: 'the last 7 days' }
  }
  if (has(q, ['all time', 'total', 'ab tak', 'shuru se'])) {
    return { from: '0000-01-01', to: now, label: 'all time' }
  }
  // 2026-10-05
  const iso = q.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const d = toISO(new Date(+iso[1], +iso[2] - 1, +iso[3]))
    return { from: d, to: d, label: shortDate(d) }
  }
  // 5 oct / oct 5 / 5 october
  const m1 = q.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*/)
  const m2 = q.match(/([a-z]{3})[a-z]*\s+(\d{1,2})(?!\d)/)
  for (const [day, mon] of [m1 ? [m1[1], m1[2]] : null, m2 ? [m2[2], m2[1]] : null].filter(Boolean) as string[][]) {
    const mi = MONTHS.indexOf(mon)
    if (mi >= 0) {
      const d = toISO(new Date(y, mi, Number(day)))
      return { from: d, to: d, label: shortDate(d) }
    }
  }
  // 5/10 or 05-10 (day/month)
  const dm = q.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/)
  if (dm) {
    const yy = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : y
    const d = toISO(new Date(yy, Number(dm[2]) - 1, Number(dm[1])))
    return { from: d, to: d, label: shortDate(d) }
  }
  // a month name on its own: "october"
  const mon = MONTHS.findIndex((m) => new RegExp(`(^|[^a-z])${m}`).test(q))
  if (mon >= 0) {
    const [from, to] = monthRange(toISO(new Date(y, mon, 1)))
    return { from, to, label: `${MONTHS[mon][0].toUpperCase()}${MONTHS[mon].slice(1)} ${y}` }
  }
  return { from: now, to: now, label: 'today' }
}

const BIZ_NAMES: Record<string, string> = {
  wallet: 'Easypaisa / JazzCash',
  load: 'Load',
  copy: 'Photocopy / Print',
  acc: 'Product sales',
  online: 'Online services',
}

const JOB_LINKS = [
  { label: 'FPSC (Federal jobs)', url: 'https://www.fpsc.gov.pk' },
  { label: 'PPSC (Punjab)', url: 'https://www.ppsc.gop.pk' },
  { label: 'SPSC (Sindh)', url: 'https://www.spsc.gov.pk' },
  { label: 'KPPSC (Khyber Pakhtunkhwa)', url: 'https://www.kppsc.gov.pk' },
  { label: 'BPSC (Balochistan)', url: 'https://www.bpsc.gob.pk' },
  { label: 'NTS', url: 'https://www.nts.org.pk' },
  { label: 'Pakistan Railways', url: 'https://www.pakrail.gov.pk' },
  { label: 'Pakistan Army', url: 'https://joinpakarmy.gov.pk' },
  { label: 'Pakistan Navy', url: 'https://www.joinpaknavy.gov.pk' },
  { label: 'Pakistan Air Force', url: 'https://www.joinpaf.gov.pk' },
]

export const MENTOR_SUGGESTIONS = [
  'Aaj kitni sale hui?',
  'Is mahine ka profit',
  'Stock mein kya pada hai?',
  'Kaun si cheez khatam ho rahi hai?',
  'Kal load kitna bika?',
  'Pending online kaam',
  'Sab se zyada kya bika is mahine?',
  'Udhaar kis kis se lena hai?',
  'Mere accounts ka balance',
  'Jobs kahan dekhun?',
]

export function answer(question: string, data: MentorData): MentorAnswer {
  const q = ` ${question.toLowerCase().trim()} `
  const p = parsePeriod(q)
  const inP = (d: string) => d >= p.from && d <= p.to
  const biz = data.biz.filter((e) => inP(e.date))
  const when = p.label === 'today' || p.label === 'yesterday' || p.label.startsWith('the') ? p.label : `in ${p.label}`

  // ---- Jobs
  if (has(q, ['job', 'jobs', 'naukri', 'nokri', 'vacanc', 'bharti', 'bharti'])) {
    return {
      lines: [
        'I can’t browse the internet, so I can’t list today’s vacancies myself.',
        'These official sites post every government job — check “Latest jobs / Advertisements” on each:',
      ],
      links: JOB_LINKS,
    }
  }

  // ---- Stock
  const productHit = data.stock.find((s) => s.name.length > 2 && q.includes(s.name.toLowerCase()))
  if (productHit) {
    const sold = sum(
      biz.filter((e) => e.productId === productHit.id),
      (e) => e.qty ?? 1,
    )
    return {
      lines: [
        `${productHit.name}: ${productHit.qty} ${productHit.unit} in stock${isLow(productHit) ? ' ⚠️ (running low)' : ''}.`,
        `Cost ${rs(productHit.costPrice)} · sale ${rs(productHit.salePrice)} each.`,
        sold ? `Sold ${when}: ${sold} ${productHit.unit}.` : '',
      ].filter(Boolean),
    }
  }
  if (has(q, ['low', 'khatam', 'kam ', 'kam reh', 'finish', 'short'])) {
    const low = data.stock.filter(isLow)
    if (!data.stock.length) return { lines: ['No products in Stock yet. Add them in Shop → Stock.'] }
    return {
      lines: low.length
        ? [`${low.length} product${low.length > 1 ? 's are' : ' is'} running low:`, ...low.map((s) => `• ${s.name} — ${s.qty} ${s.unit} left`)]
        : ['Nothing is running low. 👍'],
    }
  }
  if (has(q, ['stock', 'inventory', 'maal', 'mal ', 'product', 'parhe', 'pade', 'pare', 'para', 'saman'])) {
    if (!data.stock.length) return { lines: ['No products in Stock yet. Add them in Shop → Stock.'] }
    const value = sum(data.stock, (s) => Math.max(0, s.qty) * s.costPrice)
    const list = [...data.stock].sort((a, b) => b.qty - a.qty)
    return {
      lines: [
        `You have ${data.stock.length} products, worth ${rs(value)} at cost:`,
        ...list.slice(0, 15).map((s) => `• ${s.name} — ${s.qty} ${s.unit}${isLow(s) ? ' ⚠️' : ''}`),
        list.length > 15 ? `…and ${list.length - 15} more in Shop → Stock.` : '',
      ].filter(Boolean),
    }
  }

  // ---- Best sellers
  if (has(q, ['zyada', 'ziada', 'best', 'top', 'most', 'sab se'])) {
    const items = groupSum(
      biz.filter((e) => e.kind === 'acc' || e.kind === 'custom'),
      (e) => e.item || e.biz || 'Other',
      (e) => e.amount,
    )
    return {
      lines: items.length
        ? [`Top sellers ${when}:`, ...items.slice(0, 5).map(([n, v], i) => `${i + 1}. ${n} — ${rs(v)}`)]
        : [`No item sales recorded ${when}.`],
    }
  }

  // ---- Specific businesses
  const pickKind = (): BizEntry['kind'] | null => {
    if (has(q, ['load', 'jazz load', 'zong', 'telenor', 'ufone', 'onic', 'balance load'])) return 'load'
    if (has(q, ['easypaisa', 'jazzcash', 'jazz cash', 'commission', 'wallet', 'bheja', 'nikala'])) return 'wallet'
    if (has(q, ['photocopy', 'copy', 'print', 'lamination', 'scan'])) return 'copy'
    if (has(q, ['accessor', 'charger', 'handsfree', 'cover', 'cable'])) return 'acc'
    if (has(q, ['online', 'nadra', 'nic', 'form', 'certificate', 'license', 'licence', 'pending'])) return 'online'
    return null
  }
  const custom = data.customs.find((c) => q.includes(c.toLowerCase()))
  const kind = custom ? 'custom' : pickKind()
  if (kind) {
    const list = biz.filter((e) => e.kind === kind && (!custom || e.biz === custom))
    const name = custom ?? BIZ_NAMES[kind]
    const lines = [
      `${name} ${when}: ${list.length} entr${list.length === 1 ? 'y' : 'ies'}, ${rs(sum(list, (e) => e.amount))} handled, profit ${rs(sum(list, (e) => e.profit))}.`,
    ]
    if (kind === 'load') {
      for (const [n, v] of groupSum(list, (e) => e.network ?? 'Other', (e) => e.amount)) lines.push(`• ${n}: ${rs(v)}`)
    }
    if (kind === 'wallet') {
      for (const w of ['easypaisa', 'jazzcash'] as const) {
        const l = list.filter((e) => e.wallet === w)
        if (l.length) lines.push(`• ${w === 'easypaisa' ? 'Easypaisa' : 'JazzCash'}: ${l.length} transactions, commission ${rs(sum(l, (e) => e.profit))}`)
      }
    }
    if (kind === 'online') {
      const pending = data.biz.filter((e) => e.kind === 'online' && e.status !== 'done')
      lines.push(
        pending.length
          ? `Pending right now (${pending.length}): ${pending.slice(0, 6).map((e) => `${e.service}${e.customer ? ` (${e.customer})` : ''}`).join(', ')}`
          : 'No pending online work. ✓',
      )
    }
    return { lines }
  }

  // ---- Home accounts (locked behind the PIN)
  const homeWords = ['udhaar', 'udhar', 'loan', 'lena', 'dena', 'qarz', 'karz', 'balance', 'account', 'bank', 'cash', 'pocket', 'kharcha', 'kharch', 'expense', 'spend', 'spent', 'salary', 'income', 'aamdani']
  if (has(q, homeWords)) {
    if (!data.home || !data.loans) {
      return { lines: ['That’s in Home Accounts, which are locked. Open Home Accounts with your PIN, then ask again.'], needsUnlock: true }
    }
    if (has(q, ['udhaar', 'udhar', 'loan', 'lena', 'dena', 'qarz', 'karz'])) {
      const net = new Map<string, number>()
      for (const l of data.loans) {
        const s = l.kind === 'diya' || l.kind === 'wapasKiya' ? 1 : -1
        net.set(l.person, (net.get(l.person) ?? 0) + s * l.amount)
      }
      const owe = [...net].filter(([, v]) => v > 0)
      const iOwe = [...net].filter(([, v]) => v < 0)
      return {
        lines: [
          `Others owe you ${rs(sum(owe, ([, v]) => v))}; you owe others ${rs(-sum(iOwe, ([, v]) => v))}.`,
          ...owe.map(([n, v]) => `• ${n} owes you ${rs(v)}`),
          ...iOwe.map(([n, v]) => `• You owe ${n} ${rs(-v)}`),
        ],
      }
    }
    if (has(q, ['kharcha', 'kharch', 'expense', 'spend', 'spent'])) {
      const ex = data.home.filter((e) => e.type === 'expense' && inP(e.date) && !e.owner)
      return {
        lines: [
          `You spent ${rs(sum(ex, (e) => e.amount))} ${when}.`,
          ...groupSum(ex, (e) => e.category, (e) => e.amount)
            .slice(0, 6)
            .map(([c, v]) => `• ${c}: ${rs(v)}`),
        ],
      }
    }
    if (has(q, ['salary', 'income', 'aamdani'])) {
      const inc = data.home.filter((e) => e.type === 'income' && inP(e.date) && !e.owner)
      return { lines: [`Income ${when}: ${rs(sum(inc, (e) => e.amount))}.`, ...groupSum(inc, (e) => e.category, (e) => e.amount).map(([c, v]) => `• ${c}: ${rs(v)}`)] }
    }
    const bal = new Map<string, number>()
    for (const e of data.home) {
      const a = e.account || 'Cash in pocket'
      if (e.type === 'income') bal.set(a, (bal.get(a) ?? 0) + e.amount)
      else if (e.type === 'expense') bal.set(a, (bal.get(a) ?? 0) - e.amount)
      else {
        bal.set(a, (bal.get(a) ?? 0) - e.amount)
        if (e.toAccount) bal.set(e.toAccount, (bal.get(e.toAccount) ?? 0) + e.amount)
      }
    }
    return { lines: [`Total in your accounts: ${rs(sum([...bal.values()], (v) => v))}`, ...[...bal].map(([a, v]) => `• ${a}: ${rs(v)}`)] }
  }

  // ---- Sales / profit overall (default for "sale", "profit", "kamai", or a bare date)
  if (has(q, ['sale', 'sell', 'bikri', 'becha', 'bika', 'profit', 'munafa', 'kamai', 'earning', 'kitna', 'kitni', 'hisab', 'summary']) || p.label !== 'today') {
    if (!biz.length) return { lines: [`No shop entries ${when}.`] }
    const byKind = groupSum(biz, (e) => (e.kind === 'custom' ? (e.biz ?? 'Other') : BIZ_NAMES[e.kind]), (e) => e.profit)
    return {
      lines: [
        `${when[0].toUpperCase()}${when.slice(1)}: ${biz.length} entr${biz.length === 1 ? 'y' : 'ies'}, ${rs(sum(biz, (e) => e.amount))} handled, total profit ${rs(sum(biz, (e) => e.profit))}.`,
        ...byKind.map(([k, v]) => `• ${k}: ${rs(v)} profit`),
      ],
    }
  }

  return {
    lines: [
      'I didn’t understand that yet. I can answer questions about your sales, profit, stock, load, Easypaisa/JazzCash, online work, loans, spending and account balances — for today, yesterday, a date (e.g. “5 Oct”), this month or last month.',
      'Try one of the suggestions below.',
    ],
  }
}

/** A compact, plain-text summary of the user's figures for the online model. */
export function buildContext(data: MentorData, now = today()): string {
  const r = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
  const name = (e: BizEntry) => (e.kind === 'custom' ? (e.biz ?? 'Other') : BIZ_NAMES[e.kind])
  const block = (label: string, from: string, to: string) => {
    const list = data.biz.filter((e) => e.date >= from && e.date <= to)
    if (!list.length) return `${label}: no shop entries.`
    const parts = groupSum(list, name, (e) => e.profit).map(([k, v]) => `${k} profit ${r(v)}`)
    const items = groupSum(
      list.filter((e) => e.kind === 'acc' || e.kind === 'custom'),
      (e) => e.item || e.biz || 'Other',
      (e) => e.amount,
    )
      .slice(0, 8)
      .map(([k, v]) => `${k} ${r(v)}`)
    const loads = groupSum(
      list.filter((e) => e.kind === 'load'),
      (e) => e.network ?? 'Other',
      (e) => e.amount,
    ).map(([k, v]) => `${k} ${r(v)}`)
    return [
      `${label}: ${list.length} entries, handled ${r(sum(list, (e) => e.amount))}, profit ${r(sum(list, (e) => e.profit))} (${parts.join('; ')}).`,
      items.length ? `  Items sold: ${items.join(', ')}.` : '',
      loads.length ? `  Load by network: ${loads.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  const [mFrom, mTo] = monthRange(now)
  const lastMonth = monthRange(toISO(new Date(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 2, 1)))
  const days = Array.from({ length: 30 }, (_, i) => addDays(now, -i))
  const daily = days
    .map((d) => {
      const l = data.biz.filter((e) => e.date === d)
      return l.length ? `${d}: profit ${r(sum(l, (e) => e.profit))}, handled ${r(sum(l, (e) => e.amount))}` : ''
    })
    .filter(Boolean)
  const pending = data.biz.filter((e) => e.kind === 'online' && e.status !== 'done')

  const out = [
    `MERA KHATA DATA (today is ${now}). Use only this for questions about the user's own accounts.`,
    '== SHOP ==',
    block('Today', now, now),
    block('Yesterday', addDays(now, -1), addDays(now, -1)),
    block('This month', mFrom, mTo),
    block('Last month', lastMonth[0], lastMonth[1]),
    `All time profit: ${r(sum(data.biz, (e) => e.profit))}.`,
    daily.length ? `Daily (last 30 days):\n  ${daily.join('\n  ')}` : '',
    `Pending online work: ${pending.length ? pending.map((e) => `${e.service}${e.customer ? ' for ' + e.customer : ''} (${e.date})`).join('; ') : 'none'}.`,
    '== STOCK ==',
    data.stock.length
      ? data.stock.map((s) => `${s.name}: ${s.qty} ${s.unit} (cost ${r(s.costPrice)}, sale ${r(s.salePrice)}${isLow(s) ? ', LOW' : ''})`).join('\n')
      : 'No products recorded.',
  ]
  if (data.home && data.loans) {
    const bal = new Map<string, number>()
    for (const e of data.home) {
      const a = e.account || 'Cash in pocket'
      if (e.type === 'income') bal.set(a, (bal.get(a) ?? 0) + e.amount)
      else if (e.type === 'expense') bal.set(a, (bal.get(a) ?? 0) - e.amount)
      else {
        bal.set(a, (bal.get(a) ?? 0) - e.amount)
        if (e.toAccount) bal.set(e.toAccount, (bal.get(e.toAccount) ?? 0) + e.amount)
      }
    }
    const mine = data.home.filter((e) => !e.owner)
    const spent = groupSum(
      mine.filter((e) => e.type === 'expense' && e.date >= mFrom && e.date <= mTo),
      (e) => e.category,
      (e) => e.amount,
    )
    const net = new Map<string, number>()
    for (const l of data.loans) net.set(l.person, (net.get(l.person) ?? 0) + (l.kind === 'diya' || l.kind === 'wapasKiya' ? 1 : -1) * l.amount)
    const others = new Map<string, number>()
    for (const e of data.home.filter((x) => x.owner)) {
      const v = e.type === 'income' ? e.amount : e.type === 'expense' ? -e.amount : 0
      others.set(e.owner!, (others.get(e.owner!) ?? 0) + v)
    }
    out.push(
      '== HOME ACCOUNTS ==',
      `Account balances: ${[...bal].map(([a, v]) => `${a} ${r(v)}`).join(', ') || 'none'}.`,
      `Money kept for others: ${[...others].filter(([, v]) => Math.round(v)).map(([o, v]) => `${o} ${r(v)}`).join(', ') || 'none'}.`,
      `Spending this month: ${spent.map(([c, v]) => `${c} ${r(v)}`).join(', ') || 'none'}.`,
      `Loans (positive = they owe me): ${[...net].filter(([, v]) => Math.round(v)).map(([p, v]) => `${p} ${r(v)}`).join(', ') || 'none'}.`,
    )
  } else {
    out.push('== HOME ACCOUNTS == locked; tell the user to open Home Accounts with their PIN for personal finance questions.')
  }
  return out.filter(Boolean).join('\n')
}

/** Questions that need fresh information from the internet. */
export const needsSearch = (q: string) =>
  has(` ${q.toLowerCase()} `, ['job', 'jobs', 'naukri', 'nokri', 'vacanc', 'bharti', 'news', 'khabar', 'rate', 'price', 'qeemat', 'dollar', 'gold', 'weather', 'mausam', 'admission', 'result'])

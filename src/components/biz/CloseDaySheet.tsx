import { useState } from 'react'
import type { DayClosing } from '../../types'
import { dayDoc } from '../../lib/paths'
import { mergeDoc } from '../../hooks/useData'
import { addDays, rsRaw, shortDate } from '../../lib/format'
import { whatsappLink } from '../../lib/whatsapp'
import { Field, FormSheet, MoneyInput, num } from '../ui/kit'

type Tills = { cash: number; easypaisa: number; jazzcash: number }

export function CloseDaySheet({
  uid,
  date,
  expected,
  summary,
  shopName,
  existing,
  onClose,
}: {
  uid: string
  date: string
  expected: Tills
  summary: { entries: number; sales: number; profit: number; expenses: number; collected: number; credit: number }
  shopName: string
  existing?: DayClosing
  onClose: () => void
}) {
  const [cash, setCash] = useState(String(Math.round(existing?.cash ?? expected.cash)))
  const [ep, setEp] = useState(String(Math.round(existing?.easypaisa ?? expected.easypaisa)))
  const [jc, setJc] = useState(String(Math.round(existing?.jazzcash ?? expected.jazzcash)))
  const [note, setNote] = useState(existing?.note ?? '')
  const [carry, setCarry] = useState(true)

  const counted = { cash: num(cash), easypaisa: num(ep), jazzcash: num(jc) }
  const diff = (k: keyof Tills) => counted[k] - expected[k]
  const net = summary.profit - summary.expenses

  const diffText = (d: number) => (Math.round(d) === 0 ? '✓ matches' : d > 0 ? `${rsRaw(d)} extra` : `${rsRaw(-d)} short`)

  const report = [
    `*${shopName} — ${shortDate(date)} closing*`,
    `Entries: ${summary.entries}`,
    `Sales/handled: ${rsRaw(summary.sales)}`,
    `Profit: ${rsRaw(summary.profit)}`,
    `Shop expenses: ${rsRaw(summary.expenses)}`,
    `*Net profit: ${rsRaw(net)}*`,
    summary.credit ? `Given on udhaar: ${rsRaw(summary.credit)}` : '',
    summary.collected ? `Udhaar collected: ${rsRaw(summary.collected)}` : '',
    `Cash in drawer: ${rsRaw(counted.cash)} (${diffText(diff('cash'))})`,
    `Easypaisa: ${rsRaw(counted.easypaisa)} (${diffText(diff('easypaisa'))})`,
    `JazzCash: ${rsRaw(counted.jazzcash)} (${diffText(diff('jazzcash'))})`,
    note.trim() ? `Note: ${note.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const row = (label: string, k: keyof Tills, value: string, set: (v: string) => void) => (
    <div className="closeRow">
      <Field label={`${label} — counted`}>
        <MoneyInput value={value} onChange={set} />
      </Field>
      <div className="closeExp">
        <span>Should be {rsRaw(expected[k])}</span>
        <b className={Math.round(diff(k)) === 0 ? 'ok' : diff(k) > 0 ? 'over' : 'short'}>{diffText(diff(k))}</b>
      </div>
    </div>
  )

  return (
    <FormSheet
      title={`Close the day — ${shortDate(date)}`}
      onClose={onClose}
      canSave
      onSave={async () => {
        const closing: DayClosing = {
          ...counted,
          expectedCash: expected.cash,
          expectedEasypaisa: expected.easypaisa,
          expectedJazzcash: expected.jazzcash,
          note: note.trim(),
          at: Date.now(),
        }
        await mergeDoc(dayDoc(uid, date), { closing })
        if (carry) await mergeDoc(dayDoc(uid, addDays(date, 1)), counted)
      }}
    >
      <div className="closeSummary">
        <div>
          <span>Profit</span>
          <b>{rsRaw(summary.profit)}</b>
        </div>
        <div>
          <span>Expenses</span>
          <b>−{rsRaw(summary.expenses)}</b>
        </div>
        <div className="grand">
          <span>Net profit</span>
          <b className={net < 0 ? 'short' : ''}>{rsRaw(net)}</b>
        </div>
      </div>
      <p className="sheetText">Count the money and enter what is actually there. The app shows what it should be.</p>
      {row('💵 Cash in drawer', 'cash', cash, setCash)}
      {row('Easypaisa', 'easypaisa', ep, setEp)}
      {row('JazzCash', 'jazzcash', jc, setJc)}
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rs 100 short — gave change wrong" />
      </Field>
      <label className="checkRow">
        <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
        Use these amounts as tomorrow’s opening ({shortDate(addDays(date, 1))})
      </label>
      <a className="quickBtn plain waBtn waFull" href={whatsappLink(report)} target="_blank" rel="noreferrer">
        <span className="qIc">💬</span> Share report on WhatsApp
      </a>
    </FormSheet>
  )
}

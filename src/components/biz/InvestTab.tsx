import { useState } from 'react'
import type { BizEntry, InvestEntry } from '../../types'
import { bizCol, investCol } from '../../lib/paths'
import { addItem, allByDate, removeItem, useLiveQuery } from '../../hooks/useData'
import { groupSum, rs, shortDate, sum, today } from '../../lib/format'
import { INVEST_CATEGORIES, INVEST_ICONS } from '../../lib/catalog'
import {
  Breakdown,
  Card,
  Chips,
  ConfirmDelete,
  Fab,
  Field,
  FormSheet,
  Hero,
  HeroStat,
  List,
  MoneyInput,
  Row,
  num,
} from '../ui/kit'

export function InvestTab({ uid }: { uid: string }) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<InvestEntry | null>(null)
  const invest = useLiveQuery<InvestEntry>(allByDate(investCol(uid)), `invest-${uid}`)
  // All-time business entries, to see how much of the investment profit has paid back.
  const biz = useLiveQuery<BizEntry>(allByDate(bizCol(uid)), `bizall-${uid}`)

  const items = [...invest.items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const invested = sum(items, (e) => e.amount)
  const earned = sum(biz.items, (e) => e.profit)
  const recoveredPct = invested > 0 ? Math.min(100, Math.round((earned / invested) * 100)) : 0
  const since = items.length ? items[items.length - 1].date : null

  return (
    <>
      {(invest.error || biz.error) && <div className="errorBanner">{invest.error || biz.error}</div>}
      <Hero label="Total invested in the business" value={invested}>
        <HeroStat label="Profit earned so far" value={earned} />
        <HeroStat label={earned >= invested ? 'Net gain' : 'Still to recover'} value={Math.abs(invested - earned)} />
        {since && <HeroStat label="Started" value={shortDate(since) + ' ' + since.slice(0, 4)} />}
      </Hero>

      <Card title="Investment recovered">
        <div className="payback">
          <div className="paybackTrack">
            <div className="paybackBar" style={{ width: `${recoveredPct}%` }} />
          </div>
          <div className="paybackText">
            {invested === 0
              ? 'Add what you spent to start the business to track how fast profit pays it back.'
              : earned >= invested
                ? `🎉 Fully recovered — profit has paid back everything you invested.`
                : `${recoveredPct}% recovered · ${rs(invested - earned)} more profit to break even`}
          </div>
        </div>
      </Card>

      <div className="twoCol">
        <Card title="Where it was invested">
          <Breakdown rows={groupSum(items, (e) => e.category, (e) => e.amount)} icons={INVEST_ICONS} />
        </Card>
        <Card title="Investment entries">
          <List empty="No investment recorded yet. Tap “+ Add investment”.">
            {items.map((e) => (
              <Row
                key={e.id}
                icon={INVEST_ICONS[e.category] ?? '📝'}
                title={e.item || e.category}
                sub={[e.category, e.note].filter(Boolean).join(' · ')}
                amount={rs(e.amount)}
                amountSub={shortDate(e.date)}
                onClick={() => setDeleting(e)}
              />
            ))}
          </List>
        </Card>
      </div>

      <Fab label="Add investment" onClick={() => setAdding(true)} />
      {adding && <InvestForm uid={uid} onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmDelete
          what={`${deleting.item || deleting.category} — ${rs(deleting.amount)}`}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeItem(investCol(uid), deleting.id)}
        />
      )}
    </>
  )
}

function InvestForm({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [category, setCategory] = useState(INVEST_CATEGORIES[0])
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  return (
    <FormSheet
      title="Add investment"
      onClose={onClose}
      canSave={num(amount) > 0}
      onSave={() => addItem(investCol(uid), { category, item: item.trim(), amount: num(amount), note: note.trim(), date })}
    >
      <Field label="Type">
        <Chips options={INVEST_CATEGORIES} value={category} onChange={setCategory} />
      </Field>
      <Field label="What did you buy / pay for?">
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Canon photocopier, glass counter" autoFocus />
      </Field>
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. bought second-hand" />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}

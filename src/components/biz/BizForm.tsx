import { useState } from 'react'
import type { BizEntry, BizKind, Wallet } from '../../types'
import { bizCol } from '../../lib/paths'
import { addItem } from '../../hooks/useData'
import { rs } from '../../lib/format'
import { COPY_TYPES, NETWORKS, ONLINE_SERVICES } from '../../lib/catalog'
import { Chips, Field, FormSheet, MoneyInput, Segmented, num } from '../ui/kit'
import { KIND_ICON, KIND_LABEL } from './bizMeta'

type Draft = Omit<BizEntry, 'id' | 'createdAt'>

export function BizForm({
  uid,
  initialKind,
  date: initialDate,
  rates,
  onClose,
}: {
  uid: string
  initialKind: BizKind
  date: string
  rates: Record<string, number>
  onClose: () => void
}) {
  const [kind, setKind] = useState<BizKind>(initialKind)
  const [date, setDate] = useState(initialDate)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [profit, setProfit] = useState('')
  // wallet
  const [wallet, setWallet] = useState<Wallet>('easypaisa')
  const [dir, setDir] = useState<'send' | 'withdraw'>('send')
  // load
  const [network, setNetwork] = useState(NETWORKS[0])
  // copy
  const [copyType, setCopyType] = useState(COPY_TYPES[0])
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState(String(rates[COPY_TYPES[0]] ?? ''))
  // accessories
  const [item, setItem] = useState('')
  const [cost, setCost] = useState('')
  // online
  const [service, setService] = useState(ONLINE_SERVICES[0])
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState<'pending' | 'done'>('done')

  const q = Math.max(1, num(qty))
  let draft: Draft | null = null
  if (kind === 'wallet' && num(amount) > 0)
    draft = { kind, date, note, amount: num(amount), profit: num(profit), wallet, dir }
  if (kind === 'load' && num(amount) > 0) draft = { kind, date, note, amount: num(amount), profit: num(profit), network }
  if (kind === 'copy' && num(rate) > 0)
    draft = { kind, date, note, amount: q * num(rate), profit: q * num(rate), copyType, qty: q, rate: num(rate) }
  if (kind === 'acc' && item.trim() && num(amount) > 0)
    draft = {
      kind,
      date,
      note,
      item: item.trim(),
      qty: q,
      cost: num(cost),
      amount: q * num(amount),
      profit: q * (num(amount) - num(cost)),
    }
  if (kind === 'online' && num(amount) > 0)
    draft = {
      kind,
      date,
      note,
      service,
      customer: customer.trim(),
      status,
      cost: num(cost),
      amount: num(amount),
      profit: num(amount) - num(cost),
    }

  return (
    <FormSheet
      title="Nayi entry"
      onClose={onClose}
      canSave={!!draft}
      onSave={() => addItem(bizCol(uid), { ...draft!, note: note.trim() })}
    >
      <div className="kindPicker">
        {(Object.keys(KIND_LABEL) as BizKind[]).map((k) => (
          <button key={k} type="button" className={`kindPick ${k === kind ? 'active' : ''}`} onClick={() => setKind(k)}>
            <span>{KIND_ICON[k]}</span>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {kind === 'wallet' && (
        <>
          <Segmented
            options={[
              { id: 'easypaisa', label: 'Easypaisa' },
              { id: 'jazzcash', label: 'JazzCash' },
            ]}
            value={wallet}
            onChange={setWallet}
          />
          <div className="gap" />
          <Segmented
            options={[
              { id: 'send', label: 'Bheja / Deposit' },
              { id: 'withdraw', label: 'Nikala / Withdraw' },
            ]}
            value={dir}
            onChange={setDir}
          />
          <div className="twoFields">
            <Field label="Raqam (Rs)">
              <MoneyInput value={amount} onChange={setAmount} autoFocus />
            </Field>
            <Field label="Commission (Rs)">
              <MoneyInput value={profit} onChange={setProfit} />
            </Field>
          </div>
          <Field label="Number / Naam (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="03xx-xxxxxxx" />
          </Field>
        </>
      )}

      {kind === 'load' && (
        <>
          <Field label="Network">
            <Chips options={NETWORKS} value={network} onChange={setNetwork} />
          </Field>
          <div className="twoFields">
            <Field label="Load (Rs)">
              <MoneyInput value={amount} onChange={setAmount} autoFocus />
            </Field>
            <Field label="Profit (Rs)">
              <MoneyInput value={profit} onChange={setProfit} />
            </Field>
          </div>
          <Field label="Number (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="03xx-xxxxxxx" />
          </Field>
        </>
      )}

      {kind === 'copy' && (
        <>
          <Field label="Kya kiya">
            <Chips
              options={COPY_TYPES}
              value={copyType}
              onChange={(t) => {
                setCopyType(t)
                setRate(String(rates[t] ?? ''))
              }}
            />
          </Field>
          <div className="twoFields">
            <Field label="Kitne pages">
              <MoneyInput value={qty} onChange={setQty} autoFocus placeholder="1" />
            </Field>
            <Field label="Rate (Rs)">
              <MoneyInput value={rate} onChange={setRate} />
            </Field>
          </div>
          <div className="totalLine">
            Kul: <b>{rs(q * num(rate))}</b>
          </div>
        </>
      )}

      {kind === 'acc' && (
        <>
          <Field label="Cheez ka naam">
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Jaise: Charger, Handsfree, Cover" autoFocus />
          </Field>
          <div className="twoFields">
            <Field label="Kitne">
              <MoneyInput value={qty} onChange={setQty} placeholder="1" />
            </Field>
            <Field label="Becha (1 ka)">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
          </div>
          <Field label="Khareed (1 ki) — profit ke liye">
            <MoneyInput value={cost} onChange={setCost} />
          </Field>
          <div className="totalLine">
            Sale: <b>{rs(q * num(amount))}</b> · Profit: <b>{rs(q * (num(amount) - num(cost)))}</b>
          </div>
        </>
      )}

      {kind === 'online' && (
        <>
          <Field label="Kaam">
            <select value={service} onChange={(e) => setService(e.target.value)}>
              {ONLINE_SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Customer ka naam">
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Naam" />
          </Field>
          <div className="twoFields">
            <Field label="Fees li (Rs)">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Kharcha / Challan (Rs)">
              <MoneyInput value={cost} onChange={setCost} />
            </Field>
          </div>
          <Segmented
            options={[
              { id: 'done', label: 'Ho gaya ✓' },
              { id: 'pending', label: 'Pending' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <Field label="Phone / Detail (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="03xx-xxxxxxx, tracking no." />
          </Field>
          <div className="totalLine">
            Profit: <b>{rs(num(amount) - num(cost))}</b>
          </div>
        </>
      )}

      <Field label="Tareekh">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}

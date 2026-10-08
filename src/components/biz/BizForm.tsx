import { useState } from 'react'
import type { BizEntry, BizKind, CustomBiz, Wallet } from '../../types'
import { bizCol, settingsDoc } from '../../lib/paths'
import { addItem, mergeDoc } from '../../hooks/useData'
import { rsRaw } from '../../lib/format'
import { arrayUnion } from 'firebase/firestore'
import { COPY_TYPES, ONLINE_SERVICES } from '../../lib/catalog'
import { Chips, Field, FormSheet, MoneyInput, Segmented, num } from '../ui/kit'
import { KIND_ICON, KIND_LABEL } from './bizMeta'
import { AddBizSheet } from './AddBizSheet'

type Draft = Omit<BizEntry, 'id' | 'createdAt'>

export function BizForm({
  uid,
  initialKind,
  date: initialDate,
  rates,
  networks,
  customs,
  initialBiz,
  onSell,
  onClose,
}: {
  /** Sales go through the Sell screen instead of this form. */
  onSell: () => void
  networks: string[]
  customs: CustomBiz[]
  initialBiz?: string
  uid: string
  initialKind: BizKind
  date: string
  rates: Record<string, number>
  onClose: () => void
}) {
  const [kind, setKind] = useState<BizKind>(initialKind)
  const [biz, setBiz] = useState(initialBiz ?? customs[0]?.name ?? '')
  const [addingBiz, setAddingBiz] = useState(false)
  const [date, setDate] = useState(initialDate)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [profit, setProfit] = useState('')
  // wallet
  const [wallet, setWallet] = useState<Wallet>('easypaisa')
  const [dir, setDir] = useState<'send' | 'withdraw'>('send')
  // load
  const [network, setNetwork] = useState(networks[0])
  const [newNet, setNewNet] = useState<string | null>(null)
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
  const [phone, setPhone] = useState('')
  // Optional customer details, saved only when filled in.
  const who = { ...(customer.trim() ? { customer: customer.trim() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}) }
  const [status, setStatus] = useState<'pending' | 'done'>('done')

  const q = Math.max(1, num(qty))
  let draft: Draft | null = null
  if (kind === 'wallet' && num(amount) > 0)
    draft = { kind, date, note, amount: num(amount), profit: num(profit), wallet, dir, ...who }
  if (kind === 'load' && num(amount) > 0) draft = { kind, date, note, amount: num(amount), profit: num(profit), network }
  if (kind === 'copy' && num(rate) > 0)
    draft = { kind, date, note, amount: q * num(rate), profit: q * num(rate), copyType, qty: q, rate: num(rate) }
  if (kind === 'custom' && biz && num(amount) > 0)
    draft = { kind, date, note, biz, item: item.trim(), cost: num(cost), amount: num(amount), profit: num(amount) - num(cost) }
  if (kind === 'online' && num(amount) > 0)
    draft = {
      kind,
      date,
      note,
      service,
      ...who,
      status,
      cost: num(cost),
      amount: num(amount),
      profit: num(amount) - num(cost),
    }

  return (
    <FormSheet
      title="New entry"
      onClose={onClose}
      canSave={!!draft}
      onSave={() => addItem(bizCol(uid), { ...draft!, note: note.trim() })}
    >
      <div className="kindPicker">
        {(Object.keys(KIND_LABEL) as BizKind[])
          .filter((k) => k !== 'custom')
          .map((k) => (
            <button
              key={k}
              type="button"
              className={`kindPick ${k === kind ? 'active' : ''}`}
              onClick={() => (k === 'acc' ? onSell() : setKind(k))}
            >
              <span>{KIND_ICON[k]}</span>
              {KIND_LABEL[k]}
            </button>
          ))}
        {customs.map((c) => (
          <button
            key={c.name}
            type="button"
            className={`kindPick ${kind === 'custom' && biz === c.name ? 'active' : ''}`}
            onClick={() => {
              setKind('custom')
              setBiz(c.name)
            }}
          >
            <span>{c.icon}</span>
            {c.name}
          </button>
        ))}
        <button type="button" className="kindPick add" onClick={() => setAddingBiz(true)}>
          <span>＋</span>
          New category
        </button>
      </div>
      {addingBiz && (
        <AddBizSheet
          uid={uid}
          existing={customs}
          onClose={() => setAddingBiz(false)}
          onAdded={(b) => {
            setKind('custom')
            setBiz(b.name)
          }}
        />
      )}

      {kind === 'custom' && (
        <>
          <Field label="What did you sell / do?">
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. 3 cups of tea, puncture repair" autoFocus />
          </Field>
          <div className="twoFields">
            <Field label="Amount received (Rs)">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Cost (Rs, optional)">
              <MoneyInput value={cost} onChange={setCost} />
            </Field>
          </div>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer, phone…" />
          </Field>
          <div className="totalLine">
            Profit: <b>{rsRaw(num(amount) - num(cost))}</b>
          </div>
        </>
      )}

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
              { id: 'send', label: 'Send / Deposit' },
              { id: 'withdraw', label: 'Withdraw' },
            ]}
            value={dir}
            onChange={setDir}
          />
          <div className="twoFields">
            <Field label="Amount (Rs)">
              <MoneyInput value={amount} onChange={setAmount} autoFocus />
            </Field>
            <Field label="Commission (Rs)">
              <MoneyInput value={profit} onChange={setProfit} />
            </Field>
          </div>
          <CustomerFields customer={customer} phone={phone} setCustomer={setCustomer} setPhone={setPhone} />
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. TID / reference no." />
          </Field>
        </>
      )}

      {kind === 'load' && (
        <>
          <Field label="Network">
            <Chips
              options={[...networks, '+ Add network']}
              value={newNet !== null ? '+ Add network' : network}
              onChange={(n) => (n === '+ Add network' ? setNewNet('') : (setNewNet(null), setNetwork(n)))}
            />
            {newNet !== null && (
              <div className="inlineAdd">
                <input
                  autoFocus
                  value={newNet}
                  onChange={(e) => setNewNet(e.target.value)}
                  placeholder="Network name, e.g. SCOM"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="btnPrimary"
                  disabled={!newNet.trim()}
                  onClick={async () => {
                    const name = newNet.trim()
                    await mergeDoc(settingsDoc(uid), { networks: arrayUnion(name) })
                    setNetwork(name)
                    setNewNet(null)
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </Field>
          <div className="twoFields">
            <Field label="Load amount (Rs)">
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
          <Field label="Type">
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
            <Field label="Pages">
              <MoneyInput value={qty} onChange={setQty} autoFocus placeholder="1" />
            </Field>
            <Field label="Rate (Rs)">
              <MoneyInput value={rate} onChange={setRate} />
            </Field>
          </div>
          <div className="totalLine">
            Total: <b>{rsRaw(q * num(rate))}</b>
          </div>
        </>
      )}

      {kind === 'online' && (
        <>
          <Field label="Service">
            <select value={service} onChange={(e) => setService(e.target.value)}>
              {ONLINE_SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <CustomerFields customer={customer} phone={phone} setCustomer={setCustomer} setPhone={setPhone} />
          <div className="twoFields">
            <Field label="Fee charged (Rs)">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Cost / Challan (Rs)">
              <MoneyInput value={cost} onChange={setCost} />
            </Field>
          </div>
          <Segmented
            options={[
              { id: 'done', label: 'Done ✓' },
              { id: 'pending', label: 'Pending' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. tracking / application no." />
          </Field>
          <div className="totalLine">
            Profit: <b>{rsRaw(num(amount) - num(cost))}</b>
          </div>
        </>
      )}

      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </FormSheet>
  )
}

function CustomerFields({
  customer,
  phone,
  setCustomer,
  setPhone,
}: {
  customer: string
  phone: string
  setCustomer: (v: string) => void
  setPhone: (v: string) => void
}) {
  return (
    <div className="twoFields">
      <Field label="Customer name (optional)">
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Name" autoComplete="off" />
      </Field>
      <Field label="Phone number (optional)">
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+\- ]/g, ''))}
          placeholder="03xx-xxxxxxx"
          autoComplete="off"
          maxLength={16}
        />
      </Field>
    </div>
  )
}

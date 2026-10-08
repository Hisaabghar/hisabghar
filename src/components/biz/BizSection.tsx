import { useState } from 'react'
import type { BizEntry, BizKind, DayOpening, Period, Settings } from '../../types'
import { bizCol, dayDoc } from '../../lib/paths'
import { byDateRange, patchItem, removeItem, useLiveDoc, useLiveQuery } from '../../hooks/useData'
import { groupSum, periodRange, rs, shortDate, sum, today } from '../../lib/format'
import { COPY_TYPES, NETWORKS, NETWORK_COLORS } from '../../lib/catalog'
import { Breakdown, Card, ConfirmDelete, Fab, Hero, HeroStat, List, PeriodBar, Row, Stat, StatGrid, Tabs } from '../ui/kit'
import { KIND_ICON, KIND_LABEL, WALLET_LABEL, entrySub, entryTitle, walletClosing } from './bizMeta'
import { BizForm } from './BizForm'
import { OpeningForm } from './OpeningForm'

type Tab = 'dash' | BizKind
const TABS: { id: Tab; label: string }[] = [
  { id: 'dash', label: 'Dashboard' },
  { id: 'wallet', label: 'Easypaisa / JazzCash' },
  { id: 'load', label: 'Load' },
  { id: 'copy', label: 'Photocopy' },
  { id: 'acc', label: 'Accessories' },
  { id: 'online', label: 'Online kaam' },
]

const ZERO: DayOpening = { cash: 0, easypaisa: 0, jazzcash: 0 }

export function BizSection({ uid, settings }: { uid: string; settings: Settings }) {
  const [tab, setTab] = useState<Tab>('dash')
  const [period, setPeriod] = useState<Period>({ mode: 'day', date: today() })
  const [adding, setAdding] = useState<BizKind | null>(null)
  const [deleting, setDeleting] = useState<BizEntry | null>(null)
  const [editOpening, setEditOpening] = useState(false)

  const [from, to] = periodRange(period)
  const { items, error } = useLiveQuery<BizEntry>(byDateRange(bizCol(uid), from, to), `biz-${uid}-${from}-${to}`)
  const entries = [...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const opening = useLiveDoc<DayOpening>(period.mode === 'day' ? dayDoc(uid, period.date) : null, `day-${uid}-${period.mode}-${period.date}`)
  const open = period.mode === 'day' ? (opening.data ?? null) : null

  const of = (k: BizKind) => entries.filter((e) => e.kind === k)
  const profitOf = (k: BizKind) => sum(of(k), (e) => e.profit)
  const totalProfit = sum(entries, (e) => e.profit)
  const isDay = period.mode === 'day'
  const newDate = isDay ? period.date : today()

  const rowFor = (e: BizEntry) => (
    <Row
      key={e.id}
      icon={KIND_ICON[e.kind]}
      title={entryTitle(e)}
      sub={entrySub(e)}
      amount={rs(e.amount)}
      amountSub={isDay ? undefined : shortDate(e.date)}
      tone={e.kind === 'wallet' ? undefined : 'in'}
      onClick={() => setDeleting(e)}
      extra={
        e.kind === 'online' ? (
          <button
            className={`statusPill ${e.status === 'done' ? 'done' : ''}`}
            onClick={(ev) => {
              ev.stopPropagation()
              patchItem(bizCol(uid), e.id, { status: e.status === 'done' ? 'pending' : 'done' })
            }}
          >
            {e.status === 'done' ? 'Done ✓' : 'Pending'}
          </button>
        ) : undefined
      }
    />
  )

  const closing = open ? walletClosing(entries, open) : null

  return (
    <>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <PeriodBar period={period} onChange={setPeriod} />
      {error && <div className="errorBanner">{error}</div>}

      {tab === 'dash' && (
        <>
          <Hero label={isDay ? 'Aaj ka kul profit' : 'Mahine ka kul profit'} value={totalProfit}>
            <HeroStat label="Entries" value={String(entries.length)} />
            <HeroStat label="Kul len-den" value={sum(entries, (e) => e.amount)} />
          </Hero>
          {isDay && (
            <Card
              title="Paise kahan hain"
              action={
                <button className="linkBtn" onClick={() => setEditOpening(true)}>
                  {open ? 'Opening badlein' : 'Opening likhein'}
                </button>
              }
            >
              {closing ? (
                <StatGrid>
                  <Stat label="Cash drawer" value={closing.cash} hint={`Subah: ${rs(open!.cash)}`} accent="#0f766e" />
                  <Stat label="Easypaisa" value={closing.easypaisa} hint={`Subah: ${rs(open!.easypaisa)}`} accent="#16a34a" />
                  <Stat label="JazzCash" value={closing.jazzcash} hint={`Subah: ${rs(open!.jazzcash)}`} accent="#dc2626" />
                </StatGrid>
              ) : (
                <div className="empty">Subah ka opening likhein, phir din bhar ka cash, Easypaisa aur JazzCash khud hisab hota rahega.</div>
              )}
            </Card>
          )}
          <StatGrid>
            {(['wallet', 'load', 'copy', 'acc', 'online'] as BizKind[]).map((k) => (
              <Stat
                key={k}
                label={`${KIND_ICON[k]} ${KIND_LABEL[k]}`}
                value={profitOf(k)}
                tone="in"
                hint={`${of(k).length} entries ›`}
                onClick={() => setTab(k)}
              />
            ))}
          </StatGrid>
          <Card title={isDay ? 'Aaj ki entries' : 'Is mahine ki entries'}>
            <List empty="Abhi koi entry nahi. Neeche “+ Entry” dabayein.">{entries.map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'wallet' && (
        <>
          {isDay && (
            <Card
              title="Subah ka opening"
              action={
                <button className="linkBtn" onClick={() => setEditOpening(true)}>
                  {open ? 'Badlein' : 'Likhein'}
                </button>
              }
            >
              {open ? (
                <StatGrid>
                  <Stat label="Cash" value={open.cash} />
                  <Stat label="Easypaisa" value={open.easypaisa} />
                  <Stat label="JazzCash" value={open.jazzcash} />
                </StatGrid>
              ) : (
                <div className="empty">Aaj subah kitne paise the? “Likhein” dabayein.</div>
              )}
            </Card>
          )}
          {(['easypaisa', 'jazzcash'] as const).map((w) => {
            const list = of('wallet').filter((e) => e.wallet === w)
            const sent = sum(list.filter((e) => e.dir !== 'withdraw'), (e) => e.amount)
            const out = sum(list.filter((e) => e.dir === 'withdraw'), (e) => e.amount)
            return (
              <Card key={w} title={WALLET_LABEL[w]}>
                <StatGrid>
                  <Stat label="Bheja / Deposit" value={sent} />
                  <Stat label="Nikala / Withdraw" value={out} />
                  <Stat label="Commission" value={sum(list, (e) => e.profit)} tone="in" />
                  {closing && <Stat label="Abhi balance" value={closing[w]} />}
                </StatGrid>
              </Card>
            )
          })}
          <Card title="Entries">
            <List empty="Koi len-den nahi">{of('wallet').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'load' && (
        <>
          <Hero label="Load ka profit" value={profitOf('load')}>
            <HeroStat label="Kul load" value={sum(of('load'), (e) => e.amount)} />
          </Hero>
          <StatGrid>
            {NETWORKS.map((n) => {
              const list = of('load').filter((e) => e.network === n)
              return (
                <Stat
                  key={n}
                  label={n}
                  value={sum(list, (e) => e.amount)}
                  hint={`Profit ${rs(sum(list, (e) => e.profit))}`}
                  accent={NETWORK_COLORS[n]}
                />
              )
            })}
          </StatGrid>
          <Card title="Entries">
            <List empty="Koi load entry nahi">{of('load').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'copy' && (
        <>
          <Hero label="Photocopy / Print ki kamai" value={profitOf('copy')}>
            <HeroStat label="Kul pages" value={String(sum(of('copy'), (e) => e.qty ?? 0))} />
          </Hero>
          <Card title="Kis cheez se kitna">
            <Breakdown rows={groupSum(of('copy'), (e) => e.copyType ?? '', (e) => e.amount)} tone="in" />
          </Card>
          <Card title="Rates">
            <div className="rateList">
              {COPY_TYPES.map((t) => (
                <span key={t} className="rateChip">
                  {t}: <b>{rs(settings.rates[t] ?? 0)}</b>
                </span>
              ))}
            </div>
            <div className="statHint">Rates Settings ⚙️ se badal sakte hain.</div>
          </Card>
          <Card title="Entries">
            <List empty="Koi entry nahi">{of('copy').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'acc' && (
        <>
          <Hero label="Accessories ka profit" value={profitOf('acc')}>
            <HeroStat label="Kul sale" value={sum(of('acc'), (e) => e.amount)} />
            <HeroStat label="Items" value={String(sum(of('acc'), (e) => e.qty ?? 1))} />
          </Hero>
          <Card title="Sab se zyada bikne wale">
            <Breakdown rows={groupSum(of('acc'), (e) => e.item ?? '', (e) => e.amount).slice(0, 8)} tone="in" />
          </Card>
          <Card title="Entries">
            <List empty="Koi sale nahi">{of('acc').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'online' && (
        <>
          <Hero label="Online kaam ka profit" value={profitOf('online')}>
            <HeroStat label="Kul fees" value={sum(of('online'), (e) => e.amount)} />
            <HeroStat label="Pending" value={String(of('online').filter((e) => e.status !== 'done').length)} />
          </Hero>
          <Card title="Kaun sa kaam kitna">
            <Breakdown rows={groupSum(of('online'), (e) => e.service ?? '', (e) => e.profit)} tone="in" />
          </Card>
          <Card title="Entries (status badalne ke liye Pending/Done dabayein)">
            <List empty="Koi kaam nahi">{of('online').map(rowFor)}</List>
          </Card>
        </>
      )}

      <Fab label="Entry" onClick={() => setAdding(tab === 'dash' ? 'wallet' : tab)} />

      {adding && (
        <BizForm uid={uid} initialKind={adding} date={newDate} rates={settings.rates} onClose={() => setAdding(null)} />
      )}
      {editOpening && (
        <OpeningForm uid={uid} date={period.date} current={open ?? ZERO} onClose={() => setEditOpening(false)} />
      )}
      {deleting && (
        <ConfirmDelete
          what={`${entryTitle(deleting)} — ${rs(deleting.amount)}`}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeItem(bizCol(uid), deleting.id)}
        />
      )}
    </>
  )
}

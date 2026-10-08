import { useState } from 'react'
import type { BizEntry, BizKind, DayOpening, Period, Settings } from '../../types'
import { bizCol, dayDoc } from '../../lib/paths'
import { byDateRange, patchItem, removeItem, useLiveDoc, useLiveQuery } from '../../hooks/useData'
import { addDays, dailySeries, groupSum, periodRange, rs, shiftPeriod, shortDate, sum, today } from '../../lib/format'
import { Donut } from '../ui/Donut'
import { BarChart } from '../ui/BarChart'
import { COPY_TYPES, NETWORK_COLORS, allNetworks } from '../../lib/catalog'
import { Breakdown, Card, ConfirmDelete, Fab, Hero, HeroStat, List, PeriodBar, QuickActions, Row, Stat, StatGrid, Tabs } from '../ui/kit'
import { KIND_ICON, KIND_LABEL, KIND_SHORT, WALLET_LABEL, entrySub, entryTitle, walletClosing } from './bizMeta'
import { BizForm } from './BizForm'
import { OpeningForm } from './OpeningForm'
import { InvestTab } from './InvestTab'
import { AddBizSheet } from './AddBizSheet'
import { StockTab } from './StockTab'
import { isLow } from '../../lib/stock'
import { stockCol } from '../../lib/paths'
import type { Product } from '../../types'

/** Built-in pages, a page per user-added category (`c:<name>`), then Investment. */
export type BizTab = 'dash' | Exclude<BizKind, 'custom'> | 'stock' | 'invest' | `c:${string}`
const BASE_TABS: { id: BizTab; label: string; icon: string }[] = [
  { id: 'dash', label: 'Dashboard', icon: '📊' },
  { id: 'wallet', label: 'Easypaisa / JazzCash', icon: '💸' },
  { id: 'load', label: 'Load', icon: '📶' },
  { id: 'copy', label: 'Photocopy', icon: '🖨️' },
  { id: 'acc', label: 'Accessories', icon: '🎧' },
  { id: 'stock', label: 'Stock', icon: '📦' },
  { id: 'online', label: 'Online services', icon: '🪪' },
]

export function bizTabs(settings: Settings): { id: BizTab; label: string; icon: string }[] {
  return [
    ...BASE_TABS,
    ...(settings.customBiz ?? []).map((c) => ({ id: `c:${c.name}` as BizTab, label: c.name, icon: c.icon })),
    { id: 'invest', label: 'Investment', icon: '🏦' },
  ]
}

const KINDS: Exclude<BizKind, 'custom'>[] = ['wallet', 'load', 'copy', 'acc', 'online']

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const ZERO: DayOpening = { cash: 0, easypaisa: 0, jazzcash: 0 }

export function BizSection({
  uid,
  settings,
  tab,
  setTab,
}: {
  uid: string
  settings: Settings
  tab: BizTab
  setTab: (t: BizTab) => void
}) {
  const [period, setPeriod] = useState<Period>({ mode: 'day', date: today() })
  const [adding, setAddingState] = useState<{ kind: BizKind; biz?: string } | null>(null)
  const setAdding = (kind: BizKind | null, biz?: string) => setAddingState(kind ? { kind, biz } : null)
  const [addingBiz, setAddingBiz] = useState(false)
  const customs = settings.customBiz ?? []
  const tabs = bizTabs(settings)
  const customIcon = (name?: string) => customs.find((c) => c.name === name)?.icon ?? KIND_ICON.custom
  const customTab = tab.startsWith('c:') ? tab.slice(2) : null
  const stock = useLiveQuery<Product>(stockCol(uid), `stock-${uid}`)
  const lowStock = stock.items.filter(isLow)
  const noPeriod = tab === 'invest' || tab === 'stock'
  const [deleting, setDeleting] = useState<BizEntry | null>(null)
  const [editOpening, setEditOpening] = useState(false)

  const [from, to] = periodRange(period)
  const { items, error } = useLiveQuery<BizEntry>(byDateRange(bizCol(uid), from, to), `biz-${uid}-${from}-${to}`)
  // Chart window: the whole month, or the 14 days ending on the chosen day.
  const [tFrom, tTo] = period.mode === 'month' ? [from, to] : [addDays(period.date, -13), period.date]
  const trend = useLiveQuery<BizEntry>(byDateRange(bizCol(uid), tFrom, tTo), `biz-${uid}-${tFrom}-${tTo}`)
  const [pFrom, pTo] = periodRange(shiftPeriod(period, -1))
  const prev = useLiveQuery<BizEntry>(byDateRange(bizCol(uid), pFrom, pTo), `biz-${uid}-${pFrom}-${pTo}`)
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
      icon={e.kind === 'custom' ? customIcon(e.biz) : KIND_ICON[e.kind]}
      title={entryTitle(e)}
      sub={entrySub(e)}
      amount={rs(e.amount)}
      amountSub={isDay ? timeOf(e.createdAt) : shortDate(e.date)}
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
      <div className="mobileOnly">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <div className="pageHead">
        <h1 className="pageTitle desktopOnly">{tabs.find((t) => t.id === tab)?.label}</h1>
        {!noPeriod && <PeriodBar period={period} onChange={setPeriod} />}
      </div>
      {tab === 'invest' && <InvestTab uid={uid} />}
      {tab === 'stock' && <StockTab uid={uid} />}
      {error && <div className="errorBanner">{error}</div>}

      {tab === 'dash' && (
        <>
          <Hero
            label={isDay ? 'Profit for the day' : 'Profit for the month'}
            value={totalProfit}
            delta={{ now: totalProfit, before: sum(prev.items, (e) => e.profit), vs: isDay ? 'previous day' : 'last month' }}
            spark={dailySeries(trend.items, tFrom, tTo, (e) => e.profit).map((d) => d.value)}
          >
            <HeroStat label="Entries" value={String(entries.length)} />
            <HeroStat label="Total handled" value={sum(entries, (e) => e.amount)} />
          </Hero>
          {isDay && (
            <Card
              title="Cash & wallet balances"
              action={
                <button className="linkBtn" onClick={() => setEditOpening(true)}>
                  {open ? 'Edit opening' : 'Set opening'}
                </button>
              }
            >
              <StatGrid>
                <Stat label="Cash in drawer" value={(closing ?? ZERO).cash} hint={open ? `Opening: ${rs(open.cash)}` : 'Opening not set'} accent="#0f766e" />
                <Stat label="Easypaisa" value={(closing ?? ZERO).easypaisa} hint={open ? `Opening: ${rs(open.easypaisa)}` : 'Opening not set'} accent="#16a34a" />
                <Stat label="JazzCash" value={(closing ?? ZERO).jazzcash} hint={open ? `Opening: ${rs(open.jazzcash)}` : 'Opening not set'} accent="#dc2626" />
              </StatGrid>
              {!open && (
                <button className="setupBanner" onClick={() => setEditOpening(true)}>
                  <b>Start your day:</b> set today's opening cash, Easypaisa and JazzCash balances — they will update
                  automatically with every entry. ›
                </button>
              )}
            </Card>
          )}
          {lowStock.length > 0 && (
            <button className="setupBanner warn" onClick={() => setTab('stock')}>
              <b>⚠️ {lowStock.length} product{lowStock.length > 1 ? 's' : ''} running low:</b>{' '}
              {lowStock
                .slice(0, 4)
                .map((p) => `${p.name} (${p.qty} left)`)
                .join(', ')}
              {lowStock.length > 4 ? '…' : ''} ›
            </button>
          )}
          <Card title="Quick add">
            <QuickActions
              items={[
                ...KINDS.map((k) => ({ icon: KIND_ICON[k], label: KIND_LABEL[k], onClick: () => setAdding(k) })),
                ...customs.map((c) => ({ icon: c.icon, label: c.name, onClick: () => setAdding('custom', c.name) })),
                { icon: '＋', label: 'New category', hint: 'Add your own business', onClick: () => setAddingBiz(true) },
              ]}
            />
          </Card>
          <div className="dashGrid">
            <Card title={isDay ? 'Profit — last 14 days' : 'Daily profit this month'}>
              <BarChart data={dailySeries(trend.items, tFrom, tTo, (e) => e.profit)} />
            </Card>
            <Card title="Profit by business">
              <Donut
                centerLabel="Total profit"
                slices={[
                  ...KINDS.map((k, i) => ({ label: KIND_SHORT[k], value: profitOf(k), color: `var(--series-${i + 1})` })),
                  // Past five categories, user-added businesses fold into one neutral "Other" slice.
                  ...(customs.length ? [{ label: 'Other', value: profitOf('custom'), color: 'var(--muted)' }] : []),
                ]}
              />
            </Card>
          </div>
          <StatGrid>
            {KINDS.map((k) => (
              <Stat
                key={k}
                icon={KIND_ICON[k]}
                label={KIND_LABEL[k]}
                value={profitOf(k)}
                tone="in"
                hint={`${of(k).length} entries ›`}
                onClick={() => setTab(k)}
              />
            ))}
            {customs.map((c) => {
              const list = of('custom').filter((e) => e.biz === c.name)
              return (
                <Stat
                  key={c.name}
                  icon={c.icon}
                  label={c.name}
                  value={sum(list, (e) => e.profit)}
                  tone="in"
                  hint={`${list.length} entries ›`}
                  onClick={() => setTab(`c:${c.name}`)}
                />
              )
            })}
          </StatGrid>
          <Card title={isDay ? 'Entries for the day' : 'Entries this month'}>
            <List empty="No entries yet. Tap “+ New entry” to add one.">{entries.map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'wallet' && (
        <>
          {isDay && (
            <Card
              title="Opening balance"
              action={
                <button className="linkBtn" onClick={() => setEditOpening(true)}>
                  {open ? 'Edit' : 'Set'}
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
                <div className="empty">How much did you start the day with? Tap “Set”.</div>
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
                  <Stat label="Sent / Deposited" value={sent} />
                  <Stat label="Withdrawn" value={out} />
                  <Stat label="Commission" value={sum(list, (e) => e.profit)} tone="in" />
                  {closing && <Stat label="Current balance" value={closing[w]} />}
                </StatGrid>
              </Card>
            )
          })}
          <Card title="Entries">
            <List empty="No transactions">{of('wallet').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'load' && (
        <>
          <Hero label="Load profit" value={profitOf('load')}>
            <HeroStat label="Total load" value={sum(of('load'), (e) => e.amount)} />
          </Hero>
          <StatGrid>
            {allNetworks([...(settings.networks ?? []), ...of('load').map((e) => e.network ?? '')]).map((n) => {
              const list = of('load').filter((e) => e.network === n)
              return (
                <Stat
                  key={n}
                  label={n}
                  value={sum(list, (e) => e.amount)}
                  hint={`Profit ${rs(sum(list, (e) => e.profit))}`}
                  accent={NETWORK_COLORS[n] ?? '#64748b'}
                />
              )
            })}
          </StatGrid>
          <Card title="Entries">
            <List empty="No load entries">{of('load').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'copy' && (
        <>
          <Hero label="Photocopy & print income" value={profitOf('copy')}>
            <HeroStat label="Total pages" value={String(sum(of('copy'), (e) => e.qty ?? 0))} />
          </Hero>
          <Card title="By type">
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
            <div className="statHint">Change rates in Settings ⚙️.</div>
          </Card>
          <Card title="Entries">
            <List empty="No entries">{of('copy').map(rowFor)}</List>
          </Card>
        </>
      )}

      {tab === 'acc' && (
        <>
          <Hero label="Accessories profit" value={profitOf('acc')}>
            <HeroStat label="Total sales" value={sum(of('acc'), (e) => e.amount)} />
            <HeroStat label="Items" value={String(sum(of('acc'), (e) => e.qty ?? 1))} />
          </Hero>
          <Card title="Top sellers">
            <Breakdown rows={groupSum(of('acc'), (e) => e.item ?? '', (e) => e.amount).slice(0, 8)} tone="in" />
          </Card>
          <Card title="Entries">
            <List empty="No sales">{of('acc').map(rowFor)}</List>
          </Card>
        </>
      )}

      {customTab !== null &&
        (() => {
          const list = of('custom').filter((e) => e.biz === customTab)
          return (
            <>
              <Hero label={`${customTab} profit`} value={sum(list, (e) => e.profit)}>
                <HeroStat label="Total received" value={sum(list, (e) => e.amount)} />
                <HeroStat label="Entries" value={String(list.length)} />
              </Hero>
              <Card title="By item">
                <Breakdown rows={groupSum(list, (e) => e.item || 'Other', (e) => e.amount)} tone="in" />
              </Card>
              <Card title="Entries">
                <List empty="No entries yet. Tap “+ New entry”.">{list.map(rowFor)}</List>
              </Card>
            </>
          )
        })()}

      {tab === 'online' && (
        <>
          <Hero label="Online services profit" value={profitOf('online')}>
            <HeroStat label="Total fees" value={sum(of('online'), (e) => e.amount)} />
            <HeroStat label="Pending" value={String(of('online').filter((e) => e.status !== 'done').length)} />
          </Hero>
          <Card title="By service">
            <Breakdown rows={groupSum(of('online'), (e) => e.service ?? '', (e) => e.profit)} tone="in" />
          </Card>
          <Card title="Entries (tap Pending/Done to change status)">
            <List empty="No services recorded">{of('online').map(rowFor)}</List>
          </Card>
        </>
      )}

      {!noPeriod && (
        <Fab
          label="New entry"
          onClick={() =>
            customTab !== null
              ? setAdding('custom', customTab)
              : setAdding(tab === 'dash' || tab.startsWith('c:') ? 'wallet' : (tab as BizKind))
          }
        />
      )}
      {addingBiz && (
        <AddBizSheet
          uid={uid}
          existing={customs}
          onClose={() => setAddingBiz(false)}
          onAdded={(b) => setTab(`c:${b.name}`)}
        />
      )}

      {adding && (
        <BizForm
          uid={uid}
          initialKind={adding.kind}
          initialBiz={adding.biz}
          customs={customs}
          products={stock.items}
          date={newDate}
          rates={settings.rates}
          networks={allNetworks(settings.networks)}
          onClose={() => setAdding(null)}
        />
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

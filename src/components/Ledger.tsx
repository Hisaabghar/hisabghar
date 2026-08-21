import type { Account, Transaction } from '../types'
import { balanceOf, fmt, monthStats } from '../lib/txnUtils'
import { TxnItem } from './TxnItem'

export function Ledger({
  account,
  allTxns,
  searchQuery,
  onSearchChange,
  onOpenMenu,
  onQuickAllowance,
  onOpenNewTxn,
  onOpenTxnDetail,
  onPlayVoice,
  addingQuickTxn,
}: {
  account: Account
  allTxns: Transaction[]
  searchQuery: string
  onSearchChange: (v: string) => void
  onOpenMenu: () => void
  onQuickAllowance: () => void
  onOpenNewTxn: (type: 'in' | 'out') => void
  onOpenTxnDetail: (id: string) => void
  onPlayVoice: (txn: Transaction) => void
  addingQuickTxn: boolean
}) {
  const bal = balanceOf(allTxns)
  const stats = monthStats(allTxns)
  const q = searchQuery.trim().toLowerCase()
  const txns = q
    ? allTxns.filter((t) => t.category.toLowerCase().includes(q) || t.note.toLowerCase().includes(q))
    : allTxns

  return (
    <div className="ledger">
      <div className="ledgerHead">
        <div>
          <div className="accNameRow">
            <div className="accName">{account.name}</div>
            <button className="menuBtn" onClick={onOpenMenu}>
              ⋮
            </button>
          </div>
          <div className="accCount">
            {allTxns.length} {allTxns.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
        <div>
          <div className="balanceLabel">Balance</div>
          <div className={`balanceAmt ${bal < 0 ? 'neg' : 'pos'}`}>Rs {fmt(bal)}</div>
        </div>
      </div>

      <div className="statsRow">
        <div className="statCard">
          <div className="statLabel">This month in</div>
          <div className="statVal in">+{fmt(stats.inSum)}</div>
        </div>
        <div className="statCard">
          <div className="statLabel">This month out</div>
          <div className="statVal out">−{fmt(stats.outSum)}</div>
        </div>
        <div className="statCard">
          <div className="statLabel">Net</div>
          <div className={`statVal ${stats.net < 0 ? 'out' : 'in'}`}>
            {stats.net < 0 ? '−' : '+'}
            {fmt(Math.abs(stats.net))}
          </div>
        </div>
      </div>

      <div className="quickAdd">
        <button className="quickBtn" onClick={onQuickAllowance} disabled={addingQuickTxn}>
          💰 Add 150,000 from Dad
        </button>
        <button className="quickBtn secondary" onClick={() => onOpenNewTxn('out')}>
          − Expense
        </button>
      </div>

      <div className="searchRow">
        <input
          type="text"
          placeholder="Search entries…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="txnList">
        {txns.length === 0 ? (
          <div className="empty">No entries yet. Tap + to add your first one.</div>
        ) : (
          txns.map((t) => (
            <TxnItem key={t.id} txn={t} onOpen={() => onOpenTxnDetail(t.id)} onPlayVoice={() => onPlayVoice(t)} />
          ))
        )}
      </div>
    </div>
  )
}

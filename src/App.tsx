import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAccounts } from './hooks/useAccounts'
import { useTransactions } from './hooks/useTransactions'
import { AuthScreen } from './components/AuthScreen'
import { Ledger } from './components/Ledger'
import { NewAccountModal } from './components/modals/NewAccountModal'
import { AccMenuModal } from './components/modals/AccMenuModal'
import { RenameAccountModal } from './components/modals/RenameAccountModal'
import { ConfirmDeleteAccountModal } from './components/modals/ConfirmDeleteAccountModal'
import { NewTxnModal } from './components/modals/NewTxnModal'
import { TxnDetailModal } from './components/modals/TxnDetailModal'
import type { Transaction, TxnDraft, TxnType } from './types'
import { balanceOf, fmt } from './lib/txnUtils'
import { getVoiceNoteUrl, uploadVoiceNote } from './lib/voiceNotes'

type Modal =
  | { kind: 'newAccount' }
  | { kind: 'accMenu' }
  | { kind: 'renameAcc' }
  | { kind: 'confirmDeleteAcc' }
  | { kind: 'newTxn'; draft: TxnDraft }
  | { kind: 'txnDetail'; txnId: string }
  | null

function App() {
  const auth = useAuth()

  if (auth.loading) {
    return <div className="loadingScreen">Loading…</div>
  }
  if (!auth.user) {
    return <AuthScreen auth={auth} />
  }
  return <LedgerApp userId={auth.user.id} onSignOut={auth.signOut} />
}

function LedgerApp({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const accountsState = useAccounts(userId)
  const txnsState = useTransactions(userId, accountsState.activeAccountId)
  const [searchQuery, setSearchQuery] = useState('')
  const [modal, setModal] = useState<Modal>(null)

  const { accounts, activeAccountId, setActiveAccountId } = accountsState
  const activeAccount = accounts.find((a) => a.id === activeAccountId)

  if (accountsState.loading || !activeAccount) {
    return <div className="loadingScreen">Setting up your ledger…</div>
  }

  const activeTxns = txnsState.txnsFor(activeAccountId)
  const totalAll = accounts.reduce((sum, a) => sum + balanceOf(txnsState.txnsFor(a.id)), 0)

  function switchAccount(id: string) {
    setSearchQuery('')
    setActiveAccountId(id)
  }

  async function submitTxn(draft: TxnDraft, voiceBlob: Blob | null) {
    const amt = parseFloat(draft.amount)
    if (!amt || amt <= 0 || !activeAccountId) return
    let voiceNoteUrl: string | null = null
    if (voiceBlob) {
      voiceNoteUrl = await uploadVoiceNote(userId, voiceBlob)
    }
    await txnsState.addTransaction(activeAccountId, {
      type: draft.type,
      amount: amt,
      category: draft.category.trim() || (draft.type === 'in' ? 'Received' : 'Expense'),
      note: draft.note.trim(),
      voiceNoteUrl,
    })
    setModal(null)
  }

  async function playVoiceFromList(txn: Transaction) {
    if (!txn.voiceNoteUrl) return
    try {
      const url = await getVoiceNoteUrl(txn.voiceNoteUrl)
      new Audio(url).play()
    } catch {
      // ignore playback failure
    }
  }

  function openNewTxn(type: TxnType) {
    setModal({ kind: 'newTxn', draft: { type, amount: '', category: '', note: '' } })
  }

  async function handleDeleteTxn(id: string) {
    if (!activeAccountId) return
    await txnsState.deleteTransaction(activeAccountId, id)
    setModal(null)
  }

  async function handleDeleteAccount() {
    if (!activeAccountId) return
    const ok = await accountsState.deleteAccount(activeAccountId)
    if (ok) txnsState.purgeAccount(activeAccountId)
    setModal(null)
  }

  const selectedTxn = modal?.kind === 'txnDetail' ? activeTxns.find((t) => t.id === modal.txnId) : null
  const combinedError = accountsState.error || txnsState.error

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <div className="mark">L</div>
          <div>
            <div className="title">Ledger</div>
            <div className="subtitle">your money, your voice</div>
          </div>
        </div>
        <button className="iconBtn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>

      <div className="hero">
        <div className="totalLabel">Total balance</div>
        <div className="totalAmt">
          <span className="cur">Rs</span>
          {fmt(totalAll)}
        </div>
        <div className="heroMeta">
          <span className="heroChip">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>
      </div>

      {combinedError && <div className="errorBanner">{combinedError}</div>}

      <div className="tabsRow">
        {accounts.map((a) => (
          <div
            key={a.id}
            className={`tab ${a.id === activeAccountId ? 'active' : ''}`}
            onClick={() => switchAccount(a.id)}
          >
            {a.name}
          </div>
        ))}
        <div className="tab addTab" onClick={() => setModal({ kind: 'newAccount' })}>
          + New
        </div>
      </div>

      <Ledger
        account={activeAccount}
        allTxns={activeTxns}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenMenu={() => setModal({ kind: 'accMenu' })}
        onOpenNewTxn={openNewTxn}
        onOpenTxnDetail={(id) => setModal({ kind: 'txnDetail', txnId: id })}
        onPlayVoice={playVoiceFromList}
      />

      <button className="fab" onClick={() => openNewTxn('out')}>
        <span className="plus">+</span> New entry
      </button>

      {modal?.kind === 'newAccount' && (
        <NewAccountModal
          onClose={() => setModal(null)}
          onCreate={async (name) => {
            await accountsState.addAccount(name)
            setModal(null)
          }}
        />
      )}

      {modal?.kind === 'accMenu' && (
        <AccMenuModal
          accountName={activeAccount.name}
          onClose={() => setModal(null)}
          onRename={() => setModal({ kind: 'renameAcc' })}
          onDelete={() => setModal({ kind: 'confirmDeleteAcc' })}
        />
      )}

      {modal?.kind === 'renameAcc' && (
        <RenameAccountModal
          currentName={activeAccount.name}
          onClose={() => setModal(null)}
          onSave={async (name) => {
            await accountsState.renameAccount(activeAccount.id, name)
            setModal(null)
          }}
        />
      )}

      {modal?.kind === 'confirmDeleteAcc' && (
        <ConfirmDeleteAccountModal
          accountName={activeAccount.name}
          entryCount={activeTxns.length}
          onClose={() => setModal(null)}
          onConfirm={handleDeleteAccount}
        />
      )}

      {modal?.kind === 'newTxn' && (
        <NewTxnModal initialDraft={modal.draft} onClose={() => setModal(null)} onSave={submitTxn} />
      )}

      {modal?.kind === 'txnDetail' && selectedTxn && (
        <TxnDetailModal txn={selectedTxn} onClose={() => setModal(null)} onDelete={() => handleDeleteTxn(selectedTxn.id)} />
      )}
    </div>
  )
}

export default App

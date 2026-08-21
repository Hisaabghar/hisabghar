import type { Transaction } from '../types'
import { dateStr, fmt, iconFor } from '../lib/txnUtils'

export function TxnItem({ txn, onOpen, onPlayVoice }: { txn: Transaction; onOpen: () => void; onPlayVoice: () => void }) {
  return (
    <div className="txn" onClick={onOpen}>
      <div className="txnIcon">{iconFor(txn.category, txn.type)}</div>
      <div className="txnBody">
        <div className="txnCat">{txn.category}</div>
        {txn.note && <div className="txnNote">{txn.note}</div>}
      </div>
      {txn.voiceNoteUrl && (
        <button
          className="voiceBtn"
          onClick={(e) => {
            e.stopPropagation()
            onPlayVoice()
          }}
        >
          🔊
        </button>
      )}
      <div className="txnRight">
        <div className={`txnAmt ${txn.type}`}>
          {txn.type === 'in' ? '+' : '−'}
          {fmt(txn.amount)}
        </div>
        <div className="txnDate">{dateStr(txn.createdAt)}</div>
      </div>
    </div>
  )
}

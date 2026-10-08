import { useState } from 'react'
import { Sheet } from '../Sheet'
import type { Transaction } from '../../types'
import { fmt, fullDateStr, iconFor } from '../../lib/txnUtils'
import { getVoiceNoteUrl } from '../../lib/voiceNotes'

export function TxnDetailModal({
  txn,
  onClose,
  onDelete,
}: {
  txn: Transaction
  onClose: () => void
  onDelete: () => void
}) {
  const [playing, setPlaying] = useState(false)

  async function playVoice() {
    if (!txn.voiceNoteUrl || playing) return
    setPlaying(true)
    try {
      const url = await getVoiceNoteUrl(txn.voiceNoteUrl)
      const audio = new Audio(url)
      audio.onended = () => setPlaying(false)
      audio.onerror = () => setPlaying(false)
      await audio.play()
    } catch {
      setPlaying(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheetTitle">
        {iconFor(txn.category, txn.type)} {txn.category}
      </div>
      <div className={`detailAmt txnAmt ${txn.type}`}>
        {txn.type === 'in' ? '+' : '−'}Rs {fmt(txn.amount)}
      </div>
      <div className="detailDate">{fullDateStr(txn.createdAt)}</div>
      {txn.note && (
        <div className="field">
          <label>Note</label>
          <div style={{ fontSize: 14 }}>{txn.note}</div>
        </div>
      )}
      {txn.voiceNoteUrl && (
        <div className="field">
          <label>Voice note</label>
          <button className="quickBtn plain" style={{ width: '100%' }} onClick={playVoice} disabled={playing}>
            {playing ? '▶ Playing…' : '🔊 Play voice note'}
          </button>
        </div>
      )}
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Close
        </button>
        <button className="btnDanger" onClick={onDelete}>
          Delete entry
        </button>
      </div>
    </Sheet>
  )
}

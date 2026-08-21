import { useState } from 'react'
import { Sheet } from '../Sheet'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import type { TxnDraft } from '../../types'

export function NewTxnModal({
  initialDraft,
  onClose,
  onSave,
}: {
  initialDraft: TxnDraft
  onClose: () => void
  onSave: (draft: TxnDraft, voiceBlob: Blob | null) => Promise<void>
}) {
  const [draft, setDraft] = useState<TxnDraft>(initialDraft)
  const [saving, setSaving] = useState(false)
  const recorder = useVoiceRecorder()

  const amt = parseFloat(draft.amount)
  const canSave = !!amt && amt > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave(draft, recorder.blob)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheetTitle">New entry</div>
      <div className="typeRow" style={{ marginBottom: 13 }}>
        <button
          className={`typeBtn ${draft.type === 'in' ? 'sel in' : ''}`}
          onClick={() => setDraft((d) => ({ ...d, type: 'in' }))}
        >
          Income (+)
        </button>
        <button
          className={`typeBtn ${draft.type === 'out' ? 'sel out' : ''}`}
          onClick={() => setDraft((d) => ({ ...d, type: 'out' }))}
        >
          Expense (−)
        </button>
      </div>
      <div className="field">
        <label>Amount (Rs)</label>
        <input
          type="number"
          inputMode="numeric"
          value={draft.amount}
          onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
          placeholder="0"
        />
      </div>
      <div className="field">
        <label>Category</label>
        <input
          type="text"
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          placeholder="e.g. Food, Rent, Shopping"
        />
      </div>
      <div className="field">
        <label>Note</label>
        <textarea
          rows={2}
          value={draft.note}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          placeholder="Add a detail (optional)"
        />
      </div>
      <div className="field">
        <label>Voice note</label>
        <div className="voiceRow">
          <button
            className={`recBtn ${recorder.recording ? 'recording' : ''}`}
            disabled={saving}
            onClick={() => (recorder.recording ? recorder.stop() : recorder.start())}
          >
            {recorder.recording ? '⏹' : '🎙'}
          </button>
          <div className="voiceStatus">
            {recorder.error
              ? recorder.error
              : recorder.recording
                ? 'Recording… tap to stop'
                : recorder.blob
                  ? 'Voice note ready ✓'
                  : 'Tap to record'}
          </div>
        </div>
      </div>
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button className="btnPrimary" onClick={handleSave} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </Sheet>
  )
}

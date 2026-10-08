import { useEffect, useRef, useState } from 'react'
import type { BizEntry, HomeEntry, LoanEntry, Product, Settings } from '../types'
import { bizCol, homeCol, loansCol, stockCol } from '../lib/paths'
import { allByDate, useLiveQuery } from '../hooks/useData'
import { MENTOR_SUGGESTIONS, answer, type MentorAnswer } from '../lib/mentor'

type Msg = { from: 'me' | 'mentor'; text?: string; a?: MentorAnswer }

const WELCOME: MentorAnswer = {
  lines: [
    'Assalam o Alaikum! I’m your Mentor. Ask me about your shop and home accounts in English or Roman Urdu — sales, profit, stock, load, Easypaisa/JazzCash, loans, spending or balances.',
    'Everything stays on your device; nothing is sent to any AI company.',
  ],
}

export function MentorPage({
  uid,
  settings,
  homeUnlocked,
  onOpenHome,
}: {
  uid: string
  settings: Settings
  homeUnlocked: boolean
  onOpenHome: () => void
}) {
  const biz = useLiveQuery<BizEntry>(allByDate(bizCol(uid)), `bizall-${uid}`)
  const stock = useLiveQuery<Product>(stockCol(uid), `stock-${uid}`)
  const home = useLiveQuery<HomeEntry>(allByDate(homeCol(uid)), `home-${uid}`)
  const loans = useLiveQuery<LoanEntry>(allByDate(loansCol(uid)), `loans-${uid}`)
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'mentor', a: WELCOME }])
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs])

  function ask(q: string) {
    const question = q.trim()
    if (!question) return
    const a = answer(question, {
      biz: biz.items,
      stock: stock.items,
      home: homeUnlocked ? home.items : null,
      loans: homeUnlocked ? loans.items : null,
      customs: (settings.customBiz ?? []).map((c) => c.name),
    })
    setMsgs((m) => [...m, { from: 'me', text: question }, { from: 'mentor', a }])
    setText('')
  }

  return (
    <div className="mentor">
      <div className="pageHead">
        <h1 className="pageTitle">🤖 Mentor</h1>
      </div>
      <div className="chat">
        {msgs.map((m, i) =>
          m.from === 'me' ? (
            <div key={i} className="bubble me">
              {m.text}
            </div>
          ) : (
            <div key={i} className="bubble bot">
              {m.a!.lines.map((l, j) => (
                <div key={j}>{l}</div>
              ))}
              {m.a!.links && (
                <div className="botLinks">
                  {m.a!.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              )}
              {m.a!.needsUnlock && (
                <button className="linkBtn" onClick={onOpenHome}>
                  Open Home Accounts ›
                </button>
              )}
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <div className="suggest">
        {MENTOR_SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="askBar"
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything… e.g. 5 Oct ko kitni sale hui?" />
        <button className="btnPrimary" disabled={!text.trim()}>
          Ask
        </button>
      </form>
    </div>
  )
}

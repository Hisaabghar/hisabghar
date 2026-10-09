import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Content } from 'firebase/ai'
import type { BizEntry, HomeEntry, LoanEntry, Product, Settings } from '../types'
import { bizCol, homeCol, loansCol, stockCol } from '../lib/paths'
import { allByDate, useLiveQuery } from '../hooks/useData'
import { MENTOR_SUGGESTIONS, answer, buildContext, needsSearch, type MentorAnswer } from '../lib/mentor'
import type { GeminiReply } from '../lib/gemini'
import { areAmountsHidden, setAmountsHidden } from '../lib/format'
import { PinGate } from './home/PinGate'
import { mergeDoc } from '../hooks/useData'
import { settingsDoc } from '../lib/paths'
import { Segmented } from './ui/kit'

type Msg = { from: 'me' | 'mentor'; text?: string; a?: MentorAnswer; ai?: GeminiReply; err?: string; loading?: boolean }
type Mode = 'offline' | 'gemini'

const MODE_KEY = 'mentor-mode'
const readMode = (): Mode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'gemini' ? 'gemini' : 'offline'
  } catch {
    return 'offline'
  }
}

/** Minimal markdown: paragraphs, bullet lines, **bold** and [text](url). */
function Markdown({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
      const b = part.match(/^\*\*([^*]+)\*\*$/)
      if (b) return <b key={i}>{b[1]}</b>
      const l = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (l)
        return (
          <a key={i} href={l[2]} target="_blank" rel="noreferrer">
            {l[1]}
          </a>
        )
      return part
    })
  return (
    <>
      {text
        .split('\n')
        .filter((l) => l.trim())
        .map((l, i) => {
          const bullet = l.match(/^\s*[-*•]\s+(.*)/)
          return bullet ? (
            <div key={i} className="mdBullet">
              • {inline(bullet[1])}
            </div>
          ) : (
            <div key={i}>{inline(l.replace(/^#+\s*/, ''))}</div>
          )
        })}
    </>
  )
}

/** Google's required "Search suggestions" chip, isolated in a shadow root. */
function SearchChips({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const root = ref.current.shadowRoot ?? ref.current.attachShadow({ mode: 'open' })
    root.innerHTML = html
  }, [html])
  return <div ref={ref} className="searchChips" />
}

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
  pinRequired,
  onOpenHome,
}: {
  uid: string
  settings: Settings
  homeUnlocked: boolean
  pinRequired: boolean
  onOpenHome: () => void
}) {
  const biz = useLiveQuery<BizEntry>(allByDate(bizCol(uid)), `bizall-${uid}`)
  const stock = useLiveQuery<Product>(stockCol(uid), `stock-${uid}`)
  const home = useLiveQuery<HomeEntry>(allByDate(homeCol(uid)), `home-${uid}`)
  const loans = useLiveQuery<LoanEntry>(allByDate(loansCol(uid)), `loans-${uid}`)
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'mentor', a: WELCOME }])
  const [mode, setModeState] = useState<Mode>(readMode)
  const [history, setHistory] = useState<Content[]>([])
  const busy = msgs.some((m) => m.loading)
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // ignore
    }
  }
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  // Questions about the user's own data need the PIN once per visit to Mentor.
  const [verified, setVerified] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs])

  async function ask(q: string, ok = verified || !pinRequired) {
    const question = q.trim()
    if (!question || busy) return
    setText('')
    const general = needsSearch(question) // jobs, news, prices… — no personal data involved
    if (!ok && !general) {
      setPending(question)
      return
    }
    const data = {
      biz: ok ? biz.items : [],
      stock: ok ? stock.items : [],
      home: ok || homeUnlocked ? home.items : null,
      loans: ok || homeUnlocked ? loans.items : null,
      customs: (settings.customBiz ?? []).map((c) => c.name),
    }
    if (mode === 'offline') {
      // The PIN was entered, so answers show real amounts.
      const was = areAmountsHidden()
      if (ok) setAmountsHidden(false)
      const a = answer(question, data)
      setAmountsHidden(was)
      setMsgs((m) => [...m, { from: 'me', text: question }, { from: 'mentor', a }])
      return
    }
    setMsgs((m) => [...m, { from: 'me', text: question }, { from: 'mentor', loading: true }])
    try {
      // Loaded on first use so the AI SDK doesn't slow down app start-up.
      const { askGemini } = await import('../lib/gemini')
      const ai = await askGemini(question, ok ? buildContext(data) : 'No personal data shared for this question.', history, general)
      setHistory((h) =>
        [...h, { role: 'user', parts: [{ text: question }] } as Content, { role: 'model', parts: [{ text: ai.text }] } as Content].slice(-12),
      )
      setMsgs((m) => [...m.filter((x) => !x.loading), { from: 'mentor', ai }])
    } catch (err) {
      setMsgs((m) => [...m.filter((x) => !x.loading), { from: 'mentor', err: (err as Error).message }])
    }
  }

  return (
    <div className="mentor">
      <div className="pageHead">
        <h1 className="pageTitle">🤖 Mentor</h1>
        {verified && pinRequired && (
          <button className="privacyBtn on" onClick={() => setVerified(false)}>
            🔒 Lock Mentor
          </button>
        )}
        <Segmented
          options={[
            { id: 'offline', label: '🔒 Offline' },
            { id: 'gemini', label: '✨ Gemini AI' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      <div className="mentorNote">
        {mode === 'offline'
          ? 'Offline: answers from your own data on this device. Nothing leaves your phone.'
          : 'Gemini AI (free plan): your question and a summary of your figures are sent to Google Gemini; free-plan data may be used by Google to improve its products. Job questions search Google.'}
      </div>
      <div className="chat">
        {msgs.map((m, i) =>
          m.from === 'me' ? (
            <div key={i} className="bubble me">
              {m.text}
            </div>
          ) : m.loading ? (
            <div key={i} className="bubble bot thinking">
              <span />
              <span />
              <span />
            </div>
          ) : m.err ? (
            <div key={i} className="bubble bot err">
              {m.err}
            </div>
          ) : m.ai ? (
            <div key={i} className="bubble bot">
              {m.ai.searchUnavailable && (
                <div className="aiWarn">Live Google search isn’t available on the free plan right now — this answer is general. Check the official sites for current openings.</div>
              )}
              <Markdown text={m.ai.text} />
              {m.ai.sources.length > 0 && (
                <div className="botLinks">
                  {m.ai.sources.slice(0, 6).map((s) => (
                    <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer">
                      {s.title} ↗
                    </a>
                  ))}
                </div>
              )}
              {m.ai.searchHtml && <SearchChips html={m.ai.searchHtml} />}
              <div className="aiTag">✨ Gemini</div>
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
        <button className="btnPrimary" disabled={!text.trim() || busy}>
          Ask
        </button>
      </form>
      {pending !== null && (
        <div
          className="overlay centered"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPending(null)
          }}
        >
          <div className="pinModal">
            <PinGate
              pinHash={settings.pinHash}
              hint={settings.pinHash ? 'Mentor needs your PIN to answer questions about your accounts' : undefined}
              onUnlock={() => {
                const q = pending
                setVerified(true)
                setPending(null)
                void ask(q, true)
              }}
              onCreate={(pinHash) => mergeDoc(settingsDoc(uid), { pinHash })}
            />
            <button className="btnGhost full" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

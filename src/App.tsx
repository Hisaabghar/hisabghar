import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLiveDoc } from './hooks/useData'
import { settingsDoc } from './lib/paths'
import { DEFAULT_RATES } from './lib/catalog'
import { setAmountsHidden } from './lib/format'
import type { Settings } from './types'
import { AuthScreen } from './components/AuthScreen'
import { HOME_TABS, HomeSection, type HomeTab } from './components/home/HomeSection'
import { PinGate } from './components/home/PinGate'
import { BizSection, bizTabs, type BizTab } from './components/biz/BizSection'
import { AddBizSheet } from './components/biz/AddBizSheet'
import { MentorPage } from './components/MentorPage'
import { SettingsSheet } from './components/SettingsSheet'
import { mergeDoc } from './hooks/useData'
import { billsDue, checkBills, dueText } from './lib/bills'
import { useOnline } from './hooks/useOnline'

function App() {
  const auth = useAuth()
  if (auth.loading) return <div className="loadingScreen">Loading Mera Khata…</div>
  if (!auth.user) return <AuthScreen auth={auth} />
  return <Main user={auth.user} onSignOut={auth.signOut} />
}

type Section = 'home' | 'biz' | 'mentor'

type User = { id: string; email: string | null; name: string | null; photo: string | null }

const PRIVACY_KEY = 'mk-privacy'
const HIDDEN_KEY = 'mk-hidden'
function readFlag(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function writeFlag(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {
    // ignore
  }
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Avatar({ user }: { user: User }) {
  const letter = (user.name || user.email || '?').slice(0, 1).toUpperCase()
  return user.photo ? (
    <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar">{letter}</span>
  )
}

function Main({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const uid = user.id
  const email = user.email
  const firstName = (user.name ?? '').split(' ')[0]
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [section, setSection] = useState<Section>('biz')
  const [bizTab, setBizTab] = useState<BizTab>('dash')
  const [homeTab, setHomeTab] = useState<HomeTab>('summary')
  const [unlocked, setUnlocked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [addingBiz, setAddingBiz] = useState(false)
  // Privacy mode and the show/hide choice are remembered on this device until changed.
  const [privacy, setPrivacyState] = useState(() => readFlag(PRIVACY_KEY, true))
  const [hiddenPref, setHiddenPref] = useState(() => readFlag(HIDDEN_KEY, true))
  const hidden = privacy && hiddenPref
  const setHidden = (v: boolean) => {
    setHiddenPref(v)
    writeFlag(HIDDEN_KEY, v)
  }
  const setPrivacy = (v: boolean) => {
    setPrivacyState(v)
    writeFlag(PRIVACY_KEY, v)
    if (v) setHidden(true)
  }
  // What to do after the PIN is entered: show amounts, or switch privacy mode off.
  const [askPin, setAskPin] = useState<false | 'show' | 'disable' | 'lockoff'>(false)
  // Inside unlocked Home Accounts the PIN was already entered, so amounts show there.
  const stored = useLiveDoc<Settings>(settingsDoc(uid), `settings-${uid}`)
  const settings: Settings = { ...stored.data, rates: { ...DEFAULT_RATES, ...stored.data?.rates } }
  // With the Home PIN switched off in Settings, Home Accounts are always open.
  const lockOn = settings.homeLock !== false
  const homeUnlocked = unlocked || !lockOn
  const homeOpen = section === 'home' && homeUnlocked
  const masked = hidden && !homeOpen
  setAmountsHidden(masked)
  const online = useOnline()
  const bills = settings.bills ?? []
  const billsKey = JSON.stringify(bills)
  useEffect(() => {
    const list = JSON.parse(billsKey)
    void checkBills(list)
    const t = setInterval(() => void checkBills(list), 60 * 60 * 1000)
    return () => clearInterval(t)
  }, [billsKey])
  const due = billsDue(bills)

  const bizName = settings.businessName?.trim()
  const initials = (bizName || 'Mera Khata')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  const brand = (
    <div className="brand">
      <div className="mark">{initials}</div>
      <div className="brandText">
        <div className="title">{bizName || 'Mera Khata'}</div>
        <div className="subtitle">{bizName ? 'Powered by Mera Khata' : 'Home & shop accounts'}</div>
      </div>
    </div>
  )

  return (
    <div className={`shell ${masked ? 'private' : ''}`}>
      <aside className="sidebar">
        {brand}
        <nav className="nav">
          <button className={`navItem mentorNav ${section === 'mentor' ? 'active' : ''}`} onClick={() => setSection('mentor')}>
            <span className="navIc">🤖</span>
            Mentor
          </button>
          <div className="navGroup">🏪 Shop / Business</div>
          {bizTabs(settings).map((t) => (
            <button
              key={t.id}
              className={`navItem ${section === 'biz' && bizTab === t.id ? 'active' : ''}`}
              onClick={() => {
                setSection('biz')
                setBizTab(t.id)
              }}
            >
              <span className="navIc">{t.icon}</span>
              {t.label}
            </button>
          ))}
          <button className="navItem navAdd" onClick={() => setAddingBiz(true)}>
            <span className="navIc">＋</span>
            Add category
          </button>
          <div className="navGroup">
            🔒 Home Accounts
            {unlocked && lockOn && (
              <button className="navLock" onClick={() => setUnlocked(false)}>
                Lock
              </button>
            )}
          </div>
          {HOME_TABS.map((t) => (
            <button
              key={t.id}
              className={`navItem ${section === 'home' && homeTab === t.id ? 'active' : ''}`}
              onClick={() => {
                setSection('home')
                setHomeTab(t.id)
              }}
            >
              <span className="navIc">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <button className="navItem" onClick={() => setShowSettings(true)}>
            <span className="navIc">⚙️</span>
            Settings
          </button>
          <div className="sideUser">
            <Avatar user={user} />
            <div className="sideUserText">
              <div className="sideUserName">{user.name || 'My account'}</div>
              <div className="sideUserMail">{email}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="app">
        <header className="header mobileOnly">
          {brand}
          <button className="avatarBtn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
            <Avatar user={user} />
          </button>
        </header>

        <div className="greet">
          <div>
            <div className="greetTitle">
              {greeting()}
              {firstName ? `, ${firstName}` : ''} 👋
            </div>
            <div className="greetSub">{today}</div>
          </div>
          {homeOpen && lockOn ? (
            <button className="privacyBtn on" onClick={() => setUnlocked(false)} title="Lock Home Accounts">
              🔒 Lock
            </button>
          ) : !privacy ? null : (
            <button
              className={`privacyBtn ${hidden ? '' : 'on'}`}
              onClick={() => (hidden ? setAskPin('show') : setHidden(true))}
              title={hidden ? 'Show amounts' : 'Hide amounts'}
            >
              {hidden ? '👁 Show amounts' : '🙈 Hide amounts'}
            </button>
          )}
        </div>

        <div className="sectionSwitch mobileOnly">
          <button className={section === 'home' ? 'active' : ''} onClick={() => setSection('home')}>
            🔒 Home
          </button>
          <button className={section === 'biz' ? 'active' : ''} onClick={() => setSection('biz')}>
            🏪 Shop
          </button>
          <button className={section === 'mentor' ? 'active' : ''} onClick={() => setSection('mentor')}>
            🤖 Mentor
          </button>
        </div>

        {!online && <div className="offlineBanner">📴 Offline — you can keep working. Changes are saved on this phone and sync when you are back online.</div>}

        {due.length > 0 && (
          <div
            className="billBanner"
            onClick={() => {
              setSection('home')
              setHomeTab('bills')
            }}
          >
            <span>⏰</span>
            <span>
              {due.slice(0, 2).map((x, i) => (
                <span key={x.bill.id}>
                  {i > 0 && ' · '}
                  <b>{x.bill.name}</b> {dueText(x.daysLeft)}
                </span>
              ))}
              {due.length > 2 && ` · +${due.length - 2} more`}
            </span>
          </div>
        )}

        {section === 'mentor' && (
          <MentorPage
            uid={uid}
            settings={settings}
            homeUnlocked={homeUnlocked}
            pinRequired={lockOn}
            onOpenHome={() => {
              setSection('home')
              setHomeTab('summary')
            }}
          />
        )}

        {section === 'biz' && <BizSection uid={uid} settings={settings} tab={bizTab} setTab={setBizTab} />}

        {section === 'home' &&
          (stored.loading ? (
            <div className="loadingScreen small">…</div>
          ) : homeUnlocked ? (
            <HomeSection uid={uid} settings={settings} onLock={lockOn ? () => setUnlocked(false) : undefined} tab={homeTab} setTab={setHomeTab} />
          ) : (
            <PinGate
              pinHash={settings.pinHash}
              onUnlock={() => setUnlocked(true)}
              onCreate={(pinHash) => mergeDoc(settingsDoc(uid), { pinHash })}
            />
          ))}
      </main>

      {addingBiz && (
        <AddBizSheet
          uid={uid}
          existing={settings.customBiz ?? []}
          onClose={() => setAddingBiz(false)}
          onAdded={(b) => {
            setSection('biz')
            setBizTab(`c:${b.name}`)
          }}
        />
      )}

      {askPin && (
        <div
          className="overlay centered"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAskPin(false)
          }}
        >
          <div className="pinModal">
            <PinGate
              pinHash={settings.pinHash}
              hint={
                settings.pinHash
                  ? askPin === 'disable'
                    ? 'Enter your PIN to turn privacy mode off'
                    : askPin === 'lockoff'
                      ? 'Enter your PIN to stop asking for it on Home Accounts'
                      : 'Enter your PIN to show amounts'
                  : undefined
              }
              onUnlock={() => {
                if (askPin === 'lockoff') {
                  void mergeDoc(settingsDoc(uid), { homeLock: false })
                  setAskPin(false)
                  return
                }
                if (askPin === 'disable') setPrivacy(false)
                setHidden(false)
                setAskPin(false)
              }}
              onCreate={(pinHash) => mergeDoc(settingsDoc(uid), { pinHash })}
            />
            <button className="btnGhost full" onClick={() => setAskPin(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsSheet
          uid={uid}
          email={email}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSignOut={onSignOut}
          onPinReset={() => setUnlocked(false)}
          homeLock={lockOn}
          onHomeLockChange={(on) => {
            if (on) void mergeDoc(settingsDoc(uid), { homeLock: true })
            else if (!settings.pinHash) void mergeDoc(settingsDoc(uid), { homeLock: false })
            else {
              setShowSettings(false)
              setAskPin('lockoff')
            }
          }}
          privacy={privacy}
          onPrivacyChange={(on) => {
            if (on) setPrivacy(true)
            else {
              setShowSettings(false)
              setAskPin('disable')
            }
          }}
        />
      )}
    </div>
  )
}

export default App

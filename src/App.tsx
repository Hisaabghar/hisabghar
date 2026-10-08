import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLiveDoc } from './hooks/useData'
import { settingsDoc } from './lib/paths'
import { DEFAULT_RATES } from './lib/catalog'
import { setAmountsHidden } from './lib/format'
import type { Settings } from './types'
import { AuthScreen } from './components/AuthScreen'
import { HOME_TABS, HomeSection, type HomeTab } from './components/home/HomeSection'
import { PinGate } from './components/home/PinGate'
import { BIZ_TABS, BizSection, type BizTab } from './components/biz/BizSection'
import { SettingsSheet } from './components/SettingsSheet'
import { mergeDoc } from './hooks/useData'

function App() {
  const auth = useAuth()
  if (auth.loading) return <div className="loadingScreen">Loading Mera Khata…</div>
  if (!auth.user) return <AuthScreen auth={auth} />
  return <Main user={auth.user} onSignOut={auth.signOut} />
}

type Section = 'home' | 'biz'

type User = { id: string; email: string | null; name: string | null; photo: string | null }

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
  // Amounts start hidden every time the app opens, so nobody nearby sees them.
  const [hidden, setHidden] = useState(true)
  const [askPin, setAskPin] = useState(false)
  setAmountsHidden(hidden)
  const stored = useLiveDoc<Settings>(settingsDoc(uid), `settings-${uid}`)
  const settings: Settings = { ...stored.data, rates: { ...DEFAULT_RATES, ...stored.data?.rates } }

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
    <div className={`shell ${hidden ? 'private' : ''}`}>
      <aside className="sidebar">
        {brand}
        <nav className="nav">
          <div className="navGroup">🏪 Shop / Business</div>
          {BIZ_TABS.map((t) => (
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
          <div className="navGroup">
            🔒 Home Accounts
            {unlocked && (
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
          <button
            className={`privacyBtn ${hidden ? '' : 'on'}`}
            onClick={() => (hidden ? setAskPin(true) : setHidden(true))}
            title={hidden ? 'Show amounts' : 'Hide amounts'}
          >
            {hidden ? '👁 Show amounts' : '🙈 Hide amounts'}
          </button>
        </div>

        <div className="sectionSwitch mobileOnly">
          <button className={section === 'home' ? 'active' : ''} onClick={() => setSection('home')}>
            🔒 Home Accounts
          </button>
          <button className={section === 'biz' ? 'active' : ''} onClick={() => setSection('biz')}>
            🏪 Shop / Business
          </button>
        </div>

        {section === 'biz' && <BizSection uid={uid} settings={settings} tab={bizTab} setTab={setBizTab} />}

        {section === 'home' &&
          (stored.loading ? (
            <div className="loadingScreen small">…</div>
          ) : unlocked ? (
            <HomeSection uid={uid} settings={settings} onLock={() => setUnlocked(false)} tab={homeTab} setTab={setHomeTab} />
          ) : (
            <PinGate
              pinHash={settings.pinHash}
              onUnlock={() => setUnlocked(true)}
              onCreate={(pinHash) => mergeDoc(settingsDoc(uid), { pinHash })}
            />
          ))}
      </main>

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
              hint={settings.pinHash ? 'Enter your PIN to show amounts' : undefined}
              onUnlock={() => {
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
        />
      )}
    </div>
  )
}

export default App

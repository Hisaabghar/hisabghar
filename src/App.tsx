import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLiveDoc } from './hooks/useData'
import { settingsDoc } from './lib/paths'
import { DEFAULT_RATES } from './lib/catalog'
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
  return <Main uid={auth.user.id} email={auth.user.email} onSignOut={auth.signOut} />
}

type Section = 'home' | 'biz'

function Main({ uid, email, onSignOut }: { uid: string; email: string | null; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>('biz')
  const [bizTab, setBizTab] = useState<BizTab>('dash')
  const [homeTab, setHomeTab] = useState<HomeTab>('summary')
  const [unlocked, setUnlocked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const stored = useLiveDoc<Settings>(settingsDoc(uid), `settings-${uid}`)
  const settings: Settings = { ...stored.data, rates: { ...DEFAULT_RATES, ...stored.data?.rates } }

  const brand = (
    <div className="brand">
      <div className="mark">MK</div>
      <div>
        <div className="title">Mera Khata</div>
        <div className="subtitle">Home & shop accounts</div>
      </div>
    </div>
  )

  return (
    <div className="shell">
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
          <div className="sideUser">{email}</div>
        </div>
      </aside>

      <main className="app">
        <header className="header mobileOnly">
          {brand}
          <button className="iconBtn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
            ⚙️
          </button>
        </header>

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
            <HomeSection uid={uid} onLock={() => setUnlocked(false)} tab={homeTab} setTab={setHomeTab} />
          ) : (
            <PinGate
              pinHash={settings.pinHash}
              onUnlock={() => setUnlocked(true)}
              onCreate={(pinHash) => mergeDoc(settingsDoc(uid), { pinHash })}
            />
          ))}
      </main>

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

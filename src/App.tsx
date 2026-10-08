import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLiveDoc } from './hooks/useData'
import { settingsDoc } from './lib/paths'
import { DEFAULT_RATES } from './lib/catalog'
import type { Settings } from './types'
import { AuthScreen } from './components/AuthScreen'
import { HomeSection } from './components/home/HomeSection'
import { PinGate } from './components/home/PinGate'
import { BizSection } from './components/biz/BizSection'
import { SettingsSheet } from './components/SettingsSheet'
import { mergeDoc } from './hooks/useData'

function App() {
  const auth = useAuth()
  if (auth.loading) return <div className="loadingScreen">Mera Khata khul raha hai…</div>
  if (!auth.user) return <AuthScreen auth={auth} />
  return <Main uid={auth.user.id} email={auth.user.email} onSignOut={auth.signOut} />
}

type Section = 'home' | 'biz'

function Main({ uid, email, onSignOut }: { uid: string; email: string | null; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>('biz')
  const [unlocked, setUnlocked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const stored = useLiveDoc<Settings>(settingsDoc(uid), `settings-${uid}`)
  const settings: Settings = { ...stored.data, rates: { ...DEFAULT_RATES, ...stored.data?.rates } }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="mark">MK</div>
          <div>
            <div className="title">Mera Khata</div>
            <div className="subtitle">Ghar aur dukaan ka hisab</div>
          </div>
        </div>
        <button className="iconBtn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
          ⚙️
        </button>
      </header>

      <div className="sectionSwitch">
        <button className={section === 'home' ? 'active' : ''} onClick={() => setSection('home')}>
          🔒 Ghar ka Hisab
        </button>
        <button className={section === 'biz' ? 'active' : ''} onClick={() => setSection('biz')}>
          🏪 Dukaan / Business
        </button>
      </div>

      {section === 'biz' && <BizSection uid={uid} settings={settings} />}

      {section === 'home' &&
        (stored.loading ? (
          <div className="loadingScreen small">…</div>
        ) : unlocked ? (
          <HomeSection uid={uid} onLock={() => setUnlocked(false)} />
        ) : (
          <PinGate
            pinHash={settings.pinHash}
            onUnlock={() => setUnlocked(true)}
            onCreate={(pinHash) => mergeDoc(settingsDoc(uid), { pinHash })}
          />
        ))}

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

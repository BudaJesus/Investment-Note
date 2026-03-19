import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './supabase.js'
import './storage.js'
import Auth from './Auth.jsx'
import InvestmentJournal from './InvestmentJournal.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No Supabase — skip auth, run locally
      setChecking(false)
      setUser({ local: true })
      return
    }

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setChecking(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#8B919E" }}>
          <div style={{ width: 28, height: 28, border: "2px solid #E2E4E9", borderTop: "2px solid #2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13 }}>로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuth={() => {}} />
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setUser(null)
  }

  return <InvestmentJournal onLogout={handleLogout} userEmail={user?.email || '로컬 모드'} />
}

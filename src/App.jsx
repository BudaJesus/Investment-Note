import { useState, useEffect, Component } from 'react'
import { supabase, isSupabaseConfigured } from './supabase.js'
import './storage.js'
import Auth from './Auth.jsx'
import InvestmentJournal from './InvestmentJournal.jsx'

// ═══ Error Boundary — 하얀 화면 방지 ═══
// React 렌더링 중 에러가 나도 앱이 죽지 않고 복구 UI를 보여줌
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA", fontFamily: "'Noto Sans KR', sans-serif", padding: 20 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D23", marginBottom: 8 }}>화면 렌더링 오류</h2>
            <p style={{ fontSize: 13, color: "#4E5461", lineHeight: 1.6, marginBottom: 16 }}>
              자동입력 데이터 처리 중 오류가 발생했습니다.<br />
              데이터는 안전하게 저장되어 있습니다.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} style={{ padding: "10px 24px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" }}>
                다시 시도
              </button>
              <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#fff", color: "#1A1D23", border: "1px solid #E2E4E9", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" }}>
                페이지 새로고침
              </button>
            </div>
            <details style={{ textAlign: "left", background: "#fff", border: "1px solid #E2E4E9", borderRadius: 8, padding: 12 }}>
              <summary style={{ fontSize: 11, color: "#8B919E", cursor: "pointer" }}>에러 상세 (개발자용)</summary>
              <pre style={{ fontSize: 10, color: "#DC2626", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8, maxHeight: 200, overflow: "auto" }}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChecking(false)
      setUser({ local: true })
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setChecking(false)
    })

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

  return (
    <ErrorBoundary>
      <InvestmentJournal onLogout={handleLogout} userEmail={user?.email || '로컬 모드'} />
    </ErrorBoundary>
  )
}

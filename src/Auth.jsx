import { useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase.js'

const C = {
  bg: "#F7F8FA", text: "#1A1D23", textMid: "#4E5461", textDim: "#8B919E",
  accent: "#2563EB", border: "#E2E4E9",
}

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isSupabaseConfigured) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('가입 완료! 이메일을 확인해주세요.')
        setMode('login')
        setLoading(false)
        return
      }
      onAuth?.()
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : err.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const s = {
    wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "'Noto Sans KR', sans-serif", padding: 20 },
    card: { width: "100%", maxWidth: 380, background: "#fff", borderRadius: 8, padding: "32px 28px", border: `1px solid ${C.border}` },
    logo: { width: 36, height: 36, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", margin: "0 auto 14px" },
    title: { fontSize: 18, fontWeight: 700, textAlign: "center", color: C.text, margin: "0 0 3px", letterSpacing: -0.5 },
    sub: { fontSize: 12, color: C.textDim, textAlign: "center", margin: "0 0 22px" },
    input: { width: "100%", padding: "9px 11px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 5, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 9, color: C.text, background: C.bg },
    btn: { width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 600, background: C.accent, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
    google: { width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 500, background: "#fff", color: C.text, border: `1px solid ${C.border}`, borderRadius: 5, cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
    error: { fontSize: 12, color: "#DC2626", textAlign: "center", margin: "8px 0 0" },
    toggle: { fontSize: 12, color: C.accent, textAlign: "center", marginTop: 14, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" },
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>IN</div>
        <h1 style={s.title}>투자 노트</h1>
        <p style={s.sub}>{mode === 'login' ? '로그인하고 시작하세요' : '새 계정을 만드세요'}</p>
        <form onSubmit={handleSubmit}>
          <input style={s.input} type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="비밀번호 (6자 이상)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} type="submit" disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
        <button style={s.google} onClick={handleGoogle}>Google로 계속하기</button>
        {error && <p style={s.error}>{error}</p>}
        <button style={s.toggle} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
          {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </div>
    </div>
  )
}

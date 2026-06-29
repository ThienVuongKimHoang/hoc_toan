import React, { useState, useEffect } from 'react'
import { login, register, ROLE_META, ROLES } from '../auth/mockUsers.js'
import { GoogleOAuthProvider } from '@react-oauth/google'
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

/* ── Tab toggle ── */
function TabBar({ mode, onChange }) {
  return (
    <div className="lp-tabs">
      <button className={`lp-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => onChange('login')}>
        Đăng nhập
      </button>
      <button className={`lp-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => onChange('register')}>
        Đăng ký
      </button>
    </div>
  )
}

/* ── Login form ── */
function LoginForm({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let rendered = false

    const initGoogle = () => {
      if (rendered) return
      if (!window.google) return

      const btn = document.getElementById("googleBtn")
      if (!btn) return

      window.google.accounts.id.initialize({
        client_id: "281468345667-tb1nqlo78f06blu5m1t7qapd08ruc916.apps.googleusercontent.com",
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async (response) => {
          setLoading(true)
          setError('')

          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id_token: response.credential
              }),
            })

            const data = await res.json()

            if (!res.ok) {
              setError(data.error || 'Đăng nhập Google thất bại.')
              return
            }

            onLogin(data)

          } catch (err) {
            setError('Không thể kết nối server.')
          } finally {
            setLoading(false)
          }
        }
      })

      window.google.accounts.id.renderButton(btn, {
        theme: "outline",
        size: "large"
      })

      rendered = true
    }

    const timer = setInterval(() => {
      if (window.google && document.getElementById("googleBtn")) {
        initGoogle()
        clearInterval(timer)
      }
    }, 200)

    return () => clearInterval(timer)
  }, [])
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Vui lòng nhập đầy đủ thông tin.'); return }
    setLoading(true); setError('')
    const result = await login(email.trim(), password)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onLogin(result.user)
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label>Email</label>
          <div className="input-wrap">
            <span className="input-icon">📧</span>
            <input type="email" placeholder="example@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email" autoFocus />
          </div>
        </div>

        <div className="form-group">
          <label>
            Mật khẩu
            <a className="forgot-link" href="#">Quên mật khẩu?</a>
          </label>
          <div className="input-wrap">
            <span className="input-icon">🔒</span>
            <input type={showPwd ? 'text' : 'password'} placeholder="Nhập mật khẩu" value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoComplete="current-password" />
            <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {error && <div className="form-error">⚠️ {error}</div>}

        <button type="submit" className="btn-login" disabled={loading}>
          {loading && <span className="spin" />}
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>

      <p className="lp-signup-link">
        Chưa có tài khoản?{' '}
        <button type="button" onClick={onSwitchToRegister}>Đăng ký ngay</button>
      </p>

      <div className="lp-divider"><span>hoặc</span></div>

      <div id="googleBtn"></div>
    </>
  )
}

/* ── Register form ── */
function RegisterForm({ onLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (!name.trim()) return 'Vui lòng nhập họ tên.'
    if (!email.trim()) return 'Vui lòng nhập email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ.'
    if (password.length < 6) return 'Mật khẩu tối thiểu 6 ký tự.'
    if (password !== confirm) return 'Mật khẩu xác nhận không khớp.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError('')
    const result = await register({ name, email, password })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onLogin(result.user)
  }

  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
      : password.length < 10 ? 2
        : 3
  const strengthLabel = ['', 'Yếu', 'Trung bình', 'Mạnh'][strength]
  const strengthColor = ['', '#ef4444', '#f59e0b', '#22c55e'][strength]

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label>Họ và tên</label>
        <div className="input-wrap">
          <span className="input-icon">👤</span>
          <input type="text" placeholder="Nguyễn Văn A" value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            autoComplete="name" autoFocus />
        </div>
      </div>

      <div className="form-group">
        <label>Email</label>
        <div className="input-wrap">
          <span className="input-icon">📧</span>
          <input type="email" placeholder="example@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            autoComplete="email" />
        </div>
      </div>

      <div className="form-group">
        <label>Mật khẩu</label>
        <div className="input-wrap">
          <span className="input-icon">🔒</span>
          <input type={showPwd ? 'text' : 'password'} placeholder="Tối thiểu 6 ký tự" value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            autoComplete="new-password" />
          <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
            {showPwd ? '🙈' : '👁️'}
          </button>
        </div>
        {password.length > 0 && (
          <div className="pwd-strength">
            <div className="pwd-strength-bar">
              {[1, 2, 3].map(i => (
                <div key={i} className="pwd-strength-seg"
                  style={{ background: i <= strength ? strengthColor : '#e2e8f0' }} />
              ))}
            </div>
            <span className="pwd-strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Xác nhận mật khẩu</label>
        <div className="input-wrap">
          <span className="input-icon">🔒</span>
          <input type={showPwd ? 'text' : 'password'} placeholder="Nhập lại mật khẩu" value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            autoComplete="new-password" />
          {confirm.length > 0 && (
            <span className="confirm-check">
              {confirm === password ? '✅' : '❌'}
            </span>
          )}
        </div>
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}

      <div className="reg-role-notice">
        <span className="reg-role-notice-badge">
          {ROLE_META[ROLES.GUEST].icon} {ROLE_META[ROLES.GUEST].label}
        </span>
        <span className="reg-role-notice-text">
          Tài khoản mới mặc định là <strong>Khách</strong>. Chỉ Super Admin mới có thể nâng cấp quyền.
        </span>
      </div>

      <button type="submit" className="btn-login" disabled={loading}>
        {loading && <span className="spin" />}
        {loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
      </button>

      <p className="reg-note">
        Tài khoản được lưu trên server. Super Admin có thể nâng cấp quyền trong phần quản lý người dùng.
      </p>
    </form>
  )
}

/* ── Main page ── */
function LoginPage({ onLogin, onGoHome }) {
  const [mode, setMode] = useState('login')

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden>
        <div className="login-bg-blob blob1" />
        <div className="login-bg-blob blob2" />
        <div className="login-bg-blob blob3" />
      </div>

      <div className="login-container">
        {/* Left panel */}
        <div className="login-left">
          <button className="login-logo" onClick={onGoHome}>
            <span>📐</span>
            <span>HocToan<b>.AI</b></span>
          </button>
          <h2>Luyện đề thi Toán THPT<br />thông minh hơn mỗi ngày</h2>
          <p>Nền tảng luyện tập với AI — phân tích đề thi, trích xuất câu hỏi, kiểm tra kết quả tức thì.</p>

          <div className="login-left-badges">
            {Object.entries(ROLE_META).map(([key, meta]) => (
              <div key={key} className={`llb-item role-badge role-badge--${meta.effect} role-badge--sm`}
                style={{ '--rb-color': meta.color, '--rb-text': meta.textColor, background: meta.bg }}>
                <span className="rb-icon">{meta.icon}</span>
                <span className="rb-label">{meta.label}</span>
                {meta.effect === 'shimmer' && <span className="rb-shimmer" aria-hidden />}
              </div>
            ))}
          </div>

          <div className="login-feature-list">
            {['Upload đề PDF tự động', 'AI trích xuất 3 loại câu hỏi', 'Làm bài & kiểm tra kết quả', 'Theo dõi tiến độ học tập'].map(f => (
              <div key={f} className="lfl-item"><span className="lfl-dot">✓</span> {f}</div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="login-right">
          <div className="login-card">
            <TabBar mode={mode} onChange={setMode} />

            <div className="login-card-header">
              {mode === 'login' ? (
                <>
                  <h1>Đăng nhập</h1>
                  <p>Chào mừng bạn trở lại 👋</p>
                </>
              ) : (
                <>
                  <h1>Tạo tài khoản</h1>
                  <p>Miễn phí, không cần thẻ tín dụng 🎉</p>
                </>
              )}
            </div>

            {mode === 'login'
              ? <LoginForm onLogin={onLogin} onSwitchToRegister={() => setMode('register')} />
              : <RegisterForm onLogin={onLogin} />
            }

            <div className="login-back">
              <button onClick={onGoHome}>← Quay lại trang chủ</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default function LoginPageWithGoogle(props) {
  return (
    <GoogleOAuthProvider clientId="281468345667-tb1nqlo78f06blu5m1t7qapd08ruc916.apps.googleusercontent.com">
      <LoginPage {...props} />
    </GoogleOAuthProvider>
  )
}

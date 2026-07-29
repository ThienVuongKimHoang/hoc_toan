import React, { useEffect, useRef, useState } from 'react'
import RoleBadge from '../components/RoleBadge.jsx'
import { ROLES, hasTeacherAccess, authHeaders } from '../auth/mockUsers.js'
import { getExamsByTeacher, getAllExams, fetchMySubmissions, scaledScore } from '../store/examStore.js'

const USER_KEY = 'hoctoan_user'

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f43f5e', '#a855f7',
]

const ROLE_DEFAULT_COLOR = {
  hoc_sinh:    '#2563eb',
  giao_vien:   '#059669',
  admin:       '#7c3aed',
  super_admin: '#d97706',
}

/* ── SVG helper ── */
function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcCheck  = (s) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>
const IcCamera = (s) => <Ic size={s}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></Ic>
const IcUpload = (s) => <Ic size={s}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></Ic>
const IcTrash  = (s) => <Ic size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Ic>
const IcHome   = (s) => <Ic size={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ic>
const IcBook   = (s) => <Ic size={s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Ic>
const IcChart  = (s) => <Ic size={s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ic>
const IcStar   = (s) => <Ic size={s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ic>
const IcClock  = (s) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>
const IcAward  = (s) => <Ic size={s}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></Ic>
const IcUsers  = (s) => <Ic size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Ic>
const IcServer = (s) => <Ic size={s}><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></Ic>
const IcClose  = (s) => <Ic size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ic>
const IcMail   = (s) => <Ic size={s}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Ic>
const IcUser   = (s) => <Ic size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ic>
const IcShield = (s) => <Ic size={s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Ic>
const IcChevronRight = (s) => <Ic size={s}><polyline points="9 18 15 12 9 6"/></Ic>
const IcLock   = (s) => <Ic size={s}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Ic>
const IcCoin   = (s) => <Ic size={s}><circle cx="12" cy="12" r="9"/><path d="M9.5 15.5c.5 1 1.5 1.5 2.5 1.5 1.7 0 3-1 3-2.3 0-3-5.5-1.5-5.5-4.5 0-1.3 1.3-2.2 3-2.2 1 0 2 .4 2.5 1.3"/><line x1="12" y1="6.5" x2="12" y2="17.5"/></Ic>
const IcBag    = (s) => <Ic size={s}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></Ic>

/* user.avatarUrl: undefined = chưa từng tuỳ chỉnh (dùng ảnh Google trong user.avatar nếu có),
   null = đã chọn xoá ảnh để dùng màu nền, string = ảnh tuỳ chỉnh/ảnh Google đã chốt. */
export function resolveAvatarSrc(user) {
  const src = user.avatarUrl !== undefined ? user.avatarUrl : user.avatar
  return typeof src === 'string' && (/^https?:\/\//.test(src) || src.startsWith('data:')) ? src : null
}

/* ── Khung viền (cửa hàng) — id → hình vẽ (gradient/glow). Giá & tên là dữ liệu
   server (FRAME_CATALOG trong api.py); id ở đây phải khớp id bên đó. ── */
export const FRAME_STYLES = {
  dong:      { background: 'linear-gradient(135deg,#c58f4f,#7c4a1e)' },
  bac:       { background: 'linear-gradient(135deg,#e6ebf2,#94a3b8)' },
  ngoc_bich: { background: 'linear-gradient(135deg,#5eead4,#047857)' },
  vang:      { background: 'linear-gradient(135deg,#fde68a,#d97706)' },
  navy_gold: { background: 'linear-gradient(135deg,#FBBF24,#0F172A 55%,#FBBF24)' },
  kim_cuong: { background: 'linear-gradient(135deg,#bae6fd,#38bdf8,#f0f9ff)', glow: '0 0 14px rgba(56,189,248,.55)' },
  hoang_gia: { background: 'linear-gradient(135deg,#ddd6fe,#6d28d9,#FBBF24)', glow: '0 0 14px rgba(109,40,217,.4)' },
  cau_vong:  { background: 'conic-gradient(from 0deg,#f87171,#fbbf24,#34d399,#38bdf8,#818cf8,#f472b6,#f87171)', glow: '0 0 16px rgba(244,114,182,.45)' },
}

/* ── Avatar display ── */
export function AvatarDisplay({ user, size = 80, onClick, className = '', frameStyle = null }) {
  const [failed, setFailed] = useState(false)
  const initial  = (user.name || user.email || '?')[0].toUpperCase()
  const bgColor  = user.avatarColor || ROLE_DEFAULT_COLOR[user.role] || '#2563eb'
  const src      = resolveAvatarSrc(user)

  const circle = (
    <div
      className={`avt-display ${onClick ? 'avt-display--clickable' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      title={onClick ? 'Đổi ảnh đại diện' : undefined}
    >
      {src && !failed
        ? <img src={src} alt="avatar" className="avt-display-img" onError={() => setFailed(true)} />
        : <div className="avt-display-initial" style={{ background: bgColor, fontSize: Math.round(size * 0.38) }}>
            {initial}
          </div>
      }
      {onClick && (
        <div className="avt-display-overlay">
          {IcCamera(Math.round(size * 0.3))}
        </div>
      )}
    </div>
  )

  if (!frameStyle) return circle

  const ringPad = Math.max(4, Math.round(size * 0.08))
  return (
    <div
      className="avt-frame-ring"
      style={{
        width: size + ringPad * 2,
        height: size + ringPad * 2,
        padding: ringPad,
        background: frameStyle.background,
        boxShadow: frameStyle.glow || undefined,
      }}
    >
      {circle}
    </div>
  )
}

/* ── Avatar picker modal ── */
function AvatarPicker({ user, onSave, onClose }) {
  const [preview,  setPreview]  = useState(resolveAvatarSrc(user))
  const [selColor, setSelColor] = useState(user.avatarColor || ROLE_DEFAULT_COLOR[user.role] || AVATAR_COLORS[5])
  const fileRef = useRef(null)
  const initial = (user.name || '?')[0].toUpperCase()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { alert('Ảnh tối đa 3 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box avt-picker-modal">
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {IcCamera(20)} Đổi ảnh đại diện
          </h2>
          <button className="modal-close" onClick={onClose}>{IcClose(18)}</button>
        </div>

        {/* Preview */}
        <div className="avt-picker-preview">
          {preview
            ? <img src={preview} className="avt-picker-img" alt="preview" />
            : <div className="avt-picker-initial" style={{ background: selColor }}>
                {initial}
              </div>
          }
        </div>

        {/* Upload */}
        <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }}
          onChange={handleFile} />
        <div className="avt-picker-actions">
          <button className="avt-btn avt-btn--upload" onClick={() => fileRef.current?.click()}>
            {IcUpload(14)} Tải ảnh lên
          </button>
          {preview && (
            <button className="avt-btn avt-btn--remove" onClick={() => setPreview(null)}>
              {IcTrash(14)} Xoá ảnh
            </button>
          )}
        </div>

        {/* Color presets */}
        {!preview && (
          <div className="avt-picker-colors">
            <div className="avt-colors-label">Màu nền</div>
            <div className="avt-color-grid">
              {AVATAR_COLORS.map(c => (
                <button key={c}
                  className={`avt-swatch ${selColor === c ? 'avt-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setSelColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}

        <div className="pm-footer">
          <button className="pm-cancel" onClick={onClose}>Huỷ</button>
          <button className="pm-submit" onClick={() => onSave({ avatarUrl: preview || null, avatarColor: selColor })}>
            {IcCheck(14)} Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Hàng thống kê phẳng (tái dùng style prof-info-card) ── */
function StatRow({ icon, value, label, sub, color }) {
  return (
    <div className="prof-info-card">
      <div className="pic-icon pic-icon--tinted" style={{ '--tint': color }}>{icon}</div>
      <div className="pic-content">
        <span className="pic-label">{label}</span>
        <span className="pic-value">{value}</span>
        {sub && <span className="pic-sub">{sub}</span>}
      </div>
    </div>
  )
}

function StudentStats({ submissions }) {
  // Chỉ tính trên các bài đã có điểm (bỏ qua bài đang chờ GV công bố kết quả)
  const graded = submissions.filter(s => s.score != null && s.maxScore != null)
  const scaled = graded.map(s => scaledScore(s.score, s.maxScore))
  const avg    = scaled.length ? (scaled.reduce((a, b) => a + b, 0) / scaled.length).toFixed(2) : null
  const best   = scaled.length ? Math.max(...scaled).toFixed(2) : null
  const times  = graded.map(s => s.timeSpent).filter(t => t != null)
  const avgTimeMin = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60) : null

  // Đánh giá học lực
  let learningLevel = 'Chưa xếp loại'
  if (avg != null) {
    const avgNum = parseFloat(avg)
    if (avgNum >= 8.0) learningLevel = 'Xuất sắc'
    else if (avgNum >= 6.5) learningLevel = 'Khá'
    else if (avgNum >= 5.0) learningLevel = 'Trung bình'
    else learningLevel = 'Yếu'
  }
  const bestDesc = best != null && parseFloat(best) === 10 ? 'Đạt điểm tuyệt đối!' : 'Mục tiêu: 10/10'

  return (
    <div className="prof-section">
      <h3 className="prof-section-title">{IcChart(16)} Thống kê học tập</h3>
      <div className="prof-info-grid">
        <StatRow icon={IcBook(18)}  color="#2563eb" label="Bài đã làm"      value={submissions.length} sub={`${graded.length} bài đã chấm điểm`} />
        <StatRow icon={IcStar(18)}  color="#f59e0b" label="Điểm trung bình" value={avg  != null ? `${avg}/10`  : '—'} sub={avg  != null ? `Học lực: ${learningLevel}` : 'Chưa có dữ liệu'} />
        <StatRow icon={IcAward(18)} color="#059669" label="Điểm cao nhất"  value={best != null ? `${best}/10` : '—'} sub={best != null ? bestDesc : 'Chưa có dữ liệu'} />
        <StatRow icon={IcClock(18)} color="#7c3aed" label="Thời gian TB"   value={avgTimeMin != null ? `${avgTimeMin} phút` : '—'} sub={avgTimeMin != null ? 'Tốc độ làm đề trung bình' : 'Chưa có dữ liệu'} />
      </div>
    </div>
  )
}

function TeacherStats({ userId }) {
  const exams = getExamsByTeacher(userId)
  const pub   = exams.filter(e => e.published).length
  const draft = exams.length - pub
  const pubPercent = exams.length ? Math.round((pub / exams.length) * 100) : 0

  return (
    <div className="prof-section">
      <h3 className="prof-section-title">{IcChart(16)} Thống kê giảng dạy</h3>
      <div className="prof-info-grid">
        <StatRow icon={IcBook(18)}  color="#059669" label="Đề đã tạo"     value={exams.length} sub="Đề thi trong bộ nhớ" />
        <StatRow icon={IcChart(18)} color="#2563eb" label="Đã phát hành"  value={pub}   sub={`Tỷ lệ phát hành: ${pubPercent}%`} />
        <StatRow icon={IcClock(18)} color="#f59e0b" label="Chưa phát link" value={draft} sub={draft > 0 ? 'Cần cấu hình liên kết' : 'Đã mở tất cả đề'} />
      </div>
    </div>
  )
}

function AdminStats() {
  const exams = getAllExams()
  return (
    <div className="prof-section">
      <h3 className="prof-section-title">{IcChart(16)} Thống kê hệ thống</h3>
      <div className="prof-info-grid">
        <StatRow icon={IcUsers(18)}  color="#7c3aed" label="Người dùng"   value={4} sub="Tài khoản hệ thống" />
        <StatRow icon={IcBook(18)}   color="#059669" label="Tổng đề thi" value={exams.length} sub="Đề thi lưu trữ toàn trường" />
        <StatRow
          icon={IcServer(18)}
          color="#2563eb"
          label="Server online"
          value={<><span className="psc-pulse-dot" style={{ marginRight: 6 }} />Hoạt động</>}
          sub="Ping: 12ms · Uptime: 99.9%"
        />
      </div>
    </div>
  )
}

/* ── Cửa hàng khung viền (học sinh mua bằng xu; super admin mở khoá sẵn hết) ── */
const RARITY_LABEL = { common: 'Phổ thông', rare: 'Hiếm', epic: 'Sử thi', legendary: 'Huyền thoại' }
const RARITY_COLOR = { common: '#64748b', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706' }

function FrameShopSection({ user, onUpdateUser }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shop/frames', { headers: authHeaders() })
      if (res.ok) setData(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const applyUser = (updated) => {
    const merged = { ...user, ...updated }
    localStorage.setItem(USER_KEY, JSON.stringify(merged))
    onUpdateUser(merged)
  }

  const handleBuy = async (frame) => {
    setError(''); setBusy(true)
    try {
      const res  = await fetch('/api/shop/buy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ frameId: frame.id }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Mua khung viền thất bại.'); return }
      applyUser(body)
      await load()
    } catch {
      setError('Không thể kết nối server.')
    } finally {
      setBusy(false)
    }
  }

  const handleEquip = async (frameId) => {
    setError(''); setBusy(true)
    try {
      const res  = await fetch('/api/shop/equip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ frameId }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Trang bị khung viền thất bại.'); return }
      applyUser(body)
      await load()
    } catch {
      setError('Không thể kết nối server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="prof-section">
      <h3 className="prof-section-title">
        {IcBag(16)} Cửa hàng khung viền
        <span className="prof-coin-badge">{IcCoin(14)} {loading ? '…' : (data?.coins ?? 0)} xu</span>
      </h3>
      <p className="prof-section-desc">
        {user.role === ROLES.SUPERADMIN
          ? 'Tài khoản super admin được mở khoá toàn bộ khung viền — chọn một khung để trang bị.'
          : 'Dùng xu để mở khoá khung viền cho ảnh đại diện. Xu hiện được super admin cấp thủ công.'}
      </p>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="prof-section-desc">Đang tải…</p>
      ) : !data ? (
        <div className="form-error">Không thể tải cửa hàng.</div>
      ) : (
        <div className="prof-shop-grid">
          <button
            type="button"
            className={`prof-shop-card ${!data.equippedFrame ? 'prof-shop-card--equipped' : ''}`}
            onClick={() => handleEquip(null)}
            disabled={busy}
          >
            <AvatarDisplay user={user} size={64} />
            <span className="prof-shop-name">Không dùng khung</span>
            {!data.equippedFrame && <span className="prof-shop-tag prof-shop-tag--equipped">{IcCheck(11)} Đang dùng</span>}
          </button>

          {data.frames.map(f => {
            const isEquipped = data.equippedFrame === f.id
            return (
              <button
                type="button"
                key={f.id}
                className={`prof-shop-card ${isEquipped ? 'prof-shop-card--equipped' : ''}`}
                onClick={() => f.owned ? handleEquip(f.id) : handleBuy(f)}
                disabled={busy}
              >
                <AvatarDisplay user={user} size={64} frameStyle={FRAME_STYLES[f.id]} />
                <span className="prof-shop-name">{f.name}</span>
                <span className="prof-shop-rarity" style={{ color: RARITY_COLOR[f.rarity] }}>{RARITY_LABEL[f.rarity] || f.rarity}</span>
                {isEquipped ? (
                  <span className="prof-shop-tag prof-shop-tag--equipped">{IcCheck(11)} Đang dùng</span>
                ) : f.owned ? (
                  <span className="prof-shop-tag prof-shop-tag--owned">Đã sở hữu — bấm để dùng</span>
                ) : (
                  <span className="prof-shop-tag prof-shop-tag--price">{IcCoin(11)} {f.price} xu</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */
export default function ProfilePage({ user, onUpdateUser, onGoHome, onGoHistory }) {
  const [nameVal,          setNameVal]          = useState(user.name)
  const [savingName,       setSavingName]       = useState(false)
  const [nameError,        setNameError]        = useState('')
  const [saved,            setSaved]            = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [submissions,      setSubmissions]      = useState([])

  const [curPwd,      setCurPwd]      = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwError,     setPwError]     = useState('')
  const [pwSuccess,   setPwSuccess]   = useState(false)

  useEffect(() => {
    if (user.role !== ROLES.STUDENT) return
    let alive = true
    fetchMySubmissions(user.id)
      .then(res => { if (alive) setSubmissions(res.submissions || []) })
      .catch(() => { if (alive) setSubmissions([]) })
    return () => { alive = false }
  }, [user.id, user.role])

  const handleSaveName = async () => {
    const trimmed = nameVal.trim()
    if (!trimmed) { setNameError('Vui lòng nhập họ tên.'); return }
    setNameError('')
    setSavingName(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { setNameError(data.error || 'Cập nhật thất bại.'); return }
      const updated = { ...user, ...data }
      localStorage.setItem(USER_KEY, JSON.stringify(updated))
      onUpdateUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setNameError('Không thể kết nối server.')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwError(''); setPwSuccess(false)
    if (newPwd.length < 6) { setPwError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return }
    if (newPwd !== confirmPwd) { setPwError('Xác nhận mật khẩu mới không khớp.'); return }
    setChangingPwd(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.error || 'Đổi mật khẩu thất bại.'); return }
      setPwSuccess(true)
      setCurPwd(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError('Không thể kết nối server.')
    } finally {
      setChangingPwd(false)
    }
  }

  const handleSaveAvatar = ({ avatarUrl, avatarColor }) => {
    const updated = { ...user, avatarUrl, avatarColor }
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
    onUpdateUser(updated)
    setShowAvatarPicker(false)
  }

  return (
    <div className="prof-page">
      <div className="container prof-container">
        <h1 className="prof-page-title">Hồ sơ cá nhân</h1>

        <div className="prof-settings-grid">
          {/* ── Thông tin cá nhân ── */}
          <div className="prof-section">
            <h3 className="prof-section-title">{IcUser(16)} Thông tin cá nhân</h3>

            <div className="prof-avatar-row">
              <AvatarDisplay user={user} size={60} onClick={() => setShowAvatarPicker(true)} frameStyle={FRAME_STYLES[user.equippedFrame]} />
              <div className="prof-avatar-meta">
                <span className="prof-avatar-name">{user.name}</span>
                <RoleBadge role={user.role} size="sm" />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <div className="input-wrap">
                <span className="input-icon">{IcMail(15)}</span>
                <input value={user.email} disabled />
              </div>
            </div>
            <div className="form-group">
              <label>Họ và tên</label>
              <div className="input-wrap">
                <span className="input-icon">{IcUser(15)}</span>
                <input
                  value={nameVal}
                  onChange={e => { setNameVal(e.target.value); setNameError('') }}
                  maxLength={60}
                />
              </div>
            </div>

            {nameError && <div className="form-error">{nameError}</div>}
            {saved && <div className="prof-saved-toast">{IcCheck(14)} Đã lưu thay đổi!</div>}

            <button
              className="prof-btn prof-btn--primary prof-btn--block"
              onClick={handleSaveName}
              disabled={savingName}
            >
              {IcCheck(14)} {savingName ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>

          {/* ── Đổi mật khẩu ── */}
          <div className="prof-section">
            <h3 className="prof-section-title">{IcLock(16)} Đổi mật khẩu</h3>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Mật khẩu hiện tại</label>
                <div className="input-wrap">
                  <span className="input-icon">{IcLock(15)}</span>
                  <input type="password" value={curPwd}
                    onChange={e => { setCurPwd(e.target.value); setPwError('') }}
                    autoComplete="current-password" />
                </div>
              </div>
              <div className="form-group">
                <label>Mật khẩu mới</label>
                <div className="input-wrap">
                  <span className="input-icon">{IcLock(15)}</span>
                  <input type="password" value={newPwd}
                    onChange={e => { setNewPwd(e.target.value); setPwError('') }}
                    autoComplete="new-password" />
                </div>
              </div>
              <div className="form-group">
                <label>Xác nhận mật khẩu mới</label>
                <div className="input-wrap">
                  <span className="input-icon">{IcLock(15)}</span>
                  <input type="password" value={confirmPwd}
                    onChange={e => { setConfirmPwd(e.target.value); setPwError('') }}
                    autoComplete="new-password" />
                </div>
              </div>

              {pwError && <div className="form-error">{pwError}</div>}
              {pwSuccess && <div className="prof-saved-toast">{IcCheck(14)} Đổi mật khẩu thành công!</div>}

              <button
                type="submit"
                className="prof-btn prof-btn--accent prof-btn--block"
                disabled={changingPwd}
              >
                {IcLock(14)} {changingPwd ? 'Đang xử lý…' : 'Đổi mật khẩu'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Cửa hàng khung viền ── */}
        {(user.role === ROLES.STUDENT || user.role === ROLES.SUPERADMIN) && (
          <FrameShopSection user={user} onUpdateUser={onUpdateUser} />
        )}

        {/* ── Thống kê theo vai trò ── */}
        {user.role === ROLES.STUDENT && <StudentStats submissions={submissions} />}
        {hasTeacherAccess(user.role)  && <TeacherStats userId={user.id} />}
        {(user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) && <AdminStats />}

        {/* ── Lịch sử làm bài ── */}
        {user.role === ROLES.STUDENT && (
          <button className="prof-history-link" onClick={onGoHistory}>
            <div className="phl-left-wrap">
              <div className="phl-icon">{IcClock(20)}</div>
              <div className="phl-info">
                <span className="phl-title">Lịch sử làm bài</span>
                <span className="phl-desc">Xem lại các đề kiểm tra đã làm, điểm số và bài giải chi tiết</span>
              </div>
            </div>
            <div className="phl-right">
              <span className="phl-count">{submissions.length} đề đã làm</span>
              {IcChevronRight(16)}
            </div>
          </button>
        )}

        {/* ── Quản trị hệ thống ── */}
        {(user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) && (
          <div className="prof-section">
            <h3 className="prof-section-title">{IcShield(16)} Quản trị hệ thống</h3>
            <p className="prof-section-desc">Bảng quản trị đầy đủ đang được phát triển.</p>
            <div className="prof-admin-chips">
              <span className="pac">{IcUsers(13)} Quản lý người dùng</span>
              <span className="pac">{IcChart(13)} Thống kê</span>
              {user.role === ROLES.SUPERADMIN && <span className="pac">{IcServer(13)} Cài đặt hệ thống</span>}
            </div>
          </div>
        )}

        {/* ── Back ── */}
        <div className="prof-back-row">
          <button className="prof-btn prof-btn--ghost" onClick={onGoHome}>
            {IcHome(15)} Về trang chủ
          </button>
        </div>
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          user={user}
          onSave={handleSaveAvatar}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  )
}

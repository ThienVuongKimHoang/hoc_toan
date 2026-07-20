import React, { useRef, useState } from 'react'
import RoleBadge from '../components/RoleBadge.jsx'
import { ROLE_META, ROLES, hasTeacherAccess } from '../auth/mockUsers.js'
import { getExamsByTeacher, getAllExams } from '../store/examStore.js'

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
const IcPencil = (s) => <Ic size={s}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></Ic>
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
const IcArrow  = (s) => <Ic size={s}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Ic>
const IcMail   = (s) => <Ic size={s}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Ic>
const IcUser   = (s) => <Ic size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ic>
const IcShield = (s) => <Ic size={s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Ic>
const IcDot    = (s, color) => <svg width={s} height={s} viewBox="0 0 8 8" style={{ flexShrink: 0, verticalAlign: 'middle' }}><circle cx="4" cy="4" r="4" fill={color} /></svg>

/* ── Avatar display ── */
export function AvatarDisplay({ user, size = 80, onClick, className = '' }) {
  const initial  = (user.name || user.email || '?')[0].toUpperCase()
  const bgColor  = user.avatarColor || ROLE_DEFAULT_COLOR[user.role] || '#2563eb'
  return (
    <div
      className={`avt-display ${onClick ? 'avt-display--clickable' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      title={onClick ? 'Đổi ảnh đại diện' : undefined}
    >
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="avatar" className="avt-display-img" />
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
}

/* ── Avatar picker modal ── */
function AvatarPicker({ user, onSave, onClose }) {
  const [preview,  setPreview]  = useState(user.avatarUrl || null)
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

/* ── Mock student history ── */
const MOCK_HISTORY = [
  { id: 1, title: 'Đề thi thử THPT – Sở Đồng Nai 2026',  score: 8.25, total: 10, date: '2026-06-20', time: '87 phút' },
  { id: 2, title: 'Đề thi thử THPT Quốc gia 2025',        score: 7.50, total: 10, date: '2026-06-15', time: '90 phút' },
  { id: 3, title: 'Đề tham khảo Bộ GD&ĐT 2025',           score: 9.00, total: 10, date: '2026-06-10', time: '75 phút' },
]

function ScoreBar({ score, total }) {
  const pct   = (score / total) * 100
  const color = pct >= 80 ? '#059669' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="prof-score-bar">
      <div className="psb-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function StatCard({ icon, value, label, color }) {
  return (
    <div className="prof-stat-card" style={{ '--sc-color': color }}>
      <div className="psc-icon">{icon}</div>
      <div className="psc-value">{value}</div>
      <div className="psc-label">{label}</div>
    </div>
  )
}

function StudentStats() {
  const avg = (MOCK_HISTORY.reduce((s, h) => s + h.score, 0) / MOCK_HISTORY.length).toFixed(2)
  return (
    <div className="prof-stats-row">
      <StatCard icon={IcBook(22)}  value={MOCK_HISTORY.length} label="Bài đã làm"      color="#2563eb" />
      <StatCard icon={IcStar(22)}  value={`${avg}/10`}         label="Điểm trung bình" color="#f59e0b" />
      <StatCard icon={IcAward(22)} value="9.00"                label="Điểm cao nhất"   color="#059669" />
      <StatCard icon={IcClock(22)} value="84 phút"             label="Thời gian TB"    color="#7c3aed" />
    </div>
  )
}

function TeacherStats({ userId }) {
  const exams = getExamsByTeacher(userId)
  const pub   = exams.filter(e => e.published).length
  const draft = exams.length - pub
  return (
    <div className="prof-stats-row">
      <StatCard icon={IcBook(22)}  value={exams.length} label="Đề đã tạo"    color="#059669" />
      <StatCard icon={IcChart(22)} value={pub}          label="Đã phát hành" color="#2563eb" />
      <StatCard icon={IcClock(22)} value={draft}        label="Chưa phát link" color="#f59e0b" />
    </div>
  )
}

function AdminStats() {
  const exams = getAllExams()
  return (
    <div className="prof-stats-row">
      <StatCard icon={IcUsers(22)}  value={4}            label="Người dùng"   color="#7c3aed" />
      <StatCard icon={IcBook(22)}   value={exams.length} label="Tổng đề thi"  color="#059669" />
      <StatCard icon={IcServer(22)} value="1"            label="Server online" color="#2563eb" />
    </div>
  )
}

function HistorySection() {
  return (
    <div className="prof-section">
      <h3 className="prof-section-title">{IcClock(16)} Lịch sử làm bài</h3>
      <div className="prof-history-list">
        {MOCK_HISTORY.map(h => (
          <div key={h.id} className="prof-history-item">
            <div className="phi-left">
              <div className="phi-title">{h.title}</div>
              <div className="phi-meta">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {IcClock(12)} {h.date}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {IcClock(12)} {h.time}
                </span>
              </div>
              <ScoreBar score={h.score} total={h.total} />
            </div>
            <div className="phi-score">
              <span className="phi-score-num">{h.score}</span>
              <span className="phi-score-total">/{h.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main page ── */
export default function ProfilePage({ user, onUpdateUser, onGoMyExams, onGoHome }) {
  const meta = ROLE_META[user.role]
  const [editing,          setEditing]          = useState(false)
  const [nameVal,          setNameVal]          = useState(user.name)
  const [saved,            setSaved]            = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  const handleSaveName = () => {
    if (!nameVal.trim()) return
    const updated = { ...user, name: nameVal.trim() }
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
    onUpdateUser(updated)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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

        {/* ── Hero card ── */}
        <div className={`prof-hero prof-hero--${user.role}`}>
          <div className="prof-avatar-wrap">
            <AvatarDisplay
              user={user}
              size={88}
              onClick={() => setShowAvatarPicker(true)}
            />
          </div>

          <div className="prof-hero-info">
            {editing ? (
              <div className="prof-name-edit">
                <input
                  className="prof-name-input"
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  autoFocus maxLength={60}
                />
                <div className="prof-name-edit-actions">
                  <button className="prof-btn prof-btn--primary" onClick={handleSaveName}>
                    {IcCheck(14)} Lưu
                  </button>
                  <button className="prof-btn prof-btn--ghost"
                    onClick={() => { setEditing(false); setNameVal(user.name) }}>
                    Huỷ
                  </button>
                </div>
              </div>
            ) : (
              <div className="prof-name-row">
                <h1 className="prof-name">{user.name}</h1>
                <button className="prof-edit-btn" onClick={() => setEditing(true)} title="Sửa tên">
                  {IcPencil(15)}
                </button>
              </div>
            )}
            {saved && (
              <div className="prof-saved-toast">
                {IcCheck(14)} Đã lưu
              </div>
            )}
            <div className="prof-email" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              {IcMail(13)} {user.email}
            </div>
            <RoleBadge role={user.role} size="md" />
          </div>
        </div>

        {/* ── Stats ── */}
        {user.role === ROLES.STUDENT && <StudentStats />}
        {hasTeacherAccess(user.role)  && <TeacherStats userId={user.id} />}
        {(user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) && <AdminStats />}

        {/* ── Info section ── */}
        <div className="prof-section">
          <h3 className="prof-section-title">{IcUser(16)} Thông tin tài khoản</h3>
          <div className="prof-info-grid">
            <div className="prof-info-row">
              <span className="pir-label">{IcUser(13)} Họ tên</span>
              <span className="pir-value">{user.name}</span>
            </div>
            <div className="prof-info-row">
              <span className="pir-label">{IcMail(13)} Email</span>
              <span className="pir-value">{user.email}</span>
            </div>
            <div className="prof-info-row">
              <span className="pir-label">{IcShield(13)} Vai trò</span>
              <span className="pir-value"><RoleBadge role={user.role} size="sm" /></span>
            </div>
            <div className="prof-info-row">
              <span className="pir-label">{IcServer(13)} Tài khoản</span>
              <span className="pir-value" style={{ color: '#94a3b8' }}>Demo</span>
            </div>
          </div>
        </div>

        {/* ── Role-specific sections ── */}
        {user.role === ROLES.STUDENT && <HistorySection />}

        {hasTeacherAccess(user.role) && (
          <div className="prof-section">
            <h3 className="prof-section-title">{IcBook(16)} Quản lý đề thi</h3>
            <p className="prof-section-desc">Xem, chỉnh sửa và phát hành các đề thi của bạn.</p>
            <button className="prof-btn prof-btn--primary prof-btn--lg" onClick={onGoMyExams}>
              {IcArrow(15)} Xem đề thi của tôi
            </button>
          </div>
        )}

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

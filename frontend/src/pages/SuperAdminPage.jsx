import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ROLE_META } from '../auth/mockUsers.js'
import { getAllExams } from '../store/examStore.js'
import { GRADES, gradeLabel } from '../components/SubjectBadge.jsx'
import SiteContentTab from './SiteContentTab.jsx'
import ReportsTab from './ReportsTab.jsx'

/* ── SVG primitives ── */
function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcStats   = (s) => <Ic size={s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ic>
const IcExams   = (s) => <Ic size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></Ic>
const IcUsers   = (s) => <Ic size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Ic>
const IcConfig  = (s) => <Ic size={s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></Ic>
const IcTrash   = (s) => <Ic size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Ic>
const IcSearch  = (s) => <Ic size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ic>
const IcStar    = (s) => <Ic size={s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ic>
const IcGlobe   = (s) => <Ic size={s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ic>
const IcReports = (s) => <Ic size={s}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ic>
const IcRefresh = (s) => <Ic size={s}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5.49"/></Ic>
const IcChevron = (s, dir='right') => <Ic size={s}>{dir==='left' ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 6 15 12 9 18"/>}</Ic>
const IcSave    = (s) => <Ic size={s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Ic>
const IcEdit    = (s) => <Ic size={s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2 2 0 0 1 3 3L13 14l-4 1 1-4Z"/></Ic>
const IcKey     = (s) => <Ic size={s}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></Ic>
const IcCheck   = (s) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>
const IcLock    = (s) => <Ic size={s}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Ic>
const IcBan     = (s) => <Ic size={s}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></Ic>

/* ── KPI Card ── */
function KpiCard({ label, value, sub, color = '#2563eb', icon }) {
  return (
    <div className="sa-kpi-card">
      <div className="sa-kpi-icon" style={{ background: color + '18', color }}>
        {icon}
      </div>
      <div className="sa-kpi-body">
        <div className="sa-kpi-label">{label}</div>
        <div className="sa-kpi-value" style={{ color }}>{value ?? '—'}</div>
        {sub && <div className="sa-kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

/* ── System bar ── */
function SysBar({ label, pct, color }) {
  return (
    <div className="sa-sys-row">
      <span className="sa-sys-label">{label}</span>
      <div className="sa-sys-track">
        <div className="sa-sys-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="sa-sys-pct">{pct}%</span>
    </div>
  )
}

/* ── Simple sparkline (pure SVG, no recharts dep) ── */
function Sparkline({ data = [], color = '#2563eb' }) {
  if (!data.length) return null
  const vals = data.map(d => d.submissions)
  const max  = Math.max(...vals, 1)
  const W = 320, H = 80, pad = 8
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1 || 1)) * (W - pad * 2)
    const y = H - pad - (v / max) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon
        points={`${pad},${H} ${pts} ${W - pad},${H}`}
        fill="url(#spGrad)"
      />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════ TAB: STATS ══ */
function StatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/stats')
      if (r.ok) setStats(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="sa-loading">Đang tải thống kê…</div>
  if (!stats)  return <div className="sa-error">Không tải được dữ liệu. Server có đang chạy không?</div>

  const s = stats.system || {}
  return (
    <div className="sa-stats">
      <div className="sa-section-title">Tổng quan hệ thống</div>

      <div className="sa-kpi-grid">
        <KpiCard label="Tổng đề thi"       value={stats.total_exams}       color="#2563eb" icon={IcExams(22)}  sub={`${stats.published_exams} đã phát`}/>
        <KpiCard label="Đề thi công khai"  value={stats.public_exams}      color="#059669" icon={IcGlobe(22)}  sub="Hiển thị trong sảnh chờ"/>
        <KpiCard label="Đề nổi bật"        value={stats.featured_exams}    color="#f59e0b" icon={IcStar(22)}   sub="Featured trên trang chủ"/>
        <KpiCard label="Tổng bài nộp"      value={stats.total_submissions} color="#7c3aed" icon={IcUsers(22)}  sub={`${stats.total_questions} câu hỏi`}/>
      </div>

      <div className="sa-section-title" style={{ marginTop: 28 }}>Bài nộp 7 ngày qua</div>
      <div className="sa-chart-card">
        <div className="sa-chart-labels">
          {(stats.trend || []).map(d => (
            <span key={d.date} className="sa-chart-lbl">{d.date.slice(5)}</span>
          ))}
        </div>
        <Sparkline data={stats.trend || []} color="#7c3aed" />
        <div className="sa-chart-total">
          Tổng: <strong>{(stats.trend || []).reduce((s, d) => s + d.submissions, 0)}</strong> bài nộp
        </div>
      </div>

      <div className="sa-section-title" style={{ marginTop: 28 }}>Hiệu năng máy chủ</div>
      <div className="sa-sys-card">
        <SysBar label="CPU"  pct={s.cpu_percent  || 0} color="#ef4444"/>
        <SysBar label="RAM"  pct={s.ram_percent  || 0} color="#f59e0b"/>
        <div className="sa-sys-detail">RAM: {s.ram_used_gb}GB / {s.ram_total_gb}GB</div>
        <SysBar label="Disk" pct={s.disk_percent || 0} color="#2563eb"/>
        <div className="sa-sys-detail">Disk: {s.disk_used_gb}GB / {s.disk_total_gb}GB · còn {s.disk_free_gb}GB</div>
      </div>

      <button className="sa-refresh-btn" onClick={load}>
        {IcRefresh(14)} Làm mới
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ TAB: EXAMS ══ */
function ConfirmModal({ title, body, onConfirm, onClose }) {
  return (
    <div className="sa-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sa-modal sa-modal--sm">
        <div className="sa-modal-header">
          <h3>{title}</h3>
          <button className="sa-modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="sa-modal-body">{body}</p>
        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>Huỷ</button>
          <button className="sa-btn sa-btn--danger" onClick={onConfirm}>Xác nhận xoá</button>
        </div>
      </div>
    </div>
  )
}

function ExamsTab() {
  const [exams, setExams]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage]     = useState(1)
  const [deleting, setDeleting] = useState(null)
  const [toggling, setToggling] = useState(null)
  const PER_PAGE = 12

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/exams')
      if (r.ok) setExams(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = exams.filter(e => {
    const q = search.toLowerCase()
    if (q && !e.title.toLowerCase().includes(q) && !e.id.includes(q)) return false
    if (filter === 'published' && !e.published) return false
    if (filter === 'public'    && !e.isPublic)  return false
    if (filter === 'featured'  && !e.featured)  return false
    if (filter === 'draft'     && e.published)  return false
    return true
  })
  const pages    = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' })
      setExams(prev => prev.filter(e => e.id !== id))
    } catch {}
    setDeleting(null)
  }

  const handleFeature = async (id, current) => {
    setToggling(id)
    try {
      await fetch(`/api/admin/exams/${id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !current }),
      })
      setExams(prev => prev.map(e => e.id === id ? { ...e, featured: !current } : e))
    } catch {}
    setToggling(null)
  }

  const handleTogglePublic = async (id, current) => {
    setToggling(id)
    try {
      await fetch(`/api/exams/${id}/toggle-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !current }),
      })
      setExams(prev => prev.map(e => e.id === id ? { ...e, isPublic: !current } : e))
    } catch {}
    setToggling(null)
  }

  const fmt = iso => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <div className="sa-exams">
      {deleting && (
        <ConfirmModal
          title="Xoá đề thi"
          body={`Bạn chắc chắn muốn xoá đề thi "${deleting.title}"? Hành động không thể hoàn tác.`}
          onConfirm={() => handleDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      <div className="sa-toolbar">
        <div className="sa-search-wrap">
          {IcSearch(15)}
          <input
            className="sa-search"
            placeholder="Tìm theo tên, mã đề…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <div className="sa-filter-tabs">
          {[
            { key: 'all',       label: 'Tất cả' },
            { key: 'published', label: 'Đã phát' },
            { key: 'public',    label: 'Công khai' },
            { key: 'featured',  label: 'Nổi bật' },
            { key: 'draft',     label: 'Nháp' },
          ].map(f => (
            <button
              key={f.key}
              className={`sa-filter-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => { setFilter(f.key); setPage(1) }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="sa-count-badge">{filtered.length} đề</div>

        <button className="sa-refresh-btn sa-refresh-btn--sm" onClick={load}>
          {IcRefresh(14)}
        </button>
      </div>

      {loading ? (
        <div className="sa-loading">Đang tải…</div>
      ) : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Mã đề</th>
                  <th>Tên đề thi</th>
                  <th>Câu</th>
                  <th>Bài nộp</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={7} className="sa-empty">Không có đề thi nào.</td></tr>
                ) : paginated.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <code className="sa-code">{exam.id}</code>
                    </td>
                    <td className="sa-title-cell">
                      <span className="sa-exam-title">{exam.title}</span>
                      {exam.featured && (
                        <span className="sa-badge sa-badge--featured">★ Nổi bật</span>
                      )}
                    </td>
                    <td>{exam.totalQuestions}</td>
                    <td>{exam.submissionCount}</td>
                    <td>
                      <div className="sa-status-stack">
                        <span className={`sa-badge ${exam.published ? 'sa-badge--pub' : 'sa-badge--draft'}`}>
                          {exam.published ? 'Đã phát' : 'Nháp'}
                        </span>
                        {exam.isPublic && <span className="sa-badge sa-badge--public">Công khai</span>}
                      </div>
                    </td>
                    <td>{fmt(exam.createdAt)}</td>
                    <td>
                      <div className="sa-actions">
                        {exam.published && (
                          <button
                            className={`sa-act-btn ${exam.isPublic ? 'sa-act-btn--active' : ''}`}
                            title={exam.isPublic ? 'Đang công khai — click để ẩn' : 'Đặt công khai'}
                            disabled={toggling === exam.id}
                            onClick={() => handleTogglePublic(exam.id, exam.isPublic)}
                          >
                            {IcGlobe(14)}
                          </button>
                        )}
                        <button
                          className={`sa-act-btn ${exam.featured ? 'sa-act-btn--star' : ''}`}
                          title={exam.featured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}
                          disabled={toggling === exam.id}
                          onClick={() => handleFeature(exam.id, exam.featured)}
                        >
                          {IcStar(14)}
                        </button>
                        <button
                          className="sa-act-btn sa-act-btn--del"
                          title="Xoá đề thi"
                          onClick={() => setDeleting(exam)}
                        >
                          {IcTrash(14)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="sa-pagination">
              <button className="sa-pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                {IcChevron(15, 'left')}
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`sa-pg-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button className="sa-pg-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                {IcChevron(15, 'right')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ TAB: USERS ══ */
function EditRoleModal({ user, onSave, onClose }) {
  const [role, setRole]   = useState(user.role)
  const [grade, setGrade] = useState(user.grade ? String(user.grade) : '')
  const roles = Object.entries(ROLE_META).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon }))
  return (
    <div className="sa-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sa-modal sa-modal--sm">
        <div className="sa-modal-header">
          <h3>{IcEdit(16)} Sửa người dùng — {user.name}</h3>
          <button className="sa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="sa-field-label">Vai trò</div>
        <div className="sa-role-list">
          {roles.map(r => (
            <label key={r.key} className={`sa-role-option ${role === r.key ? 'selected' : ''}`}>
              <input type="radio" name="role" value={r.key} checked={role === r.key}
                onChange={() => setRole(r.key)} />
              <span className="sa-role-icon">{r.icon}</span>
              <span className="sa-role-label">{r.label}</span>
            </label>
          ))}
        </div>
        <div className="sa-field-label">Khối (cấp độ lớp)</div>
        <select className="sa-grade-select" value={grade} onChange={e => setGrade(e.target.value)}>
          <option value="">— Chưa đặt khối —</option>
          {GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
        </select>
        <p className="sa-field-hint">Dùng cho học sinh — quyết định lớp học sinh có thể tham gia.</p>
        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>Huỷ</button>
          <button className="sa-btn sa-btn--primary" onClick={() => onSave(user.id, role, grade || null)}>Lưu</button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onSave, onClose }) {
  const [pwd,     setPwd]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [err,     setErr]     = useState('')
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (pwd.length < 6)   { setErr('Mật khẩu tối thiểu 6 ký tự.'); return }
    if (pwd !== confirm)  { setErr('Mật khẩu xác nhận không khớp.'); return }
    setSaving(true)
    await onSave(user.id, pwd)
    setSaving(false)
  }

  return (
    <div className="sa-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sa-modal sa-modal--sm">
        <div className="sa-modal-header">
          <h3>{IcKey(16)} Đặt lại mật khẩu — {user.name}</h3>
          <button className="sa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            className="sa-config-input"
            placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setErr('') }}
            autoFocus
          />
          <input
            type="password"
            className="sa-config-input"
            placeholder="Xác nhận mật khẩu mới"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setErr('') }}
          />
          {err && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>⚠️ {err}</div>}
        </div>
        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>Huỷ</button>
          <button className="sa-btn sa-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Đang lưu…' : `${IcLock(14)} Đặt lại`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Avatar người dùng: hiển thị ảnh nếu là URL/data-URI (vd. đăng nhập Google),
   nếu không (hoặc ảnh lỗi) thì hiển thị chữ cái đầu. */
function UserAvatar({ user, meta }) {
  const [failed, setFailed] = useState(false)
  const src     = user.avatarUrl || user.avatar
  const isImg   = typeof src === 'string' && (/^https?:\/\//.test(src) || src.startsWith('data:'))
  const initial = (user.name || user.email || '?')[0].toUpperCase()

  if (isImg && !failed) {
    return (
      <div className="sa-user-avatar sa-user-avatar--img">
        <img src={src} alt="" onError={() => setFailed(true)} />
      </div>
    )
  }
  return (
    <div className="sa-user-avatar" style={{ background: (meta?.color || '#888') + '22', color: meta?.color || '#888' }}>
      {/* tránh đổ nguyên URL dài ra màn hình nếu avatar là URL lỗi */}
      {isImg ? initial : (user.avatar || initial)}
    </div>
  )
}

function UsersTab() {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [editing,  setEditing]  = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [pwdEdit,  setPwdEdit]  = useState(null)
  const [page,     setPage]     = useState(1)
  const PER_PAGE = 15

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/users')
      if (r.ok) setUsers(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('hoctoan_user')) } catch { return null }
  })()

  const filtered = users
    .filter(u => {
      const q = search.toLowerCase()
      if (q && !u.name.toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false
      if (filter !== 'all' && u.role !== filter) return false
      return true
    })
    // Ưu tiên hiển thị: super_admin -> admin -> giáo viên -> học sinh -> khách
    .sort((a, b) => {
      const tierDiff = (ROLE_META[b.role]?.tier ?? -1) - (ROLE_META[a.role]?.tier ?? -1)
      return tierDiff !== 0 ? tierDiff : a.name.localeCompare(b.name, 'vi')
    })
  const pages     = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleSaveRole = async (userId, newRole, newGrade) => {
    const prevUser = users.find(u => String(u.id) === String(userId))
    try {
      if (!prevUser || prevUser.role !== newRole) {
        await fetch(`/api/admin/users/${userId}/role`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ role: newRole }),
        })
      }
      const normGrade = newGrade || null
      if (!prevUser || (prevUser.grade || null) !== normGrade) {
        await fetch(`/api/admin/users/${userId}/grade`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ grade: normGrade }),
        })
      }
      setUsers(prev => prev.map(u => String(u.id) === String(userId) ? { ...u, role: newRole, grade: normGrade } : u))
      if (currentUser && String(currentUser.id) === String(userId)) {
        const updated = { ...currentUser, role: newRole, grade: normGrade }
        localStorage.setItem('hoctoan_user', JSON.stringify(updated))
        window.dispatchEvent(new CustomEvent('hoctoan_user_updated', { detail: updated }))
      }
    } catch {}
    setEditing(null)
  }

  const handleDelete = async (userId) => {
    try {
      await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      setUsers(prev => prev.filter(u => String(u.id) !== String(userId)))
    } catch {}
    setDeleting(null)
  }

  const handleResetPwd = async (userId, pwd) => {
    try {
      await fetch(`/api/admin/users/${userId}/password`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pwd }),
      })
    } catch {}
    setPwdEdit(null)
  }

  const fmt = iso => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <div className="sa-users">
      {editing && (
        <EditRoleModal user={editing} onSave={handleSaveRole} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmModal
          title="Xoá người dùng"
          body={`Bạn chắc chắn muốn xoá tài khoản "${deleting.name}" (${deleting.email})? Hành động không thể hoàn tác.`}
          onConfirm={() => handleDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
      {pwdEdit && (
        <ResetPasswordModal user={pwdEdit} onSave={handleResetPwd} onClose={() => setPwdEdit(null)} />
      )}

      <div className="sa-toolbar">
        <div className="sa-search-wrap">
          {IcSearch(15)}
          <input
            className="sa-search"
            placeholder="Tìm theo tên, email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="sa-filter-tabs">
          <button className={`sa-filter-tab ${filter==='all' ? 'active':''}`} onClick={() => { setFilter('all'); setPage(1) }}>
            Tất cả
          </button>
          {Object.entries(ROLE_META).map(([k, v]) => (
            <button key={k} className={`sa-filter-tab ${filter===k ? 'active':''}`} onClick={() => { setFilter(k); setPage(1) }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <div className="sa-count-badge">{filtered.length} người</div>
        <button className="sa-refresh-btn sa-refresh-btn--sm" onClick={load}>{IcRefresh(14)}</button>
      </div>

      {loading ? (
        <div className="sa-loading">Đang tải…</div>
      ) : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Khối</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={7} className="sa-empty">Không có người dùng nào.</td></tr>
                ) : paginated.map(u => {
                  const meta   = ROLE_META[u.role]
                  const isSelf = String(currentUser?.id) === String(u.id)
                  return (
                    <tr key={u.id} className={isSelf ? 'sa-row--self' : ''}>
                      <td><code className="sa-code">#{u.id}</code></td>
                      <td>
                        <div className="sa-user-name">
                          <UserAvatar user={u} meta={meta} />
                          <span>{u.name}</span>
                          {isSelf && <span className="sa-badge sa-badge--self">Bạn</span>}
                          {u.isRegistered && <span className="sa-badge" style={{background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0'}}>Tự đăng ký</span>}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="sa-role-pill" style={{ background: meta?.bg, color: meta?.textColor }}>
                          {meta?.icon} {meta?.label}
                        </span>
                      </td>
                      <td>
                        {u.grade
                          ? <span className="sa-grade-pill">🎓 {gradeLabel(u.grade)}</span>
                          : <span className="sa-grade-empty">—</span>}
                      </td>
                      <td>{fmt(u.createdAt)}</td>
                      <td>
                        <div className="sa-actions">
                          <button className="sa-act-btn" title="Sửa vai trò & khối" onClick={() => setEditing(u)}>
                            {IcEdit(14)}
                          </button>
                          <button className="sa-act-btn" title="Đặt lại mật khẩu" onClick={() => setPwdEdit(u)}>
                            {IcKey(14)}
                          </button>
                          {!isSelf && (
                            <button className="sa-act-btn sa-act-btn--del" title="Xoá tài khoản" onClick={() => setDeleting(u)}>
                              {IcTrash(14)}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="sa-pagination">
              <button className="sa-pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                {IcChevron(15, 'left')}
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`sa-pg-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
              <button className="sa-pg-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                {IcChevron(15, 'right')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ TAB: CONFIG ══ */
function ConfigTab() {
  const [cfg,     setCfg]     = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.ok ? r.json() : {})
      .then(data => { setCfg({ announcement: '', maxExamsPerUser: 50, allowPublicExams: true, ...data }); setLoading(false) })
      .catch(() => { setCfg({ announcement: '', maxExamsPerUser: 50, allowPublicExams: true }); setLoading(false) })
  }, [])

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
  }

  if (loading) return <div className="sa-loading">Đang tải cấu hình…</div>

  return (
    <div className="sa-config">
      <div className="sa-config-card">
        <div className="sa-config-title">Thông báo hệ thống</div>
        <div className="sa-config-row">
          <label className="sa-config-label">Thông báo toàn site (để trống = tắt)</label>
          <textarea
            className="sa-config-input sa-config-textarea"
            value={cfg.announcement || ''}
            onChange={e => setCfg(c => ({ ...c, announcement: e.target.value }))}
            placeholder="Nhập thông báo sẽ hiển thị ở đầu trang…"
            rows={3}
          />
        </div>
      </div>

      <div className="sa-config-card">
        <div className="sa-config-title">Giới hạn hệ thống</div>
        <div className="sa-config-row">
          <label className="sa-config-label">Số đề tối đa / giáo viên</label>
          <input
            type="number" min={1} max={999}
            className="sa-config-input sa-config-number"
            value={cfg.maxExamsPerUser ?? 50}
            onChange={e => setCfg(c => ({ ...c, maxExamsPerUser: +e.target.value }))}
          />
        </div>
        <div className="sa-config-row sa-config-row--toggle">
          <div>
            <label className="sa-config-label">Cho phép giáo viên đặt đề công khai</label>
            <div className="sa-config-hint">Khi tắt, chỉ super admin mới đặt đề thành công khai</div>
          </div>
          <label className="sa-toggle">
            <input
              type="checkbox"
              checked={!!cfg.allowPublicExams}
              onChange={e => setCfg(c => ({ ...c, allowPublicExams: e.target.checked }))}
            />
            <span className="sa-toggle-slider" />
          </label>
        </div>
      </div>

      <div className="sa-config-card">
        <div className="sa-config-title">Trang chủ</div>
        <div className="sa-config-row">
          <label className="sa-config-label">Tiêu đề hero section</label>
          <input
            className="sa-config-input"
            value={cfg.heroTitle || ''}
            onChange={e => setCfg(c => ({ ...c, heroTitle: e.target.value }))}
            placeholder="Luyện thi THPT với AI"
          />
        </div>
        <div className="sa-config-row">
          <label className="sa-config-label">Mô tả hero section</label>
          <textarea
            className="sa-config-input sa-config-textarea"
            value={cfg.heroDesc || ''}
            onChange={e => setCfg(c => ({ ...c, heroDesc: e.target.value }))}
            placeholder="Mô tả ngắn xuất hiện dưới tiêu đề…"
            rows={2}
          />
        </div>
      </div>

      <div className="sa-config-footer">
        <button
          className={`sa-btn sa-btn--primary ${saved ? 'sa-btn--saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? <>{IcCheck(15)} Đã lưu</> : <>{IcSave(15)} {saving ? 'Đang lưu…' : 'Lưu cấu hình'}</>}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════ TAB: SECURITY ══ */
function BanIpModal({ initialIp = '', onSave, onClose }) {
  const [ip, setIp]         = useState(initialIp)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const handleSave = async () => {
    if (!ip.trim()) { setErr('Vui lòng nhập địa chỉ IP.'); return }
    setSaving(true)
    try { await onSave(ip.trim(), reason.trim()) } finally { setSaving(false) }
  }

  return (
    <div className="sa-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sa-modal sa-modal--sm">
        <div className="sa-modal-header">
          <h3>{IcBan(16)} Cấm địa chỉ IP</h3>
          <button className="sa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="sa-config-input"
            placeholder="Địa chỉ IP (vd. 203.0.113.10)"
            value={ip}
            onChange={e => { setIp(e.target.value); setErr('') }}
            autoFocus
            disabled={!!initialIp}
          />
          <input
            className="sa-config-input"
            placeholder="Lý do (không bắt buộc)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          {err && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>⚠️ {err}</div>}
        </div>
        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>Huỷ</button>
          <button className="sa-btn sa-btn--danger" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Đang cấm…' : <>{IcBan(14)} Cấm IP</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function SecurityTab({ viewerId }) {
  const [attempts, setAttempts]     = useState([])
  const [banned, setBanned]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [banning, setBanning]       = useState(null)   // null | true (form trắng) | "1.2.3.4" (từ 1 dòng)
  const [unbanning, setUnbanning]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/login-attempts?viewerId=${encodeURIComponent(viewerId)}`)
      if (r.ok) {
        const data = await r.json()
        setAttempts(data.attempts || [])
        setBanned(data.banned || [])
      }
    } catch {}
    setLoading(false)
  }, [viewerId])

  useEffect(() => { load() }, [load])

  const handleBan = async (ip, reason) => {
    try {
      await fetch('/api/admin/banned-ips', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ viewerId, ip, reason }),
      })
      await load()
    } catch {}
    setBanning(null)
  }

  const handleUnban = async (ip) => {
    try {
      await fetch(`/api/admin/banned-ips/${encodeURIComponent(ip)}?viewerId=${encodeURIComponent(viewerId)}`, {
        method: 'DELETE',
      })
      await load()
    } catch {}
    setUnbanning(null)
  }

  const bannedSet = new Set(banned.map(b => b.ip))
  const fmt     = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  const fmtLock = s => s <= 0 ? '—' : (s >= 60 ? `${Math.ceil(s / 60)} phút` : `${s} giây`)

  return (
    <div className="sa-exams">
      {banning && (
        <BanIpModal
          initialIp={typeof banning === 'string' ? banning : ''}
          onSave={handleBan}
          onClose={() => setBanning(null)}
        />
      )}
      {unbanning && (
        <ConfirmModal
          title="Gỡ cấm IP"
          body={`Cho phép địa chỉ IP "${unbanning}" truy cập trở lại?`}
          onConfirm={() => handleUnban(unbanning)}
          onClose={() => setUnbanning(null)}
        />
      )}

      <div className="sa-toolbar">
        <div className="sa-count-badge">{attempts.length} IP có lịch sử đăng nhập sai</div>
        <button className="sa-btn sa-btn--primary" onClick={() => setBanning(true)}>
          {IcBan(14)} Cấm IP thủ công
        </button>
        <button className="sa-refresh-btn sa-refresh-btn--sm" onClick={load}>{IcRefresh(14)}</button>
      </div>

      {loading ? (
        <div className="sa-loading">Đang tải…</div>
      ) : (
        <>
          <div className="sa-config-title" style={{ marginTop: 8 }}>IP đang bị theo dõi (đăng nhập sai)</div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Địa chỉ IP</th>
                  <th>Số lần sai</th>
                  <th>Đang khoá</th>
                  <th>Cập nhật lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 ? (
                  <tr><td colSpan={5} className="sa-empty">Chưa có IP nào đăng nhập sai.</td></tr>
                ) : attempts.map(a => (
                  <tr key={a.ip}>
                    <td><code className="sa-code">{a.ip}</code></td>
                    <td>{a.failCount}</td>
                    <td>{a.lockedSeconds > 0
                      ? <span className="sa-badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{IcLock(12)} {fmtLock(a.lockedSeconds)}</span>
                      : '—'}</td>
                    <td>{fmt(a.updatedAt)}</td>
                    <td>
                      <div className="sa-actions">
                        {bannedSet.has(a.ip) ? (
                          <span className="sa-badge" style={{ background: '#f1f5f9', color: '#475569' }}>Đã cấm</span>
                        ) : (
                          <button className="sa-act-btn sa-act-btn--del" title="Cấm IP này" onClick={() => setBanning(a.ip)}>
                            {IcBan(14)}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sa-config-title" style={{ marginTop: 24 }}>IP đã bị cấm truy cập</div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Địa chỉ IP</th>
                  <th>Lý do</th>
                  <th>Cấm lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {banned.length === 0 ? (
                  <tr><td colSpan={4} className="sa-empty">Chưa cấm IP nào.</td></tr>
                ) : banned.map(b => (
                  <tr key={b.ip}>
                    <td><code className="sa-code">{b.ip}</code></td>
                    <td>{b.reason || '—'}</td>
                    <td>{fmt(b.bannedAt)}</td>
                    <td>
                      <div className="sa-actions">
                        <button className="sa-act-btn" title="Gỡ cấm" onClick={() => setUnbanning(b.ip)}>
                          {IcCheck(14)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ MAIN PAGE ══ */
const TABS = [
  { key: 'stats',  label: 'Thống kê',          icon: IcStats },
  { key: 'exams',  label: 'Quản lý đề thi',     icon: IcExams },
  { key: 'users',  label: 'Người dùng',          icon: IcUsers },
  { key: 'config', label: 'Cấu hình hệ thống',   icon: IcConfig },
  { key: 'reports', label: 'Báo cáo',            icon: IcReports },
  { key: 'security', label: 'Bảo mật / Chặn IP', icon: IcBan, superAdminOnly: true },
  { key: 'site',   label: 'Nội dung trang chủ',   icon: IcGlobe },
]

export default function SuperAdminPage({ user, onGoHome, initialTab, navNonce }) {
  const visibleTabs = TABS.filter(t => !t.superAdminOnly || user?.role === 'super_admin')
  const [tab,       setTab]       = useState(
    initialTab && visibleTabs.some(t => t.key === initialTab) ? initialTab : 'stats'
  )
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sa_sidebar_collapsed') === 'true'
  )

  // Cho phép điều hướng thẳng vào 1 tab từ bên ngoài (vd: bấm thông báo báo cáo).
  // Phụ thuộc navNonce (tăng mỗi lần điều hướng) để nhảy tab được kể cả khi bấm lại đúng tab cũ.
  useEffect(() => {
    if (initialTab && visibleTabs.some(t => t.key === initialTab)) setTab(initialTab)
  }, [navNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSidebar = () => {
    setCollapsed(v => {
      localStorage.setItem('sa_sidebar_collapsed', String(!v))
      return !v
    })
  }

  const TabContent = {
    stats:  <StatsTab />,
    exams:  <ExamsTab />,
    users:  <UsersTab />,
    config: <ConfigTab />,
    reports: <ReportsTab viewerId={user.id} />,
    security: <SecurityTab viewerId={user.id} />,
    site:   <SiteContentTab />,
  }[tab]

  return (
    <div className="sa-layout">
      {/* ── Sidebar ── */}
      <aside className={`sa-sidebar ${collapsed ? 'sa-sidebar--collapsed' : ''}`}>
        <div className="sa-sidebar-header">
          {!collapsed && <span className="sa-sidebar-title">SUPER ADMIN</span>}
          <button className="sa-sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Mở rộng' : 'Thu gọn'}>
            {collapsed ? IcChevron(15, 'right') : IcChevron(15, 'left')}
          </button>
        </div>

        <nav className="sa-sidebar-nav">
          {visibleTabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                className={`sa-nav-item ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
                title={collapsed ? t.label : undefined}
              >
                {Icon(18)}
                {!collapsed && <span>{t.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sa-sidebar-footer">
          <button className="sa-nav-item sa-nav-item--back" onClick={onGoHome} title="Trang chủ">
            {IcChevron(15, 'left')}
            {!collapsed && <span>Trang chủ</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="sa-main">
        <div className="sa-topbar">
          <div className="sa-topbar-left">
            <span className="sa-topbar-crown">👑</span>
            <div>
              <h1 className="sa-topbar-title">
                {visibleTabs.find(t => t.key === tab)?.label}
              </h1>
              <p className="sa-topbar-sub">
                Đăng nhập: <strong>{user?.name}</strong> · {ROLE_META[user?.role]?.icon} {ROLE_META[user?.role]?.label}
              </p>
            </div>
          </div>
        </div>

        <div className="sa-content">
          {TabContent}
        </div>
      </main>
    </div>
  )
}

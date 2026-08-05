import React, { useEffect, useState } from 'react'
import { authHeaders } from '../auth/mockUsers.js'
import { SUBJECTS } from '../components/SubjectBadge.jsx'
import { getLabelGroups } from '../data/labels.js'

function IcExam(size = 18) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}

const TOPIC_SUBJECTS = ['toan', 'ly', 'hoa']

/* ═══════════════════════════════════════════ MỤC: ĐỀ THI (nhãn chủ đề) ══ */
function ExamTopicsTab() {
  const [subject, setSubject]         = useState('toan')
  const [grade, setGrade]             = useState('thpt')
  const [customTopics, setCustomTopics] = useState([])
  const [loading, setLoading]         = useState(true)
  const [newGroup, setNewGroup]       = useState('')
  const [newTopic, setNewTopic]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState('')

  const load = () => {
    setLoading(true)
    fetch(`/api/topics/custom?subject=${subject}&grade=${grade}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { topics: [] })
      .then(data => setCustomTopics(data.topics || []))
      .catch(() => setCustomTopics([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [subject, grade]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTopic.trim()) { setErr('Tên chủ đề không được để trống.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/topics/custom', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ subject, grade, group: newGroup.trim(), topic: newTopic.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Không thêm được nhãn.'); setSaving(false); return }
      setNewTopic(''); setNewGroup('')
      load()
    } catch {
      setErr('Lỗi kết nối.')
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    setCustomTopics(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/topics/custom/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
  }

  const groups = getLabelGroups(subject, grade)

  return (
    <div className="sa-config">
      <div className="sa-config-card">
        <div className="sa-config-title">Chọn môn + cấp học</div>
        <div className="sa-config-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {TOPIC_SUBJECTS.map(s => (
            <button key={s} type="button"
              className={`rs-grade-btn ${subject === s ? 'active' : ''}`}
              onClick={() => setSubject(s)}>
              {SUBJECTS[s]?.label || s}
            </button>
          ))}
          <div className="rs-grade-toggle" style={{ marginLeft: 12 }}>
            <button type="button" className={`rs-grade-btn ${grade === 'thpt' ? 'active' : ''}`}
              onClick={() => setGrade('thpt')}>THPT</button>
            <button type="button" className={`rs-grade-btn ${grade === 'thcs' ? 'active' : ''}`}
              onClick={() => setGrade('thcs')}>THCS</button>
          </div>
        </div>
      </div>

      <div className="sa-config-card">
        <div className="sa-config-title">Thêm nhãn chủ đề mới</div>
        <form onSubmit={handleAdd} className="sa-config-row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="sa-config-label">Nhóm (tuỳ chọn)</label>
            <input className="sa-config-input" value={newGroup}
              onChange={e => setNewGroup(e.target.value)} placeholder="vd. Hàm số và ứng dụng" />
          </div>
          <div>
            <label className="sa-config-label">Tên chủ đề</label>
            <input className="sa-config-input" value={newTopic}
              onChange={e => setNewTopic(e.target.value)} placeholder="Tên chủ đề mới…" />
          </div>
          <button className="sa-btn sa-btn--primary" disabled={saving} type="submit">
            {saving ? 'Đang thêm…' : '+ Thêm nhãn'}
          </button>
        </form>
        {err && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8 }}>⚠️ {err}</div>}
        <div className="sa-config-hint">
          Nhãn tự thêm dùng chung cho toàn hệ thống — mọi giáo viên khi trích/tạo đề đều chọn được,
          kể cả AI khi tự động phân loại chủ đề lúc trích PDF.
        </div>
      </div>

      <div className="sa-config-card">
        <div className="sa-config-title">
          Nhãn tự thêm ({SUBJECTS[subject]?.label} · {grade === 'thpt' ? 'THPT' : 'THCS'})
        </div>
        {loading ? (
          <div className="sa-loading">Đang tải…</div>
        ) : customTopics.length === 0 ? (
          <div className="sa-config-hint">Chưa có nhãn tự thêm nào cho môn/cấp này.</div>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Nhóm</th><th>Chủ đề</th><th /></tr></thead>
              <tbody>
                {customTopics.map(t => (
                  <tr key={t.id}>
                    <td>{t.group || '—'}</td>
                    <td>{t.topic}</td>
                    <td><button className="sa-btn sa-btn--ghost" onClick={() => handleDelete(t.id)}>Xoá</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sa-config-card">
        <div className="sa-config-title">Nhãn có sẵn trong hệ thống</div>
        <div className="sa-config-hint" style={{ marginBottom: 10 }}>Danh sách nhãn gốc, chỉ để tham khảo.</div>
        {groups.map(g => (
          <div key={g.group} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>{g.group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.topics.map(t => <span key={t} className="eq-topic-group-tag">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════ SHELL ══ */
const TABS = [
  { key: 'exam', label: 'Đề thi', icon: IcExam },
]

export default function SettingsPage({ user, onGoHome }) {
  const [tab, setTab] = useState('exam')
  const TabContent = { exam: <ExamTopicsTab /> }[tab]

  return (
    <div className="sa-layout">
      <aside className="sa-sidebar">
        <div className="sa-sidebar-header">
          <span className="sa-sidebar-title">CÀI ĐẶT</span>
        </div>
        <nav className="sa-sidebar-nav">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`sa-nav-item ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon(18)}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="sa-sidebar-footer">
          <button className="sa-nav-item sa-nav-item--back" onClick={onGoHome}>
            <span>← Trang chủ</span>
          </button>
        </div>
      </aside>

      <main className="sa-main">
        <div className="sa-topbar">
          <div className="sa-topbar-left">
            <div>
              <h1 className="sa-topbar-title">{TABS.find(t => t.key === tab)?.label}</h1>
              <p className="sa-topbar-sub">Đăng nhập: <strong>{user?.name}</strong></p>
            </div>
          </div>
        </div>
        <div className="sa-content">{TabContent}</div>
      </main>
    </div>
  )
}

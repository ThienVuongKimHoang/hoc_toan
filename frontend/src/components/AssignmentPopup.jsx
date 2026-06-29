import React, { useEffect, useState } from 'react'
import { getPendingForStudent } from '../store/classStore.js'

export default function AssignmentPopup({ user, onGoMyClasses }) {
  const [pending, setPending] = useState([])
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    if (!user) return
    getPendingForStudent(String(user.id), user.email).then(({ items }) => {
      if (items && items.length > 0) {
        setPending(items)
        setOpen(true)
      }
    }).catch(() => {})
  }, [user?.id])

  if (!open || pending.length === 0) return null

  const formatDt = iso => iso
    ? new Date(iso).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
    : '—'

  const urgent = pending.filter(a => {
    const diff = new Date(a.dueDate) - new Date()
    return diff < 86400_000 // within 24h
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal-box ap-modal">
        <div className="modal-header">
          <h2>📚 Bài tập chưa nộp</h2>
          <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div style={{padding:'0 24px 24px'}}>
          <p className="ap-subtitle">
            Bạn có <strong>{pending.length} bài tập</strong> chưa nộp.
            {urgent.length > 0 && <span className="ap-urgent"> {urgent.length} bài sắp hết hạn!</span>}
          </p>
          <div className="ap-list">
            {pending.slice(0, 5).map(a => {
              const diff = new Date(a.dueDate) - new Date()
              const isUrgent = diff < 86400_000
              return (
                <div key={a.id} className={`ap-item ${isUrgent ? 'ap-item--urgent' : ''}`}>
                  <div className="ap-item-dot" />
                  <div className="ap-item-info">
                    <div className="ap-item-title">{a.title}</div>
                    <div className="ap-item-meta">
                      <span className="ap-class-name">🏫 {a.className}</span>
                      <span className={`ap-due ${isUrgent ? 'ap-due--urgent' : ''}`}>
                        ⏰ Hạn: {formatDt(a.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            {pending.length > 5 && (
              <div className="ap-more">và {pending.length - 5} bài tập khác…</div>
            )}
          </div>
          <div className="cm-footer">
            <button className="pm-cancel" onClick={() => setOpen(false)}>Để sau</button>
            <button className="btn-primary" onClick={() => { setOpen(false); onGoMyClasses() }}>
              📚 Đến Lớp của tôi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

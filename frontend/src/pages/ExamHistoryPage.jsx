import React, { useEffect, useState } from 'react'
import { fetchMySubmissions, scaledScore } from '../store/examStore.js'

function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcClock  = (s) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>
const IcHome   = (s) => <Ic size={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ic>
const IcUser   = (s) => <Ic size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ic>

const formatDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const formatDuration = (sec) => {
  if (sec == null) return null
  const m = Math.round(sec / 60)
  return m > 0 ? `${m} phút` : `${sec} giây`
}

function ScoreBar({ score, total }) {
  const pct   = (score / total) * 100
  const color = pct >= 80 ? '#059669' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="prof-score-bar">
      <div className="psb-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

/* ── Trang riêng: Lịch sử làm bài (danh sách các đề học sinh đã làm) ── */
export default function ExamHistoryPage({ user, onGoHome, onGoProfile }) {
  const [submissions, setSubmissions] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchMySubmissions(user.id)
      .then(res => { if (alive) setSubmissions(res.submissions || []) })
      .catch(() => { if (alive) setSubmissions([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user.id])

  return (
    <div className="prof-page">
      <div className="container prof-container">
        <div className="prof-section">
          <h3 className="prof-section-title">{IcClock(16)} Lịch sử làm bài</h3>
          {loading ? (
            <p className="prof-section-desc">Đang tải…</p>
          ) : submissions.length === 0 ? (
            <p className="prof-section-desc">Chưa có bài làm nào. Hãy vào một đề thi để bắt đầu!</p>
          ) : (
            <div className="prof-history-list">
              {submissions.map(s => {
                const pending = s.score == null
                const scaled  = pending ? null : scaledScore(s.score, s.maxScore)
                const dur     = formatDuration(s.timeSpent)
                return (
                  <a key={s.id} className="prof-history-item" href={`#results/${s.examId}/${s.id}`}
                     title="Xem lại bài làm">
                    <div className="phi-left">
                      <div className="phi-title">{s.examTitle || 'Đề thi'}</div>
                      <div className="phi-meta">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {IcClock(12)} {formatDt(s.submittedAt)}
                        </span>
                        {dur && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {IcClock(12)} {dur}
                          </span>
                        )}
                      </div>
                      {!pending && <ScoreBar score={scaled} total={10} />}
                    </div>
                    <div className="phi-score">
                      {pending ? (
                        <span className="phi-score-pending">Chờ công bố</span>
                      ) : (
                        <>
                          <span className="phi-score-num">{scaled}</span>
                          <span className="phi-score-total">/10</span>
                        </>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Back ── */}
        <div className="prof-back-row" style={{ gap: 10 }}>
          <button className="prof-btn prof-btn--ghost" onClick={onGoProfile}>
            {IcUser(15)} Hồ sơ cá nhân
          </button>
          <button className="prof-btn prof-btn--ghost" onClick={onGoHome}>
            {IcHome(15)} Về trang chủ
          </button>
        </div>
      </div>
    </div>
  )
}

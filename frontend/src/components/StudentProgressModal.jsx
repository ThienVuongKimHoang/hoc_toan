import React, { useState } from 'react'
import { scaledScore } from '../store/examStore.js'

/* Chi tiết tiến độ 1 học sinh: điểm theo thời gian (bar chart, quy về thang 10),
   điểm trung bình tổng hợp, và chi tiết các buổi trễ/vắng + bài bỏ. */

const Y_TICKS = [10, 7.5, 5, 2.5, 0]

const fmtShort = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  : '—'
const fmtFull = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

export default function StudentProgressModal({ student, onClose }) {
  const [hover, setHover] = useState(null)
  if (!student) return null

  const { studentName, attendance = {}, assignments = {}, scoreHistory = [] } = student

  const points = [...scoreHistory]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map(s => ({ ...s, scaled: scaledScore(s.score, s.maxScore) }))
  const avg = points.length
    ? Math.round((points.reduce((sum, p) => sum + p.scaled, 0) / points.length) * 100) / 100
    : null

  const lateDates = (attendance.detail || []).filter(d => d.status === 'tre')
  const absentDates = (attendance.detail || []).filter(d => d.status === 'vang')
  const missed = assignments.missed || []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box spd-box" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>📈 Tiến độ — {studentName}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          <div className="spd-summary">
            <div className="spd-summary-item">
              <div className="spd-summary-value">{avg != null ? avg : '—'}<small>/10</small></div>
              <div className="spd-summary-label">Điểm trung bình ({points.length} bài đã chấm)</div>
            </div>
            <div className="spd-summary-item">
              <div className="spd-summary-value">{attendance.rate != null ? `${attendance.rate}%` : '—'}</div>
              <div className="spd-summary-label">Chuyên cần ({attendance.total || 0} buổi)</div>
            </div>
            <div className="spd-summary-item">
              <div className="spd-summary-value">{assignments.submitted ?? 0}/{assignments.total ?? 0}</div>
              <div className="spd-summary-label">Bài đã nộp</div>
            </div>
          </div>

          <h3 className="sd-heading" style={{ marginTop: 22 }}>Điểm theo thời gian</h3>
          {points.length === 0 ? (
            <div className="cm-empty-state">Chưa có điểm nào được ghi nhận.</div>
          ) : (
            <div className="sd-card">
              <div className="sd-card-body">
                <div className="sd-chart" style={{ height: 200 }}>
                  <div className="sd-yaxis">
                    {Y_TICKS.map(v => <span key={v} className="sd-ytick">{v}</span>)}
                  </div>
                  <div className="sd-plot">
                    <div className="sd-grid-lines">
                      {Y_TICKS.map(v => (
                        <div key={v} className="sd-gridline" style={{ bottom: `${(v / 10) * 100}%` }} />
                      ))}
                    </div>
                    <svg className="sd-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        className="sd-line-path"
                        points={points
                          .map((p, i) => `${((i + 0.5) / points.length) * 100},${100 - (p.scaled / 10) * 100}`)
                          .join(' ')}
                      />
                    </svg>
                    {points.map((p, i) => {
                      const h = (p.scaled / 10) * 100
                      const on = hover === i
                      return (
                        <div
                          key={i}
                          className={`sd-col sd-col--line${on ? ' is-hover' : ''}`}
                          onMouseEnter={() => setHover(i)}
                          onMouseLeave={() => setHover(cur => (cur === i ? null : cur))}
                        >
                          <div className="sd-bar-area">
                            {on && (
                              <div className="sd-tip" style={{ bottom: `calc(${h}% + 28px)` }}>
                                <div className="sd-tip-label">{p.title} · {fmtFull(p.date)}</div>
                                <div className="sd-tip-value">
                                  <i className="sd-tip-dot" />Điểm: <b>{p.score}/{p.maxScore}</b> ({p.scaled}/10)
                                </div>
                              </div>
                            )}
                            <span className="sd-count" style={{ bottom: `calc(${h}% + 14px)` }}>{p.scaled}</span>
                            <div className="sd-dot" style={{ bottom: `${h}%` }} />
                          </div>
                          <div className="sd-xlabel">{fmtShort(p.date)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <h3 className="sd-heading" style={{ marginTop: 22 }}>Chi tiết</h3>
          <div className="spd-detail-grid">
            <div className="spd-detail-card">
              <div className="spd-detail-head">🕒 Đi trễ ({lateDates.length})</div>
              {lateDates.length ? (
                <ul className="spd-detail-list">
                  {lateDates.map((d, i) => <li key={i}>{fmtFull(d.date)}</li>)}
                </ul>
              ) : <div className="spd-detail-empty">Không có buổi nào đi trễ.</div>}
            </div>
            <div className="spd-detail-card">
              <div className="spd-detail-head">🚫 Vắng ({absentDates.length})</div>
              {absentDates.length ? (
                <ul className="spd-detail-list">
                  {absentDates.map((d, i) => <li key={i}>{fmtFull(d.date)}</li>)}
                </ul>
              ) : <div className="spd-detail-empty">Không có buổi nào vắng.</div>}
            </div>
            <div className="spd-detail-card">
              <div className="spd-detail-head">📝 Bỏ bài tập ({missed.length})</div>
              {missed.length ? (
                <ul className="spd-detail-list">
                  {missed.map((m, i) => (
                    <li key={i}>{m.title} <small>(hạn {fmtFull(m.date)})</small></li>
                  ))}
                </ul>
              ) : <div className="spd-detail-empty">Không bỏ bài nào.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

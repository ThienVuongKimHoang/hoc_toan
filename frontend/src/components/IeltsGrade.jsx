import React, { useEffect, useState } from 'react'
import { getGradesSummary, gradeSubmission } from '../store/classStore.js'

/* ─── Helpers ─── */
export const CRITERIA_META = (criterionLabel) => ([
  ['task_response',      criterionLabel || 'Task Response', '🎯'],
  ['coherence_cohesion', 'Coherence & Cohesion',            '🔗'],
  ['lexical_resource',   'Lexical Resource',                '📚'],
  ['grammatical_range',  'Grammar Range & Accuracy',        '✏️'],
])

export function bandColor(b) {
  if (b == null) return '#94a3b8'
  if (b >= 7.5) return '#059669'
  if (b >= 6.0) return '#2563eb'
  if (b >= 5.0) return '#d97706'
  return '#dc2626'
}

export function BandChip({ band, size = 'md' }) {
  return (
    <span className={`ielts-band-chip ielts-band-chip--${size}`}
      style={{ background: bandColor(band) }}>
      {band != null ? band.toFixed(1) : '—'}
    </span>
  )
}

const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

/* ─── Kết quả chấm chi tiết (học sinh & giáo viên đều xem được) ─── */
export function IeltsGradeModal({ grade, studentName, taskLabel, onClose }) {
  const g = grade || {}
  const crit = g.criteria || {}
  const meta = CRITERIA_META(g.criterionLabel)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box ielts-modal">
        <div className="modal-header">
          <h2>🤖 Kết quả chấm AI {taskLabel ? `· ${taskLabel}` : ''}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ielts-modal-body">
          {g.status === 'pending' && (
            <div className="ielts-pending"><span className="fdz-spinner" /> AI đang chấm bài, vui lòng đợi trong giây lát…</div>
          )}
          {g.status === 'error' && (
            <div className="cm-error" style={{ marginTop: 0 }}>⚠️ {g.error || 'Chấm bài thất bại.'}</div>
          )}

          {g.status === 'done' && (
            <>
              {/* Overall band */}
              <div className="ielts-overall">
                <div className="ielts-overall-circle" style={{ borderColor: bandColor(g.overallBand) }}>
                  <div className="ielts-overall-score" style={{ color: bandColor(g.overallBand) }}>
                    {g.overallBand?.toFixed(1)}
                  </div>
                  <div className="ielts-overall-label">Overall Band</div>
                </div>
                <div className="ielts-overall-info">
                  {studentName && <div className="ielts-student-name">👤 {studentName}</div>}
                  <div className="ielts-meta-row">📝 {g.wordCount ?? '—'} từ · 🕒 Chấm lúc {fmtDt(g.gradedAt)}</div>
                </div>
              </div>

              {/* 4 criteria */}
              <div className="ielts-criteria-grid">
                {meta.map(([key, label, icon]) => {
                  const c = crit[key] || {}
                  return (
                    <div key={key} className="ielts-criterion-card">
                      <div className="ielts-criterion-head">
                        <span className="ielts-criterion-label">{icon} {label}</span>
                        <BandChip band={c.band} />
                      </div>
                      {c.comment && <div className="ielts-criterion-comment">{c.comment}</div>}
                    </div>
                  )
                })}
              </div>

              {/* AI feedback */}
              {g.feedback && (
                <div className="ielts-section">
                  <h4 className="ielts-section-title">💬 Nhận xét của AI</h4>
                  <div className="ielts-feedback">{g.feedback}</div>
                </div>
              )}

              <div className="ielts-two-col">
                {g.strengths?.length > 0 && (
                  <div className="ielts-section ielts-list-box ielts-list-box--good">
                    <h4 className="ielts-section-title">✅ Điểm mạnh</h4>
                    <ul>{g.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {g.improvements?.length > 0 && (
                  <div className="ielts-section ielts-list-box ielts-list-box--warn">
                    <h4 className="ielts-section-title">🔧 Cần cải thiện</h4>
                    <ul>{g.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>

              {/* Corrections */}
              {g.corrections?.length > 0 && (
                <div className="ielts-section">
                  <h4 className="ielts-section-title">🩹 Lỗi tiêu biểu & cách sửa</h4>
                  <div className="ielts-corrections">
                    {g.corrections.map((c, i) => (
                      <div key={i} className="ielts-correction">
                        <div className="ielts-corr-error">✗ {c.error}</div>
                        <div className="ielts-corr-fix">✓ {c.fix}</div>
                        {c.explain && <div className="ielts-corr-explain">{c.explain}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Đề bài trích xuất (Task 1) */}
              {g.imageDesc && (
                <details className="ielts-section ielts-details">
                  <summary className="ielts-section-title">🖼 Đề bài AI trích xuất từ ảnh đính kèm</summary>
                  <pre className="ielts-essay-text">{g.imageDesc}</pre>
                </details>
              )}

              {/* Bài làm học sinh */}
              {g.essayText && (
                <details className="ielts-section ielts-details" open>
                  <summary className="ielts-section-title">📄 Bài làm của học sinh ({g.wordCount} từ)</summary>
                  <pre className="ielts-essay-text">{g.essayText}</pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Bảng tóm tắt thống kê điểm từng người ─── */
export function IeltsStatsTable({ classId, assignmentId, refreshKey = 0, onViewStudent }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    getGradesSummary(classId, assignmentId)
      .then(d => { if (alive) setData(d) })
      .catch(() => { if (alive) setData({ rows: [], stats: {} }) })
    return () => { alive = false }
  }, [classId, assignmentId, refreshKey])

  if (!data) return <div className="ielts-stats-loading">Đang tải bảng điểm…</div>
  const { rows = [], stats = {}, criterionLabel } = data
  if (rows.length === 0) return <div className="ielts-stats-loading">Chưa có bài nộp nào.</div>

  const short = { task_response: (criterionLabel === 'Task Achievement' ? 'TA' : 'TR'), coherence_cohesion: 'CC', lexical_resource: 'LR', grammatical_range: 'GRA' }

  return (
    <div className="ielts-stats">
      <div className="ielts-stats-cards">
        <div className="ielts-stat-card"><span>{stats.graded ?? 0}/{stats.total ?? 0}</span><small>Đã chấm</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.avg) }}>{stats.avg ?? '—'}</span><small>Band TB</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.max) }}>{stats.max ?? '—'}</span><small>Cao nhất</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.min) }}>{stats.min ?? '—'}</span><small>Thấp nhất</small></div>
      </div>
      <div className="ielts-stats-table-wrap">
        <table className="ielts-stats-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Học sinh</th>
              <th>{short.task_response}</th><th>CC</th><th>LR</th><th>GRA</th>
              <th>Overall</th><th>Số từ</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.studentId}>
                <td style={{ textAlign: 'left' }}>
                  <span className="ielts-stats-name">{r.studentName || r.studentId}</span>
                </td>
                {['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range'].map(k => (
                  <td key={k}>{r[k] != null ? <span style={{ color: bandColor(r[k]), fontWeight: 700 }}>{r[k].toFixed(1)}</span> : '—'}</td>
                ))}
                <td>{r.status === 'done' ? <BandChip band={r.overallBand} size="sm" />
                  : r.status === 'pending' ? <span className="ielts-pending-chip">⏳</span>
                  : r.status === 'error' ? <span title="Chấm lỗi">⚠️</span> : '—'}</td>
                <td>{r.wordCount ?? '—'}</td>
                <td>
                  {onViewStudent && r.status === 'done' && (
                    <button className="ielts-view-btn" onClick={() => onViewStudent(r.studentId)}>Xem</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Modal bảng điểm (dùng phía học sinh) ─── */
export function IeltsStatsModal({ classId, assignment, onClose, onViewStudent }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>📊 Bảng điểm — {assignment.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <IeltsStatsTable classId={classId} assignmentId={assignment.id} onViewStudent={onViewStudent} />
        </div>
      </div>
    </div>
  )
}

/* ─── Nút chấm / chấm lại của giáo viên ─── */
export function GradeButton({ classId, assignmentId, studentId, hasGrade, onDone }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await gradeSubmission(classId, assignmentId, studentId)
    } catch (e) { alert(e?.message || 'Chấm thất bại') }
    finally { setBusy(false); onDone?.() }
  }
  return (
    <button className="mec-btn ielts-grade-btn" onClick={run} disabled={busy}>
      {busy ? <><span className="fdz-spinner" style={{ width: 12, height: 12 }} /> Đang chấm…</> : (hasGrade ? '🔄 Chấm lại' : '🤖 Chấm AI')}
    </button>
  )
}

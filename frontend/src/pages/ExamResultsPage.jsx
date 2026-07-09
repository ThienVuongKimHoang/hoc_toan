import React, { useEffect, useState } from 'react'
import { deleteSubmission, fetchExamById, getSubmissions, hideResultsToggle, revealResults, scaledScore } from '../store/examStore.js'
import QuestionStats from '../components/QuestionStats.jsx'
import GradeEssayModal from '../components/GradeEssayModal.jsx'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(sec) {
  if (sec == null || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} giây`
  return s ? `${m} phút ${s} giây` : `${m} phút`
}

function ScoreBar({ score, maxScore }) {
  const pct   = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="er-score-bar">
      <div className="er-score-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="er-score-label">{score}/{maxScore} ({pct}%)</span>
    </div>
  )
}

/* ── Thanh tiến độ thời gian làm bài ── */
function TimeBar({ sec, limitMin }) {
  if (sec == null || sec < 0) return <span className="er-time-empty">—</span>
  const limitSec = limitMin ? limitMin * 60 : 0
  const pct   = limitSec > 0 ? Math.min(100, Math.round((sec / limitSec) * 100)) : 100
  // Dùng nhiều thời gian (gần hết giờ) → đỏ; nhanh → xanh
  const color = !limitSec ? '#6366f1' : pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e'
  return (
    <div className="er-time-bar">
      <div className="er-time-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="er-time-label">⏱ {fmtDuration(sec)}</span>
    </div>
  )
}

/* ── Histogram ── */
function Histogram({ subs, maxScore }) {
  if (!subs.length || !maxScore) return null

  // 10 bins đều nhau theo thang điểm
  const NUM_BINS = 10
  const step = maxScore / NUM_BINS

  const bins = Array.from({ length: NUM_BINS }, (_, i) => {
    const lo = +(i * step).toFixed(2)
    const hi = +((i + 1) * step).toFixed(2)
    return { lo, hi, count: 0 }
  })

  subs.forEach(s => {
    const score  = s.score ?? 0
    const idx    = Math.min(Math.floor(score / step), NUM_BINS - 1)
    bins[idx].count++
  })

  const peak = Math.max(...bins.map(b => b.count), 1)

  // Màu theo vùng điểm (đỏ → vàng → xanh)
  const barColor = (i) => {
    const ratio = (i + 0.5) / NUM_BINS
    if (ratio >= 0.7) return '#22c55e'
    if (ratio >= 0.5) return '#f59e0b'
    return '#ef4444'
  }

  const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(1)

  return (
    <div className="er-histogram">
      <div className="er-hist-header">
        <h3 className="er-hist-title">Phân bố điểm</h3>
        <div className="er-hist-legend">
          <span className="er-hl-dot" style={{ background: '#ef4444' }} /> Yếu
          <span className="er-hl-dot" style={{ background: '#f59e0b' }} /> Trung bình
          <span className="er-hl-dot" style={{ background: '#22c55e' }} /> Khá – Giỏi
        </div>
      </div>

      <div className="er-hist-body">
        {/* Y-axis labels */}
        <div className="er-hist-yaxis">
          {[peak, Math.ceil(peak / 2), 0].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="er-hist-chart">
          {/* Dashed grid lines */}
          <div className="er-hist-grid">
            <div className="er-hist-gridline" style={{ bottom: '100%' }} />
            <div className="er-hist-gridline" style={{ bottom: '50%' }} />
            <div className="er-hist-gridline" style={{ bottom: '0%' }} />
          </div>

          {bins.map((bin, i) => {
            const heightPct = (bin.count / peak) * 100
            const color     = barColor(i)
            return (
              <div key={i} className="er-hist-col">
                <div className="er-hist-bar-wrap">
                  {bin.count > 0 && (
                    <div className="er-hist-count-tag" style={{ color }}>
                      {bin.count}
                    </div>
                  )}
                  <div
                    className="er-hist-bar"
                    style={{
                      height:     `${heightPct}%`,
                      background: bin.count > 0
                        ? `linear-gradient(to top, ${color}cc, ${color})`
                        : 'transparent',
                      minHeight:  bin.count > 0 ? 4 : 0,
                    }}
                    title={`${fmt(bin.lo)}–${fmt(bin.hi)} điểm: ${bin.count} học sinh`}
                  />
                </div>
                <div className="er-hist-xlabel">
                  {fmt(bin.lo)}
                </div>
              </div>
            )
          })}

          {/* last x label */}
          <div className="er-hist-xlabel-last">{fmt(maxScore)}</div>
        </div>
      </div>

      <div className="er-hist-xaxis-label">Điểm số</div>
    </div>
  )
}

/* ── Root ── */
export default function ExamResultsPage({ examId, examTitle, onGoBack }) {
  const [data,        setData]        = useState(null)
  const [exam,        setExam]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [toggling,    setToggling]    = useState(false)
  const [err,         setErr]         = useState('')
  const [confirmDel,  setConfirmDel]  = useState(null)   // bài nộp đang chờ xác nhận xóa
  const [delBusy,     setDelBusy]     = useState(false)
  const [gradingSub,  setGradingSub]  = useState(null)   // bài nộp đang chấm tự luận

  const load = () => {
    setLoading(true)
    Promise.all([
      getSubmissions(examId),
      fetchExamById(examId),
    ])
      .then(([d, e]) => { setData(d); setExam(e); setLoading(false) })
      .catch(e => { setErr(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [examId])

  const handleReveal = async () => {
    setToggling(true)
    try {
      if (data.resultsRevealed) await hideResultsToggle(examId)
      else await revealResults(examId)
      load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    setDelBusy(true)
    try {
      await deleteSubmission(examId, confirmDel.id)
      setConfirmDel(null)
      load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setDelBusy(false)
    }
  }

  if (loading) return <div className="app"><div className="er-loading">⏳ Đang tải kết quả…</div></div>

  if (err) return (
    <div className="app">
      <div className="pm-error" style={{ margin: '32px auto', maxWidth: 400 }}>⚠️ {err}</div>
      <button className="btn-primary" onClick={onGoBack}>← Quay lại</button>
    </div>
  )

  // Chỉ hiển thị bài nộp qua link chung của đề (không thuộc lớp học).
  // Điểm của bài nộp theo lớp được xem riêng trong trang quản lý lớp.
  const rawSubs  = (data?.submissions || []).filter(s => !s.classId)
  const revealed = data?.resultsRevealed || false
  const hideMode = data?.hideResults || false
  const hasEssay = (exam?.sections?.['TỰ LUẬN']?.questions?.length ?? 0) > 0

  // Quy đổi mọi điểm về thang 10 để hiển thị thống nhất.
  const maxScore = 10
  const subs     = rawSubs.map(s => ({ ...s, score: scaledScore(s.score, s.maxScore), maxScore }))

  const scores   = subs.map(s => s.score ?? 0)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : 0
  const highScore = scores.length ? Math.max(...scores) : 0
  const lowScore  = scores.length ? Math.min(...scores) : 0
  const sorted    = [...scores].sort((a, b) => a - b)
  const median    = scores.length
    ? (sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)])
    : 0
  const passCount = scores.filter(s => maxScore > 0 && s / maxScore >= 0.5).length

  return (
    <div className="app">
      <div className="create-topbar">
        <div>
          <h1 className="exam-title">📊 Kết quả bài thi</h1>
          <p className="exam-subtitle">{examTitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hideMode && (
            <button
              className={`mec-btn ${revealed ? 'mec-btn--delete' : 'mec-btn--publish'}`}
              disabled={toggling}
              onClick={handleReveal}
            >
              {toggling ? '⏳…' : revealed ? '🔒 Ẩn kết quả' : '👁 Công bố kết quả'}
            </button>
          )}
          <button className="mec-btn" onClick={onGoBack}>← Quay lại</button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="er-summary">
        <div className="er-stat">
          <div className="er-stat-num">{subs.length}</div>
          <div className="er-stat-label">Bài nộp</div>
        </div>
        <div className="er-stat">
          <div className="er-stat-num" style={{ color: '#2563eb' }}>{avgScore}</div>
          <div className="er-stat-label">Điểm TB / {maxScore}</div>
        </div>
        <div className="er-stat">
          <div className="er-stat-num" style={{ color: '#059669' }}>{highScore}</div>
          <div className="er-stat-label">Cao nhất</div>
        </div>
        <div className="er-stat">
          <div className="er-stat-num" style={{ color: '#ef4444' }}>{lowScore}</div>
          <div className="er-stat-label">Thấp nhất</div>
        </div>
        <div className="er-stat">
          <div className="er-stat-num" style={{ color: '#7c3aed' }}>{median}</div>
          <div className="er-stat-label">Trung vị</div>
        </div>
        <div className="er-stat">
          <div className="er-stat-num" style={{ color: revealed ? '#22c55e' : '#94a3b8' }}>
            {revealed ? '👁' : '🔒'}
          </div>
          <div className="er-stat-label">{revealed ? 'Đã công bố' : 'Chưa công bố'}</div>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="my-exams-empty">
          <div className="mee-icon">📭</div>
          <h3>Chưa có bài nộp nào</h3>
          <p>Học sinh chưa làm bài thi này.</p>
        </div>
      ) : (
        <>
          {/* Histogram */}
          <Histogram subs={subs} maxScore={maxScore} />

          {/* Per-question stats */}
          <QuestionStats exam={exam} subs={subs} />

          {/* Pass rate note */}
          {maxScore > 0 && (
            <div className="er-passrate">
              <span className="er-passrate-badge">
                ✅ {passCount}/{subs.length} học sinh đạt ≥ 50%
                {' '}({Math.round(passCount / subs.length * 100)}%)
              </span>
            </div>
          )}

          {/* Table */}
          <div className="er-table-wrap">
            <table className="er-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Học sinh</th>
                  <th>Điểm</th>
                  <th>Thời gian làm</th>
                  <th>Thời gian nộp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs
                  .slice()
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((s, i) => (
                    <tr key={s.id ?? i} className="er-row">
                      <td className="er-td-num">{i + 1}</td>
                      <td className="er-td-name">
                        <div className="er-avatar">{(s.studentName || '?')[0].toUpperCase()}</div>
                        {s.studentName || 'Ẩn danh'}
                        {s.violationCount > 0 && (
                          <span className="er-violation-chip" title="Số lần vi phạm khóa màn hình">
                            ⚠️ {s.violationCount}
                          </span>
                        )}
                      </td>
                      <td className="er-td-score">
                        <ScoreBar score={s.score ?? 0} maxScore={s.maxScore ?? maxScore} />
                      </td>
                      <td className="er-td-timebar">
                        <TimeBar sec={s.timeSpent} limitMin={exam?.settings?.duration} />
                      </td>
                      <td className="er-td-time">{fmtDate(s.submittedAt)}</td>
                      <td className="er-td-del">
                        {hasEssay && (() => {
                          const raw = rawSubs.find(r => r.id === s.id)
                          const graded = raw?.manualScores && Object.keys(raw.manualScores).length > 0
                          return (
                            <button
                              className={`er-grade-btn ${graded ? 'graded' : ''}`}
                              title="Chấm câu tự luận (xem ảnh bài làm)"
                              onClick={() => setGradingSub(raw || s)}
                            >{graded ? '✅ Đã chấm' : '✍️ Chấm'}</button>
                          )
                        })()}
                        <button
                          className="er-del-btn"
                          title="Xóa bài làm này"
                          onClick={() => setConfirmDel(s)}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {gradingSub && exam && (
        <GradeEssayModal
          exam={exam}
          submission={gradingSub}
          onClose={() => setGradingSub(null)}
          onSaved={() => { setGradingSub(null); load() }}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !delBusy && setConfirmDel(null)}>
          <div className="modal-box er-del-modal">
            <div className="er-del-icon">🗑️</div>
            <h3 className="er-del-title">Xóa bài làm?</h3>
            <p className="er-del-text">
              Bạn có muốn xóa bài làm của học sinh{' '}
              <strong>{confirmDel.studentName || 'Ẩn danh'}</strong> hay không?
              Hành động này không thể hoàn tác.
            </p>
            <div className="er-del-actions">
              <button className="mec-btn" disabled={delBusy} onClick={() => setConfirmDel(null)}>Hủy</button>
              <button className="mec-btn mec-btn--delete" disabled={delBusy} onClick={handleDelete}>
                {delBusy ? '⏳…' : '🗑️ Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

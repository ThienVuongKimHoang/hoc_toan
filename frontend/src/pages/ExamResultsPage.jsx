import React, { useEffect, useState } from 'react'
import { fetchExamById, getSubmissions, hideResultsToggle, revealResults } from '../store/examStore.js'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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

const SECTION_PREFIXES = {
  'PHẦN I':    'I',
  'PHẦN II':   'II',
  'PHẦN III':  'III',
  'TIẾNG ANH': 'EN',
}

/* ── Per-question statistics ── */
function QuestionStats({ exam, subs }) {
  const [expanded, setExpanded] = useState({})
  const [showSection, setShowSection] = useState({})

  if (!exam?.sections || !subs.length) return null

  const sectionKeys = Object.keys(exam.sections).filter(
    s => s in SECTION_PREFIXES && exam.sections[s]?.questions?.length
  )
  if (!sectionKeys.length) return null

  const buildStats = (sec) => {
    const questions = exam.sections[sec]?.questions || []
    const prefix    = SECTION_PREFIXES[sec]
    return questions.map(q => {
      const key          = `${prefix}_${q.question_number}`
      let correctCount   = 0
      const wrongStudents = []

      subs.forEach(sub => {
        const ans = sub.answers?.[key]
        let ok = false
        if (sec === 'PHẦN I' || sec === 'TIẾNG ANH') {
          ok = q.answer && ans === q.answer
        } else if (sec === 'PHẦN II') {
          const sqs = q.sub_questions || []
          ok = sqs.length > 0 && sqs.every(sq => ans?.[sq.label] === sq.correct_answer)
        } else if (sec === 'PHẦN III') {
          const ua = (ans || '').toString().trim().toLowerCase()
          const ca = (q.answer || '').toString().trim().toLowerCase()
          ok = !!ua && !!ca && ua === ca
        }
        if (ok) correctCount++
        else wrongStudents.push(sub.studentName || 'Ẩn danh')
      })

      return { num: q.question_number, key, correctCount, total: subs.length, wrongStudents }
    })
  }

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))
  const toggleSec = (sec) => setShowSection(p => ({ ...p, [sec]: !p[sec] }))

  return (
    <div className="er-qstats">
      <h3 className="er-qstats-title">📋 Thống kê chi tiết theo câu</h3>
      {sectionKeys.map(sec => {
        const stats   = buildStats(sec)
        const isOpen  = showSection[sec] !== false
        return (
          <div key={sec} className="er-qstats-section">
            <button className="er-qstats-sec-header" onClick={() => toggleSec(sec)}>
              <span>{sec}</span>
              <span className="er-qstats-sec-count">{stats.length} câu</span>
              <span className="er-qstats-sec-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="er-qstats-body">
                {stats.map(s => {
                  const pct   = s.total > 0 ? Math.round(s.correctCount / s.total * 100) : 0
                  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
                  const isExp = expanded[s.key]
                  return (
                    <div key={s.key} className="er-qstat-row">
                      <div className="er-qstat-main">
                        <span className="er-qstat-num">Câu {s.num}</span>
                        <div className="er-qstat-bar-track">
                          <div className="er-qstat-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="er-qstat-fraction" style={{ color }}>
                          {s.correctCount}/{s.total}
                        </span>
                        <span className="er-qstat-pct" style={{ color }}>({pct}%)</span>
                        {s.wrongStudents.length > 0 && (
                          <button className="er-qstat-toggle" onClick={() => toggle(s.key)}>
                            {isExp ? '▲' : '▼'} {s.wrongStudents.length} sai
                          </button>
                        )}
                        {s.wrongStudents.length === 0 && (
                          <span className="er-qstat-all-correct">✓ Tất cả đúng</span>
                        )}
                      </div>
                      {isExp && s.wrongStudents.length > 0 && (
                        <div className="er-qstat-wrong-wrap">
                          <span className="er-qstat-wrong-label">Trả lời sai:</span>
                          <div className="er-qstat-wrong-names">
                            {s.wrongStudents.map((name, i) => (
                              <span key={i} className="er-qstat-wrong-chip">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
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
  const [activeClass, setActiveClass] = useState('all')

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

  if (loading) return <div className="app"><div className="er-loading">⏳ Đang tải kết quả…</div></div>

  if (err) return (
    <div className="app">
      <div className="pm-error" style={{ margin: '32px auto', maxWidth: 400 }}>⚠️ {err}</div>
      <button className="btn-primary" onClick={onGoBack}>← Quay lại</button>
    </div>
  )

  const allSubs  = data?.submissions || []
  const classes  = data?.classes     || []
  const revealed = data?.resultsRevealed || false
  const hideMode = data?.hideResults || false

  const subs = activeClass === 'all'
    ? allSubs
    : allSubs.filter(s => s.classId === activeClass)

  const maxScore = allSubs[0]?.maxScore || 0

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

      {/* Class tabs */}
      {classes.length > 0 && (
        <div className="er-class-tabs">
          <button
            className={`er-class-tab ${activeClass === 'all' ? 'active' : ''}`}
            onClick={() => setActiveClass('all')}
          >
            Tất cả <span className="er-cls-count">{allSubs.length}</span>
          </button>
          {classes.map(cls => {
            const count = allSubs.filter(s => s.classId === cls.id).length
            return (
              <button
                key={cls.id}
                className={`er-class-tab ${activeClass === cls.id ? 'active' : ''}`}
                onClick={() => setActiveClass(cls.id)}
              >
                🏫 {cls.name} <span className="er-cls-count">{count}</span>
              </button>
            )
          })}
        </div>
      )}

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
                  <th>Thời gian nộp</th>
                </tr>
              </thead>
              <tbody>
                {subs
                  .slice()
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((s, i) => (
                    <tr key={i} className="er-row">
                      <td className="er-td-num">{i + 1}</td>
                      <td className="er-td-name">
                        <div className="er-avatar">{(s.studentName || '?')[0].toUpperCase()}</div>
                        {s.studentName || 'Ẩn danh'}
                      </td>
                      <td className="er-td-score">
                        <ScoreBar score={s.score ?? 0} maxScore={s.maxScore ?? maxScore} />
                      </td>
                      <td className="er-td-time">{fmtDate(s.submittedAt)}</td>
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

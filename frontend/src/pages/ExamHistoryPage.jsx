import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fetchMySubmissions, scaledScore } from '../store/examStore.js'
import { SUBJECTS, SUBJECT_ORDER } from '../components/SubjectBadge.jsx'

function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcClock         = (s) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>
const IcHome          = (s) => <Ic size={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ic>
const IcUser          = (s) => <Ic size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ic>
const IcChevronRight  = (s) => <Ic size={s}><polyline points="9 18 15 12 9 6"/></Ic>
const IcChevronLeft   = (s) => <Ic size={s}><polyline points="15 18 9 12 15 6"/></Ic>
const IcTrend         = (s) => <Ic size={s}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Ic>
const IcAward         = (s) => <Ic size={s}><circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/></Ic>
const IcTarget        = (s) => <Ic size={s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/></Ic>
const IcLayers        = (s) => <Ic size={s}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></Ic>
const IcAlert         = (s) => <Ic size={s}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ic>
const IcEye           = (s) => <Ic size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Ic>
const IcCalendar      = (s) => <Ic size={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ic>
const IcCheck         = (s) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>

const formatDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const formatDtShort = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

const formatDayMonth = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  : '—'

const formatDuration = (sec) => {
  if (sec == null) return null
  const m = Math.round(sec / 60)
  return m > 0 ? `${m} phút` : `${sec} giây`
}

/* Màu theo mức điểm (thang 10): đỏ < 5 · vàng 5–8 · xanh ≥ 8 */
const scoreColor = v => (v == null ? '#94a3b8' : v >= 8 ? '#059669' : v >= 5 ? '#f59e0b' : '#ef4444')
const scoreTone  = v => (v == null ? 'pending' : v >= 8 ? 'good' : v >= 5 ? 'mid' : 'low')

/* ── Điều hướng 2 cấp đồng bộ vào URL hash: #history (chọn môn) và
   #history/<subject> (dashboard tiến độ của môn đó). */
function subjectFromHash() {
  const h = window.location.hash.slice(1)
  if (!h.startsWith('history')) return null
  const rest = h === 'history' ? '' : h.slice('history/'.length)
  return rest.split('/')[0] || null
}

const RANGES = [
  { key: 'week',  label: 'Tuần này',  days: 7 },
  { key: 'month', label: 'Tháng này', days: 30 },
  { key: 'all',   label: 'Tất cả',    days: null },
]

/* ── Đo bề rộng khung chứa để vẽ biểu đồ theo px (SVG co giãn mượt, chữ không méo) ── */
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/* ── Block 2: biểu đồ đường điểm số theo thời gian (SVG tự vẽ, không thêm thư viện) ── */
function ScoreLineChart({ points, avg }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)

  const H = 264
  const PAD = { t: 20, r: 18, b: 36, l: 36 }
  const iw = Math.max(w - PAD.l - PAD.r, 10)
  const ih = H - PAD.t - PAD.b
  const n  = points.length

  const px = i => PAD.l + (n <= 1 ? iw / 2 : (iw * i) / (n - 1))
  const py = v => PAD.t + ih * (1 - Math.max(0, Math.min(10, v)) / 10)

  // Nhãn trục X: chỉ hiện tối đa 6 mốc để không chồng chữ trên màn hình hẹp
  const tickEvery = Math.max(1, Math.ceil(n / 6))

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(p.score)}`).join(' ')
  const area = n > 1
    ? `${line} L ${px(n - 1)} ${PAD.t + ih} L ${px(0)} ${PAD.t + ih} Z`
    : ''

  return (
    <div className="eh-chart" ref={ref}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Biểu đồ điểm số theo thời gian">
          <defs>
            <linearGradient id="ehArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Lưới ngang + nhãn trục điểm */}
          {[0, 2, 4, 6, 8, 10].map(v => (
            <g key={v}>
              <line x1={PAD.l} y1={py(v)} x2={PAD.l + iw} y2={py(v)} className="eh-grid" />
              <text x={PAD.l - 9} y={py(v) + 4} className="eh-axis" textAnchor="end">{v}</text>
            </g>
          ))}

          {/* Đường điểm trung bình */}
          {avg != null && (
            <g>
              <line x1={PAD.l} y1={py(avg)} x2={PAD.l + iw} y2={py(avg)} className="eh-avg-line" />
              <text x={PAD.l + 4} y={py(avg) - 7} className="eh-avg-label">TB {avg}</text>
            </g>
          )}

          {area && <path d={area} fill="url(#ehArea)" />}
          {n > 1 && <path d={line} className="eh-line" />}

          {points.map((p, i) => (
            <g key={p.id}>
              <text x={px(i)} y={H - 12} className="eh-axis" textAnchor="middle">
                {i % tickEvery === 0 || i === n - 1 ? formatDayMonth(p.at) : ''}
              </text>
              <circle cx={px(i)} cy={py(p.score)} r={hover === i ? 6.5 : 4.5}
                fill="#fff" stroke={scoreColor(p.score)} strokeWidth="2.6" className="eh-dot" />
              {/* Vùng bắt chuột rộng hơn chấm để dễ rê trên điện thoại */}
              <circle cx={px(i)} cy={py(p.score)} r="16" fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)} />
            </g>
          ))}
        </svg>
      )}

      {hover != null && points[hover] && (
        <div className="eh-tip" style={{
          left: `${px(hover)}px`,
          top:  `${py(points[hover].score) - 14}px`,
          transform: `translate(-50%, -100%) ${px(hover) < 90 ? 'translateX(28px)' : px(hover) > w - 90 ? 'translateX(-28px)' : ''}`,
        }}>
          <div className="eh-tip-score" style={{ color: scoreColor(points[hover].score) }}>
            {points[hover].score}<span>/10</span>
          </div>
          <div className="eh-tip-title">{points[hover].title}</div>
          <div className="eh-tip-date">{formatDt(points[hover].at)}</div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, hint, tone = 'blue' }) {
  return (
    <div className={`eh-stat eh-stat--${tone}`}>
      <div className="eh-stat-ic">{icon}</div>
      <div className="eh-stat-body">
        <div className="eh-stat-label">{label}</div>
        <div className="eh-stat-value">{value}</div>
        {hint && <div className="eh-stat-hint">{hint}</div>}
      </div>
    </div>
  )
}

/* Thanh tiến độ nhỏ (thẻ môn + ô điểm): chạy từ 0 → giá trị thật sau khi mount */
function MiniBar({ pct, color }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return (
    <div className="eh-bar"><div className="eh-bar-fill" style={{ width: `${w}%`, background: color }} /></div>
  )
}

/* ── Trang: Lịch sử làm bài — Môn → Dashboard tiến độ → Xem lại bài ── */
export default function ExamHistoryPage({ user, onGoHome, onGoProfile }) {
  const [submissions, setSubmissions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [navSubject,  setNavSubject]  = useState(subjectFromHash)
  const [range,       setRange]       = useState('all')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchMySubmissions(user.id)
      .then(res => { if (alive) setSubmissions(res.submissions || []) })
      .catch(() => { if (alive) setSubmissions([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user.id])

  // Nút Back / vuốt back trên điện thoại lùi đúng 1 cấp (dashboard môn → danh sách môn)
  useEffect(() => {
    const onPop = () => setNavSubject(subjectFromHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop) }
  }, [])

  const goSubject = (key) => {
    window.history.pushState(null, '', `#history${key ? `/${key}` : ''}`)
    setNavSubject(key || null)
    setRange('all')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goBack = () => window.history.back()

  // ── Gom bài làm theo môn ──
  const subjectGroups = useMemo(() => {
    const byKey = new Map()
    for (const s of submissions) {
      const key = SUBJECTS[s.examSubject] ? s.examSubject : 'khac'
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(s)
    }
    return Array.from(byKey.entries()).map(([key, subs]) => {
      const asc    = [...subs].sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
      const graded = asc.filter(s => s.score != null).map(s => scaledScore(s.score, s.maxScore))
      const avg    = graded.length ? Math.round((graded.reduce((a, b) => a + b, 0) / graded.length) * 100) / 100 : null
      return {
        key, label: SUBJECTS[key]?.label || 'Khác', icon: SUBJECTS[key]?.icon,
        subs: asc,
        examCount:    new Set(subs.map(s => s.examId)).size,
        attemptCount: subs.length,
        avg, best: graded.length ? Math.max(...graded) : null,
        lastAt: asc[asc.length - 1]?.submittedAt,
      }
    }).sort((a, b) => SUBJECT_ORDER.indexOf(a.key) - SUBJECT_ORDER.indexOf(b.key))
  }, [submissions])

  const active = navSubject ? subjectGroups.find(g => g.key === navSubject) : null

  // ── Bài làm của môn đang xem, lọc theo khoảng thời gian ──
  const ranged = useMemo(() => {
    if (!active) return []
    const days = RANGES.find(r => r.key === range)?.days
    if (!days) return active.subs
    const from = Date.now() - days * 86400000
    return active.subs.filter(s => new Date(s.submittedAt || 0).getTime() >= from)
  }, [active, range])

  // ── Chỉ số thông minh + dữ liệu biểu đồ (chỉ tính trên bài đã có điểm) ──
  const stats = useMemo(() => {
    const graded = ranged.filter(s => s.score != null)
    const points = graded.map(s => ({
      id: s.id, at: s.submittedAt, title: s.examTitle || 'Đề thi',
      score: scaledScore(s.score, s.maxScore),
    }))
    if (!points.length) return { points: [], avg: null, best: null, bestTitle: null, improve: null, verdict: null, declining: false }

    const vals   = points.map(p => p.score)
    const avg    = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
    const bestIdx = vals.indexOf(Math.max(...vals))
    // % cải thiện = (điểm mới nhất − điểm đầu tiên) / 10
    const improve = points.length > 1 ? Math.round((vals[vals.length - 1] - vals[0]) * 10) : null
    // Cảnh báo khi 3 bài gần nhất giảm điểm liên tiếp
    const t = vals.slice(-3)
    const declining = t.length === 3 && t[0] > t[1] && t[1] > t[2]

    let verdict
    if (improve == null)      verdict = { tone: 'neutral', label: 'Chưa đủ dữ liệu', msg: 'Làm thêm một bài nữa để xem đường tiến bộ của bạn nhé.' }
    else if (improve >= 10)   verdict = { tone: 'good',    label: 'Đang tăng trưởng tốt', msg: `Tuyệt vời! Bạn đã tiến bộ ${improve}% so với bài đầu tiên.` }
    else if (improve > 0)     verdict = { tone: 'good',    label: 'Tiến bộ đều', msg: `Bạn đã nhích lên ${improve}% so với bài đầu tiên — giữ nhịp này nhé.` }
    else if (improve === 0)   verdict = { tone: 'neutral', label: 'Đang giữ phong độ', msg: 'Điểm ổn định so với bài đầu tiên. Thử sức với đề khó hơn xem sao!' }
    else                      verdict = { tone: 'warn',    label: 'Cần cố gắng hơn', msg: `Điểm giảm ${Math.abs(improve)}% so với bài đầu tiên — hãy xem lại các câu sai bên dưới.` }

    return { points, avg, best: vals[bestIdx], bestTitle: points[bestIdx].title, improve, verdict, declining }
  }, [ranged])

  // Bảng lịch sử: mới nhất lên đầu
  const rows = useMemo(
    () => [...ranged].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)),
    [ranged],
  )

  const shortName = (user.name || '').trim().split(/\s+/).slice(-1)[0] || 'bạn'
  // Biểu đồ chỉ vẽ 24 lần gần nhất — nhiều hơn thì các chấm dính vào nhau
  const chartPoints = stats.points.slice(-24)

  return (
    <div className="prof-page eh-tech">
      <div className="container prof-container">

        {/* ══ Block 1: chọn môn ══ */}
        {!active ? (
          <>
            <div className="eh-hero">
              <h1 className="eh-hello">Chào {shortName} 👋</h1>
              <p className="eh-hello-sub">Hôm nay bạn muốn xem lại tiến độ môn nào?</p>
            </div>

            {loading ? (
              <p className="prof-section-desc">Đang tải…</p>
            ) : subjectGroups.length === 0 ? (
              <div className="prof-section">
                <p className="prof-section-desc" style={{ margin: 0 }}>
                  Chưa có bài làm nào. Hãy vào một đề thi để bắt đầu!
                </p>
              </div>
            ) : (
              <div className="eh-subj-grid">
                {subjectGroups.map((g, i) => (
                  <button key={g.key} className="eh-subj-card" style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => goSubject(g.key)}>
                    <div className={`eh-subj-ic subject-badge--${g.key}`}>{g.icon}</div>
                    <div className="eh-subj-body">
                      <div className="eh-subj-name">{g.label}</div>
                      <div className="eh-subj-meta">
                        Đã hoàn thành {g.examCount} đề · {g.attemptCount} lần luyện tập
                      </div>
                      <MiniBar pct={g.avg != null ? (g.avg / 10) * 100 : 0} color={scoreColor(g.avg)} />
                      <div className="eh-subj-foot">
                        <span className={`eh-subj-avg eh-tone-${scoreTone(g.avg)}`}>
                          {g.avg != null ? `Điểm TB ${g.avg}/10` : 'Chưa có điểm'}
                        </span>
                        <span className="eh-subj-date">{IcCalendar(12)} {formatDtShort(g.lastAt)}</span>
                      </div>
                    </div>
                    <span className="hist-arrow">{IcChevronRight(16)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ══ Block 2: dashboard tiến độ của môn ══ */}
            <div className="eh-dash-head">
              <button className="phc-back" onClick={goBack}>{IcChevronLeft(15)} Tất cả môn</button>
              <div className="eh-dash-title">
                <span className={`eh-subj-ic eh-subj-ic--sm subject-badge--${active.key}`}>{active.icon}</span>
                <div>
                  <h1 className="eh-dash-name">{active.label}</h1>
                  <p className="eh-dash-sub">{active.examCount} đề · {active.attemptCount} lần làm</p>
                </div>
              </div>
              <div className="eh-range">
                {RANGES.map(r => (
                  <button key={r.key} className={`eh-range-btn ${range === r.key ? 'is-active' : ''}`}
                    onClick={() => setRange(r.key)}>{r.label}</button>
                ))}
              </div>
            </div>

            <div className="prof-section">
              <h3 className="prof-section-title">{IcTrend(16)} Tiến độ điểm số</h3>

              {stats.points.length === 0 ? (
                <p className="prof-section-desc" style={{ margin: 0 }}>
                  Chưa có bài nào đã công bố điểm trong khoảng thời gian này.
                </p>
              ) : (
                <>
                  <div className="eh-stat-grid">
                    <StatCard icon={IcTarget(18)} label="Điểm trung bình" tone={scoreTone(stats.avg)}
                      value={<><b>{stats.avg}</b><span>/10</span></>}
                      hint={`${stats.points.length} bài đã có điểm`} />
                    <StatCard icon={IcAward(18)} label="Điểm cao nhất" tone={scoreTone(stats.best)}
                      value={<><b>{stats.best}</b><span>/10</span></>}
                      hint={stats.bestTitle} />
                    <StatCard icon={IcTrend(18)} label="Cải thiện"
                      tone={stats.improve == null ? 'neutral' : stats.improve > 0 ? 'good' : stats.improve < 0 ? 'low' : 'neutral'}
                      value={stats.improve == null ? <b>—</b> : <><b>{stats.improve > 0 ? '+' : ''}{stats.improve}</b><span>%</span></>}
                      hint="so với bài đầu tiên" />
                    <StatCard icon={IcLayers(18)} label="Số lần làm" tone="blue"
                      value={<b>{ranged.length}</b>}
                      hint={RANGES.find(r => r.key === range)?.label.toLowerCase()} />
                  </div>

                  {stats.verdict && (
                    <div className={`eh-verdict eh-verdict--${stats.verdict.tone}`}>
                      <span className="eh-verdict-ic">{stats.verdict.tone === 'warn' ? IcAlert(16) : IcCheck(16)}</span>
                      <div>
                        <b>{stats.verdict.label}</b>
                        <span> — {stats.verdict.msg}</span>
                      </div>
                    </div>
                  )}

                  {stats.declining && (
                    <div className="eh-verdict eh-verdict--warn">
                      <span className="eh-verdict-ic">{IcAlert(16)}</span>
                      <div>
                        <b>3 bài gần nhất điểm giảm liên tiếp</b>
                        <span> — nên dành thời gian ôn lại kiến thức nền tảng trước khi làm đề mới nhé.</span>
                      </div>
                    </div>
                  )}

                  <ScoreLineChart points={chartPoints} avg={stats.avg} />
                  {stats.points.length > chartPoints.length && (
                    <p className="eh-chart-note">Biểu đồ hiển thị {chartPoints.length} lần làm gần nhất.</p>
                  )}
                </>
              )}
            </div>

            {/* ══ Block 3: bảng lịch sử chi tiết ══ */}
            <div className="prof-section">
              <h3 className="prof-section-title">{IcClock(16)} Lịch sử chi tiết</h3>

              {rows.length === 0 ? (
                <p className="prof-section-desc" style={{ margin: 0 }}>
                  Không có bài làm nào trong khoảng thời gian này.
                </p>
              ) : (
                <div className="eh-table">
                  <div className="eh-thead">
                    <span>Ngày làm</span><span>Bài kiểm tra</span><span>Câu đúng</span>
                    <span>Thời gian</span><span>Điểm</span><span />
                  </div>
                  {rows.map((s, i) => {
                    const pending = s.score == null
                    const scaled  = pending ? null : scaledScore(s.score, s.maxScore)
                    const dur     = formatDuration(s.timeSpent)
                    const hasQ    = !pending && s.questionCount > 0
                    return (
                      <div key={s.id} className="eh-row" style={{ animationDelay: `${i * 35}ms` }}>
                        <span className="eh-cell eh-cell--date">
                          <i className="eh-cl">Ngày làm</i>{formatDt(s.submittedAt)}
                        </span>
                        <span className="eh-cell eh-cell--title">
                          <i className="eh-cl">Bài kiểm tra</i>
                          <b>{s.examTitle || 'Đề thi'}</b>
                          {s.className && <em className="eh-chip">{s.className}</em>}
                        </span>
                        <span className="eh-cell">
                          <i className="eh-cl">Câu đúng</i>
                          {hasQ
                            ? <span className={`eh-tone-${scoreTone(scaled)}`}><b>{s.correctCount}</b>/{s.questionCount}</span>
                            : <span className="eh-muted">—</span>}
                        </span>
                        <span className="eh-cell">
                          <i className="eh-cl">Thời gian</i>{dur || <span className="eh-muted">—</span>}
                        </span>
                        <span className="eh-cell eh-cell--score">
                          <i className="eh-cl">Điểm</i>
                          {pending
                            ? <span className="phi-score-pending">Chờ công bố</span>
                            : <>
                                <span className="eh-score-num" style={{ color: scoreColor(scaled) }}>{scaled}</span>
                                <span className="eh-score-total">/10</span>
                                <MiniBar pct={(scaled / 10) * 100} color={scoreColor(scaled)} />
                              </>}
                        </span>
                        <span className="eh-cell eh-cell--act">
                          <a className="eh-review-btn" href={`#results/${s.examId}/${s.id}`}>
                            {IcEye(14)} Xem lại
                          </a>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

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

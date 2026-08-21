import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSubmissionReview, fetchMySubmissions, scaledScore } from '../store/examStore.js'
import { QuestionText, FigureImages, SECTION_PREFIX, toPassageHTML } from '../components/QuestionCard.jsx'
import { SUBJECTS } from '../components/SubjectBadge.jsx'
import MathText from '../components/MathText.jsx'
import MarkerText from '../components/MarkerText.jsx'
import './ExamReviewPage.css'

/* ════════════════════════════════════════════════════════════════════════
   Xem lại bài làm — ĐỐI CHIẾU VỚI ĐỀ GỐC.
   Khác với ExamTakePage: ở đây KHÔNG dùng giao diện làm bài (tab từng phần,
   nút bấm chọn đáp án, thứ tự đã trộn của học sinh). Trang này in lại toàn bộ
   đề gốc — đúng thứ tự câu và đúng nhãn A/B/C/D của đề — rồi đánh dấu lên đó
   đáp án học sinh đã chọn (xanh = đúng, đỏ = sai) và đáp án đúng của hệ thống
   (highlight vàng). Nếu lượt làm đó bị trộn đề, mỗi câu ghi thêm "lúc làm là
   Câu N" để học sinh đối chiếu được với bản mình đã thấy.
════════════════════════════════════════════════════════════════════════ */

const SECTION_ORDER = ['PHẦN I', 'PHẦN II', 'PHẦN III', 'TIẾNG ANH', 'READING', 'TỰ LUẬN']

const SECTION_META = {
  'PHẦN I':    { label: 'Phần I – Trắc nghiệm',     color: '#2563eb', ppq: 0.25 },
  'PHẦN II':   { label: 'Phần II – Đúng / Sai',     color: '#7c3aed', ppq: 1 },
  'PHẦN III':  { label: 'Phần III – Trả lời ngắn',  color: '#059669', ppq: 0.5 },
  'TIẾNG ANH': { label: 'Tiếng Anh – Trắc nghiệm',  color: '#0f766e', ppq: 0.25 },
  'READING':   { label: 'Reading – Bài đọc',        color: '#0e7490', ppq: 0.25 },
  'TỰ LUẬN':   { label: 'Tự luận',                  color: '#d97706', ppq: 0 },
}

const MC_SECTIONS = ['PHẦN I', 'TIẾNG ANH', 'READING']
const DISPLAY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

const STATUS_META = {
  right:   { label: 'Đúng',          icon: '✓' },
  wrong:   { label: 'Sai',           icon: '✗' },
  partial: { label: 'Đúng một phần', icon: '◐' },
  skipped: { label: 'Chưa trả lời',  icon: '—' },
  nokey:   { label: 'Chưa có đáp án', icon: '?' },
  essay:   { label: 'Đã chấm',        icon: '✓' },
  pending: { label: 'Chờ chấm',       icon: '⏳' },
}

const round2 = n => Math.round(n * 100) / 100

const formatDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

/* Thời gian dạng đồng hồ mm:ss — dùng cho ô "Thời gian hoàn thành" */
const formatClock = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const norm = v => (v ?? '').toString().trim().toLowerCase()

/* Mã hoá màu theo mức điểm (thang 10): đỏ < 5 · vàng 5–8 · xanh ≥ 8 */
const bandOf = v => (v == null ? 'none' : v >= 8 ? 'high' : v >= 5 ? 'mid' : 'low')
const BAND_COLOR = { high: '#059669', mid: '#f59e0b', low: '#ef4444', none: '#94a3b8' }
const BAND_MSG = {
  high: 'Tuyệt vời! Bạn đang làm rất tốt.',
  mid:  'Khá rồi đấy! Xem lại vài câu sai bên dưới là điểm sẽ lên ngay.',
  low:  'Đừng nản chí, hãy xem lại lời giải bên dưới nhé!',
  none: 'Bài này chưa có điểm.',
}

/* Số chạy từ 0 → giá trị thật khi trang vừa tải (ease-out) */
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (target == null) { setV(0); return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf, start
    const step = (t) => {
      start ??= t
      const p = Math.min(1, (t - start) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // Chốt giá trị thật kể cả khi rAF không chạy (tab nền, trình duyệt tiết kiệm pin)
    // — hiệu ứng đẹp là phụ, KHÔNG được để điểm kẹt ở 0.
    const done = setTimeout(() => setV(target), ms + 250)
    return () => { cancelAnimationFrame(raf); clearTimeout(done) }
  }, [target, ms])
  return v
}

/* Vòng tròn điểm số (radial progress) — thay cho dòng chữ "2/10" khô khan */
function RadialScore({ score, band }) {
  const R = 62, STROKE = 12
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(1, (score ?? 0) / 10))
  const shown = useCountUp(score)
  const [dash, setDash] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDash(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return (
    <div className="rv-radial">
      <svg width={(R + STROKE) * 2} height={(R + STROKE) * 2}>
        <circle cx={R + STROKE} cy={R + STROKE} r={R} className="rv-radial-track" strokeWidth={STROKE} />
        <circle cx={R + STROKE} cy={R + STROKE} r={R} className="rv-radial-fill" strokeWidth={STROKE}
          stroke={BAND_COLOR[band]} strokeDasharray={C} strokeDashoffset={C * (1 - dash)}
          transform={`rotate(-90 ${R + STROKE} ${R + STROKE})`} />
      </svg>
      <div className="rv-radial-mid">
        <span className="rv-radial-num" style={{ color: BAND_COLOR[band] }}>
          {shown.toFixed(score != null && score % 1 === 0 ? 0 : 2)}
        </span>
        <span className="rv-radial-total">/10</span>
      </div>
    </div>
  )
}

function StatTile({ icon, tone, label, value, hint }) {
  return (
    <div className={`rv-stat rv-stat--${tone}`}>
      <span className="rv-stat-ic">{icon}</span>
      <span className="rv-stat-label">{label}</span>
      <span className="rv-stat-value">{value}</span>
      {hint && <span className="rv-stat-hint">{hint}</span>}
    </div>
  )
}

/* Biểu đồ đường nhỏ: điểm 5 lần làm gần nhất của môn này, chấm to = lần đang xem */
function MiniTrend({ points, currentId }) {
  const W = 300, H = 120, PAD = { t: 14, r: 14, b: 22, l: 24 }
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
  const n = points.length
  const px = i => PAD.l + (n <= 1 ? iw / 2 : (iw * i) / (n - 1))
  const py = v => PAD.t + ih * (1 - Math.max(0, Math.min(10, v)) / 10)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(p.score)}`).join(' ')
  const area = n > 1 ? `${line} L ${px(n - 1)} ${PAD.t + ih} L ${px(0)} ${PAD.t + ih} Z` : ''
  return (
    <svg className="rv-trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Điểm các lần làm gần nhất">
      <defs>
        <linearGradient id="rvTrend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 5, 10].map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={py(v)} x2={PAD.l + iw} y2={py(v)} className="rv-trend-grid" />
          <text x={PAD.l - 6} y={py(v) + 3.5} className="rv-trend-axis" textAnchor="end">{v}</text>
        </g>
      ))}
      {area && <path d={area} fill="url(#rvTrend)" />}
      {n > 1 && <path d={line} className="rv-trend-line" />}
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={px(i)} cy={py(p.score)} r={p.id === currentId ? 6 : 4}
            fill="#fff" stroke={BAND_COLOR[bandOf(p.score)]} strokeWidth={p.id === currentId ? 3 : 2} />
          <text x={px(i)} y={H - 7} className="rv-trend-axis" textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

/* ── Dựng kết quả từng câu theo ĐỀ GỐC (giữ nguyên thứ tự câu trong exam.sections) ── */
function buildReview(exam, submission) {
  const answers = submission?.answers || {}
  const manual  = submission?.manualScores || {}
  const shuffle = submission?.shuffleMap || null

  const blocks = []
  for (const sec of SECTION_ORDER) {
    const data = exam?.sections?.[sec]
    const qs   = data?.questions || []
    if (!qs.length) continue

    const prefix = SECTION_PREFIX[sec] || 'I'
    const ppq    = data.points_per_q || SECTION_META[sec].ppq
    const order  = shuffle?.sections?.[sec] || null   // thứ tự học sinh đã thấy

    const items = qs.map(q => {
      const key    = `${prefix}_${q.question_number}`
      const picked = answers[key]
      // Vị trí câu này trong bản trộn học sinh đã làm (0 = đề không trộn)
      const seenAt = order ? order.indexOf(q.question_number) + 1 : 0
      const base   = { q, key, picked, seenAt, choiceOrder: shuffle?.choices?.[key] || null }

      if (MC_SECTIONS.includes(sec)) {
        // PHẦN I tính điểm tối đa cho mọi câu; TIẾNG ANH/READING chỉ tính câu có đáp án
        const max = sec === 'PHẦN I' ? ppq : (q.answer ? ppq : 0)
        const status = !q.answer ? 'nokey'
          : picked == null ? 'skipped'
          : picked === q.answer ? 'right' : 'wrong'
        return { ...base, kind: 'mc', status, max, earned: status === 'right' ? max : 0 }
      }

      if (sec === 'PHẦN II') {
        const subs   = q.sub_questions || []
        const user   = (picked && typeof picked === 'object') ? picked : {}
        const nRight = subs.filter(s => user[s.label] === s.correct_answer).length
        const nDone  = subs.filter(s => user[s.label] !== undefined).length
        const total  = subs.length
        const earned = !total ? 0
          : nRight === total     ? ppq
          : nRight === total - 1 ? ppq * 0.5
          : nRight === total - 2 ? ppq * 0.25
          : nRight === total - 3 ? ppq * 0.1 : 0
        const status = nDone === 0 ? 'skipped'
          : nRight === total ? 'right'
          : nRight === 0 ? 'wrong' : 'partial'
        return { ...base, kind: 'tf', status, max: ppq, earned: round2(earned), nRight, total, user }
      }

      if (sec === 'TỰ LUẬN') {
        const max    = Number(q.points) || 0
        const scored = manual[key]
        return {
          ...base, kind: 'essay', max,
          earned: Number(scored) || 0,
          status: scored == null ? 'pending' : 'essay',
          images: Array.isArray(picked) ? picked : [],
        }
      }

      // PHẦN III — trả lời ngắn
      const status = !norm(q.answer) ? 'nokey'
        : !norm(picked) ? 'skipped'
        : norm(picked) === norm(q.answer) ? 'right' : 'wrong'
      return { ...base, kind: 'short', status, max: ppq, earned: status === 'right' ? ppq : 0 }
    })

    blocks.push({
      sec,
      items,
      nRight: items.filter(i => i.status === 'right').length,
      earned: round2(items.reduce((s, i) => s + i.earned, 0)),
      max:    round2(items.reduce((s, i) => s + i.max, 0)),
    })
  }
  return blocks
}

/* Đoạn văn / bài đọc — thu gọn được cho đỡ dài khi rà soát câu sai */
function PassageBox({ title, text }) {
  const [open, setOpen] = useState(true)
  if (!text) return null
  return (
    <div className="rv-passage">
      <button className="rv-passage-head" onClick={() => setOpen(v => !v)}>
        <span>{title || 'Đoạn văn / Bài đọc'}</span>
        <span className="rv-passage-toggle">{open ? '▲ Thu gọn' : '▼ Xem'}</span>
      </button>
      {open && (
        <div className="rv-passage-text" dangerouslySetInnerHTML={{ __html: toPassageHTML(text) }} />
      )}
    </div>
  )
}

/* ── Một câu trong đề gốc + dấu vết bài làm của học sinh ── */
function ReviewQuestion({ item, showPassage }) {
  const { q, kind, status, picked, earned, max, seenAt, choiceOrder } = item
  const meta = STATUS_META[status] || STATUS_META.nokey

  // Đề bật trộn đáp án: nhãn học sinh THẤY lúc làm khác nhãn của đề gốc —
  // ghi chú lại để không bị hiểu nhầm là "em chọn B mà sao ở đây là A".
  const seenLabelOf = (realKey) => {
    if (!Array.isArray(choiceOrder) || realKey == null) return null
    const idx = choiceOrder.indexOf(realKey)
    return idx >= 0 ? (DISPLAY_LABELS[idx] || null) : null
  }

  return (
    <article className={`rv-q rv-q--${status}`} id={`q-${item.key}`}>
      <header className="rv-q-head">
        <span className="rv-q-num">Câu {q.question_number}</span>
        <span className={`rv-badge rv-badge--${status}`}>{meta.icon} {meta.label}</span>
        {max > 0 && (
          <span className="rv-q-pts">
            {status === 'pending' ? `— / ${round2(max)}đ` : `${round2(earned)} / ${round2(max)}đ`}
          </span>
        )}
        {seenAt > 0 && seenAt !== q.question_number && (
          <span className="rv-q-seen">lúc làm là Câu {seenAt}</span>
        )}
      </header>

      {showPassage && <PassageBox title={q.passage_title} text={q.passage_text} />}

      <div className="rv-q-text"><QuestionText q={q} /></div>
      <FigureImages path={q.figure_path} />

      {kind === 'mc' && (
        <div className="rv-choices">
          {Object.entries(q.choices || {}).map(([key, val]) => {
            const isKey  = q.answer != null && key === q.answer
            const isPick = picked === key
            const cls = isKey && isPick ? 'is-right' : isPick ? 'is-wrong' : isKey ? 'is-key' : ''
            const seen = isPick ? seenLabelOf(key) : null
            return (
              <div key={key} className={`rv-choice ${cls}`}>
                <span className="rv-choice-key">{key}.</span>
                <span className="rv-choice-text"><MarkerText text={val} images={q.images} /></span>
                <span className="rv-choice-tags">
                  {isPick && <em className="rv-tag rv-tag--pick">Bạn chọn{seen && seen !== key ? ` (lúc làm là ${seen})` : ''}</em>}
                  {isKey  && <em className="rv-tag rv-tag--key">Đáp án đúng</em>}
                </span>
              </div>
            )
          })}
          {status === 'skipped' && <p className="rv-note rv-note--warn">Bạn đã bỏ trống câu này.</p>}
          {status === 'nokey'   && <p className="rv-note">Đề gốc chưa có đáp án cho câu này.</p>}
        </div>
      )}

      {kind === 'tf' && (
        <div className="rv-tf">
          {(q.sub_questions || []).map(sub => {
            const ua = item.user?.[sub.label]
            const st = sub.correct_answer == null ? 'nokey'
              : ua === undefined ? 'skipped'
              : ua === sub.correct_answer ? 'right' : 'wrong'
            return (
              <div key={sub.label} className={`rv-tf-row rv-tf-row--${st}`}>
                <span className="rv-tf-label">{sub.label})</span>
                <span className="rv-tf-text"><MathText text={sub.text} /></span>
                <span className="rv-tf-ans">
                  <em className={`rv-tag ${st === 'right' ? 'rv-tag--ok' : st === 'wrong' ? 'rv-tag--bad' : 'rv-tag--miss'}`}>
                    Bạn: {ua === undefined ? 'bỏ trống' : ua ? 'Đúng' : 'Sai'}
                  </em>
                  {sub.correct_answer != null && (
                    <em className="rv-tag rv-tag--key">Đáp án: {sub.correct_answer ? 'Đúng' : 'Sai'}</em>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {kind === 'short' && (
        <div className="rv-short">
          <em className={`rv-tag ${status === 'right' ? 'rv-tag--ok' : status === 'wrong' ? 'rv-tag--bad' : 'rv-tag--miss'}`}>
            Bạn trả lời: {norm(picked) ? String(picked) : 'bỏ trống'}
          </em>
          {q.answer != null && q.answer !== '' && (
            <em className="rv-tag rv-tag--key">Đáp án đúng: {String(q.answer)}</em>
          )}
        </div>
      )}

      {kind === 'essay' && (
        <div className="rv-essay">
          {item.images.length > 0 ? (
            <div className="rv-essay-thumbs">
              {item.images.map((img, i) => (
                <a key={img.url || i} href={img.url} target="_blank" rel="noreferrer">
                  <img src={img.url} alt={img.name || `Ảnh bài làm ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          ) : (
            <p className="rv-note rv-note--warn">Bạn chưa nộp ảnh bài làm cho câu này.</p>
          )}
          {status === 'pending' && <p className="rv-note">Giáo viên chưa chấm câu tự luận này.</p>}
        </div>
      )}
    </article>
  )
}

/* ── Trang xem lại một bài đã làm, đối chiếu với đề gốc ── */
export default function ExamReviewPage({ examId, subId, onGoHome }) {
  const [state, setState]           = useState('loading')  // loading | error | hidden | ready
  const [errMsg, setErrMsg]         = useState('')
  const [exam, setExam]             = useState(null)
  const [submission, setSubmission] = useState(null)
  const [history, setHistory]       = useState([])
  const [onlyWrong, setOnlyWrong]   = useState(false)
  // Tiêu đề trên thanh sticky chỉ hiện khi đã cuộn qua khối tiêu đề lớn —
  // tránh in cùng một tên đề 2 lần ngay đầu trang.
  const [compact, setCompact]       = useState(false)
  const headRef                     = useRef(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetchSubmissionReview(examId, subId)
      .then(res => {
        if (!alive) return
        if (!res.revealed) { setState('hidden'); return }
        setExam(res.exam)
        setSubmission(res.submission)
        setState('ready')
      })
      .catch(e => { if (alive) { setErrMsg(e.message || 'Không thể xem lại bài làm'); setState('error') } })
    return () => { alive = false }
  }, [examId, subId])

  // Lịch sử làm bài của chính học sinh đó — để so sánh với lần trước, vẽ đường
  // tiến độ và xếp hạng giữa các lần làm. Giáo viên mở bài của học sinh sẽ bị
  // API chặn (403) → chỉ đơn giản là không có các khối này, không báo lỗi.
  useEffect(() => {
    const sid = submission?.studentId
    if (!sid) return
    let alive = true
    fetchMySubmissions(sid)
      .then(res => { if (alive) setHistory(res.submissions || []) })
      .catch(() => { if (alive) setHistory([]) })
    return () => { alive = false }
  }, [submission?.studentId])

  useEffect(() => {
    const el = headRef.current
    if (state !== 'ready' || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [state])

  const blocks = useMemo(
    () => (exam && submission ? buildReview(exam, submission) : []),
    [exam, submission],
  )

  const totals = useMemo(() => {
    const items = blocks.flatMap(b => b.items)
    return {
      count:   items.length,
      right:   items.filter(i => i.status === 'right').length,
      wrong:   items.filter(i => ['wrong', 'partial', 'skipped'].includes(i.status)).length,
      // Số câu chấm tự động (bỏ tự luận + câu chưa có đáp án) — dùng làm mẫu số "đúng/tổng"
      auto:    items.filter(i => i.kind !== 'essay' && i.status !== 'nokey').length,
      essayMax: items.filter(i => i.kind === 'essay').reduce((s, i) => s + i.max, 0),
      essayPending: items.some(i => i.status === 'pending'),
    }
  }, [blocks])

  /* ── Đối chiếu với các lần làm khác: lần trước, hạng, đường tiến độ ── */
  const progress = useMemo(() => {
    if (!submission) return { attempts: [], attemptNo: 0, prevDelta: null, rank: 0, trend: [] }
    const cur = scaledScore(submission.score, submission.maxScore)

    const attempts = history
      .filter(s => String(s.examId) === String(examId) && s.score != null)
      .map(s => ({ ...s, scaled: scaledScore(s.score, s.maxScore) }))
      .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))

    const idx  = attempts.findIndex(s => String(s.id) === String(subId))
    const prev = idx > 0 ? attempts[idx - 1] : null
    const rank = attempts.length
      ? [...attempts].sort((a, b) => b.scaled - a.scaled).findIndex(s => String(s.id) === String(subId)) + 1
      : 0

    // 5 lần gần nhất của CÙNG MÔN (không chỉ đề này) — thấy ngay đang lên hay xuống.
    // Đề cũ chưa gắn môn thì lấy chính các lần làm của đề đó cho khỏi trộn môn.
    const sameGroup = exam?.subject
      ? (s => (s.examSubject || 'khac') === exam.subject)
      : (s => String(s.examId) === String(examId))
    const trend = history
      .filter(s => s.score != null && sameGroup(s))
      .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
      .slice(-5)
      .map(s => ({
        id: s.id,
        score: scaledScore(s.score, s.maxScore),
        label: s.submittedAt
          ? new Date(s.submittedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
          : '—',
      }))

    return {
      attempts,
      attemptNo: idx >= 0 ? idx + 1 : attempts.length,
      prevDelta: prev ? round2(cur - prev.scaled) : null,
      rank,
      trend,
    }
  }, [history, exam, submission, examId, subId])

  if (state === 'loading') return (
    <div className="rv-status"><p>Đang tải bài làm…</p></div>
  )

  if (state === 'error') return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">⚠️</div>
        <h1 className="etl-title">Không thể xem lại bài làm</h1>
        <p className="review-status-desc">{errMsg}</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )

  if (state === 'hidden') return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">⏳</div>
        <h1 className="etl-title">Kết quả chưa được công bố</h1>
        <p className="review-status-desc">Giáo viên chưa công bố đáp án/điểm cho đề này. Quay lại sau nhé.</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )

  const scaled       = scaledScore(submission.score, submission.maxScore)
  const band         = bandOf(scaled)
  const shuffled     = !!submission.shuffleMap
  // Điểm hiển thị luôn tính trên TỔNG điểm toàn đề (kể cả tự luận chưa chấm — tạm 0đ)
  // để khớp với điểm giáo viên thấy, tránh 2 màn hình ra 2 điểm khác nhau.
  const pendingEssay = totals.essayPending && totals.essayMax > 0

  const subjectKey   = SUBJECTS[exam.subject] ? exam.subject : null
  const subjectLabel = subjectKey ? SUBJECTS[subjectKey].label : null
  const accuracy     = totals.auto ? Math.round((totals.right / totals.auto) * 100) : null
  const paceSec      = submission.timeSpent && totals.count ? Math.round(submission.timeSpent / totals.count) : null
  const pace         = paceSec == null ? '—'
    : paceSec >= 60 ? `${Math.floor(paceSec / 60)}p${String(paceSec % 60).padStart(2, '0')}/câu`
    : `${paceSec}s/câu`
  // "Làm lại": đề giao trong lớp thì quay về lớp để vào lại đúng luồng (giữ
  // nguyên luật số lần làm / thời gian mở); đề lẻ thì vào sảnh đề thi.
  const retakeHref = submission.classId ? `#class/${submission.classId}/exam` : `#lobby/${examId}`
  const nextHref   = submission.classId ? `#class/${submission.classId}` : '#my-classes'
  const goDetail   = () => document.getElementById('rv-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="rv-page">
      <div className="rv-topbar">
        <div className="rv-topbar-in">
          <div className={`rv-topbar-title ${compact ? 'is-visible' : ''}`}>
            <span className="rv-topbar-label">Kết quả bài làm</span>
            <h1>{exam.title}</h1>
          </div>
          <div className="rv-topbar-act">
            <a className="rv-btn rv-btn--ghost" href="#history">← Lịch sử làm bài</a>
            <button className="rv-btn rv-btn--ghost" onClick={onGoHome}>Trang chủ</button>
          </div>
        </div>
      </div>

      <div className="rv-body">
        {/* ── Block 1: tiêu đề + breadcrumb + trạng thái ── */}
        <header className="rv-head" ref={headRef}>
          <nav className="rv-crumbs">
            <a href="#history">Lịch sử</a>
            <span>›</span>
            {subjectKey && (<><a href={`#history/${subjectKey}`}>{subjectLabel}</a><span>›</span></>)}
            {submission.className && (<><span className="rv-crumb-mid">{submission.className}</span><span>›</span></>)}
            <span className="rv-crumb-cur">{exam.title}</span>
          </nav>
          <div className="rv-head-row">
            <h1>{exam.title}</h1>
            <span className={`rv-state ${pendingEssay ? 'rv-state--pending' : ''}`}>
              {pendingEssay ? '⏳ Chờ chấm tự luận' : '✓ Đã hoàn thành'}
            </span>
            {submission.studentName && <span className="rv-state rv-state--muted">👤 {submission.studentName}</span>}
          </div>
        </header>

        <div className="rv-hero">
          <div className="rv-hero-main">
            {/* ── Block 2: điểm số + nhận xét + so sánh lần trước ── */}
            <section className={`rv-score-card rv-score-card--${band}`}>
              <RadialScore score={scaled} band={band} />
              <div className="rv-score-body">
                <p className="rv-score-msg">{BAND_MSG[band]}</p>
                <p className="rv-score-sub">
                  {submission.score}/{submission.maxScore} điểm · {totals.right}/{totals.auto} câu đúng
                  {progress.attemptNo > 0 && ` · lần làm thứ ${progress.attemptNo}`}
                </p>
                {progress.prevDelta == null ? (
                  <p className="rv-delta rv-delta--flat">● Đây là lần làm đầu tiên của đề này</p>
                ) : progress.prevDelta > 0 ? (
                  <p className="rv-delta rv-delta--up">▲ Cao hơn {progress.prevDelta} điểm so với lần làm trước</p>
                ) : progress.prevDelta < 0 ? (
                  <p className="rv-delta rv-delta--down">▼ Thấp hơn {Math.abs(progress.prevDelta)} điểm so với lần làm trước</p>
                ) : (
                  <p className="rv-delta rv-delta--flat">● Bằng điểm lần làm trước</p>
                )}
              </div>
            </section>

            {/* ── Block 3: thông số chi tiết ── */}
            <div className="rv-stat-grid">
              <StatTile icon="⏱" tone="blue" label="Thời gian làm"
                value={formatClock(submission.timeSpent)} hint={formatDt(submission.submittedAt)} />
              <StatTile icon="🎯" tone={band} label="Độ chính xác"
                value={accuracy == null ? '—' : `${accuracy}%`} hint={`${totals.right}/${totals.auto} câu đúng`} />
              <StatTile icon="🏅" tone="violet" label="Hạng lần làm"
                value={progress.rank ? `#${progress.rank}` : '—'}
                hint={progress.attempts.length > 1 ? `trong ${progress.attempts.length} lần làm đề này` : 'mới làm 1 lần'} />
              <StatTile icon="⚡" tone="amber" label="Tốc độ trung bình"
                value={pace} hint={`${totals.count} câu trong đề`} />
            </div>

            {/* ── Block 5: nút hành động ── */}
            <div className="rv-actions">
              <button className="rv-btn rv-btn--primary" onClick={goDetail}>🔍 Xem chi tiết bài làm</button>
              <a className="rv-btn rv-btn--outline" href={retakeHref}>🔁 Làm lại bài này</a>
              <a className="rv-btn rv-btn--soft" href={nextHref}>Học tiếp →</a>
            </div>
          </div>

          {/* ── Block 4 + gợi ý: đường tiến độ & các lần làm khác ── */}
          <aside className="rv-hero-side">
            <section className="rv-card">
              <h3 className="rv-card-title">{subjectLabel ? `Tiến độ môn ${subjectLabel}` : 'Tiến độ qua các lần làm'}</h3>
              {progress.trend.length >= 2 ? (
                <>
                  <MiniTrend points={progress.trend} currentId={submission.id} />
                  <p className="rv-card-note">{progress.trend.length} lần làm gần nhất · chấm đậm là bài đang xem</p>
                </>
              ) : (
                <p className="rv-card-empty">Cần ít nhất 2 bài đã có điểm để vẽ đường tiến độ.</p>
              )}
              <a className="rv-card-link" href={subjectKey ? `#history/${subjectKey}` : '#history'}>
                Xem toàn bộ tiến độ →
              </a>
            </section>

            {progress.attempts.length > 1 && (
              <section className="rv-card">
                <h3 className="rv-card-title">Các lần làm đề này</h3>
                <ul className="rv-attempts">
                  {progress.attempts.map((a, i) => ({ ...a, no: i + 1 })).reverse().map(a => {
                    const isCur = String(a.id) === String(subId)
                    return (
                      <li key={a.id}>
                        <a className={`rv-attempt ${isCur ? 'is-current' : ''}`} href={`#results/${examId}/${a.id}`}>
                          <span className="rv-attempt-no">Lần {a.no}</span>
                          <span className="rv-attempt-date">
                            {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('vi-VN') : '—'}
                          </span>
                          <span className="rv-attempt-score" style={{ color: BAND_COLOR[bandOf(a.scaled)] }}>
                            {a.scaled}<i>/10</i>
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {/* ── Chi tiết: đối chiếu với đề gốc ── */}
        <section id="rv-detail" className="rv-detail">
          <header className="rv-detail-head">
            <div>
              <span className="rv-detail-label">Đối chiếu với đề gốc</span>
              <h2>Chi tiết từng câu</h2>
            </div>
            <div className="rv-filter">
              <button className={`rv-filter-btn ${!onlyWrong ? 'is-active' : ''}`} onClick={() => setOnlyWrong(false)}>
                Tất cả câu <b>{totals.count}</b>
              </button>
              <button className={`rv-filter-btn ${onlyWrong ? 'is-active' : ''}`} onClick={() => setOnlyWrong(true)}>
                Câu cần xem lại <b>{totals.wrong}</b>
              </button>
            </div>
          </header>

          {shuffled && (
            <p className="rv-callout">
              Lượt làm này bật <b>trộn đề</b>. Bên dưới là <b>đề gốc</b> — thứ tự câu và nhãn A/B/C/D theo
              đề gốc, mỗi câu có ghi chú vị trí bạn đã thấy lúc làm bài.
            </p>
          )}
          {pendingEssay && (
            <p className="rv-callout rv-callout--warn">
              ✍️ Phần tự luận đang chờ giáo viên chấm — điểm ở trên đã tính trên tổng điểm toàn đề
              (phần tự luận tạm tính 0đ cho tới khi được chấm).
            </p>
          )}

        {blocks.map(block => {
          const items = onlyWrong
            ? block.items.filter(i => ['wrong', 'partial', 'skipped'].includes(i.status))
            : block.items
          if (!items.length) return null
          const meta = SECTION_META[block.sec] || { label: block.sec, color: '#475569' }
          // READING: đoạn văn in 1 lần cho cả nhóm câu hỏi dùng chung passage_group
          const seenPassage = new Set()
          return (
            <section key={block.sec} className="rv-section" style={{ '--sec-color': meta.color }}>
              <header className="rv-section-head">
                <h2>{meta.label}</h2>
                <span className="rv-section-stat">
                  {block.sec === 'TỰ LUẬN'
                    ? `${round2(block.earned)}/${round2(block.max)}đ`
                    : `${block.nRight}/${block.items.length} câu đúng · ${round2(block.earned)}/${round2(block.max)}đ`}
                </span>
              </header>
              {items.map(item => {
                let showPassage = !!item.q.passage_text
                if (showPassage && block.sec === 'READING') {
                  const gid = item.q.passage_group ?? 1
                  showPassage = !seenPassage.has(gid)
                  seenPassage.add(gid)
                }
                return <ReviewQuestion key={item.key} item={item} showPassage={showPassage} />
              })}
            </section>
          )
        })}

        {onlyWrong && totals.wrong === 0 && (
          <p className="rv-empty">🎉 Bạn làm đúng toàn bộ các câu có đáp án. Quá tuyệt!</p>
        )}
        </section>

        <div className="rv-foot">
          <a className="rv-btn rv-btn--ghost" href="#history">← Lịch sử làm bài</a>
          <button className="rv-btn rv-btn--ghost" onClick={onGoHome}>Trang chủ</button>
        </div>
      </div>
    </div>
  )
}

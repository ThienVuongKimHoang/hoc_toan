import React, { useEffect, useMemo, useState } from 'react'
import { fetchSubmissionReview, scaledScore } from '../store/examStore.js'
import { QuestionText, FigureImages, SECTION_PREFIX, toPassageHTML } from '../components/QuestionCard.jsx'
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

const formatDuration = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m > 0 ? `${m} phút ${s} giây` : `${s} giây`
}

const norm = v => (v ?? '').toString().trim().toLowerCase()

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
  const [onlyWrong, setOnlyWrong]   = useState(false)

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
  const scoreColor   = scaled >= 8 ? '#059669' : scaled >= 5 ? '#f59e0b' : '#ef4444'
  const shuffled     = !!submission.shuffleMap
  // Điểm hiển thị luôn tính trên TỔNG điểm toàn đề (kể cả tự luận chưa chấm — tạm 0đ)
  // để khớp với điểm giáo viên thấy, tránh 2 màn hình ra 2 điểm khác nhau.
  const pendingEssay = totals.essayPending && totals.essayMax > 0

  return (
    <div className="rv-page">
      <div className="rv-topbar">
        <div className="rv-topbar-in">
          <div className="rv-topbar-title">
            <span className="rv-topbar-label">Đối chiếu với đề gốc</span>
            <h1>{exam.title}</h1>
          </div>
          <div className="rv-topbar-act">
            <a className="rv-btn rv-btn--ghost" href="#history">← Lịch sử làm bài</a>
            <button className="rv-btn rv-btn--ghost" onClick={onGoHome}>Trang chủ</button>
          </div>
        </div>
      </div>

      <div className="rv-body">
        <section className="rv-summary">
          <div className="rv-score" style={{ color: scoreColor }}>
            {scaled}<span>/10</span>
          </div>
          <div className="rv-summary-meta">
            <div className="rv-summary-row">
              <span><b>{totals.right}</b>/{totals.auto} câu đúng</span>
              <span>{submission.score}/{submission.maxScore} điểm</span>
              <span>⏱ {formatDuration(submission.timeSpent)}</span>
              <span>🗓 {formatDt(submission.submittedAt)}</span>
              {submission.className && <span>🏫 {submission.className}</span>}
              {submission.studentName && <span>👤 {submission.studentName}</span>}
            </div>
            <div className="rv-score-bar">
              <div className="rv-score-fill" style={{ width: `${Math.min(100, (scaled / 10) * 100)}%`, background: scoreColor }} />
            </div>
          </div>
        </section>

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

        <div className="rv-filter">
          <button className={`rv-filter-btn ${!onlyWrong ? 'is-active' : ''}`} onClick={() => setOnlyWrong(false)}>
            Tất cả câu <b>{totals.count}</b>
          </button>
          <button className={`rv-filter-btn ${onlyWrong ? 'is-active' : ''}`} onClick={() => setOnlyWrong(true)}>
            Câu cần xem lại <b>{totals.wrong}</b>
          </button>
        </div>

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

        <div className="rv-foot">
          <a className="rv-btn rv-btn--ghost" href="#history">← Lịch sử làm bài</a>
          <button className="rv-btn rv-btn--ghost" onClick={onGoHome}>Trang chủ</button>
        </div>
      </div>
    </div>
  )
}

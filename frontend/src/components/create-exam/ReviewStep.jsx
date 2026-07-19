import React, { useCallback, useEffect, useRef, useState } from 'react'
import EditableQuestion from './EditableQuestion.jsx'
import ReadingSection from './ReadingSection.jsx'
import MixExamModal from '../MixExamModal.jsx'
import { SUBJECTS } from '../SubjectBadge.jsx'
import { subjectHasLabels } from '../../data/labels.js'

function isUnanswered(q, sec) {
  if (sec === 'PHẦN I' || sec === 'TIẾNG ANH' || sec === 'READING') return q.answer === null || q.answer === undefined
  if (sec === 'PHẦN III') return !q.answer || !q.answer.toString().trim()
  // TỰ LUẬN chấm tay — không có "đáp án" nên không tính là thiếu đáp án
  return false
}

const MATH_SECTIONS = ['PHẦN I', 'PHẦN II', 'PHẦN III', 'TỰ LUẬN']
const SECTION_META = {
  'PHẦN I':    { label: 'Trắc nghiệm',   color: '#2563eb', shortLabel: 'Phần I' },
  'PHẦN II':   { label: 'Đúng / Sai',    color: '#7c3aed', shortLabel: 'Phần II' },
  'PHẦN III':  { label: 'Trả lời ngắn',  color: '#059669', shortLabel: 'Phần III' },
  'TỰ LUẬN':   { label: 'Tự luận (upload ảnh)', color: '#d97706', shortLabel: 'Tự luận' },
  'TIẾNG ANH': { label: 'Trắc nghiệm',   color: '#0f766e', shortLabel: 'Tiếng Anh' },
  'READING':   { label: 'Bài đọc',       color: '#0e7490', shortLabel: 'Reading' },
}

let _uidSeq = Date.now()
function nextUid() { return `q${++_uidSeq}` }
function ensureUid(q) { return q._uid ? q : { ...q, _uid: nextUid() } }

function emptyMCQ(num, sec = 'PHẦN I') {
  return { _uid: nextUid(), question_number: num, section: sec, question_text: '', has_figure: false,
    choices: { A: '', B: '', C: '', D: '' }, answer: null, points: 0.25,
    passage_title: null, passage_text: null }
}
function emptyTF(num) {
  return { _uid: nextUid(), question_number: num, section: 'PHẦN II', question_text: '', has_figure: false,
    sub_questions: [
      { label: 'a', text: '', correct_answer: true },
      { label: 'b', text: '', correct_answer: false },
      { label: 'c', text: '', correct_answer: true },
      { label: 'd', text: '', correct_answer: false },
    ], points: null }
}
function emptyShort(num) {
  return { _uid: nextUid(), question_number: num, section: 'PHẦN III', question_text: '', has_figure: false,
    answer: '', points: null }
}
function emptyEssay(num) {
  return { _uid: nextUid(), question_number: num, section: 'TỰ LUẬN', question_text: '', has_figure: false,
    answer: '', points: 1.0 }   // points = điểm tối đa GV chấm tay; answer = gợi ý chấm (tùy chọn)
}
const EMPTY_FN = {
  'PHẦN I':    (n) => emptyMCQ(n, 'PHẦN I'),
  'PHẦN II':   emptyTF,
  'PHẦN III':  emptyShort,
  'TỰ LUẬN':   emptyEssay,
  'TIẾNG ANH': (n) => emptyMCQ(n, 'TIẾNG ANH'),
  'READING':   (n) => ({ ...emptyMCQ(n, 'READING'), passage_group: 1 }),
}

/* ── Insert-between button ── */
function InsertRow({ onClick, show }) {
  return (
    <div className={`rs-insert-row${show ? '' : ' rs-insert-row--hidden'}`}>
      <button className="rs-insert-btn" onClick={onClick} type="button" title="Thêm câu hỏi tại đây">
        + Thêm
      </button>
    </div>
  )
}

/* ── Checks whether a mousedown is on the card's drag edge / handle ── */
function isDragTrigger(e, wrapperEl) {
  // Always allow from the explicit drag handle
  if (e.target.closest('[data-drag-handle]')) return true
  // Block if on any interactive element
  if (e.target.closest('input, textarea, button, select, a, [contenteditable]')) return false
  // Allow from within 18px of any outer edge of the card wrapper
  const r = wrapperEl.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  const EDGE = 18
  return x < EDGE || x > r.width - EDGE || y < EDGE || y > r.height - EDGE
}

export default function ReviewStep({ result, title, onTitleChange, onPreview, onSave, subject = 'toan' }) {
  const effectiveSections = Object.keys(result.sections || {}).filter(sec => SECTION_META[sec])
  let sectionList = effectiveSections.length > 0 ? effectiveSections : MATH_SECTIONS
  // Đề Toán (kể cả trích từ PDF) luôn có sẵn tab Tự luận để GV thêm câu upload ảnh
  const isMathExam = sectionList.some(s => ['PHẦN I', 'PHẦN II', 'PHẦN III'].includes(s))
  if (isMathExam && !sectionList.includes('TỰ LUẬN')) sectionList = [...sectionList, 'TỰ LUẬN']

  const [activeSection, setActiveSection] = useState(sectionList[0] || 'PHẦN I')
  const [grade,         setGrade]         = useState('thpt')
  const [showMix,       setShowMix]       = useState(false)
  const [sections, setSections] = useState(() => {
    const s = {}
    sectionList.forEach(sec => {
      const rawQs = JSON.parse(JSON.stringify(result.sections[sec]?.questions || []))
      s[sec] = {
        ...(result.sections[sec] || { questions: [], points_per_q: 0.25 }),
        questions: rawQs.map(ensureUid),
      }
    })
    return s
  })
  const [highlightQ, setHighlightQ] = useState(null)
  const [toasts, setToasts]         = useState([])
  const jumpIdxRef = useRef(0)

  /* ── Drag state ── */
  const cardEls      = useRef({})   // { [_uid]: DOM wrapper element }
  const ghostEl      = useRef(null) // cloned DOM node appended to body
  const swapTargetRef = useRef(null)
  const [activeDragIdx, setActiveDragIdx] = useState(null)
  const [swapTarget,    setSwapTarget]    = useState(null) // { idx, zone: 'near'|'over', dir: 'up'|'down' }

  /* Cleanup ghost if component unmounts during drag */
  useEffect(() => () => {
    if (ghostEl.current) { document.body.removeChild(ghostEl.current); ghostEl.current = null }
  }, [])

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const totalQ = sectionList.reduce((s, sec) => s + (sections[sec]?.questions?.length ?? 0), 0)

  const unansweredList = sectionList.flatMap(sec =>
    (sections[sec]?.questions || [])
      .map((q, idx) => ({ sec, idx }))
      .filter(({ sec: s, idx: i }) => isUnanswered(sections[s].questions[i], s))
  )
  const unansweredCount = unansweredList.length

  const jumpToUnanswered = useCallback(() => {
    if (unansweredList.length === 0) return
    const i = jumpIdxRef.current % unansweredList.length
    jumpIdxRef.current++
    const { sec, idx } = unansweredList[i]
    setActiveSection(sec)
    setHighlightQ({ sec, idx })
  }, [unansweredList])

  const buildResult = useCallback(() => ({
    ...result,
    total_questions: totalQ,
    sections: Object.fromEntries(sectionList.map(sec => [sec, { ...sections[sec] }])),
  }), [result, sections, totalQ, sectionList])

  /* ── Per-question CRUD ── */
  const updateQuestion = (sec, idx, updated) => {
    setSections(prev => {
      const qs = [...prev[sec].questions]
      qs[idx] = updated
      return { ...prev, [sec]: { ...prev[sec], questions: qs } }
    })
  }

  const deleteQuestion = (sec, idx) => {
    setSections(prev => {
      const qs = prev[sec].questions
        .filter((_, i) => i !== idx)
        .map((q, i) => ({ ...q, question_number: i + 1 }))
      return { ...prev, [sec]: { ...prev[sec], questions: qs } }
    })
    addToast('Đã xoá câu hỏi', 'warn')
  }

  const addQuestion = (sec, atIdx = null) => {
    setSections(prev => {
      const qs = [...prev[sec].questions]
      const emptyFn = EMPTY_FN[sec] || ((n) => emptyMCQ(n, sec))
      const newQ = emptyFn(0)
      let newQs
      if (atIdx === null || atIdx >= qs.length) {
        newQs = [...qs, newQ]
      } else {
        newQs = [...qs.slice(0, atIdx), newQ, ...qs.slice(atIdx)]
      }
      return {
        ...prev,
        [sec]: { ...prev[sec], questions: newQs.map((q, i) => ({ ...q, question_number: i + 1 })) },
      }
    })
    addToast('Đã thêm câu hỏi mới', 'success')
  }

  const moveQuestion = useCallback((sec, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    setSections(prev => {
      const qs = [...prev[sec].questions]
      const [moved] = qs.splice(fromIdx, 1)
      qs.splice(toIdx, 0, moved)
      return {
        ...prev,
        [sec]: { ...prev[sec], questions: qs.map((q, i) => ({ ...q, question_number: i + 1 })) },
      }
    })
    addToast('Đã di chuyển câu hỏi', 'info')
  }, [addToast])

  const handleReport = ({ questionNum, section, type }) => {
    addToast(`Đã ghi nhận báo cáo: "${type}"`, 'success')
  }

  /* ══════════════════════════════════════════
     Custom mouse-drag system
  ══════════════════════════════════════════ */
  const startDrag = useCallback((idx, e) => {
    const qs  = sections[activeSection]?.questions ?? []
    const q   = qs[idx]
    if (!q?._uid) return

    const wrapper = cardEls.current[q._uid]
    if (!wrapper) return
    if (!isDragTrigger(e, wrapper)) return

    const cardDiv = wrapper.querySelector('.eq-card')
    if (!cardDiv) return

    const rect = wrapper.getBoundingClientRect()
    const offsetY = e.clientY - rect.top

    /* Clone the card and attach to body as ghost */
    const clone = cardDiv.cloneNode(true)
    Object.assign(clone.style, {
      position:     'fixed',
      top:          `${rect.top}px`,
      left:         `${rect.left}px`,
      width:        `${rect.width}px`,
      margin:       '0',
      pointerEvents:'none',
      zIndex:       '9998',
      opacity:      '0.94',
      transform:    'rotate(0.7deg) scale(1.025)',
      boxShadow:    '0 22px 64px rgba(0,0,0,0.28)',
      borderRadius: '14px',
      transition:   'none',
      cursor:       'grabbing',
    })
    document.body.appendChild(clone)
    ghostEl.current = clone

    setActiveDragIdx(idx)
    e.preventDefault()

    /* Capture section + qs + idx in closure — stable for the lifetime of this drag */
    const sec = activeSection

    const onMove = (me) => {
      if (!ghostEl.current) return
      ghostEl.current.style.top = `${me.clientY - offsetY}px`

      let found = null
      for (let i = 0; i < qs.length; i++) {
        if (i === idx) continue
        const el = cardEls.current[qs[i]._uid]
        if (!el) continue
        const r = el.getBoundingClientRect()
        const NEAR = 52
        if (me.clientY < r.top - NEAR || me.clientY > r.bottom + NEAR) continue

        const zone = (me.clientY >= r.top && me.clientY <= r.bottom) ? 'over' : 'near'
        const dir  = i > idx ? 'down' : 'up'
        if (!found || (zone === 'over' && found.zone === 'near')) found = { idx: i, zone, dir }
      }

      swapTargetRef.current = found
      setSwapTarget(prev => {
        if (!prev && !found) return prev
        if (!prev || !found || prev.idx !== found.idx || prev.zone !== found.zone) return found
        return prev
      })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',  onUp)

      if (ghostEl.current) {
        document.body.removeChild(ghostEl.current)
        ghostEl.current = null
      }

      const target = swapTargetRef.current
      if (target && target.idx !== idx) moveQuestion(sec, idx, target.idx)

      swapTargetRef.current = null
      setActiveDragIdx(null)
      setSwapTarget(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',  onUp)
  }, [sections, activeSection, moveQuestion])

  const questions  = sections[activeSection]?.questions ?? []
  const meta       = SECTION_META[activeSection] || { label: activeSection, color: '#475569', shortLabel: activeSection }
  const isDragging = activeDragIdx !== null

  return (
    <div className={`review-step${isDragging ? ' rs-is-drag-active' : ''}`}>

      {/* ── Sticky top bar ── */}
      <div className="rs-topbar">
        <div className="rs-topbar-left">
          <div className="rs-title-wrap">
            <input
              className="rs-title-input"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Tên đề thi…"
              maxLength={120}
            />
          </div>
          <div className="rs-meta-row">
            {SUBJECTS[subject] && (
              <span className={`rs-subject-pill subject-badge--${subject}`}>
                {SUBJECTS[subject].icon} {SUBJECTS[subject].label}
              </span>
            )}
            {subjectHasLabels(subject) && (
              <div className="rs-grade-toggle">
                <button className={`rs-grade-btn ${grade === 'thpt' ? 'active' : ''}`}
                  onClick={() => setGrade('thpt')} type="button">THPT</button>
                <button className={`rs-grade-btn ${grade === 'thcs' ? 'active' : ''}`}
                  onClick={() => setGrade('thcs')} type="button">THCS</button>
              </div>
            )}
            <button className="rs-mix-btn" type="button" onClick={() => setShowMix(true)}
              title="Tạo đề từ ngân hàng câu hỏi theo chủ đề">
              🎲 Phối đề
            </button>
          </div>
          <div className="rs-stats">
            {sectionList.map(sec => {
              const count = sections[sec]?.questions?.length ?? 0
              const m = SECTION_META[sec] || { shortLabel: sec, color: '#475569' }
              return (
                <span key={sec} className="rs-stat-pill" style={{ color: m.color, borderColor: m.color + '40' }}>
                  {m.shortLabel}: {count}
                </span>
              )
            })}
            <span className="rs-total">Tổng: {totalQ} câu</span>
            {unansweredCount > 0 ? (
              <button className="rs-no-ans-badge" onClick={jumpToUnanswered}>
                ⚠ {unansweredCount} câu chưa có đáp án →
              </button>
            ) : totalQ > 0 ? (
              <span className="rs-all-ans-badge">✓ Đủ đáp án</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Section tabs ── */}
      {sectionList.length > 1 && (
        <div className="rs-section-tabs">
          {sectionList.map(sec => {
            const count = sections[sec]?.questions?.length ?? 0
            const m = SECTION_META[sec] || { shortLabel: sec, label: sec, color: '#475569' }
            return (
              <button key={sec}
                className={`rs-tab ${activeSection === sec ? 'active' : ''}`}
                style={{ '--rs-color': m.color }}
                onClick={() => setActiveSection(sec)}
              >
                <span>{m.shortLabel} – {m.label}</span>
                <span className={`rs-tab-count ${activeSection === sec ? 'active' : ''}`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Question list ── */}
      <div className="rs-content">
        <div className="rs-section-header">
          <h2 style={{ color: meta.color }}>{meta.shortLabel} — {meta.label}</h2>
          <span className="rs-section-pts">
            {sections[activeSection]?.points_per_q ? `${sections[activeSection].points_per_q}đ / câu` : ''}
          </span>
        </div>

        {activeSection === 'READING' ? (
          <ReadingSection
            questions={questions}
            grade={grade}
            pointsPerQ={sections[activeSection]?.points_per_q}
            onReport={handleReport}
            onChange={(newQs) => setSections(prev => ({
              ...prev,
              READING: { ...prev.READING, questions: newQs },
            }))}
          />
        ) : questions.length === 0 ? (
          <div className="rs-empty">
            <div className="rs-empty-icon">📭</div>
            <p>Chưa có câu hỏi nào trong phần này</p>
            <button className="rs-add-btn" onClick={() => addQuestion(activeSection, 0)}>
              + Thêm câu hỏi đầu tiên
            </button>
          </div>
        ) : (
          <div className="rs-question-list">
            {/* Insert before first */}
            <InsertRow onClick={() => addQuestion(activeSection, 0)} show={!isDragging} />

            {questions.map((q, idx) => {
              const isActive  = activeDragIdx === idx
              const isSwap    = swapTarget?.idx === idx
              const swapZone  = isSwap ? swapTarget.zone : null
              const swapDir   = isSwap ? swapTarget.dir  : null

              const cls = [
                'rs-drag-wrapper',
                isActive  ? 'rs-is-dragging' : '',
                isSwap && swapZone === 'near' ? 'rs-swap-near' : '',
                isSwap && swapZone === 'over' ? `rs-swap-over rs-swap-${swapDir}` : '',
              ].filter(Boolean).join(' ')

              return (
                <React.Fragment key={q._uid}>
                  <div
                    className={cls}
                    ref={(el) => { if (el) cardEls.current[q._uid] = el; else delete cardEls.current[q._uid] }}
                    onMouseDown={(e) => startDrag(idx, e)}
                  >
                    <EditableQuestion
                      q={q}
                      index={idx}
                      subject={subject}
                      grade={grade}
                      pointsPerQ={sections[activeSection]?.points_per_q}
                      onUpdate={updated => updateQuestion(activeSection, idx, updated)}
                      onDelete={() => deleteQuestion(activeSection, idx)}
                      onReportSubmit={handleReport}
                      highlight={highlightQ?.sec === activeSection && highlightQ?.idx === idx}
                    />
                  </div>

                  {/* Insert after each card */}
                  <InsertRow onClick={() => addQuestion(activeSection, idx + 1)} show={!isDragging} />
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Sticky bottom CTA ── */}
      <div className="rs-bottom-bar">
        <div className="rs-bottom-left">
          <span className="rs-bottom-count">{totalQ} câu hỏi đã sẵn sàng</span>
        </div>
        <div className="rs-bottom-right">
          <button className="rs-preview-btn" onClick={() => onPreview(buildResult())}>
            👁 Xem trước
          </button>
          {onSave && (
            <button className="rs-save-btn" disabled={totalQ === 0} onClick={() => onSave(buildResult())}>
              💾 Lưu lại
            </button>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div className="rs-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`rs-toast rs-toast--${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {showMix && (
        <MixExamModal
          subject={subject}
          grade={grade}
          onClose={() => setShowMix(false)}
          onAddQuestions={(qs) => {
            const sec = activeSection
            setSections(prev => {
              const existing = prev[sec]?.questions || []
              const offset   = existing.length
              const newQs    = qs.map((q, i) => ({
                ...q,
                _uid: nextUid(),
                question_number: offset + i + 1,
                section: sec,
              }))
              return { ...prev, [sec]: { ...prev[sec], questions: [...existing, ...newQs] } }
            })
            setShowMix(false)
            addToast(`Đã thêm ${qs.length} câu từ ngân hàng`, 'success')
          }}
        />
      )}
    </div>
  )
}

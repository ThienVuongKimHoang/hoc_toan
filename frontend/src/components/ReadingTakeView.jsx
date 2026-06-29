import React, { useRef, useState } from 'react'
import MathText from './MathText.jsx'
import './ReadingTakeView.css'

/* ════════════════════════════════════════════════════════
   Reading (làm bài) — bố cục 2 cột:
     • Trái:  bài đọc (tiêu đề nổi bật, danh sách, chỗ trống tương tác)
     • Phải:  câu hỏi (cloze chỉ hiện "Question N" + ABCD)
   Bài điền từ: click chỗ trống (N) trong đoạn văn → nhảy tới câu N;
   chọn đáp án → chữ cái hiện ngay tại chỗ trống.
════════════════════════════════════════════════════════ */

/* HTML (đã chỉnh trong editor) → text thuần có xuống dòng */
function normalizeToText(s) {
  if (!s) return ''
  if (/<(br|div|p|li|ul|ol|strong|em|u|b|i|span)\b/i.test(s)) {
    return s
      .replace(/<\/(div|p|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  return s
}

/* Gom câu hỏi theo passage_group, lấy đoạn văn + tiêu đề từ anchor */
function groupByPassage(questions) {
  const groups = []
  const idx = new Map()
  ;(questions || []).forEach(q => {
    const gid = q.passage_group ?? 1
    if (!idx.has(gid)) {
      const g = { gid, items: [], passage_text: null, passage_title: null }
      idx.set(gid, g); groups.push(g)
    }
    const g = idx.get(gid)
    g.items.push(q)
    if (q.passage_text && !g.passage_text)   g.passage_text  = q.passage_text
    if (q.passage_title && !g.passage_title) g.passage_title = q.passage_title
  })
  return groups
}

/* Đồng bộ số chỗ trống với số câu hỏi.
   Các chỗ trống "(N) ____" trong đoạn văn có thể mang số GỐC của đề (10, 11…)
   trong khi câu hỏi đã được đánh số lại (1, 2…). Ta map theo THỨ TỰ: chỗ trống
   thứ k ↦ câu hỏi thứ k của nhóm, ghi lại số cho khớp, và bổ sung "______"
   cho những chỗ trống bị thiếu gạch dưới (lỗi khi trích từ PDF).
   Trả về { text: đoạn văn đã sửa, blanks: Set<số câu là chỗ trống> }. */
export function remapPassageBlanks(passageText, qnums) {
  const blanks = new Set()
  if (!passageText) return { text: passageText || '', blanks }
  // Chỉ coi là bài điền từ nếu có ÍT NHẤT một chỗ trống "(N) ____" có gạch dưới.
  if (!/\(\s*\d+\s*\)\s*_+/.test(passageText)) return { text: passageText, blanks }

  let k = 0
  const text = passageText.replace(/\(\s*\d+\s*\)(\s*_*)/g, (m, tail) => {
    const qn = qnums[k]; k++
    if (qn == null) return m
    blanks.add(qn)
    const slot = /_/.test(tail) ? tail : ' ______'   // bù chỗ trống nếu thiếu gạch dưới
    return `(${qn})${slot}`
  })
  return { text, blanks }
}

/* Render 1 dòng — giữ nguyên text (kể cả "____"), chỉ "(N)" thành nút nhảy câu hỏi */
function renderInline(text, blankNums, answers, onBlankJump) {
  const re = /\(\s*(\d{1,3})\s*\)/g
  const nodes = []
  let last = 0, m, k = 0
  while ((m = re.exec(text)) !== null) {
    const num = parseInt(m[1], 10)
    if (!blankNums.has(num)) continue            // (N) không phải chỗ trống → giữ nguyên
    if (m.index > last) nodes.push(<span key={k++}>{text.slice(last, m.index)}</span>)
    const ans = answers[num]
    nodes.push(
      <button
        key={k++}
        type="button"
        className={`rt-gap ${ans ? 'answered' : ''}`}
        onClick={() => onBlankJump(num)}
        title={`Câu ${num} — bấm để tới câu hỏi`}
      >
        ({num}){ans ? <sup className="rt-gap-ans">{ans}</sup> : null}
      </button>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(<span key={k++}>{text.slice(last)}</span>)
  return nodes.length ? nodes : text
}

/* Thân đoạn văn: tách đoạn / danh sách, chèn chỗ trống tương tác */
function PassageBody({ text, blankNums, answers, onBlankJump }) {
  const lines = normalizeToText(text).split('\n')
  const blocks = []
  let curList = null
  lines.forEach(raw => {
    const t = raw.trim()
    if (!t) { curList = null; return }
    if (/^[•▪◦‣·-]\s+/.test(t) || t.startsWith('•')) {
      if (!curList) { curList = { type: 'ul', items: [] }; blocks.push(curList) }
      curList.items.push(t.replace(/^[•▪◦‣·-]\s*/, ''))
    } else {
      curList = null
      blocks.push({ type: 'p', text: t })
    }
  })

  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="rt-list">
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it, blankNums, answers, onBlankJump)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="rt-para">{renderInline(b.text, blankNums, answers, onBlankJump)}</p>
        )
      )}
    </>
  )
}

/* Một câu hỏi (cột phải) — cloze ẩn phần đề, chỉ "Question N" + ABCD */
function ReadingQuestion({ q, examMode, isCloze, selected, onSelect, flash, registerRef }) {
  const correct = q.answer
  const locked = !examMode && correct != null && selected != null

  const getState = (key) => {
    if (examMode) return selected === key ? 'selected' : ''
    if (selected == null) return ''
    if (correct == null) return selected === key ? 'selected' : ''
    if (key === correct) return 'correct'
    if (key === selected) return 'wrong'
    return ''
  }

  return (
    <div
      ref={el => registerRef(q.question_number, el)}
      className={`rt-q ${flash ? 'flash' : ''} ${isCloze ? 'cloze' : ''}`}
    >
      <div className="rt-q-head">
        <span className="rt-q-num">Question {q.question_number}</span>
        {q.points ? <span className="rt-q-pts">{q.points}đ</span> : null}
        {correct == null && <span className="rt-q-noans">—</span>}
      </div>

      {!isCloze && q.question_text && (
        <p className="rt-q-stem"><MathText text={q.question_text} /></p>
      )}

      <div className={`rt-q-choices ${isCloze ? 'horizontal' : ''}`}>
        {['A', 'B', 'C', 'D'].map(key => (
          <button
            key={key}
            type="button"
            className={`rt-choice ${getState(key)}`}
            onClick={() => !locked && onSelect(q, key)}
            disabled={locked}
          >
            <span className="rt-choice-letter">{key}</span>
            <span className="rt-choice-text"><MathText text={q.choices?.[key] || ''} /></span>
          </button>
        ))}
      </div>

      {!examMode && selected != null && correct != null && (
        <p className={`rt-q-feedback ${selected === correct ? 'ok' : 'no'}`}>
          {selected === correct ? `✓ Đúng (${correct})` : `✗ Sai — đáp án: ${correct}`}
        </p>
      )}
    </div>
  )
}

const FONT_STEPS = [0.9, 1, 1.12, 1.28, 1.45, 1.65]

export default function ReadingTakeView({ questions, examMode = false, onAnswerChange }) {
  const groups = groupByPassage(questions)
  const [cur, setCur] = useState(0)
  const [answers, setAnswers] = useState({})       // { questionNumber: 'A' }
  const [flashQ, setFlashQ] = useState(null)
  const [fontIdx, setFontIdx] = useState(1)
  const [reader, setReader] = useState(false)       // chế độ đọc toàn màn hình
  const qRefs = useRef({})

  if (groups.length === 0) {
    return <p className="empty-msg">Không có bài đọc nào trong phần này.</p>
  }

  const active = Math.min(cur, groups.length - 1)
  const g = groups[active]
  const { text: passageText, blanks: blankNums } =
    remapPassageBlanks(g.passage_text || '', g.items.map(q => q.question_number))
  const fontScale = FONT_STEPS[fontIdx]

  const goTo = (i) => { setCur(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const handleSelect = (q, key) => {
    const num = q.question_number
    if (!examMode && q.answer != null && answers[num] != null) return
    setAnswers(prev => ({ ...prev, [num]: key }))
    onAnswerChange?.(`RD_${num}`, key)
  }

  const registerRef = (num, el) => { if (el) qRefs.current[num] = el }

  const jumpToQuestion = (num) => {
    if (reader) setReader(false)
    requestAnimationFrame(() => {
      const el = qRefs.current[num]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashQ(num)
      setTimeout(() => setFlashQ(f => (f === num ? null : f)), 1400)
    })
  }

  const zoomOut = () => setFontIdx(i => Math.max(0, i - 1))
  const zoomIn  = () => setFontIdx(i => Math.min(FONT_STEPS.length - 1, i + 1))

  const passageToolbar = (
    <div className="rt-passage-tools">
      <button type="button" className="rt-tool" onClick={zoomOut} disabled={fontIdx === 0} title="Thu nhỏ chữ">A−</button>
      <button type="button" className="rt-tool" onClick={zoomIn} disabled={fontIdx === FONT_STEPS.length - 1} title="Phóng to chữ">A+</button>
      <button type="button" className="rt-tool rt-tool-reader" onClick={() => setReader(true)} title="Chế độ đọc toàn màn hình">⤢ Đọc</button>
    </div>
  )

  const passageInner = (
    <>
      {g.passage_title && <h3 className="rt-passage-title">{g.passage_title}</h3>}
      <div className="rt-passage-body" style={{ fontSize: `${fontScale}rem` }}>
        <PassageBody
          text={passageText}
          blankNums={blankNums}
          answers={answers}
          onBlankJump={jumpToQuestion}
        />
      </div>
    </>
  )

  return (
    <div className="reading-take">
      {/* Tiến trình + chọn nhanh bài đọc */}
      <div className="rt-progress">
        <span className="rt-progress-label">
          📖 Bài đọc <strong>{active + 1}</strong> / {groups.length}
          <span className="rt-progress-sub">{g.items.length} câu</span>
        </span>
        <div className="rt-dots">
          {groups.map((gr, i) => (
            <button key={gr.gid}
              className={`rt-dot ${i === active ? 'active' : ''}`}
              onClick={() => goTo(i)}
              title={`Bài đọc ${i + 1} (${gr.items.length} câu)`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="rt-cols">
        {/* Cột trái: bài đọc */}
        <div className="rt-passage">
          <div className="rt-passage-head">
            <span className="rt-passage-eyebrow">Đoạn văn / Bài đọc</span>
            {passageToolbar}
          </div>
          <div className="rt-passage-scroll">
            {passageInner}
          </div>
          {blankNums.size > 0 && (
            <div className="rt-passage-hint">
              💡 Bấm vào số <span className="rt-blank-demo">(10)</span> trong bài đọc để nhảy tới câu hỏi tương ứng.
            </div>
          )}
        </div>

        {/* Cột phải: câu hỏi */}
        <div className="rt-questions">
          {g.items.map(q => (
            <ReadingQuestion
              key={`${q.section}-${q.question_number}`}
              q={q}
              examMode={examMode}
              isCloze={blankNums.has(q.question_number)}
              selected={answers[q.question_number] ?? null}
              onSelect={handleSelect}
              flash={flashQ === q.question_number}
              registerRef={registerRef}
            />
          ))}
        </div>
      </div>

      {/* Điều hướng bài đọc */}
      <div className="rt-nav">
        <button className="rt-nav-btn" disabled={active === 0} onClick={() => goTo(active - 1)}>
          ← Bài đọc trước
        </button>
        <span className="rt-nav-count">{active + 1} / {groups.length}</span>
        <button className="rt-nav-btn rt-nav-next" disabled={active >= groups.length - 1} onClick={() => goTo(active + 1)}>
          Bài đọc tiếp theo →
        </button>
      </div>

      {/* Chế độ đọc toàn màn hình */}
      {reader && (
        <div className="rt-reader-overlay" onClick={() => setReader(false)}>
          <div className="rt-reader-box" onClick={e => e.stopPropagation()}>
            <div className="rt-reader-bar">
              <span className="rt-reader-title">📖 Bài đọc {active + 1}</span>
              <div className="rt-passage-tools">
                <button type="button" className="rt-tool" onClick={zoomOut} disabled={fontIdx === 0}>A−</button>
                <button type="button" className="rt-tool" onClick={zoomIn} disabled={fontIdx === FONT_STEPS.length - 1}>A+</button>
                <button type="button" className="rt-tool" onClick={() => setReader(false)}>✕ Đóng</button>
              </div>
            </div>
            <div className="rt-reader-content">
              {passageInner}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

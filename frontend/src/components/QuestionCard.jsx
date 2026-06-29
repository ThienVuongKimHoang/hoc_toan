import React, { useEffect, useState } from 'react'
import MathText from './MathText.jsx'

const CONTENT_EDITABLE_TAG = /<(strong|em|u|b|i|div|br|span|p)\b/i

function toPassageHTML(text) {
  if (!text) return ''
  if (CONTENT_EDITABLE_TAG.test(text)) {
    return text
      .replace(/\n\n+/g, '<div class="passage-para-break"></div>')
      .replace(/\n/g, '<br>')
  }
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n+/g, '<div class="passage-para-break"></div>')
    .replace(/\n/g, '<br>')
}

function FigureImages({ path }) {
  if (!path) return null
  const src = `/images/${path.replace('images/', '')}`
  return (
    <div className="figure-images">
      <img src={src} alt="Hình vẽ minh họa" className="figure-img" loading="lazy" />
    </div>
  )
}

function PassageBlock({ title, text }) {
  const [collapsed, setCollapsed] = useState(false)
  if (!text) return null
  return (
    <div className="passage-block">
      <div className="passage-header" onClick={() => setCollapsed(v => !v)}>
        <span className="passage-label">{title || 'Đoạn văn / Bài đọc'}</span>
        <span className="passage-toggle">{collapsed ? '▼ Xem' : '▲ Thu gọn'}</span>
      </div>
      {!collapsed && (
        <div className="passage-text"
          dangerouslySetInnerHTML={{ __html: toPassageHTML(text) }} />
      )}
    </div>
  )
}

/* ── Trắc nghiệm 1 đáp án (PHẦN I Toán + Tiếng Anh) ── */
function MultipleChoiceCard({ q, examMode, onAnswerChange, hidePassage = false }) {
  const [selected, setSelected] = useState(null)
  const correct = q.answer  // null nếu không có đáp án

  const handleSelect = (key) => {
    if (examMode) {
      setSelected(key)
      onAnswerChange?.(key)
      return
    }
    // Practice mode: lock sau khi chọn (nếu có đáp án), hoặc cho toggle (nếu không có)
    if (correct !== null && selected !== null) return
    setSelected(key)
    onAnswerChange?.(key)
  }

  const getState = (key) => {
    if (examMode) return selected === key ? 'selected' : ''
    if (selected === null) return ''
    if (correct === null) return selected === key ? 'selected' : ''  // chưa có đáp án
    if (key === correct) return 'correct'
    if (key === selected) return 'wrong'
    return ''
  }

  return (
    <div className="q-body">
      {!hidePassage && <PassageBlock title={q.passage_title} text={q.passage_text} />}
      <p className="q-text"><MathText text={q.question_text} /></p>
      <FigureImages path={q.figure_path} />
      <div className="choices">
        {Object.entries(q.choices || {}).map(([key, val]) => (
          <button
            key={key}
            className={`choice-btn ${getState(key)}`}
            onClick={() => handleSelect(key)}
            disabled={!examMode && correct !== null && selected !== null}
          >
            <span className="choice-label">{key}.</span>
            <span className="choice-text"><MathText text={val} /></span>
          </button>
        ))}
      </div>
      {!examMode && selected !== null && correct !== null && (
        <p className={`answer-feedback ${selected === correct ? 'correct' : 'wrong'}`}>
          {selected === correct
            ? `✓ Đúng! Đáp án: ${correct}`
            : `✗ Sai! Đáp án đúng là: ${correct}`}
        </p>
      )}
      {!examMode && selected !== null && correct === null && (
        <p className="answer-feedback neutral">Chưa có đáp án chính thức cho câu này.</p>
      )}
    </div>
  )
}

/* ── PHẦN II: Đúng/Sai ── */
function TrueFalseCard({ q, examMode, onAnswerChange }) {
  const [answers, setAnswers] = useState({})
  const subs = q.sub_questions || []

  const toggle = (label, val) => {
    const next = { ...answers, [label]: answers[label] === val ? undefined : val }
    setAnswers(next)
    onAnswerChange?.(next)
  }

  const getResult = (sub) => {
    if (examMode) return null
    const userAns = answers[sub.label]
    if (userAns === undefined || sub.correct_answer === null) return null
    return userAns === sub.correct_answer ? 'correct' : 'wrong'
  }

  return (
    <div className="q-body">
      <p className="q-text"><MathText text={q.question_text} /></p>
      <FigureImages path={q.figure_path} />
      <div className="sub-questions">
        {subs.map((sub) => {
          const result = getResult(sub)
          return (
            <div key={sub.label} className={`sub-row ${result || ''}`}>
              <span className="sub-label">{sub.label})</span>
              <span className="sub-text"><MathText text={sub.text} /></span>
              <div className="tf-buttons">
                <button
                  className={`tf-btn true-btn ${answers[sub.label] === true ? 'active' : ''}`}
                  onClick={() => toggle(sub.label, true)}
                >Đúng</button>
                <button
                  className={`tf-btn false-btn ${answers[sub.label] === false ? 'active' : ''}`}
                  onClick={() => toggle(sub.label, false)}
                >Sai</button>
              </div>
              {!examMode && result && (
                <span className={`sub-result ${result}`}>
                  {result === 'correct' ? '✓' : `✗ (${sub.correct_answer ? 'Đúng' : 'Sai'})`}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── PHẦN III: trả lời ngắn ── */
function ShortAnswerCard({ q, examMode, onAnswerChange }) {
  const [value, setValue]       = useState('')
  const [submitted, setSubmitted] = useState(false)
  const correct = q.answer

  const check = () => { if (value.trim()) setSubmitted(true) }

  const isCorrect = correct && value.trim().toLowerCase() === correct.toString().toLowerCase()

  if (examMode) {
    return (
      <div className="q-body">
        <p className="q-text"><MathText text={q.question_text} /></p>
        <FigureImages path={q.figure_path} />
        <div className="short-answer-row">
          <input
            className="short-input"
            type="text"
            placeholder="Nhập đáp án…"
            value={value}
            onChange={e => { setValue(e.target.value); onAnswerChange?.(e.target.value) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="q-body">
      <p className="q-text"><MathText text={q.question_text} /></p>
      <FigureImages path={q.figure_path} />
      <div className="short-answer-row">
        <input
          className="short-input"
          type="text"
          placeholder="Nhập đáp án…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSubmitted(false); onAnswerChange?.(e.target.value) }}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          disabled={submitted && isCorrect}
        />
        <button className="check-btn" onClick={check} disabled={!value.trim()}>
          Kiểm tra
        </button>
      </div>
      {submitted && correct && (
        <p className={`answer-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
          {isCorrect ? `✓ Chính xác!` : `✗ Chưa đúng. Đáp án: ${correct}`}
        </p>
      )}
      {submitted && !correct && (
        <p className="answer-feedback neutral">Chưa có đáp án mẫu.</p>
      )}
    </div>
  )
}

/* ── Card tổng hợp ── */
const SECTION_CLASS = {
  'PHẦN I':    'phan-1',
  'PHẦN II':   'phan-2',
  'PHẦN III':  'phan-3',
  'TIẾNG ANH': 'phan-english',
  'READING':   'phan-english',
}
const SECTION_PREFIX = {
  'PHẦN I':    'I',
  'PHẦN II':   'II',
  'PHẦN III':  'III',
  'TIẾNG ANH': 'EN',
  'READING':   'RD',
}

function _isMultipleChoice(q) {
  return q.section === 'PHẦN I' || q.section === 'TIẾNG ANH' || q.section === 'READING'
}

export default function QuestionCard({ q, index, examMode = false, onAnswerChange, hidePassage = false }) {
  const [expanded, setExpanded] = useState(true)
  const points   = q.points ? `${q.points}đ` : ''
  const secClass = SECTION_CLASS[q.section] || 'phan-1'
  const prefix   = SECTION_PREFIX[q.section] || 'I'
  const qKey     = `${prefix}_${q.question_number}`

  const handleChange = (ans) => onAnswerChange?.(qKey, ans)

  const hasAnswer = q.answer != null
  const isEnglish = q.section === 'TIẾNG ANH' || q.section === 'READING'

  return (
    <div className={`question-card ${secClass}`}>
      <div className="q-header" onClick={() => setExpanded(v => !v)}>
        <span className="q-num">
          {isEnglish ? `Question ${q.question_number}` : `Câu ${q.question_number}`}
        </span>
        {points && <span className="q-points">{points}</span>}
        {q.has_figure && <span className="q-badge img-badge">📷 Hình</span>}
        {isEnglish && !hasAnswer && <span className="q-badge no-ans-badge">—</span>}
        <span className="q-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        _isMultipleChoice(q) ? (
          <MultipleChoiceCard q={q} examMode={examMode} onAnswerChange={handleChange} hidePassage={hidePassage} />
        ) : q.section === 'PHẦN II' ? (
          <TrueFalseCard q={q} examMode={examMode} onAnswerChange={handleChange} />
        ) : (
          <ShortAnswerCard q={q} examMode={examMode} onAnswerChange={handleChange} />
        )
      )}
    </div>
  )
}

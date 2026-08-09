import { useState, useEffect, useRef, useCallback } from 'react'
import { generateExamples } from '../store/vocabStore.js'
import { IconX, IconPencil, IconFlame, IconTrophy, IconRefresh, IconCheck, IconLoader, IconLightbulb } from './VocabIcons.jsx'
import { categoryLabel } from '../utils/vocabCategories.js'

function Score({ correct, wrong }) {
  return (
    <>
      <span className="vp-ok"><IconCheck size={12} sw={2.4} /> {correct}</span>
      <span className="vp-no"><IconX size={12} sw={2.4} /> {wrong}</span>
    </>
  )
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function makeBlank(sentence, word) {
  const regex = new RegExp(`\\b(${word}(?:s|ed|ing|er|est|ly)?)\\b`, 'gi')
  return sentence.replace(regex, m => '_'.repeat(m.length))
}

function isCorrect(input, word) {
  const i = input.trim().toLowerCase()
  const w = word.toLowerCase()
  if (i === w) return true
  const variants = [w, w + 's', w + 'ed', w + 'ing', w + 'er', w + 'ly', w + 'est',
    w.replace(/e$/, 'ing'), w.replace(/e$/, 'ed'), w.replace(/y$/, 'ies')]
  return variants.includes(i)
}

function wordMask(word) {
  return word.split('').map((_, i) => <span key={i} className="vp-mask-letter">_</span>)
}

const STREAK_MSGS = ['', '', '2', '3', '4', '5 · Xuất sắc!', '6 · Tuyệt vời!', '7 · Không thể tin được!']

export default function FillBlankPractice({ words, onClose, onRecordResult }) {
  const [pool] = useState(() => shuffle(words))
  const [idx, setIdx] = useState(0)
  const [sentence, setSentence] = useState(null)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [state, setState] = useState('idle')
  const [score, setScore] = useState({ correct: 0, wrong: 0, skipped: 0 })
  const [streak, setStreak] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef(null)

  const current = pool[idx] || null

  useEffect(() => {
    if (!current) return
    setSentence(null)
    setState('idle')
    setInput('')
    setShowHint(false)
    loadSentence(current)
  }, [idx, current?.id])

  useEffect(() => {
    if (sentence && state === 'idle') inputRef.current?.focus()
  }, [sentence, state])

  // Luôn dùng Groq — câu ví dụ gốc trích từ PDF bị lỗi dính chữ mất khoảng trắng
  async function loadSentence(word) {
    setLoading(true)
    try {
      const data = await generateExamples(word.word, word.vietnamese)
      const ex = data.examples?.find(e => e.english?.toLowerCase().includes(word.word.toLowerCase())) || data.examples?.[0]
      if (ex?.english) {
        setSentence({ original: ex.english, blanked: makeBlank(ex.english, word.word), viet: ex.vietnamese })
      } else {
        setSentence(null)
      }
    } catch {
      setSentence(null)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (state !== 'idle' || !sentence?.blanked) return
    const correct = isCorrect(input, current.word)
    setState(correct ? 'correct' : 'wrong')
    onRecordResult(current.id, correct)
    setScore(s => ({ ...s, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }))
    setStreak(s => (correct ? s + 1 : 0))
  }

  function next() {
    if (idx + 1 >= pool.length) { setFinished(true); return }
    setIdx(i => i + 1)
  }

  function skip() {
    setScore(s => ({ ...s, skipped: s.skipped + 1 }))
    setStreak(0)
    next()
  }

  const restart = useCallback(() => {
    setIdx(0)
    setScore({ correct: 0, wrong: 0, skipped: 0 })
    setStreak(0)
    setFinished(false)
    setState('idle')
    setInput('')
  }, [])

  function highlight(text, word) {
    const parts = text.split(new RegExp(`(\\b${word}(?:s|ed|ing|er|est|ly)?\\b)`, 'gi'))
    return parts.map((p, i) => p.toLowerCase().startsWith(word.toLowerCase()) ? <mark key={i} className="vp-hl">{p}</mark> : p)
  }

  if (finished) {
    const total = score.correct + score.wrong + score.skipped
    const pct = total ? Math.round((score.correct / total) * 100) : 0
    return (
      <div className="vp-practice-overlay">
        <div className="vp-practice-box vp-result-box">
          <IconTrophy size={40} style={{ color: 'var(--accentDark)' }} />
          <h2>Hoàn thành luyện tập!</h2>
          <div className="vp-fb-stats">
            <div className="vp-fb-stat ok"><span>{score.correct}</span>Đúng</div>
            <div className="vp-fb-stat no"><span>{score.wrong}</span>Sai</div>
            <div className="vp-fb-stat sk"><span>{score.skipped}</span>Bỏ qua</div>
          </div>
          <div className="vp-result-pct">{pct}% chính xác</div>
          <div className="vp-result-actions">
            <button className="vp-btn vp-btn--ghost" onClick={restart}><IconRefresh size={15} /> Làm lại</button>
            <button className="vp-btn vp-btn--primary" onClick={onClose}><IconCheck size={15} /> Xong</button>
          </div>
        </div>
      </div>
    )
  }

  const progress = pool.length ? (idx / pool.length) * 100 : 0
  const streakLabel = STREAK_MSGS[Math.min(streak, STREAK_MSGS.length - 1)]

  return (
    <div className="vp-practice-overlay">
      <div className="vp-practice-box">
        <div className="vp-practice-head">
          <span className="vp-practice-title"><IconPencil size={16} /> Điền vào chỗ trống</span>
          <div className="vp-practice-head-right">
            {streakLabel && <span className="vp-streak"><IconFlame size={14} style={{ color: 'var(--accentDark)' }} /> {streakLabel}</span>}
            <button className="vp-icon-btn" onClick={onClose} aria-label="Đóng"><IconX size={18} /></button>
          </div>
        </div>

        <div className="vp-progress-wrap"><div className="vp-progress-bar" style={{ width: `${progress}%` }} /></div>
        <div className="vp-counter">
          Câu {idx + 1} / {pool.length}
          <Score correct={score.correct} wrong={score.wrong} />
        </div>

        {current && (
          <div className="vp-fb-word-info">
            <div className="vp-mask-wrap">
              {wordMask(current.word)}
              <span className="vp-letter-count">({current.word.length} chữ cái)</span>
            </div>
            <div className="vp-fb-word-meta">
              <span>{current.pos}</span>
              <span className="vp-chip vp-chip--sm">{categoryLabel(current.category)}</span>
            </div>
          </div>
        )}

        <div className="vp-question-area">
          {loading && (
            <div className="vp-loading-area"><IconLoader size={22} /><p>AI đang tạo câu ví dụ...</p></div>
          )}

          {!loading && !sentence && (
            <div className="vp-error-box">
              <p>Không tạo được câu ví dụ cho từ này.</p>
              <button className="vp-btn vp-btn--sm vp-btn--ghost" onClick={skip}>Bỏ qua</button>
            </div>
          )}

          {!loading && sentence && (
            <>
              <div className="vp-fill-sentence-box">
                {state === 'idle' ? (
                  <p className="vp-fill-sentence">{sentence.blanked}</p>
                ) : (
                  <p className="vp-fill-sentence vp-fill-revealed">{highlight(sentence.original, current.word)}</p>
                )}
              </div>

              <div className="vp-hint-row">
                <span className="vp-viet-hint">{sentence.viet || current.vietnamese}</span>
                {state === 'idle' && (
                  <button className="vp-hint-btn" onClick={() => setShowHint(true)} disabled={showHint}>
                    <IconLightbulb size={14} />
                    {showHint ? `${current.word[0].toUpperCase()}${'_ '.repeat(current.word.length - 1).trim()}` : 'Gợi ý'}
                  </button>
                )}
              </div>

              {state === 'idle' ? (
                <form onSubmit={handleSubmit} className="vp-fill-form">
                  <input ref={inputRef} className="vp-fill-input" value={input} onChange={e => setInput(e.target.value)}
                    placeholder="Nhập từ còn thiếu..." autoComplete="off" spellCheck={false} />
                  <button type="submit" className="vp-btn vp-btn--primary" disabled={!input.trim()}>Kiểm tra</button>
                </form>
              ) : (
                <div className={`vp-fill-result ${state}`}>
                  {state === 'correct' ? (
                    <span>Chính xác! <strong>{current.word}</strong></span>
                  ) : (
                    <span>Sai. Đáp án đúng: <strong>{current.word}</strong>{input && <em> (bạn nhập: "{input}")</em>}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="vp-practice-foot">
          {state === 'idle'
            ? <button className="vp-btn vp-btn--ghost" onClick={skip}>Bỏ qua</button>
            : <button className="vp-btn vp-btn--primary" onClick={next}>{idx + 1 >= pool.length ? 'Xem kết quả' : 'Tiếp theo'}</button>}
        </div>
      </div>
    </div>
  )
}

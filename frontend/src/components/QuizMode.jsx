import { useState, useEffect, useCallback } from 'react'
import { generateExamples } from '../store/vocabStore.js'
import { IconX, IconTarget, IconTrophy, IconRefresh, IconCheck, IconLoader } from './VocabIcons.jsx'

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

function pickWrongOptions(correctWord, allWords) {
  const others = allWords.filter(w => w.id !== correctWord.id && w.vietnamese)
  return shuffle(others).slice(0, 3)
}

function buildFillBlank(word, example) {
  if (!example) return null
  const regex = new RegExp(`\\b${word}\\b`, 'gi')
  if (!regex.test(example)) return null
  return example.replace(regex, '_____')
}

const QUESTION_TYPES = ['mc_en_vi', 'mc_vi_en', 'fill_blank']

function buildMCQuestion(word, allWords, type) {
  const wrongOpts = pickWrongOptions(word, allWords)
  const options = shuffle([word, ...wrongOpts])
  return { type, word, options, correctId: word.id }
}

function buildQuestion(queueWords, allWords, index) {
  const word = queueWords[index % queueWords.length]
  const fullWord = allWords.find(w => w.id === word.id) || word
  const type = QUESTION_TYPES[index % QUESTION_TYPES.length]

  if (type === 'fill_blank') {
    const blank = buildFillBlank(fullWord.word, fullWord.example)
    if (!blank) return buildMCQuestion(fullWord, allWords, 'mc_en_vi')
    return { type: 'fill_blank', word: fullWord, blank, hint: fullWord.vietnamese }
  }
  return buildMCQuestion(fullWord, allWords, type)
}

export default function QuizMode({ queueWords, allWords, onClose, onRecordResult }) {
  const [index, setIndex] = useState(0)
  const [questions, setQuestions] = useState([])
  const [selected, setSelected] = useState(null)
  const [fillInput, setFillInput] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ correct: 0, wrong: 0 })
  const [finished, setFinished] = useState(false)
  const [aiExample, setAiExample] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)

  useEffect(() => {
    setQuestions(queueWords.map((_, i) => buildQuestion(queueWords, allWords, i)))
  }, [queueWords, allWords])

  const current = questions[index]

  useEffect(() => {
    if (!current) return
    setAiExample(null)
    if (current.type === 'fill_blank' && !current.word.example) {
      setLoadingAI(true)
      generateExamples(current.word.word, current.word.vietnamese)
        .then(data => {
          const ex = data.examples?.[0]?.english || ''
          const blank = buildFillBlank(current.word.word, ex)
          if (blank) setAiExample({ blank, original: ex })
        })
        .catch(() => {})
        .finally(() => setLoadingAI(false))
    }
  }, [current])

  const handleAnswer = useCallback((isCorrect) => {
    onRecordResult(current.word.id, isCorrect)
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), wrong: s.wrong + (isCorrect ? 0 : 1) }))
    setRevealed(true)
  }, [current, onRecordResult])

  function handleMCSelect(optionId) {
    if (revealed) return
    setSelected(optionId)
    handleAnswer(optionId === current.correctId)
  }

  function handleFillSubmit(e) {
    e.preventDefault()
    if (revealed) return
    const answer = fillInput.trim().toLowerCase()
    const correct = current.word.word.toLowerCase()
    handleAnswer(answer === correct)
    setRevealed(true)
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) { setFinished(true); return }
    setIndex(i => i + 1)
    setSelected(null)
    setFillInput('')
    setRevealed(false)
    setAiExample(null)
  }

  if (!questions.length || !current) {
    return (
      <div className="vp-practice-overlay">
        <div className="vp-practice-box"><p>Đang tải câu hỏi...</p></div>
      </div>
    )
  }

  if (finished) {
    const total = score.correct + score.wrong
    const pct = total ? Math.round((score.correct / total) * 100) : 0
    return (
      <div className="vp-practice-overlay">
        <div className="vp-practice-box vp-result-box">
          <IconTrophy size={40} style={{ color: 'var(--accentDark)' }} />
          <h2>Kết quả kiểm tra</h2>
          <div className="vp-result-score"><span>{score.correct}</span><em>/</em><span className="vp-result-total">{total}</span></div>
          <p className="vp-result-pct">{pct}% chính xác</p>
          <p className="vp-result-msg">
            {pct >= 80 ? 'Xuất sắc! Bạn đã nắm vững các từ này.' : pct >= 60 ? 'Khá tốt! Hãy ôn lại những từ còn sai.' : 'Hãy ôn lại nhiều hơn nhé!'}
          </p>
          <div className="vp-result-actions">
            <button className="vp-btn vp-btn--ghost" onClick={() => { setIndex(0); setScore({ correct: 0, wrong: 0 }); setFinished(false); setRevealed(false); setSelected(null); setFillInput('') }}>
              <IconRefresh size={15} /> Làm lại
            </button>
            <button className="vp-btn vp-btn--primary" onClick={onClose}><IconCheck size={15} /> Xong</button>
          </div>
        </div>
      </div>
    )
  }

  const progress = (index / questions.length) * 100
  const blank = aiExample?.blank || current.blank
  const originalSentence = aiExample?.original || current.word?.example

  return (
    <div className="vp-practice-overlay">
      <div className="vp-practice-box">
        <div className="vp-practice-head">
          <span className="vp-practice-title"><IconTarget size={17} /> Kiểm tra từ vựng</span>
          <button className="vp-icon-btn" onClick={onClose} aria-label="Đóng"><IconX size={18} /></button>
        </div>

        <div className="vp-progress-wrap"><div className="vp-progress-bar" style={{ width: `${progress}%` }} /></div>
        <div className="vp-counter">
          Câu {index + 1} / {questions.length}
          <Score correct={score.correct} wrong={score.wrong} />
        </div>

        <div className="vp-question-area">
          {current.type === 'mc_en_vi' && (
            <>
              <p className="vp-q-label">Từ tiếng Anh này có nghĩa là gì?</p>
              <div className="vp-q-word">{current.word.word}</div>
              <p className="vp-q-pos">{current.word.pos}</p>
              <div className="vp-mc-options">
                {current.options.map(opt => {
                  const isCorrect = opt.id === current.correctId
                  const isSelected = selected === opt.id
                  let cls = 'vp-mc-option'
                  if (revealed) { if (isCorrect) cls += ' correct'; else if (isSelected) cls += ' wrong' }
                  else if (isSelected) cls += ' selected'
                  return <button key={opt.id} className={cls} onClick={() => handleMCSelect(opt.id)} disabled={revealed}>{opt.vietnamese}</button>
                })}
              </div>
            </>
          )}

          {current.type === 'mc_vi_en' && (
            <>
              <p className="vp-q-label">Nghĩa tiếng Việt này ứng với từ nào?</p>
              <div className="vp-q-word vp-q-viet">{current.word.vietnamese}</div>
              <p className="vp-q-pos">{current.word.pos}</p>
              <div className="vp-mc-options">
                {current.options.map(opt => {
                  const isCorrect = opt.id === current.correctId
                  const isSelected = selected === opt.id
                  let cls = 'vp-mc-option'
                  if (revealed) { if (isCorrect) cls += ' correct'; else if (isSelected) cls += ' wrong' }
                  else if (isSelected) cls += ' selected'
                  return <button key={opt.id} className={cls} onClick={() => handleMCSelect(opt.id)} disabled={revealed}>{opt.word}</button>
                })}
              </div>
            </>
          )}

          {current.type === 'fill_blank' && (
            <>
              <p className="vp-q-label">Điền từ còn thiếu vào chỗ trống:</p>
              {loadingAI ? (
                <p className="vp-q-loading"><IconLoader size={14} /> Đang tạo câu hỏi...</p>
              ) : (
                <div className="vp-fill-sentence">{blank || `_____ (${current.word.pos})`}</div>
              )}
              <p className="vp-q-hint">Gợi ý: {current.word.vietnamese}</p>
              {!revealed ? (
                <form onSubmit={handleFillSubmit} className="vp-fill-form">
                  <input autoFocus className="vp-fill-input" value={fillInput} onChange={e => setFillInput(e.target.value)} placeholder="Nhập từ còn thiếu..." />
                  <button type="submit" className="vp-btn vp-btn--primary">Kiểm tra</button>
                </form>
              ) : (
                <div className={`vp-fill-result ${fillInput.trim().toLowerCase() === current.word.word.toLowerCase() ? 'correct' : 'wrong'}`}>
                  {fillInput.trim().toLowerCase() === current.word.word.toLowerCase() ? 'Chính xác!' : `Đáp án đúng: "${current.word.word}"`}
                  {originalSentence && <p className="vp-fill-original">{originalSentence}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {revealed && (
          <div className="vp-revealed">
            <div className="vp-revealed-answer">
              <strong>{current.word.word}</strong> ({current.word.pos}) — {current.word.vietnamese}
            </div>
            <button className="vp-btn vp-btn--primary" onClick={nextQuestion}>
              {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

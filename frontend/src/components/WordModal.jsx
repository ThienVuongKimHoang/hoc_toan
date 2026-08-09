import { useState, useEffect } from 'react'
import { generateExamples } from '../store/vocabStore.js'
import { tokenizeIpa } from '../utils/ipa.js'
import { IconX, IconSpeaker, IconBookmark, IconBookmarkFilled, IconRobot, IconRefresh, IconEye, IconLoader } from './VocabIcons.jsx'
import { categoryLabel } from '../utils/vocabCategories.js'

function speak(text) {
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.85
  window.speechSynthesis.speak(u)
}

function highlightWord(sentence, word) {
  const parts = sentence.split(new RegExp(`(\\b${word}s?\\b)`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase().startsWith(word.toLowerCase())
      ? <strong key={i} className="vp-hl">{part}</strong>
      : part
  )
}

export default function WordModal({ word, inQueue, onToggleQueue, onClose }) {
  const [examples, setExamples] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [revealed, setRevealed] = useState(() => new Set())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => { fetchExamples() }, [word.id])

  async function fetchExamples() {
    setLoading(true)
    setError(null)
    setRevealed(new Set())
    try {
      const data = await generateExamples(word.word, word.vietnamese)
      setExamples(data.examples)
    } catch {
      setError('Không thể tạo ví dụ. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const ipaTokens = word.ipa ? tokenizeIpa(word.ipa) : null

  return (
    <div className="vp-modal-overlay" onClick={onClose}>
      <div className="vp-modal-box" onClick={e => e.stopPropagation()}>
        <button className="vp-modal-close" onClick={onClose} aria-label="Đóng"><IconX size={18} /></button>

        <div className="vp-modal-word-row">
          <h2 className="vp-modal-word">{word.word}</h2>
          <button className="vp-icon-btn" onClick={() => speak(word.word)} title="Phát âm" aria-label="Phát âm">
            <IconSpeaker size={19} />
          </button>
          <button
            className={`vp-btn vp-btn--sm ${inQueue ? 'vp-btn--dark' : 'vp-btn--ghost'}`}
            onClick={() => onToggleQueue(word)}
            title={inQueue ? 'Xóa khỏi hàng ôn tập' : 'Thêm vào hàng ôn tập'}
          >
            {inQueue ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
            {inQueue ? 'Đang ôn' : 'Thêm vào ôn'}
          </button>
        </div>

        {ipaTokens && (
          <div className="vp-ipa-row">
            <span className="vp-ipa">
              /{ipaTokens.map((t, i) => <span key={i} className={t.kind}>{t.text}</span>)}/
            </span>
            <span className="vp-ipa-legend">
              <span><i className="vp-legend-dot vp-legend-dot--gold" />phụ âm</span>
              <span><i className="vp-legend-dot vp-legend-dot--navy" />nguyên âm</span>
            </span>
          </div>
        )}

        <p className="vp-modal-pos">{word.pos}</p>
        <p className="vp-modal-viet">{word.vietnamese}</p>
        {word.category && <span className="vp-chip vp-chip--modal">{categoryLabel(word.category)}</span>}

        {word.example && (
          <div className="vp-pdf-example">
            <span className="vp-pdf-ex-label">Ví dụ gốc</span>
            <span>{highlightWord(word.example, word.word)}</span>
            <button className="vp-icon-btn vp-icon-btn--sm" onClick={() => speak(word.example)} aria-label="Phát âm ví dụ">
              <IconSpeaker size={15} />
            </button>
          </div>
        )}

        <div className="vp-examples">
          <div className="vp-examples-head">
            <h3><IconRobot size={17} /> Ví dụ do AI tạo</h3>
            <button className="vp-btn vp-btn--sm vp-btn--ghost" onClick={fetchExamples} disabled={loading}>
              {loading ? <IconLoader size={14} /> : <IconRefresh size={14} />} Tạo lại
            </button>
          </div>

          {loading && (
            <div className="vp-loading-area">
              <IconLoader size={22} />
              <p>AI đang tạo ví dụ cho "{word.word}"...</p>
            </div>
          )}
          {error && (
            <div className="vp-error-box">
              <p>{error}</p>
              <button className="vp-btn vp-btn--sm vp-btn--ghost" onClick={fetchExamples}>Thử lại</button>
            </div>
          )}
          {examples && !loading && (
            <div className="vp-examples-list">
              {examples.map((ex, i) => (
                <div className="vp-example-item" key={i}>
                  <div className="vp-example-en">
                    <span className="vp-ex-num">{i + 1}</span>
                    <p>{highlightWord(ex.english, word.word)}</p>
                    <button className="vp-icon-btn vp-icon-btn--sm" onClick={() => speak(ex.english)} aria-label="Phát âm">
                      <IconSpeaker size={14} />
                    </button>
                  </div>
                  {revealed.has(i) ? (
                    <p className="vp-example-viet">{ex.vietnamese}</p>
                  ) : (
                    <button className="vp-viet-spoiler" onClick={() => setRevealed(prev => new Set(prev).add(i))}>
                      <IconEye size={14} /> Bấm để xem nghĩa tiếng Việt
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

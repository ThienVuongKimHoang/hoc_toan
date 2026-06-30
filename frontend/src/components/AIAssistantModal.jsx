import React, { useRef, useState } from 'react'
import MathText from './MathText.jsx'

const SECTION_META = {
  'PHẦN I':    { label: 'Trắc nghiệm',  color: '#2563eb' },
  'PHẦN II':   { label: 'Đúng / Sai',   color: '#7c3aed' },
  'PHẦN III':  { label: 'Trả lời ngắn', color: '#059669' },
  'TIẾNG ANH': { label: 'Tiếng Anh',    color: '#0f766e' },
  'READING':   { label: 'Reading',      color: '#0e7490' },
}

function QuestionPreview({ q, checked, onToggle }) {
  const sec   = q.section || 'PHẦN I'
  const isMCQ = sec === 'PHẦN I' || sec === 'TIẾNG ANH' || sec === 'READING'
  const isTF  = sec === 'PHẦN II'

  return (
    <div
      className={`ai-q-card ${checked ? 'ai-q-card--checked' : ''}`}
      onClick={onToggle}
    >
      <label className="ai-q-checkbox" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </label>

      <div className="ai-q-body">
        <div className="ai-q-num">Câu {q.question_number}</div>

        <div className="ai-q-text">
          <MathText text={q.question_text || ''} />
        </div>

        {isMCQ && q.choices && (
          <div className="ai-q-choices">
            {['A', 'B', 'C', 'D'].map(k => (
              <span key={k} className={`ai-q-choice ${q.answer === k ? 'ai-q-choice--correct' : ''}`}>
                <strong>{k}.</strong>&nbsp;<MathText text={q.choices[k] || ''} />
              </span>
            ))}
          </div>
        )}

        {isTF && Array.isArray(q.sub_questions) && (
          <div className="ai-q-subs">
            {q.sub_questions.map(sub => (
              <div key={sub.label} className={`ai-q-sub ${sub.correct_answer ? 'ai-q-sub--true' : 'ai-q-sub--false'}`}>
                <strong>{sub.label})</strong>&nbsp;<MathText text={sub.text || ''} />
                <span className="ai-q-sub-badge">{sub.correct_answer ? 'Đúng' : 'Sai'}</span>
              </div>
            ))}
          </div>
        )}

        {sec === 'PHẦN III' && (
          <div className="ai-q-shortans">
            Đáp án:&nbsp;<strong><MathText text={String(q.answer ?? '')} /></strong>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AIAssistantModal({ activeSection, availableSections, onAdd, onClose }) {
  const [prompt,    setPrompt]    = useState('')
  const [section,   setSection]   = useState(activeSection || availableSections?.[0] || 'PHẦN I')
  const [count,     setCount]     = useState(5)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [questions, setQuestions] = useState([])
  const [selected,  setSelected]  = useState(new Set())
  const promptRef = useRef(null)

  const handleGenerate = async () => {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setQuestions([])
    setSelected(new Set())
    try {
      const res  = await fetch('/api/generate-questions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: text, section, count }),
      })
      if (!res.ok) throw new Error(`Lỗi máy chủ: HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const qs = data.questions || []
      setQuestions(qs)
      setSelected(new Set(qs.map((_, i) => i)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (i) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const allSelected = selected.size === questions.length && questions.length > 0
  const toggleAll   = () =>
    setSelected(allSelected ? new Set() : new Set(questions.map((_, i) => i)))

  const handleAdd = () => {
    const toAdd = questions.filter((_, i) => selected.has(i))
    if (toAdd.length === 0) return
    onAdd(toAdd, section)
    onClose()
  }

  const meta = SECTION_META[section] || { label: section, color: '#475569' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="ai-modal-header">
          <div className="ai-modal-title">
            <span className="ai-modal-icon">🤖</span>
            Trợ lý AI tạo câu hỏi
          </div>
          <button className="mix-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        {/* ── Input panel ── */}
        <div className="ai-input-panel">
          <textarea
            ref={promptRef}
            className="ai-prompt-textarea"
            placeholder="Mô tả câu hỏi bạn muốn tạo…&#10;Ví dụ: Tạo câu về tích phân xác định, ứng dụng tính diện tích hình phẳng"
            value={prompt}
            rows={3}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
          />

          <div className="ai-options-row">
            {/* Section tabs */}
            <div className="ai-sec-tabs">
              {(availableSections || ['PHẦN I']).map(sec => {
                const m = SECTION_META[sec] || { label: sec, color: '#475569' }
                return (
                  <button
                    key={sec}
                    className={`ai-sec-tab ${section === sec ? 'active' : ''}`}
                    style={{ '--sec-color': m.color }}
                    onClick={() => setSection(sec)}
                    type="button"
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>

            {/* Count */}
            <div className="ai-count-wrap">
              <span className="ai-count-label">Số câu</span>
              <input
                type="number"
                className="ai-count-input"
                min={1} max={10}
                value={count}
                onChange={e => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              />
            </div>

            {/* Generate */}
            <button
              className="ai-gen-btn"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              type="button"
              style={{ '--sec-color': meta.color }}
            >
              {loading
                ? <><span className="ai-spinner" />Đang tạo…</>
                : <>✨ Tạo câu hỏi</>}
            </button>
          </div>

          {error && <div className="ai-error-msg">{error}</div>}
        </div>

        {/* ── Results ── */}
        {questions.length > 0 && (
          <>
            <div className="ai-results-bar">
              <span className="ai-results-label">
                {questions.length} câu đã tạo
                <span className="ai-sec-badge" style={{ background: meta.color }}>{meta.label}</span>
              </span>
              <button className="ai-toggle-all-btn" onClick={toggleAll} type="button">
                {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="ai-q-list">
              {questions.map((q, i) => (
                <QuestionPreview
                  key={i}
                  q={q}
                  checked={selected.has(i)}
                  onToggle={() => toggleSelect(i)}
                />
              ))}
            </div>

            <div className="ai-modal-footer">
              <span className="ai-footer-hint">Ctrl+Enter để tạo lại</span>
              <button
                className="ai-add-btn"
                disabled={selected.size === 0}
                onClick={handleAdd}
                type="button"
              >
                + Thêm {selected.size} câu vào đề
              </button>
            </div>
          </>
        )}

        {/* Empty state while loading */}
        {loading && questions.length === 0 && (
          <div className="ai-loading-state">
            <span className="ai-spinner ai-spinner--lg" />
            <span>AI đang soạn câu hỏi…</span>
          </div>
        )}

      </div>
    </div>
  )
}

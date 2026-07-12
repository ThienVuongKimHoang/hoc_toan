import React, { useState } from 'react'
import { DIFFICULTY_LEVELS, getLabelGroups, subjectHasLabels } from '../data/labels.js'
import { SUBJECTS } from './SubjectBadge.jsx'

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function DiceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  )
}

/* ── Criterion row: topic + difficulty filter + count ── */
function CriterionRow({ item, index, groups, onRemove, onChange }) {
  const [groupOpen, setGroupOpen] = useState(false)
  const [topicOpen, setTopicOpen] = useState(false)

  const selectedGroup = groups.find(g => g.topics.includes(item.topic))

  return (
    <div className="mix-criterion-row">
      <span className="mix-criterion-num">{index + 1}</span>

      {/* Group picker */}
      <div className="mix-picker-wrap">
        <button
          className="mix-picker-btn"
          onClick={() => { setGroupOpen(v => !v); setTopicOpen(false) }}
          type="button"
        >
          {selectedGroup?.group || 'Nhóm…'} <span>▾</span>
        </button>
        {groupOpen && (
          <div className="mix-picker-dropdown">
            {groups.map(g => (
              <button key={g.group} className="mix-picker-option"
                onClick={() => {
                  onChange({ ...item, topic: g.topics[0] })
                  setGroupOpen(false)
                }}>
                {g.group}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Topic picker */}
      <div className="mix-picker-wrap">
        <button
          className="mix-picker-btn mix-picker-btn--topic"
          onClick={() => { setTopicOpen(v => !v); setGroupOpen(false) }}
          type="button"
        >
          {item.topic || 'Chủ đề…'} <span>▾</span>
        </button>
        {topicOpen && (
          <div className="mix-picker-dropdown">
            {(selectedGroup?.topics || groups.flatMap(g => g.topics)).map(t => (
              <button key={t} className={`mix-picker-option ${item.topic === t ? 'selected' : ''}`}
                onClick={() => { onChange({ ...item, topic: t }); setTopicOpen(false) }}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Difficulty filter (optional) */}
      <div className="mix-diff-filter">
        <button
          className={`mix-diff-any ${!item.level ? 'active' : ''}`}
          onClick={() => onChange({ ...item, level: null })}
          type="button"
        >Tất cả</button>
        {DIFFICULTY_LEVELS.map(d => (
          <button
            key={d.id}
            className={`mix-diff-chip ${item.level === d.id ? 'active' : ''}`}
            style={item.level === d.id ? { background: d.bg, color: d.color, borderColor: d.border } : {}}
            onClick={() => onChange({ ...item, level: item.level === d.id ? null : d.id })}
            title={d.desc}
            type="button"
          >
            {d.short}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="mix-count-wrap">
        <button className="mix-count-btn" onClick={() => onChange({ ...item, count: Math.max(1, item.count - 1) })} type="button">−</button>
        <span className="mix-count-val">{item.count}</span>
        <button className="mix-count-btn" onClick={() => onChange({ ...item, count: Math.min(20, item.count + 1) })} type="button">+</button>
        <span className="mix-count-label">câu</span>
      </div>

      <button className="mix-remove-btn" onClick={onRemove} title="Xóa tiêu chí" type="button">
        <CloseIcon />
      </button>
    </div>
  )
}

/* ── Result preview ── */
function ResultPreview({ questions, onAdd, onClose, confirmLabel = 'Thêm vào đề' }) {
  if (!questions) return null
  return (
    <div className="mix-result">
      <div className="mix-result-header">
        <span className="mix-result-title">Kết quả: {questions.length} câu hỏi</span>
        <div className="mix-result-actions">
          <button className="mix-result-cancel" onClick={onClose} type="button">Thử lại</button>
          <button className="mix-result-confirm" onClick={() => onAdd(questions)} type="button">
            ✓ {confirmLabel} ({questions.length} câu)
          </button>
        </div>
      </div>
      <div className="mix-result-list">
        {questions.map((q, i) => {
          const diff = DIFFICULTY_LEVELS.find(d => d.id === q.level_label)
          return (
            <div key={i} className="mix-result-item">
              <span className="mix-result-num">{i + 1}</span>
              <div className="mix-result-content">
                <div className="mix-result-chips">
                  {q.topic_label && <span className="mix-result-topic">{q.topic_label}</span>}
                  {diff && (
                    <span className="mix-result-diff"
                      style={{ background: diff.bg, color: diff.color, borderColor: diff.border }}>
                      {diff.id}
                    </span>
                  )}
                  <span className="mix-result-src">{q._exam_title}</span>
                </div>
                <p className="mix-result-text">
                  {(q.question_text || '').slice(0, 120)}{q.question_text?.length > 120 ? '…' : ''}
                </p>
              </div>
            </div>
          )
        })}
        {questions.length === 0 && (
          <div className="mix-result-empty">
            Không tìm thấy câu hỏi phù hợp. Hãy gán nhãn cho câu hỏi trước khi phối đề.
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Modal ── */
export default function MixExamModal({ subject = 'toan', grade: initialGrade = 'thpt', onClose, onAddQuestions, standalone = false }) {
  const [grade,      setGrade]      = useState(initialGrade)
  const [criteria,   setCriteria]   = useState([
    { topic: '', level: null, count: 3 },
  ])
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)

  const groups = getLabelGroups(subject, grade)

  const addCriterion = () =>
    setCriteria(prev => [...prev, { topic: '', level: null, count: 3 }])

  const updateCriterion = (i, val) =>
    setCriteria(prev => prev.map((c, idx) => idx === i ? val : c))

  const removeCriterion = (i) =>
    setCriteria(prev => prev.filter((_, idx) => idx !== i))

  const totalCount = criteria.reduce((s, c) => s + c.count, 0)

  const handleMix = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const allQuestions = []
      for (const c of criteria) {
        if (!c.topic) continue
        const params = new URLSearchParams({ limit: c.count })
        params.set('topic', c.topic)
        if (subject) params.set('subject', subject)
        if (c.level) params.set('level', c.level)
        const res = await fetch(`/api/questions/bank?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        allQuestions.push(...(data.questions || []))
      }
      setResult(allQuestions)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="mix-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mix-modal">
        {/* Header */}
        <div className="mix-modal-header">
          <div className="mix-modal-title">
            <DiceIcon /> Phối đề tự động
          </div>
          <button className="mix-modal-close" onClick={onClose} type="button"><CloseIcon /></button>
        </div>

        {/* Subject + grade toggle */}
        <div className="mix-grade-row">
          {SUBJECTS[subject] && (
            <span className={`rs-subject-pill subject-badge--${subject}`}>
              {SUBJECTS[subject].icon} {SUBJECTS[subject].label}
            </span>
          )}
          {subjectHasLabels(subject) && (
            <>
              <span className="mix-grade-label">Cấp học:</span>
              <div className="mix-grade-toggle">
                <button className={`rs-grade-btn ${grade === 'thpt' ? 'active' : ''}`}
                  onClick={() => setGrade('thpt')} type="button">THPT</button>
                <button className={`rs-grade-btn ${grade === 'thcs' ? 'active' : ''}`}
                  onClick={() => setGrade('thcs')} type="button">THCS</button>
              </div>
            </>
          )}
          <span className="mix-hint">
            Hệ thống sẽ chọn ngẫu nhiên từ ngân hàng câu hỏi đã được gán nhãn.
          </span>
        </div>

        {/* Result view */}
        {result ? (
          <ResultPreview
            questions={result}
            onAdd={onAddQuestions}
            onClose={() => setResult(null)}
            confirmLabel={standalone ? 'Tạo đề' : 'Thêm vào đề'}
          />
        ) : (
          <>
            {/* Criteria list */}
            <div className="mix-criteria-list">
              <div className="mix-criteria-header">
                <span>Tiêu chí lấy câu hỏi</span>
                <span className="mix-total-badge">Tổng: {totalCount} câu</span>
              </div>
              {criteria.map((c, i) => (
                <CriterionRow
                  key={i}
                  item={c}
                  index={i}
                  groups={groups}
                  onChange={val => updateCriterion(i, val)}
                  onRemove={() => removeCriterion(i)}
                />
              ))}
              <button className="mix-add-criterion" onClick={addCriterion} type="button">
                + Thêm tiêu chí
              </button>
            </div>

            {error && <div className="mix-error">{error}</div>}

            {/* Footer */}
            <div className="mix-modal-footer">
              <button className="mix-cancel-btn" onClick={onClose} type="button">Hủy</button>
              <button
                className="mix-go-btn"
                onClick={handleMix}
                disabled={loading || criteria.every(c => !c.topic)}
                type="button"
              >
                {loading ? '⏳ Đang phối đề…' : <><DiceIcon /> Phối đề ngay ({totalCount} câu)</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

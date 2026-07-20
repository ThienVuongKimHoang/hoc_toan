import React, { useMemo, useState } from 'react'
import MathText from './MathText.jsx'
import { gradeSubmission } from '../store/examStore.js'

/**
 * GV chấm tay câu tự luận cho MỘT bài nộp.
 * Props: exam (có sections['TỰ LUẬN']), submission (answers, manualScores, id), onClose, onSaved
 */
export default function GradeEssayModal({ exam, submission, teacherId, onClose, onSaved }) {
  const essayQs = exam?.sections?.['TỰ LUẬN']?.questions ?? []

  const [scores, setScores] = useState(() => {
    const init = {}
    const saved = submission?.manualScores || {}
    essayQs.forEach(q => {
      const key = `TL_${q.question_number}`
      init[key] = saved[key] != null ? String(saved[key]) : ''
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [zoom, setZoom]     = useState(null)   // url ảnh đang phóng to

  const maxOf = (q) => Number(q.points) || 0

  const total = useMemo(
    () => essayQs.reduce((s, q) => {
      const v = parseFloat(scores[`TL_${q.question_number}`])
      return s + (isNaN(v) ? 0 : v)
    }, 0),
    [scores, essayQs],
  )
  const totalMax = essayQs.reduce((s, q) => s + maxOf(q), 0)

  const setScore = (key, raw, max) => {
    if (raw === '') return setScores(p => ({ ...p, [key]: '' }))
    let v = parseFloat(raw)
    if (isNaN(v)) return
    v = Math.max(0, Math.min(v, max))
    setScores(p => ({ ...p, [key]: String(v) }))
  }

  const handleSave = async () => {
    setSaving(true); setErr('')
    const manual = {}
    essayQs.forEach(q => {
      const key = `TL_${q.question_number}`
      const v = parseFloat(scores[key])
      if (!isNaN(v)) manual[key] = v
    })
    try {
      await gradeSubmission(exam.id, submission.id, manual, teacherId)
      onSaved?.()
    } catch (e) {
      setErr(e.message || 'Lưu điểm thất bại.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-box ge-modal">
        <div className="ge-header">
          <div>
            <h3 className="ge-title">✍️ Chấm tự luận</h3>
            <p className="ge-sub">Bài làm của <strong>{submission?.studentName || 'Ẩn danh'}</strong></p>
          </div>
          <div className="ge-total">
            {Math.round(total * 100) / 100}<span> / {totalMax}đ tự luận</span>
          </div>
        </div>

        {essayQs.length === 0 ? (
          <p className="ge-empty">Đề này không có câu tự luận.</p>
        ) : (
          <div className="ge-list">
            {essayQs.map(q => {
              const key    = `TL_${q.question_number}`
              const images = submission?.answers?.[key]
              const imgs   = Array.isArray(images) ? images : []
              const max    = maxOf(q)
              return (
                <div key={key} className="ge-item">
                  <div className="ge-item-head">
                    <span className="ge-qnum">Câu {q.question_number}</span>
                    <span className="ge-qmax">Tối đa {max}đ</span>
                  </div>
                  {q.question_text && (
                    <div className="ge-qtext"><MathText text={q.question_text} /></div>
                  )}
                  {q.answer && (
                    <div className="ge-rubric">💡 Gợi ý chấm: <MathText text={q.answer} /></div>
                  )}

                  {imgs.length > 0 ? (
                    <div className="ge-imgs">
                      {imgs.map((im, i) => (
                        <img key={im.url || i} src={im.url} alt={im.name || `Ảnh ${i + 1}`}
                          className="ge-img" loading="lazy" onClick={() => setZoom(im.url)} />
                      ))}
                    </div>
                  ) : (
                    <div className="ge-no-img">— Học sinh chưa nộp ảnh cho câu này —</div>
                  )}

                  <div className="ge-score-row">
                    <label>Điểm câu này:</label>
                    <input
                      type="number" min="0" max={max} step="0.25"
                      className="ge-score-input"
                      value={scores[key] ?? ''}
                      placeholder="0"
                      onChange={e => setScore(key, e.target.value, max)}
                    />
                    <span className="ge-score-max">/ {max}đ</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {err && <div className="pm-error" style={{ margin: '8px 0' }}>⚠️ {err}</div>}

        <div className="ge-actions">
          <button className="mec-btn" disabled={saving} onClick={onClose}>Hủy</button>
          <button className="mec-btn mec-btn--publish" disabled={saving || essayQs.length === 0} onClick={handleSave}>
            {saving ? '⏳ Đang lưu…' : '💾 Lưu điểm'}
          </button>
        </div>
      </div>

      {zoom && (
        <div className="ge-zoom" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Ảnh bài làm" />
          <button className="ge-zoom-close" onClick={() => setZoom(null)}>✕</button>
        </div>
      )}
    </div>
  )
}

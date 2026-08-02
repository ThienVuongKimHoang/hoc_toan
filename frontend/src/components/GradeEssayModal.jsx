import React, { useMemo, useState } from 'react'
import MathText from './MathText.jsx'
import { gradeSubmission } from '../store/examStore.js'

/**
 * GV chấm tay câu tự luận cho MỘT bài nộp.
 * Props: exam (có sections['TỰ LUẬN']), submission (answers, manualScores, id), onClose, onSaved
 */
export default function GradeEssayModal({ exam, submission, teacherId, onClose, onSaved }) {
  const essayQs = exam?.sections?.['TỰ LUẬN']?.questions ?? []
  const maxOf = (q) => Number(q.points) || 0

  // Điểm cũ có thể VƯỢT điểm tối đa hiện tại nếu đề bị sửa (giảm điểm câu này)
  // SAU KHI bài đã được chấm — clampedKeys ghi lại những câu bị giới hạn lại lúc
  // hiển thị, để báo cho GV biết thay vì âm thầm đổi số (tránh hiểu nhầm là bug
  // hiển thị "2/1đ" khi thực ra là điểm cũ chưa khớp thang điểm mới).
  // Tính 1 lần lúc mount — submission/exam không đổi trong vòng đời modal (mở
  // lại cho bài khác luôn unmount/mount modal mới, xem ClassManagementPage.jsx).
  const initial = useMemo(() => {
    const init = {}
    const clamped = new Set()
    const saved = submission?.manualScores || {}
    essayQs.forEach(q => {
      const key = `TL_${q.question_number}`
      const max = maxOf(q)
      const raw = saved[key]
      if (raw == null) { init[key] = ''; return }
      const num = Number(raw)
      const bounded = Math.max(0, Math.min(num, max))
      init[key] = String(bounded)
      if (bounded !== num) clamped.add(key)
    })
    return { scores: init, clamped }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [scores, setScores] = useState(initial.scores)
  const clampedKeys = initial.clamped
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [zoom, setZoom]     = useState(null)   // url ảnh đang phóng to

  // Điểm tự luận cũ không khớp với câu hỏi nào hiện có trong đề — thường do đề bị
  // sửa (thêm/xoá/đổi thứ tự câu tự luận) SAU KHI bài này đã được chấm, khiến
  // question_number (dùng làm key TL_n) trỏ sang câu khác. Điểm này VẪN được cộng
  // vào tổng điểm bài thi (xem _manual_total ở backend) nên không mất, nhưng
  // không có ô nào để hiển thị — liệt kê riêng để GV biết và chấm lại đúng câu
  // nếu cần, thay vì tưởng nhầm câu đó "chưa có điểm".
  const currentKeys = new Set(essayQs.map(q => `TL_${q.question_number}`))
  const orphanedEntries = Object.entries(submission?.manualScores || {})
    .filter(([k]) => !currentKeys.has(k))

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
                  {clampedKeys.has(key) && (
                    <div className="ge-clamp-warn">
                      ⚠️ Điểm đã lưu trước đó vượt điểm tối đa hiện tại của câu này (đề có thể
                      đã bị sửa sau khi chấm) — đã giới hạn lại còn {max}đ. Kiểm tra lại nếu cần.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {orphanedEntries.length > 0 && (
          <div className="ge-orphan-warn">
            <div className="ge-orphan-title">
              ⚠️ Có điểm tự luận cũ không khớp câu nào trong đề hiện tại (đề có thể đã bị
              sửa — thêm/xoá/đổi thứ tự câu tự luận sau khi bài này đã được chấm). Điểm này
              vẫn được cộng vào tổng, nhưng nên kiểm tra và chấm lại cho đúng câu:
            </div>
            {orphanedEntries.map(([key, val]) => (
              <div key={key} className="ge-orphan-row">
                <code>{key}</code>: {val}đ
              </div>
            ))}
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

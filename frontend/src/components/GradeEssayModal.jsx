import React, { useEffect, useMemo, useState } from 'react'
import MathText from './MathText.jsx'
import { gradeSubmission, scaledScore } from '../store/examStore.js'
import './GradeEssayModal.css'

/**
 * GV chấm tay câu tự luận, chấm liên tiếp được nhiều LƯỢT của cùng học sinh và
 * nhiều học sinh mà không phải đóng/mở lại modal.
 *
 * Props:
 *   exam         — đề thi (có sections['TỰ LUẬN'])
 *   students     — [{ studentId, studentName, attempts: [submission…] }] (attempts sắp TĂNG dần theo thời gian)
 *   initialSubId — id bài nộp mở đầu tiên
 *   teacherId, onClose, onSaved (gọi sau mỗi lần lưu để danh sách ngoài tải lại — KHÔNG đóng modal)
 */

const isGraded = (s) => !!s?.manualScores && Object.keys(s.manualScores).length > 0

const formatDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const fmtDur = (sec) => {
  if (sec == null || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m} phút` : `${sec} giây`
}

/* Điểm đã lưu → giá trị cho ô nhập, kèm danh sách câu bị giới hạn lại vì đề đã
   sửa giảm điểm tối đa sau khi chấm (báo cho GV thay vì âm thầm đổi số). */
function initScores(sub, essayQs) {
  const out = {}
  const clamped = new Set()
  const saved = sub?.manualScores || {}
  essayQs.forEach(q => {
    const key = `TL_${q.question_number}`
    const max = Number(q.points) || 0
    const raw = saved[key]
    if (raw == null) { out[key] = ''; return }
    const num = Number(raw)
    const bounded = Math.max(0, Math.min(num, max))
    out[key] = String(bounded)
    if (bounded !== num) clamped.add(key)
  })
  return { scores: out, clamped }
}

/* Ảnh bài làm của 1 câu trong 1 lượt */
function AnswerImages({ sub, qKey, onZoom, compact = false }) {
  const imgs = Array.isArray(sub?.answers?.[qKey]) ? sub.answers[qKey] : []
  if (imgs.length === 0) return <div className="ge-no-img">— Chưa nộp ảnh cho câu này —</div>
  return (
    <div className={`ge-imgs ${compact ? 'ge-imgs--compact' : ''}`}>
      {imgs.map((im, i) => (
        <img key={im.url || i} src={im.url} alt={im.name || `Ảnh ${i + 1}`}
          className="ge-img" loading="lazy" onClick={() => onZoom(im.url)} />
      ))}
    </div>
  )
}

export default function GradeEssayModal({ exam, students = [], initialSubId, teacherId, onClose, onSaved }) {
  const essayQs = exam?.sections?.['TỰ LUẬN']?.questions ?? []
  const maxOf = (q) => Number(q.points) || 0
  const totalMax = essayQs.reduce((s, q) => s + maxOf(q), 0)

  const [curId,  setCurId]  = useState(initialSubId)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const [zoom,   setZoom]   = useState(null)
  const [split,  setSplit]  = useState(false)   // xem song song lượt trước

  /* ── Vị trí hiện tại trong danh sách học sinh / lượt làm ── */
  const stIdx    = students.findIndex(st => st.attempts?.some(a => String(a.id) === String(curId)))
  const student  = students[stIdx] || null
  const attempts = student?.attempts || []
  const attIdx   = attempts.findIndex(a => String(a.id) === String(curId))
  const sub      = attempts[attIdx] || null
  const prevAttempt = attIdx > 0 ? attempts[attIdx - 1] : null

  const [state, setState] = useState(() => initScores(sub, essayQs))
  // Đổi lượt/học sinh → nạp lại điểm đã lưu của bài đó (chỉ theo curId, không theo
  // `sub` — danh sách ngoài tải lại sau mỗi lần lưu sẽ tạo object mới, nếu bám vào
  // đó thì điểm đang gõ dở của lượt hiện tại bị xoá trắng).
  useEffect(() => { setState(initScores(sub, essayQs)); setErr('') }, [curId])
  const { scores, clamped: clampedKeys } = state
  const setScores = (updater) =>
    setState(prev => ({ ...prev, scores: typeof updater === 'function' ? updater(prev.scores) : updater }))

  const total = useMemo(
    () => essayQs.reduce((s, q) => {
      const v = parseFloat(scores[`TL_${q.question_number}`])
      return s + (isNaN(v) ? 0 : v)
    }, 0),
    [scores, essayQs],
  )

  const currentKeys = new Set(essayQs.map(q => `TL_${q.question_number}`))
  const orphanedEntries = Object.entries(sub?.manualScores || {}).filter(([k]) => !currentKeys.has(k))

  const setScore = (key, raw, max) => {
    if (raw === '') return setScores(p => ({ ...p, [key]: '' }))
    let v = parseFloat(raw)
    if (isNaN(v)) return
    v = Math.max(0, Math.min(v, max))
    setScores(p => ({ ...p, [key]: String(v) }))
  }

  /* ── Điểm đi đâu tiếp theo ── */
  const gradedCount   = attempts.filter(isGraded).length
  const nextUngraded  = attempts.find((a, i) => i !== attIdx && !isGraded(a) && i > attIdx)
                     || attempts.find((a, i) => i !== attIdx && !isGraded(a))
  const firstTarget   = (st) => st?.attempts?.find(a => !isGraded(a)) || st?.attempts?.[st.attempts.length - 1] || null
  const nextStudent   = students[stIdx + 1] || null
  const prevStudent   = students[stIdx - 1] || null

  const goTo = (target) => { if (target?.id != null) setCurId(target.id) }

  const doSave = async () => {
    const manual = {}
    essayQs.forEach(q => {
      const key = `TL_${q.question_number}`
      const v = parseFloat(scores[key])
      if (!isNaN(v)) manual[key] = v
    })
    await gradeSubmission(exam.id, sub.id, manual, teacherId)
    onSaved?.()
  }

  // after: 'close' | 'attempt' | 'student'
  const handleSave = async (after = 'close') => {
    if (!sub) return
    setSaving(true); setErr('')
    try {
      await doSave()
      if (after === 'close') { onClose?.(); return }
      if (after === 'attempt') goTo(nextUngraded)
      if (after === 'student') goTo(firstTarget(nextStudent))
    } catch (e) {
      setErr(e.message || 'Lưu điểm thất bại.')
    } finally {
      setSaving(false)
    }
  }

  /* Chép nhanh điểm của lượt liền trước sang lượt đang chấm */
  const copyFromPrev = () => {
    if (!prevAttempt) return
    const { scores: s } = initScores(prevAttempt, essayQs)
    setScores(s)
  }

  if (!sub) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box ge-modal">
          <p className="ge-empty">Không tìm thấy bài nộp để chấm.</p>
          <div className="ge-actions"><button className="mec-btn" onClick={onClose}>Đóng</button></div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-box ge-modal">
        {/* ── Đầu trang: học sinh + điều hướng lượt ── */}
        <div className="ge-header">
          <div className="ge-head-main">
            <h3 className="ge-title">✍️ Chấm tự luận</h3>
            <p className="ge-sub">
              <strong>{student?.studentName || sub.studentName || 'Ẩn danh'}</strong>
              <span className="ge-sub-dim"> · học sinh {stIdx + 1}/{students.length}</span>
            </p>
          </div>
          <div className="ge-total">
            {Math.round(total * 100) / 100}<span> / {totalMax}đ tự luận</span>
          </div>
        </div>

        <div className="ge-nav">
          <div className="ge-nav-attempts">
            <span className="ge-nav-label">Lượt làm:</span>
            {attempts.map((a, i) => (
              <button key={a.id}
                className={`ge-att ${String(a.id) === String(curId) ? 'is-cur' : ''} ${isGraded(a) ? 'is-graded' : ''}`}
                onClick={() => goTo(a)}
                title={`${formatDt(a.submittedAt)} · ${fmtDur(a.timeSpent)} · ${isGraded(a) ? 'đã chấm' : 'chưa chấm tự luận'}`}>
                Lượt {i + 1}{isGraded(a) ? ' ✓' : ''}
              </button>
            ))}
            <span className="ge-nav-status">{gradedCount}/{attempts.length} lượt đã chấm</span>
          </div>
          <div className="ge-nav-students">
            <button className="ge-navbtn" disabled={!prevStudent || saving}
              onClick={() => goTo(firstTarget(prevStudent))}
              title={prevStudent ? `Học sinh trước: ${prevStudent.studentName}` : 'Không còn học sinh phía trước'}>
              ◀ HS trước
            </button>
            <button className="ge-navbtn" disabled={!nextStudent || saving}
              onClick={() => goTo(firstTarget(nextStudent))}
              title={nextStudent ? `Học sinh tiếp: ${nextStudent.studentName}` : 'Đã là học sinh cuối'}>
              HS tiếp ▶
            </button>
          </div>
        </div>

        <div className="ge-attempt-meta">
          <span>🗓 {formatDt(sub.submittedAt)}</span>
          <span>⏱ {fmtDur(sub.timeSpent)}</span>
          <span>📝 Trắc nghiệm (tự động): <b>{scaledScore(sub.score, sub.maxScore)}</b>/10</span>
          <span className={isGraded(sub) ? 'ge-chip-ok' : 'ge-chip-wait'}>
            {isGraded(sub) ? '✅ Đã chấm tự luận' : '⏳ Chưa chấm tự luận'}
          </span>
          {prevAttempt && (
            <>
              <button className={`ge-tool ${split ? 'is-on' : ''}`} onClick={() => setSplit(v => !v)}>
                ⇋ {split ? 'Ẩn' : 'So sánh'} lượt {attIdx}
              </button>
              <button className="ge-tool" onClick={copyFromPrev} title="Áp dụng điểm đã chấm ở lượt liền trước">
                📋 Lấy điểm lượt {attIdx}
              </button>
            </>
          )}
        </div>

        {essayQs.length === 0 ? (
          <p className="ge-empty">Đề này không có câu tự luận.</p>
        ) : (
          <div className="ge-list">
            {essayQs.map(q => {
              const key = `TL_${q.question_number}`
              const max = maxOf(q)
              const prevScore = prevAttempt?.manualScores?.[key]
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

                  {split && prevAttempt ? (
                    <div className="ge-split">
                      <div className="ge-split-pane ge-split-pane--old">
                        <div className="ge-split-label">
                          Lượt {attIdx} (cũ){prevScore != null ? ` · đã chấm ${prevScore}đ` : ''}
                        </div>
                        <AnswerImages sub={prevAttempt} qKey={key} onZoom={setZoom} compact />
                      </div>
                      <div className="ge-split-pane">
                        <div className="ge-split-label ge-split-label--cur">Lượt {attIdx + 1} (đang chấm)</div>
                        <AnswerImages sub={sub} qKey={key} onZoom={setZoom} compact />
                      </div>
                    </div>
                  ) : (
                    <AnswerImages sub={sub} qKey={key} onZoom={setZoom} />
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
                    {prevScore != null && (
                      <button className="ge-mini-copy" type="button"
                        onClick={() => setScore(key, String(prevScore), max)}
                        title={`Lượt ${attIdx} câu này được ${prevScore}đ`}>
                        ↩ {prevScore}đ (lượt {attIdx})
                      </button>
                    )}
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
          <button className="mec-btn" disabled={saving} onClick={onClose}>Đóng</button>
          <span style={{ flex: 1 }} />
          {nextUngraded && (
            <button className="mec-btn ge-btn-next" disabled={saving || essayQs.length === 0}
              onClick={() => handleSave('attempt')}>
              Lưu & lượt tiếp theo →
            </button>
          )}
          {nextStudent && (
            <button className="mec-btn ge-btn-next" disabled={saving || essayQs.length === 0}
              onClick={() => handleSave('student')}>
              Lưu & học sinh tiếp theo ⇥
            </button>
          )}
          <button className="mec-btn mec-btn--publish" disabled={saving || essayQs.length === 0}
            onClick={() => handleSave('close')}>
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

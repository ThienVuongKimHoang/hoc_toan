import React, { useRef, useState } from 'react'
import MathText from './MathText.jsx'

const SECTIONS = ['PHẦN I', 'PHẦN II', 'PHẦN III', 'TỰ LUẬN']
const SECTION_META = {
  'PHẦN I':   { label: 'PHẦN I. TRẮC NGHIỆM', color: '#2563eb', points: '' },
  'PHẦN II':  { label: 'PHẦN II. ĐÚNG / SAI',  color: '#7c3aed', points: '' },
  'PHẦN III': { label: 'PHẦN III. TRẢ LỜI NGẮN', color: '#059669', points: '' },
  'TỰ LUẬN':  { label: 'PHẦN TỰ LUẬN', color: '#d97706', points: '' },
}

/* ── MCQ Preview ── */
function MCQPreview({ q, showAnswers, onEditAnswer }) {
  const [editKey, setEditKey]   = useState(null)
  const [editVal, setEditVal]   = useState('')
  const choices = q.choices || {}
  return (
    <div className="ep-q-content">
      <div className="ep-q-choices">
        {Object.entries(choices).map(([key, val]) => (
          <div
            key={key}
            className={`ep-choice ${showAnswers && key === q.answer ? 'ep-correct' : ''}`}
          >
            <span className="ep-choice-key">{key}.</span>
            {editKey === key ? (
              <div className="ep-inline-edit">
                <input
                  autoFocus
                  className="ep-inline-input"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => {
                    onEditAnswer?.({ ...q, choices: { ...choices, [key]: editVal } })
                    setEditKey(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      onEditAnswer?.({ ...q, choices: { ...choices, [key]: editVal } })
                      setEditKey(null)
                    }
                    if (e.key === 'Escape') setEditKey(null)
                  }}
                />
              </div>
            ) : (
              <span
                className="ep-choice-text"
                onClick={() => { setEditKey(key); setEditVal(val) }}
                title="Click để sửa"
              >
                <MathText text={val} />
                <span className="ep-edit-pencil">✏️</span>
              </span>
            )}
            {showAnswers && key === q.answer && (
              <span className="ep-ans-tick">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── TF Preview ── */
function TFPreview({ q, showAnswers, onEditQuestion }) {
  const subs = q.sub_questions || []
  return (
    <div className="ep-q-content">
      <div className="ep-tf-subs">
        {subs.map((sub, i) => (
          <div key={i} className="ep-tf-row">
            <span className="ep-tf-label">{sub.label})</span>
            <span className="ep-tf-text"><MathText text={sub.text} /></span>
            {showAnswers && (
              <span className={`ep-tf-ans ${sub.correct_answer ? 'true' : 'false'}`}>
                {sub.correct_answer ? 'Đúng' : 'Sai'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Short Preview ── */
function ShortPreview({ q, showAnswers }) {
  return (
    <div className="ep-q-content">
      {showAnswers && q.answer && (
        <div className="ep-short-ans">
          <span className="ep-short-ans-label">Đáp án:</span>
          <span className="ep-short-ans-val"><MathText text={q.answer} /></span>
        </div>
      )}
    </div>
  )
}

/* ── Essay Preview ── */
function EssayPreview({ q, showAnswers }) {
  return (
    <div className="ep-q-content">
      <div className="ep-essay-note">✍️ Học sinh upload ảnh bài làm — chấm tay ({q.points ?? 1}đ)</div>
      {showAnswers && q.answer && (
        <div className="ep-short-ans">
          <span className="ep-short-ans-label">Gợi ý chấm:</span>
          <span className="ep-short-ans-val"><MathText text={q.answer} /></span>
        </div>
      )}
    </div>
  )
}

/* ── Main modal ── */
export default function ExamPreviewModal({ result, title, onClose, onPublish, onEditQuestion }) {
  const [showAnswers, setShowAnswers] = useState(false)
  const printRef = useRef(null)

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.6; padding: 20mm; }
        .ep-correct { font-weight: bold; }
        .ep-ans-tick { color: green; margin-left: 4px; }
        .ep-edit-pencil, .ep-inline-edit { display: none; }
        .ep-choice { margin: 4px 0; }
        .ep-choice-key { font-weight: bold; margin-right: 6px; }
        .ep-section-header { margin-top: 20px; font-weight: bold; font-size: 14pt; border-bottom: 1px solid #000; padding-bottom: 4px; }
        .ep-q-row { margin: 12px 0; }
        .ep-q-num { font-weight: bold; }
      </style>
      </head><body>${content}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const totalQ = SECTIONS.reduce((s, sec) => s + (result.sections[sec]?.questions?.length ?? 0), 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box ep-modal">
        {/* Modal toolbar */}
        <div className="ep-toolbar">
          <div className="ep-toolbar-left">
            <button className="modal-close" onClick={onClose}>✕</button>
            <span className="ep-toolbar-title">Xem trước đề thi</span>
          </div>
          <div className="ep-toolbar-right">
            <button
              className={`ep-toggle-ans ${showAnswers ? 'active' : ''}`}
              onClick={() => setShowAnswers(v => !v)}
            >
              {showAnswers ? '🙈 Ẩn đáp án' : '👁 Hiện đáp án'}
            </button>
            <button className="ep-print-btn" onClick={handlePrint}>🖨 In / Xuất PDF</button>
            <button className="ep-publish-btn" onClick={onPublish}>🚀 Xác nhận phát đề</button>
          </div>
        </div>

        {/* Exam paper */}
        <div className="ep-paper-wrap">
          <div className="ep-paper" ref={printRef}>
            {/* Header */}
            <div className="ep-paper-header">
              <div className="ep-paper-school">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div className="ep-paper-title">{title}</div>
              <div className="ep-paper-meta">
                <span>Môn: Toán</span>
                <span>Tổng số câu: {totalQ}</span>
              </div>
              <div className="ep-paper-note">(Đề thi này được tạo bởi Trung tâm Ánh Sáng)</div>
            </div>

            {/* Sections */}
            {SECTIONS.map(sec => {
              const qs = result.sections[sec]?.questions ?? []
              if (qs.length === 0) return null
              const meta = SECTION_META[sec]
              const pts  = result.sections[sec]?.points_per_q
              return (
                <div key={sec} className="ep-section">
                  <div className="ep-section-header" style={{ color: meta.color }}>
                    {meta.label}
                    {pts && <span className="ep-section-pts">({pts}đ / câu)</span>}
                  </div>
                  {qs.map((q, idx) => (
                    <div key={idx} className="ep-q-row">
                      <div className="ep-q-header-row">
                        <span className="ep-q-num">Câu {q.question_number}.</span>
                        <span className="ep-q-text">
                          <MathText text={q.question_text} />
                        </span>
                        {/* Quick edit button */}
                        <button
                          className="ep-q-edit-btn"
                          onClick={() => { onClose(); onEditQuestion?.(sec, idx) }}
                          title="Quay lại để chỉnh sửa câu này"
                        >
                          ✏️ Sửa
                        </button>
                      </div>

                      {q.figure_path && (
                        <img
                          src={`/images/${q.figure_path.replace('images/', '')}`}
                          alt="" className="ep-figure"
                        />
                      )}

                      {sec === 'PHẦN I' && (
                        <MCQPreview
                          q={q}
                          showAnswers={showAnswers}
                          onEditAnswer={updated => onEditQuestion?.(sec, idx, updated)}
                        />
                      )}
                      {sec === 'PHẦN II' && (
                        <TFPreview q={q} showAnswers={showAnswers} />
                      )}
                      {sec === 'PHẦN III' && (
                        <ShortPreview q={q} showAnswers={showAnswers} />
                      )}
                      {sec === 'TỰ LUẬN' && (
                        <EssayPreview q={q} showAnswers={showAnswers} />
                      )}
                    </div>
                  ))}
                </div>
              )
            })}

            {showAnswers && (
              <div className="ep-answer-key">
                <div className="ep-ak-title">— Đáp án —</div>
                <div className="ep-ak-grid">
                  {(result.sections['PHẦN I']?.questions ?? []).map(q => (
                    <div key={q.question_number} className="ep-ak-item">
                      <span className="ep-ak-num">{q.question_number}.</span>
                      <span className="ep-ak-ans" style={{ color: '#2563eb' }}>{q.answer}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

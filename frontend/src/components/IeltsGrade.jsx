import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getGradesSummary, gradeSubmission, updateAiGrade } from '../store/classStore.js'

/* ─── Helpers ─── */
export const CRITERIA_META = (criterionLabel) => ([
  ['task_response',      criterionLabel || 'Task Response', '🎯'],
  ['coherence_cohesion', 'Coherence & Cohesion',            '🔗'],
  ['lexical_resource',   'Lexical Resource',                '📚'],
  ['grammatical_range',  'Grammar Range & Accuracy',        IC.pencil(13)],
])
const CRIT_KEYS = ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range']

/* ─── Icon SVG dùng cho các nút phía giáo viên (thay cho emoji) ─── */
function Svg({ size = 14, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {children}
    </svg>
  )
}
const IC = {
  zap:     (s = 14) => <Svg size={s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Svg>,
  refresh: (s = 14) => <Svg size={s}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Svg>,
  pencil:  (s = 14) => <Svg size={s}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Svg>,
  trash:   (s = 14) => <Svg size={s}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Svg>,
  check:   (s = 14) => <Svg size={s}><polyline points="20 6 9 17 4 12" /></Svg>,
  x:       (s = 14) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>,
  plus:    (s = 14) => <Svg size={s}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>,
  eye:     (s = 14) => <Svg size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>,
}

export function bandColor(b) {
  if (b == null) return '#94a3b8'
  if (b >= 7.5) return '#059669'
  if (b >= 6.0) return '#2563eb'
  if (b >= 5.0) return '#d97706'
  return '#dc2626'
}

export function BandChip({ band, size = 'md' }) {
  return (
    <span className={`ielts-band-chip ielts-band-chip--${size}`}
      style={{ background: bandColor(band) }}>
      {band != null ? band.toFixed(1) : '—'}
    </span>
  )
}

const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => i * 0.5)

function overallBandFromCriteria(criteria) {
  const bands = CRIT_KEYS.map(k => criteria?.[k]?.band ?? 0)
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length
  return Math.floor(avg * 2 + 0.5) / 2
}

/* ─── Chú thích lỗi kiểu Google Docs: tô màu trong bài + popover khi bấm ─── */
export const ANNOT_TYPES = {
  grammar:   'Ngữ pháp',
  vocab:     'Từ vựng',
  coherence: 'Liên kết',
  task:      'Nội dung',
}

function rangeToOffsets(container, range) {
  let start = null, end = null, acc = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length
    if (node === range.startContainer) start = acc + range.startOffset
    if (node === range.endContainer) end = acc + range.endOffset
    acc += len
  }
  return { start, end }
}

function buildSegments(text, corrections, creating) {
  const located = corrections
    .map((c, i) => ({ ...c, _idx: i }))
    .filter(c => c.start != null && c.end != null && c.start < c.end && c.end <= text.length)
  if (creating) located.push({ ...creating, _idx: 'new', _creating: true })
  located.sort((a, b) => a.start - b.start)

  const segments = []
  let cursor = 0
  for (const c of located) {
    if (c.start < cursor) continue
    if (c.start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, c.start) })
    segments.push({ kind: 'mark', text: text.slice(c.start, c.end), corr: c })
    cursor = c.end
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

function AnnotEditPopover({ isNew, quote, fix: initFix = '', explain: initExplain = '', type: initType = 'grammar', style, onSubmit, onDelete, onCancel }) {
  const [fix, setFix] = useState(initFix)
  const [explain, setExplain] = useState(initExplain)
  const [type, setType] = useState(initType || 'grammar')
  return (
    <div className="ielts-annot-popover ielts-annot-popover--edit" style={style} onClick={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
      <div className="ielts-annot-pop-wrong">✗ {quote}</div>
      <select className="ielts-annot-pop-type" value={type} onChange={e => setType(e.target.value)}>
        {Object.entries(ANNOT_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <input className="ielts-annot-pop-input" value={fix} onChange={e => setFix(e.target.value)}
        placeholder="Sửa thành..." />
      <textarea className="ielts-annot-pop-textarea" value={explain} onChange={e => setExplain(e.target.value)}
        placeholder="Giải thích ngắn (tiếng Việt)..." rows={2} />
      <div className="ielts-annot-pop-actions">
        {!isNew && <button type="button" className="ielts-annot-pop-del" onClick={onDelete}>{IC.trash(12)} Xoá</button>}
        <button type="button" className="ielts-annot-pop-cancel" onClick={onCancel}>{IC.x(12)} Huỷ</button>
        <button type="button" className="ielts-annot-pop-save" disabled={!fix.trim()}
          onClick={() => onSubmit({ fix: fix.trim(), explain: explain.trim(), type })}>
          {isNew ? <>{IC.plus(12)} Thêm</> : <>{IC.check(12)} Lưu</>}
        </button>
      </div>
    </div>
  )
}

export function AnnotatedEssay({ text, corrections, editable, canEdit, focusIndex, onRequestEdit, onChangeCorrection, onDeleteCorrection, onAddCorrection }) {
  const wrapRef = useRef(null)
  const markRefs = useRef({})
  const [activeIdx, setActiveIdx] = useState(null)
  const [creating, setCreating] = useState(null)
  const [popPos, setPopPos] = useState(null)

  useEffect(() => {
    if (activeIdx == null && !creating) return
    const handler = (e) => {
      if (e.target.closest('.ielts-annot, .ielts-annot-popover')) return
      setActiveIdx(null); setCreating(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeIdx, creating])

  useEffect(() => {
    if (editable && focusIndex != null) setActiveIdx(focusIndex)
  }, [editable, focusIndex])

  const located = corrections.filter(c => c.start != null && c.end != null)
  const unlocated = corrections.map((c, i) => ({ ...c, _idx: i })).filter(c => c.start == null || c.end == null)

  const handleMouseUp = () => {
    if (!editable) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!wrapRef.current || !wrapRef.current.contains(range.commonAncestorContainer)) return
    let { start, end } = rangeToOffsets(wrapRef.current, range)
    if (start == null || end == null) return
    if (start > end) [start, end] = [end, start]
    while (start < end && /\s/.test(text[start])) start++
    while (end > start && /\s/.test(text[end - 1])) end--
    if (end - start < 2) return
    if (located.some(c => start < c.end && c.start < end)) return
    sel.removeAllRanges()
    setActiveIdx(null)
    setCreating({ start, end, quote: text.slice(start, end) })
  }

  const segments = buildSegments(text, corrections, creating)

  // Điểm neo popover (mark có thể xuống dòng giữa chừng — dùng getClientRects()[0]
  // để lấy đúng fragment dòng đầu, tránh containing-block bị tính lố sang chữ khác
  // khi popover được đặt bên trong <mark> position:relative theo kiểu cũ).
  const openKey = creating ? 'new' : activeIdx
  markRefs.current = {}
  useLayoutEffect(() => {
    if (openKey == null || !wrapRef.current) { setPopPos(null); return }
    const el = markRefs.current[openKey]
    if (!el) { setPopPos(null); return }
    const rects = el.getClientRects()
    const r = rects[0] || el.getBoundingClientRect()
    const wrapRect = wrapRef.current.getBoundingClientRect()
    setPopPos({
      top: r.bottom - wrapRect.top + wrapRef.current.scrollTop,
      left: r.left - wrapRect.left + wrapRef.current.scrollLeft,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, segments.length])

  const handleWrapDoubleClick = (e) => {
    if (editable || !canEdit) return
    if (e.target.closest('.ielts-annot')) return   // mark tự xử lý double-click riêng
    onRequestEdit?.(null)
  }

  const activeSeg = !creating && activeIdx != null
    ? segments.find(s => s.kind === 'mark' && !s.corr._creating && s.corr._idx === activeIdx)
    : null

  return (
    <div className={`ielts-essay-wrap ${editable ? 'ielts-essay-wrap--editable' : ''}`} ref={wrapRef}
      onMouseUp={handleMouseUp} onDoubleClick={handleWrapDoubleClick}>
      {segments.map((seg, i) => seg.kind === 'text'
        ? <React.Fragment key={i}>{seg.text}</React.Fragment>
        : (
          <mark key={i}
            ref={el => { if (el) markRefs.current[seg.corr._idx] = el }}
            className={`ielts-annot ielts-annot--${seg.corr._creating ? 'pending' : (seg.corr.type || 'grammar')} ${activeIdx === seg.corr._idx ? 'ielts-annot--active' : ''}`}
            onClick={() => { if (seg.corr._creating) return; setCreating(null); setActiveIdx(p => p === seg.corr._idx ? null : seg.corr._idx) }}
            onDoubleClick={(e) => {
              if (seg.corr._creating) return
              e.stopPropagation()
              if (!editable && canEdit) onRequestEdit?.(seg.corr._idx)
            }}>
            {seg.text}
          </mark>
        )
      )}
      {creating && popPos && (
        <AnnotEditPopover isNew quote={creating.quote} style={{ top: popPos.top, left: popPos.left }}
          onSubmit={patch => { onAddCorrection({ error: creating.quote, start: creating.start, end: creating.end, ...patch }); setCreating(null) }}
          onCancel={() => setCreating(null)} />
      )}
      {activeSeg && popPos && (
        editable ? (
          <AnnotEditPopover quote={activeSeg.corr.error} fix={activeSeg.corr.fix} explain={activeSeg.corr.explain} type={activeSeg.corr.type}
            style={{ top: popPos.top, left: popPos.left }}
            onSubmit={patch => { onChangeCorrection(activeIdx, patch); setActiveIdx(null) }}
            onDelete={() => { onDeleteCorrection(activeIdx); setActiveIdx(null) }}
            onCancel={() => setActiveIdx(null)} />
        ) : (
          <div className="ielts-annot-popover" style={{ top: popPos.top, left: popPos.left }} onClick={e => e.stopPropagation()}>
            <div className="ielts-annot-pop-wrong">✗ {activeSeg.corr.error}</div>
            <div className="ielts-annot-pop-fix">✓ {activeSeg.corr.fix}</div>
            {activeSeg.corr.explain && <div className="ielts-annot-pop-explain">{activeSeg.corr.explain}</div>}
          </div>
        )
      )}
      {editable && (
        <div className="ielts-annot-hint">💡 Bôi đen một đoạn trong bài để thêm ghi chú lỗi mới</div>
      )}
      {!editable && canEdit && (
        <div className="ielts-annot-hint">💡 Bấm đúp vào bài làm (hoặc vào một lỗi đã tô màu) để sửa</div>
      )}
      {unlocated.length > 0 && (
        <div className="ielts-annot-unlocated">
          <div className="ielts-annot-unlocated-title">📌 Ghi chú khác (không xác định được vị trí trong bài)</div>
          {unlocated.map(c => (
            <div key={c._idx} className="ielts-correction">
              <div className="ielts-corr-error">✗ {c.error}</div>
              <div className="ielts-corr-fix">✓ {c.fix}</div>
              {c.explain && <div className="ielts-corr-explain">{c.explain}</div>}
              {editable && <button type="button" className="ielts-corr-del" onClick={() => onDeleteCorrection(c._idx)}>{IC.trash(11)} Xoá</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function makeDraft(g) {
  return {
    criteria: CRIT_KEYS.reduce((acc, k) => {
      acc[k] = { band: g.criteria?.[k]?.band ?? 0, comment: g.criteria?.[k]?.comment || '' }
      return acc
    }, {}),
    feedback: g.feedback || '',
    strengths: (g.strengths || []).join('\n'),
    improvements: (g.improvements || []).join('\n'),
    corrections: (g.corrections || []).map(c => ({ ...c })),
  }
}

/* ─── Kết quả chấm chi tiết (học sinh & giáo viên đều xem được) ─── */
export function IeltsGradeModal({ grade, studentName, taskLabel, onClose, editable = false, classId, assignmentId, studentId, onSaved }) {
  const [current, setCurrent] = useState(grade || {})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pendingFocus, setPendingFocus] = useState(null)
  const [essayFocusIdx, setEssayFocusIdx] = useState(null)

  useEffect(() => { setCurrent(grade || {}); setEditing(false) }, [grade])

  const g = current
  const crit = g.criteria || {}
  const meta = CRITERIA_META(g.criterionLabel)

  const startEditing = (focus = null, idx = null) => {
    setDraft(makeDraft(g)); setEditing(true); setPendingFocus(focus); setEssayFocusIdx(idx)
  }
  const cancelEditing = () => { setDraft(null); setEditing(false); setPendingFocus(null); setEssayFocusIdx(null) }

  const updateCorrections = (updater) => setDraft(d => ({ ...d, corrections: updater(d.corrections) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const patch = {
        criteria: draft.criteria,
        feedback: draft.feedback,
        strengths: draft.strengths.split('\n').map(s => s.trim()).filter(Boolean),
        improvements: draft.improvements.split('\n').map(s => s.trim()).filter(Boolean),
        corrections: draft.corrections,
      }
      const res = await updateAiGrade(classId, assignmentId, studentId, patch)
      setCurrent(res.aiGrade)
      setEditing(false)
      onSaved?.(res.aiGrade)
    } catch (e) {
      alert(e?.message || 'Lưu chỉnh sửa thất bại')
    } finally {
      setSaving(false)
    }
  }

  const liveOverall = editing ? overallBandFromCriteria(draft.criteria) : g.overallBand

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box ielts-modal">
        <div className="modal-header">
          <h2>{editable ? '🤖 Kết quả chấm AI' : '📝 Kết quả chấm'} {taskLabel ? `· ${taskLabel}` : ''}</h2>
          <div className="ielts-modal-head-actions">
            {editable && g.status === 'done' && !editing && (
              <button className="mec-btn" onClick={() => startEditing()}>{IC.pencil()} Sửa</button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ielts-modal-body">
          {g.status === 'pending' && (
            <div className="ielts-pending"><span className="fdz-spinner" /> {editable ? 'AI đang chấm bài' : 'Đang chấm bài'}, vui lòng đợi trong giây lát…</div>
          )}
          {g.status === 'error' && (
            <div className="cm-error" style={{ marginTop: 0 }}>⚠️ {g.error || 'Chấm bài thất bại.'}</div>
          )}

          {g.status === 'done' && (
            <>
              {/* Overall band */}
              <div className="ielts-overall">
                <div className="ielts-overall-circle" style={{ borderColor: bandColor(liveOverall) }}>
                  <div className="ielts-overall-score" style={{ color: bandColor(liveOverall) }}>
                    {liveOverall?.toFixed(1)}
                  </div>
                  <div className="ielts-overall-label">Overall Band</div>
                </div>
                <div className="ielts-overall-info">
                  {studentName && <div className="ielts-student-name">👤 {studentName}</div>}
                  <div className="ielts-meta-row">📝 {g.wordCount ?? '—'} từ · 🕒 Chấm lúc {fmtDt(g.gradedAt)}</div>
                  {g.editedAt && <div className="ielts-meta-row">{IC.pencil(12)} GV sửa lúc {fmtDt(g.editedAt)}</div>}
                </div>
              </div>

              {/* 4 criteria */}
              <div className="ielts-criteria-grid">
                {meta.map(([key, label, icon]) => {
                  const c = editing ? draft.criteria[key] : (crit[key] || {})
                  return (
                    <div key={key} className="ielts-criterion-card">
                      <div className="ielts-criterion-head">
                        <span className="ielts-criterion-label">{icon} {label}</span>
                        {editing ? (
                          <select className="ielts-band-select" value={c.band} autoFocus={pendingFocus === 'band-' + key}
                            onChange={e => setDraft(d => ({ ...d, criteria: { ...d.criteria, [key]: { ...d.criteria[key], band: parseFloat(e.target.value) } } }))}>
                            {BAND_OPTIONS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}
                          </select>
                        ) : (
                          <span className={editable ? 'ielts-dbl-editable' : ''}
                            onDoubleClick={editable ? () => startEditing('band-' + key) : undefined}
                            title={editable ? 'Bấm đúp để sửa band' : undefined}>
                            <BandChip band={c.band} />
                          </span>
                        )}
                      </div>
                      {editing ? (
                        <textarea className="ielts-criterion-edit-comment" rows={2} value={c.comment} autoFocus={pendingFocus === 'comment-' + key}
                          onChange={e => setDraft(d => ({ ...d, criteria: { ...d.criteria, [key]: { ...d.criteria[key], comment: e.target.value } } }))}
                          placeholder="Nhận xét tiêu chí..." />
                      ) : (
                        (c.comment || editable) && (
                          <div className={`ielts-criterion-comment ${editable ? 'ielts-dbl-editable' : ''}`}
                            onDoubleClick={editable ? () => startEditing('comment-' + key) : undefined}>
                            {c.comment || 'Bấm đúp để thêm nhận xét…'}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Nhận xét */}
              <div className="ielts-section">
                <h4 className="ielts-section-title">💬 {editable ? 'Nhận xét của AI' : 'Nhận xét'}</h4>
                {editing ? (
                  <textarea className="ielts-edit-textarea" rows={4} value={draft.feedback} autoFocus={pendingFocus === 'feedback'}
                    onChange={e => setDraft(d => ({ ...d, feedback: e.target.value }))}
                    placeholder="Nhận xét tổng quan..." />
                ) : (
                  (g.feedback || editable) && (
                    <div className={`ielts-feedback ${editable ? 'ielts-dbl-editable' : ''}`}
                      onDoubleClick={editable ? () => startEditing('feedback') : undefined}>
                      {g.feedback || 'Bấm đúp để thêm nhận xét…'}
                    </div>
                  )
                )}
              </div>

              {editing ? (
                <div className="ielts-two-col">
                  <div className="ielts-section ielts-list-box ielts-list-box--good">
                    <h4 className="ielts-section-title">✅ Điểm mạnh (mỗi dòng 1 ý)</h4>
                    <textarea className="ielts-edit-textarea" rows={4} value={draft.strengths} autoFocus={pendingFocus === 'strengths'}
                      onChange={e => setDraft(d => ({ ...d, strengths: e.target.value }))} />
                  </div>
                  <div className="ielts-section ielts-list-box ielts-list-box--warn">
                    <h4 className="ielts-section-title">🔧 Cần cải thiện (mỗi dòng 1 ý)</h4>
                    <textarea className="ielts-edit-textarea" rows={4} value={draft.improvements} autoFocus={pendingFocus === 'improvements'}
                      onChange={e => setDraft(d => ({ ...d, improvements: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="ielts-two-col">
                  {g.strengths?.length > 0 && (
                    <div className={`ielts-section ielts-list-box ielts-list-box--good ${editable ? 'ielts-dbl-editable' : ''}`}
                      onDoubleClick={editable ? () => startEditing('strengths') : undefined}>
                      <h4 className="ielts-section-title">✅ Điểm mạnh</h4>
                      <ul>{g.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {g.improvements?.length > 0 && (
                    <div className={`ielts-section ielts-list-box ielts-list-box--warn ${editable ? 'ielts-dbl-editable' : ''}`}
                      onDoubleClick={editable ? () => startEditing('improvements') : undefined}>
                      <h4 className="ielts-section-title">🔧 Cần cải thiện</h4>
                      <ul>{g.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              {/* Đề bài trích xuất (Task 1) */}
              {g.imageDesc && (
                <details className="ielts-section ielts-details">
                  <summary className="ielts-section-title">🖼 {editable ? 'Đề bài AI trích xuất từ ảnh đính kèm' : 'Đề bài đã trích xuất từ ảnh đính kèm'}</summary>
                  <pre className="ielts-essay-text">{g.imageDesc}</pre>
                </details>
              )}

              {/* Bài làm học sinh — tô màu lỗi + ghi chú kiểu Google Docs */}
              {g.essayText && (
                <details className="ielts-section ielts-details" open>
                  <summary className="ielts-section-title">📄 Bài làm của học sinh ({g.wordCount} từ) — bấm vào đoạn tô màu để xem ghi chú lỗi</summary>
                  <AnnotatedEssay
                    text={g.essayText}
                    corrections={editing ? draft.corrections : (g.corrections || [])}
                    editable={editing}
                    canEdit={editable}
                    focusIndex={editing ? essayFocusIdx : null}
                    onRequestEdit={(idx) => startEditing('essay-annot', idx)}
                    onChangeCorrection={(idx, patch) => updateCorrections(list => list.map((c, i) => i === idx ? { ...c, ...patch } : c))}
                    onDeleteCorrection={(idx) => updateCorrections(list => list.filter((_, i) => i !== idx))}
                    onAddCorrection={(item) => updateCorrections(list => [...list, item])}
                  />
                </details>
              )}

              {editing && (
                <div className="ielts-edit-footer">
                  <button className="mec-btn" onClick={cancelEditing} disabled={saving}>{IC.x()} Huỷ</button>
                  <button className="mec-btn ielts-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? <><span className="fdz-spinner" style={{ width: 12, height: 12 }} /> Đang lưu…</> : <>{IC.check()} Lưu thay đổi</>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Bảng tóm tắt thống kê điểm từng người ─── */
export function IeltsStatsTable({ classId, assignmentId, refreshKey = 0, onViewStudent }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    getGradesSummary(classId, assignmentId)
      .then(d => { if (alive) setData(d) })
      .catch(() => { if (alive) setData({ rows: [], stats: {} }) })
    return () => { alive = false }
  }, [classId, assignmentId, refreshKey])

  if (!data) return <div className="ielts-stats-loading">Đang tải bảng điểm…</div>
  const { rows = [], stats = {}, criterionLabel } = data
  if (rows.length === 0) return <div className="ielts-stats-loading">Chưa có bài nộp nào.</div>

  const short = { task_response: (criterionLabel === 'Task Achievement' ? 'TA' : 'TR'), coherence_cohesion: 'CC', lexical_resource: 'LR', grammatical_range: 'GRA' }

  return (
    <div className="ielts-stats">
      <div className="ielts-stats-cards">
        <div className="ielts-stat-card"><span>{stats.graded ?? 0}/{stats.total ?? 0}</span><small>Đã chấm</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.avg) }}>{stats.avg ?? '—'}</span><small>Band TB</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.max) }}>{stats.max ?? '—'}</span><small>Cao nhất</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.min) }}>{stats.min ?? '—'}</span><small>Thấp nhất</small></div>
      </div>
      <div className="ielts-stats-table-wrap">
        <table className="ielts-stats-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Học sinh</th>
              <th>{short.task_response}</th><th>CC</th><th>LR</th><th>GRA</th>
              <th>Overall</th><th>Số từ</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.studentId}>
                <td style={{ textAlign: 'left' }}>
                  <span className="ielts-stats-name">{r.studentName || r.studentId}</span>
                </td>
                {['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range'].map(k => (
                  <td key={k}>{r[k] != null ? <span style={{ color: bandColor(r[k]), fontWeight: 700 }}>{r[k].toFixed(1)}</span> : '—'}</td>
                ))}
                <td>{r.status === 'done' ? <BandChip band={r.overallBand} size="sm" />
                  : r.status === 'pending' ? <span className="ielts-pending-chip">⏳</span>
                  : r.status === 'error' ? <span title="Chấm lỗi">⚠️</span> : '—'}</td>
                <td>{r.wordCount ?? '—'}</td>
                <td>
                  {onViewStudent && r.status === 'done' && (
                    <button className="ielts-view-btn" onClick={() => onViewStudent(r.studentId)}>{IC.eye(12)} Xem</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Modal bảng điểm (dùng phía học sinh) ─── */
export function IeltsStatsModal({ classId, assignment, onClose, onViewStudent }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>📊 Bảng điểm — {assignment.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <IeltsStatsTable classId={classId} assignmentId={assignment.id} onViewStudent={onViewStudent} />
        </div>
      </div>
    </div>
  )
}

/* ─── Nút chấm / chấm lại của giáo viên ─── */
export function GradeButton({ classId, assignmentId, studentId, hasGrade, onDone }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await gradeSubmission(classId, assignmentId, studentId)
    } catch (e) { alert(e?.message || 'Chấm thất bại') }
    finally { setBusy(false); onDone?.() }
  }
  return (
    <button className="mec-btn ielts-grade-btn" onClick={run} disabled={busy}>
      {busy ? <><span className="fdz-spinner" style={{ width: 12, height: 12 }} /> Đang chấm…</> : (hasGrade ? <>{IC.refresh()} Chấm lại</> : <>{IC.zap()} Chấm AI</>)}
    </button>
  )
}

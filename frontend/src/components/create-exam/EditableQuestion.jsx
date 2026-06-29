import React, { useEffect, useRef, useState } from 'react'
import MathText from '../MathText.jsx'
import { DIFFICULTY_LEVELS, THPT_LABEL_GROUPS, THCS_LABEL_GROUPS } from '../../data/labels.js'
import './EditableQuestion.css'
const PASSAGE_SPLIT_THRESHOLD = 300
/* ─── Convert plain text / old markers → HTML for display ─── */
// Detects HTML produced by contenteditable (formatting/structural tags only)
const CONTENT_EDITABLE_TAG = /<(strong|em|u|b|i|div|br|span|p)\b/i

export function toPassageHTML(text) {
  if (!text) return ''
  if (CONTENT_EDITABLE_TAG.test(text)) {
    // Already rich HTML from contenteditable — only normalise bare newlines
    return text.replace(/\n/g, '<br>')
  }
  // Plain text (from AI or old markers): escape, convert markers, convert \n
  // LƯU Ý: KHÔNG đổi "__..__" thành gạch chân — sẽ phá các chỗ trống "____" của bài điền từ.
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

/* ─── Word-like WYSIWYG editor (B / I / U, contenteditable) ─── */
export function PassageEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const editorRef = useRef(null)
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Populate contenteditable when entering edit mode
  useEffect(() => {
    if (editing && editorRef.current) {
      editorRef.current.innerHTML = toPassageHTML(value || '')
      editorRef.current.focus()
    }
  }, [editing])

  // Click outside → save and close
  useEffect(() => {
    if (!editing) return
    const save = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        const html = editorRef.current?.innerHTML || ''
        setEditing(false)
        onChangeRef.current(html)
      }
    }
    document.addEventListener('mousedown', save)
    return () => document.removeEventListener('mousedown', save)
  }, [editing])

  // Apply / toggle format (execCommand handles toggle automatically)
  const fmt = (cmd) => {
    document.execCommand(cmd, false, null)
    editorRef.current?.focus()
  }

  const html = toPassageHTML(value || '')

  if (editing) {
    return (
      <div ref={containerRef} className="eq-passage-editor-wrap">
        <div className="eq-passage-fmtbar">
          <button type="button" className="eq-fmt-btn" title="In đậm (Ctrl+B)"
            onMouseDown={e => { e.preventDefault(); fmt('bold') }}><b>B</b></button>
          <button type="button" className="eq-fmt-btn" title="In nghiêng (Ctrl+I)"
            onMouseDown={e => { e.preventDefault(); fmt('italic') }}><em>I</em></button>
          <button type="button" className="eq-fmt-btn" title="Gạch dưới (Ctrl+U)"
            onMouseDown={e => { e.preventDefault(); fmt('underline') }}><u>U</u></button>
          <span className="eq-fmt-hint">Click ngoài để lưu</span>
        </div>
        <div
          ref={editorRef}
          contentEditable
          className="eq-passage-editable"
          suppressContentEditableWarning
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="eq-passage-display"
      onClick={() => setEditing(true)} title="Click để chỉnh sửa">
      {html
        ? <div className="eq-passage-formatted" dangerouslySetInnerHTML={{ __html: html }} />
        : <span className="eq-placeholder">Click để nhập nội dung…</span>
      }
      <span className="eq-edit-hint">✏️</span>
    </div>
  )
}

/* ─── Click-to-edit field with LaTeX preview ─── */
function MathEditField({ value, onChange, placeholder, multiline = true }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const draftRef = useRef(draft)
  onChangeRef.current = onChange
  draftRef.current = draft

  const startEdit = () => { setDraft(value || ''); setEditing(true) }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      const len = (value || '').length
      if (inputRef.current.setSelectionRange) inputRef.current.setSelectionRange(len, len)
    }
  }, [editing])

  useEffect(() => {
    if (!editing) return
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setEditing(false)
        if (draftRef.current !== (value || '')) onChangeRef.current(draftRef.current)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [editing, value])

  if (editing) {
    return (
      <div ref={wrapRef} className="eq-mf-wrap">
        {multiline ? (
          <AutoTextarea
            textareaRef={inputRef}
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            className="eq-mf-textarea"
          />
        ) : (
          <input
            ref={inputRef}
            className="eq-mf-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => {
              if (e.key === 'Enter') { setEditing(false); if (draft !== (value || '')) onChangeRef.current(draft) }
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={`eq-mf-wrap eq-mf-preview${!value ? ' eq-mf-empty' : ''}`}
      onClick={startEdit} title="Click để chỉnh sửa">
      {value
        ? <MathText text={value} />
        : <span className="eq-placeholder">{placeholder}</span>}
      <span className="eq-edit-hint">✏️</span>
    </div>
  )
}

/* ─── Auto-resize textarea ─── */
function AutoTextarea({ value, onChange, placeholder, className, textareaRef }) {
  const innerRef = useRef(null)
  const ref = textareaRef || innerRef
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      className={`eq-textarea ${className || ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
    />
  )
}

/* ─── Report error popover ─── */
const ERROR_TYPES = [
  'Câu hỏi thiếu/sai nội dung',
  'Đáp án không chính xác',
  'Lỗi định dạng / ký tự',
  'Công thức toán bị lỗi',
  'Khác',
]
function ReportPopover({ onClose, onSubmit }) {
  const [selected, setSelected] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="eq-report-pop" ref={ref}>
      <div className="eq-rp-title">Báo cáo vấn đề</div>
      {ERROR_TYPES.map(t => (
        <label key={t} className="eq-rp-option">
          <input type="radio" name="err" checked={selected === t} onChange={() => setSelected(t)} />
          {t}
        </label>
      ))}
      <button className="eq-rp-submit" disabled={!selected}
        onClick={() => { onSubmit(selected); onClose() }}>
        Gửi báo cáo
      </button>
    </div>
  )
}

/* ─── LaTeX toolbar ─── */
const LATEX_SHORTCUTS = [
  { label: '$…$', snippet: '$ $', tip: 'Inline math', cursor: 1 },
  { label: '$$…$$', snippet: '$$ $$', tip: 'Block math', cursor: 3 },
  { label: 'frac', snippet: '\\frac{}{}', tip: 'Phân số', cursor: 6 },
  { label: '√', snippet: '\\sqrt{}', tip: 'Căn bậc 2', cursor: 6 },
  { label: 'ⁿ√', snippet: '\\sqrt[n]{}', tip: 'Căn bậc n', cursor: 8 },
  { label: 'xⁿ', snippet: '^{}', tip: 'Lũy thừa', cursor: 1 },
  { label: 'xₙ', snippet: '_{}', tip: 'Chỉ số dưới', cursor: 1 },
  { label: '∫', snippet: '\\int_{}^{}', tip: 'Tích phân', cursor: 5 },
  { label: 'Σ', snippet: '\\sum_{}^{}', tip: 'Tổng sigma', cursor: 5 },
  { label: 'lim', snippet: '\\lim_{}', tip: 'Giới hạn', cursor: 5 },
  { label: '∞', snippet: '\\infty', tip: 'Vô cực', cursor: 7 },
  { label: 'π', snippet: '\\pi', tip: 'Pi', cursor: 3 },
  { label: '→', snippet: '\\to', tip: 'Mũi tên', cursor: 3 },
  { label: '≤', snippet: '\\leq', tip: '≤', cursor: 4 },
  { label: '≥', snippet: '\\geq', tip: '≥', cursor: 4 },
  { label: '≠', snippet: '\\neq', tip: '≠', cursor: 4 },
  { label: '·', snippet: '\\cdot', tip: 'Nhân (·)', cursor: 5 },
  { label: '×', snippet: '\\times', tip: 'Nhân (×)', cursor: 6 },
  { label: 'vec', snippet: '\\vec{}', tip: 'Vector', cursor: 5 },
  { label: '|x|', snippet: '\\left| \\right|', tip: 'Giá trị tuyệt đối', cursor: 7 },
  { label: 'α', snippet: '\\alpha', tip: 'Alpha', cursor: 6 },
  { label: 'β', snippet: '\\beta', tip: 'Beta', cursor: 5 },
  { label: 'θ', snippet: '\\theta', tip: 'Theta', cursor: 6 },
  { label: '△', snippet: '\\triangle', tip: 'Tam giác', cursor: 9 },
  { label: '∈', snippet: '\\in', tip: 'Thuộc', cursor: 3 },
  { label: '⊂', snippet: '\\subset', tip: 'Tập con', cursor: 7 },
  { label: 'M(;;)', snippet: 'M(; ; )', tip: 'Toạ độ 3D', cursor: 2 },
  { label: 'M(;)', snippet: 'M(; )', tip: 'Toạ độ 2D', cursor: 2 },
  { label: '[a;b]', snippet: '[;]', tip: 'Đoạn [a;b]', cursor: 1 },
  { label: '(a;b)', snippet: '(;)', tip: 'Khoảng (a;b)', cursor: 1 },
  { label: 'overline', snippet: '\\overline{}', tip: 'Gạch trên (cung)', cursor: 10 },
  { label: '≈', snippet: '\\approx', tip: 'Xấp xỉ ≈', cursor: 7 },
  { label: 'max', snippet: '\\max', tip: 'Maximum', cursor: 4 },
  { label: 'min', snippet: '\\min', tip: 'Minimum', cursor: 4 },
  { label: '\\\\', snippet: '\\\\', tip: 'Xuống dòng', cursor: 2 },
  { label: 'begin{cases}', snippet: '\\begin{cases}\n \\\\\n \\end{cases}', tip: 'Hệ phương trình', cursor: 15 },
]

function insertSnippet(el, value, onChange, snippet, cursorFromStart) {
  if (!el) { onChange(value + snippet); return }
  const start = el.selectionStart
  const end = el.selectionEnd
  const sel = value.slice(start, end)

  let inserted, newCursor
  if (sel && snippet.includes('{}')) {
    // Wrap selection in first {}
    inserted = snippet.replace('{}', `{${sel}}`)
    newCursor = start + inserted.length
  } else if (snippet === '$ $' || snippet === '$$ $$') {
    inserted = sel ? `$${sel}$` : snippet
    newCursor = start + (sel ? sel.length + 2 : cursorFromStart)
  } else {
    inserted = snippet
    newCursor = start + cursorFromStart
  }

  const next = value.slice(0, start) + inserted + value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(newCursor, newCursor)
  })
}

function LatexToolbar({ taRef, value, onChange, onImageFile }) {
  const imgInputRef = useRef(null)
  return (
    <div className="eq-latex-toolbar">
      <span className="eq-lt-label">LaTeX:</span>
      <div className="eq-lt-btns">
        {LATEX_SHORTCUTS.map(s => (
          <button key={s.label} type="button" className="eq-lt-btn" title={s.tip}
            onClick={() => insertSnippet(taRef.current, value, onChange, s.snippet, s.cursor)}>
            {s.label}
          </button>
        ))}
        {onImageFile && (
          <>
            <span className="eq-lt-sep" />
            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) onImageFile(e.target.files[0]); e.target.value = '' }} />
            <button type="button" className="eq-lt-btn eq-lt-img-btn"
              title="Chèn ảnh (Ctrl+V dán, kéo thả trực tiếp vào khung soạn thảo)"
              onClick={() => imgInputRef.current?.click()}>
              🖼 Ảnh
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Inline image preview in split pane ─── */
function PreviewWithImages({ text, images }) {
  if (!text) return <span className="eq-placeholder">Xem trước xuất hiện ở đây…</span>
  const parts = text.split(/(\[img:[^\]]*\])/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[img:([^\]]*)\]$/)
        if (m) {
          const img = (images || []).find(im => im.id === m[1])
          if (img) {
            return (
              <span key={i} className="eq-preview-img-wrap">
                <img
                  src={img.dataUrl || (img.url ? `/images/${img.url.replace('images/', '')}` : '')}
                  alt={img.name || 'Hình'}
                  className="eq-preview-img"
                />
              </span>
            )
          }
          return <span key={i} className="eq-img-ref-placeholder">📷</span>
        }
        return part ? <MathText key={i} text={part} /> : null
      })}
    </>
  )
}

/* ─── Detect garbled LaTeX from LLM failure ─── */
function hasSuspiciousLatex(text) {
  if (!text || text.length < 8 || text.includes('$')) return false
  return (
    /\s{3,}/.test(text) ||
    /[a-z]\s[a-z]\s[a-z]/.test(text) ||
    /[A-Z]\s+[\d;\-]/.test(text) ||
    /\b(frac|sqrt|int|lim|sum|alpha|theta|infty)\b/.test(text) ||
    /\b[A-Z]\s+\d+\s*[;,]\s*\d/.test(text) ||
    /\b(dx|dy|dt|dz)\b/.test(text) ||
    /\b(ln|log|sin|cos|tan)\s+[a-z0-9(]/.test(text) ||
    /[A-Z]\s+[A-Z]\s+\d/.test(text)
  )
}

/* ─── Image gallery ─── */
function ImageGallery({ images, onAdd, onDelete, figurePath, onDeleteFigure }) {
  const fileRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh quá lớn (tối đa 5 MB).'); return }
    const reader = new FileReader()
    reader.onload = (e) => onAdd({ id: Date.now().toString(), dataUrl: e.target.result, name: file.name })
    reader.readAsDataURL(file)
  }

  const figSrc = figurePath ? `/images/${figurePath.replace('images/', '')}` : null
  const totalCount = (figSrc ? 1 : 0) + images.length

  return (
    <div className="eq-img-section">
      <div className="eq-img-header">
        <span className="eq-question-label">Hình ảnh đính kèm</span>
        {totalCount < 5 && (
          <button type="button" className="eq-img-add-btn"
            onClick={() => fileRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Thêm ảnh
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
      {totalCount > 0 && (
        <div className="eq-img-gallery">
          {/* Ảnh AI parse từ đề thi */}
          {figSrc && (
            <div className="eq-img-item">
              <img src={figSrc} alt="Hình từ đề thi" className="eq-img-thumb"
                onClick={() => window.open(figSrc, '_blank')} />
              <button type="button" className="eq-img-del" onClick={onDeleteFigure} title="Xoá hình AI">✕</button>
              <span className="eq-img-ai-badge">AI</span>
            </div>
          )}
          {images.map(img => (
            <div key={img.id} className="eq-img-item">
              <img
                src={img.dataUrl || (img.url ? `/images/${img.url.replace('images/', '')}` : '')}
                alt={img.name || 'Hình minh họa'}
                className="eq-img-thumb"
                onClick={() => window.open(img.dataUrl || img.url, '_blank')}
              />
              <button type="button" className="eq-img-del" onClick={() => onDelete(img.id)} title="Xoá ảnh">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Label Row: difficulty + topic ─── */
function TopicDropdown({ groups, value, onChange, onClose }) {
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const filtered = groups.flatMap(g =>
    g.topics
      .filter(t => !search || t.toLowerCase().includes(search.toLowerCase()) || g.group.toLowerCase().includes(search.toLowerCase()))
      .map(t => ({ topic: t, group: g.group }))
  )

  return (
    <div className="eq-topic-dropdown" ref={ref}>
      <input
        autoFocus
        className="eq-topic-search"
        placeholder="Tìm chủ đề…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onClose()}
      />
      <div className="eq-topic-list">
        {value && (
          <button className="eq-topic-option eq-topic-clear"
            onMouseDown={e => { e.preventDefault(); onChange(null); onClose() }}>
            ✕ Xóa nhãn chủ đề
          </button>
        )}
        {filtered.length === 0
          ? <div className="eq-topic-empty">Không tìm thấy</div>
          : filtered.map((item, i) => (
            <button key={i}
              className={`eq-topic-option ${value === item.topic ? 'selected' : ''}`}
              onMouseDown={e => { e.preventDefault(); onChange(item.topic); onClose() }}>
              <span className="eq-topic-group-tag">{item.group}</span>
              {item.topic}
            </button>
          ))
        }
      </div>
    </div>
  )
}

function LabelRow({ q, grade, onChange, onAutoClassify, classifying }) {
  const [topicOpen, setTopicOpen] = useState(false)
  const [hoveredDiff, setHoveredDiff] = useState(null)
  const groups = grade === 'thcs' ? THCS_LABEL_GROUPS : THPT_LABEL_GROUPS
  const activeDiff = DIFFICULTY_LEVELS.find(d => d.id === (hoveredDiff ?? q.level_label))

  return (
    <div className="eq-label-row">
      <div className="eq-label-section eq-label-section--diff">
        <span className="eq-label-section-title">Mức độ:</span>
        <div className="eq-diff-chips">
          {DIFFICULTY_LEVELS.map(d => (
            <button
              key={d.id} type="button"
              className={`eq-diff-chip ${q.level_label === d.id ? 'active' : ''}`}
              style={q.level_label === d.id ? { background: d.bg, color: d.color, borderColor: d.border } : {}}
              onClick={() => onChange({ ...q, level_label: q.level_label === d.id ? null : d.id })}
              onMouseEnter={() => setHoveredDiff(d.id)}
              onMouseLeave={() => setHoveredDiff(null)}
            >
              <span className="eq-diff-short">{d.short}</span>
              <span className="eq-diff-name">{d.id}</span>
            </button>
          ))}
        </div>
        {activeDiff && (
          <div className="eq-diff-desc-box" style={{ borderLeftColor: activeDiff.color }}>
            <span className="eq-diff-desc-level" style={{ color: activeDiff.color }}>
              {activeDiff.short} – {activeDiff.id}
            </span>
            <span className="eq-diff-desc-text">{activeDiff.desc}</span>
          </div>
        )}
      </div>

      <div className="eq-label-section eq-label-section--topic">
        <span className="eq-label-section-title">Chủ đề:</span>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`eq-topic-chip ${q.topic_label ? 'has-value' : ''}`}
            onClick={() => setTopicOpen(v => !v)}
          >
            {q.topic_label || 'Chọn chủ đề…'}
            <span className="eq-topic-arrow">▾</span>
          </button>
          {topicOpen && (
            <TopicDropdown
              groups={groups}
              value={q.topic_label || null}
              onChange={t => onChange({ ...q, topic_label: t })}
              onClose={() => setTopicOpen(false)}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        className={`eq-autoclassify-btn ${classifying ? 'loading' : ''}`}
        onClick={onAutoClassify}
        disabled={classifying || !q.question_text?.trim()}
        title="AI tự động nhận diện chủ đề và độ khó"
      >
        {classifying ? '⏳ Đang phân loại…' : '🤖 Tự phân loại'}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PHẦN I — Trắc nghiệm
═══════════════════════════════════════════ */
function MCQEditor({ q, onChange }) {
  const choices = q.choices || { A: '', B: '', C: '', D: '' }
  const correct = q.answer  // null = chưa có đáp án
  const setChoice = (key, val) => onChange({ ...q, choices: { ...choices, [key]: val } })
  const setCorrect = (key) => onChange({ ...q, answer: correct === key ? null : key })

  return (
    <div className="eq-body">
      <div className="eq-choices">
        {Object.entries(choices).map(([key, val]) => (
          <div key={key} className={`eq-choice-row ${correct === key ? 'correct' : ''}`}>
            <button className={`eq-choice-letter ${correct === key ? 'correct' : ''}`}
              onClick={() => setCorrect(key)} title="Click để chọn / bỏ chọn đáp án đúng" type="button">
              {key}
            </button>
            <MathEditField value={val} onChange={v => setChoice(key, v)} placeholder={`Đáp án ${key}…`} />
            {correct === key && <span className="eq-correct-tag">✓ Đúng</span>}
          </div>
        ))}
      </div>
      <p className="eq-hint">💡 Click chữ cái để đánh dấu đáp án đúng (click lại để bỏ)</p>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PHẦN II — Đúng / Sai
═══════════════════════════════════════════ */
function TFEditor({ q, onChange }) {
  const subs = q.sub_questions || []
  const updateSub = (idx, patch) => {
    const updated = subs.map((s, i) => i === idx ? { ...s, ...patch } : s)
    onChange({ ...q, sub_questions: updated })
  }
  return (
    <div className="eq-body">
      <div className="eq-subs">
        {subs.map((sub, idx) => (
          <div key={idx} className="eq-sub-row">
            <span className="eq-sub-label">{sub.label})</span>
            <MathEditField value={sub.text || ''} onChange={v => updateSub(idx, { text: v })} placeholder="Nội dung ý phụ…" />
            <div className="eq-tf-btns">
              <button className={`eq-tf-btn true ${sub.correct_answer === true ? 'active' : ''}`}
                onClick={() => updateSub(idx, { correct_answer: true })} type="button">Đ</button>
              <button className={`eq-tf-btn false ${sub.correct_answer === false ? 'active' : ''}`}
                onClick={() => updateSub(idx, { correct_answer: false })} type="button">S</button>
            </div>
          </div>
        ))}
      </div>
      <p className="eq-hint">💡 Click Đ/S để đặt đáp án cho từng ý</p>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PHẦN III — Trả lời ngắn
═══════════════════════════════════════════ */
function ShortEditor({ q, onChange }) {
  return (
    <div className="eq-body">
      <div className="eq-short-ans-row">
        <span className="eq-short-label">Đáp án:</span>
        <MathEditField
          value={q.answer || ''}
          onChange={v => onChange({ ...q, answer: v })}
          placeholder="Nhập đáp án đúng…"
          multiline={false}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Editable points badge
═══════════════════════════════════════════ */
function PointsBadge({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const open = () => { setDraft(value != null ? String(value) : ''); setEditing(true) }

  const save = () => {
    const num = parseFloat(draft)
    if (!isNaN(num) && num >= 0) onChange(num)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number" step="0.25" min="0" max="10"
        className="eq-pts-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return (
    <span className="eq-pts eq-pts-edit" onClick={open} title="Click để chỉnh điểm">
      {value != null ? `${value}đ` : '—đ'}
      <span className="eq-pts-pen">✏</span>
    </span>
  )
}

/* ═══════════════════════════════════════════
   Main EditableQuestion
═══════════════════════════════════════════ */
const SECTION_COLOR = {
  'PHẦN I': '#2563eb',
  'PHẦN II': '#7c3aed',
  'PHẦN III': '#059669',
  'TIẾNG ANH': '#0f766e',
  'READING': '#0e7490',
}

export default function EditableQuestion({
  q, index, pointsPerQ, onUpdate, onDelete, onReportSubmit, highlight, grade = 'thpt',
  readingMode = false, clozeMode = false,
}) {
  const [editingText, setEditingText] = useState(() => hasSuspiciousLatex(q.question_text))
  const [localText, setLocalText] = useState(q.question_text || '')
  const [showPreview, setShowPreview] = useState(true)
  const [showReport, setShowReport] = useState(false)
  const [reported, setReported] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [classifying, setClassifying] = useState(false)

  /* ── AI inline assistant ── */
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiImage, setAiImage] = useState(null)   // { dataUrl, b64, mime, name }
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [splitView, setSplitView] = useState(
    () => (q.passage_text?.length ?? 0) >= PASSAGE_SPLIT_THRESHOLD
  )
  const cardRef = useRef(null)
  const taRef = useRef(null)
  const aiFileRef = useRef(null)

  const autoClassify = async () => {
    if (!q.question_text?.trim()) return
    setClassifying(true)
    try {
      const res = await fetch('/api/classify-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: q.question_text, grade }),
      })
      if (res.ok) {
        const data = await res.json()
        onUpdate({
          ...q,
          topic_label: data.topic_label ?? q.topic_label,
          level_label: data.level_label ?? q.level_label,
        })
      }
    } catch { /* silent */ }
    setClassifying(false)
  }

  const handleAIImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh quá lớn (tối đa 5 MB)'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      const b64 = dataUrl.split(',')[1]
      setAiImage({ dataUrl, b64, mime: file.type, name: file.name })
    }
    reader.readAsDataURL(file)
  }

  const handleAIPaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        handleAIImageFile(item.getAsFile())
        return
      }
    }
  }

  const handleAIGenerate = async () => {
    if ((!aiPrompt.trim() && !aiImage) || aiLoading) return
    setAiLoading(true)
    setAiResult(null)
    setAiError(null)
    try {
      const promptText = aiPrompt.trim() || 'Tạo câu hỏi từ hình ảnh này'
      const ctx = q.question_text?.trim()
        ? `Câu hỏi hiện tại: "${q.question_text}"\n\nYêu cầu: ${promptText}`
        : promptText
      const payload = { prompt: ctx, section: q.section, count: 1 }
      if (aiImage) {
        payload.image_b64 = aiImage.b64
        payload.image_mime = aiImage.mime
      }
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      const gen = data.questions?.[0]
      if (!gen) throw new Error('AI không tạo được câu hỏi')
      setAiResult(gen)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAIApply = () => {
    const patch = { question_text: aiResult.question_text ?? q.question_text }
    if (aiResult.choices) patch.choices = aiResult.choices
    if (aiResult.answer !== undefined) patch.answer = aiResult.answer
    if (aiResult.sub_questions) patch.sub_questions = aiResult.sub_questions
    onUpdate({ ...q, ...patch })
    setShowAI(false)
    setAiResult(null)
    setAiPrompt('')
    setAiImage(null)
    setAiError(null)
  }

  const closeAI = () => {
    setShowAI(false)
    setAiResult(null)
    setAiError(null)
    setAiImage(null)
  }

  useEffect(() => {
    if (highlight && cardRef.current)
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

  const startEdit = () => { setEditingText(true); setLocalText(q.question_text || '') }
  const saveText = () => {
    setEditingText(false)
    if (localText !== q.question_text) onUpdate({ ...q, question_text: localText })
  }
  const cancelEdit = () => { setEditingText(false); setLocalText(q.question_text || '') }

  const handleAddImage = (img) => onUpdate({ ...q, images: [...(q.images || []), img] })
  const handleDeleteImage = (id) => onUpdate({ ...q, images: (q.images || []).filter(i => i.id !== id) })

  // Thêm ảnh vào gallery VÀ chèn marker [img:id] ở CUỐI nội dung (luôn append)
  const addImageAndInsertMarker = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh quá lớn (tối đa 5 MB).'); return }
    const id = `i${Date.now()}`
    const reader = new FileReader()
    reader.onload = (ev) => {
      onUpdate({ ...q, images: [...(q.images || []), { id, dataUrl: ev.target.result, name: file.name }] })
      const marker = `\n[img:${id}]`
      setLocalText(prev => prev + marker)
      requestAnimationFrame(() => {
        const ta = taRef.current
        if (ta) { ta.focus(); ta.scrollTop = ta.scrollHeight; const end = ta.value.length; ta.setSelectionRange(end, end) }
      })
    }
    reader.readAsDataURL(file)
  }

  const handleRawPaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) { addImageAndInsertMarker(file); return }
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files[0]) addImageAndInsertMarker(files[0])
  }
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDraggingOver(true) }
  const handleDragLeave = () => setIsDraggingOver(false)

  const handleReport = (type) => {
    setReported(true)
    onReportSubmit?.({ questionNum: q.question_number, section: q.section, type })
  }

  const color = SECTION_COLOR[q.section] || '#2563eb'
  const isEnglishLike = q.section === 'TIẾNG ANH' || q.section === 'READING'
  const images = q.images || []
  const totalImgs = (q.figure_path ? 1 : 0) + images.length
  const suspicious = hasSuspiciousLatex(q.question_text)

  return (
    <div ref={cardRef} className={`eq-card ${highlight ? 'eq-highlight' : ''}`} style={{ '--eq-color': color }}>

      {/* ── Header ── */}
      <div className="eq-header">
        <div className="eq-drag-handle" data-drag-handle title="Kéo để thay đổi vị trí">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2.5" cy="2" r="1.5" /><circle cx="7.5" cy="2" r="1.5" />
            <circle cx="2.5" cy="8" r="1.5" /><circle cx="7.5" cy="8" r="1.5" />
            <circle cx="2.5" cy="14" r="1.5" /><circle cx="7.5" cy="14" r="1.5" />
          </svg>
        </div>
        <div className="eq-header-left">
          <span className="eq-num" style={{ background: color }}>
            {isEnglishLike ? `Question ${q.question_number}` : `Câu ${q.question_number}`}
          </span>
          <PointsBadge
            value={q.points ?? pointsPerQ}
            onChange={pts => onUpdate({ ...q, points: pts })}
          />
          {totalImgs > 0 && <span className="eq-badge img">{totalImgs} ảnh{q.figure_path ? ' (AI)' : ''}</span>}
          {suspicious && !editingText && !isEnglishLike && (
            <button type="button" className="eq-latex-warn-inline" onClick={startEdit}
              title="Phát hiện nội dung có thể có lỗi LaTeX từ AI. Click để chỉnh sửa.">
              ⚠ LaTeX lỗi
            </button>
          )}
        </div>
        <div className="eq-header-right">
          <button
            className={`eq-icon-btn eq-ai-toggle ${showAI ? 'active' : ''}`}
            onClick={() => showAI ? closeAI() : setShowAI(true)}
            title="Trợ lý AI tạo câu hỏi"
            type="button"
          >
            🤖 Trợ lý
          </button>
          <div className="eq-report-wrap">
            {reported ? (
              <span className="eq-reported">✅ Đã báo cáo</span>
            ) : (
              <button className="eq-icon-btn report" onClick={() => setShowReport(v => !v)}
                title="Báo cáo lỗi" type="button">⚑ Báo lỗi</button>
            )}
            {showReport && (
              <ReportPopover onClose={() => setShowReport(false)} onSubmit={handleReport} />
            )}
          </div>
          <button className="eq-icon-btn delete" onClick={onDelete} title="Xoá câu hỏi" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
          </button>
        </div>
      </div>

      {/* ── AI inline panel ── */}
      {showAI && (
        <div className="eq-ai-panel">
          {/* Hidden file input */}
          <input
            ref={aiFileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleAIImageFile(e.target.files[0]); e.target.value = '' }}
          />

          <div className="eq-ai-input-row">
            <textarea
              className="eq-ai-prompt"
              placeholder={aiImage ? 'Thêm mô tả (tuỳ chọn)… Ví dụ: tạo câu khó hơn' : 'Mô tả câu hỏi muốn tạo… hoặc dán ảnh vào đây (Ctrl+V)'}
              value={aiPrompt}
              rows={2}
              autoFocus
              onChange={e => setAiPrompt(e.target.value)}
              onPaste={handleAIPaste}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIGenerate() }
                if (e.key === 'Escape') closeAI()
              }}
            />
            <div className="eq-ai-action-col">
              <button
                className="eq-ai-gen-btn"
                onClick={handleAIGenerate}
                disabled={aiLoading || (!aiPrompt.trim() && !aiImage)}
                type="button"
              >
                {aiLoading
                  ? <><span className="eq-ai-spinner" /> Đang tạo…</>
                  : <>✨ Tạo</>}
              </button>
              <button className="eq-ai-close-btn" onClick={closeAI} type="button">Huỷ</button>
            </div>
          </div>

          {/* Image attachment row */}
          <div className="eq-ai-attach-row">
            {aiImage ? (
              <div className="eq-ai-img-preview">
                <img src={aiImage.dataUrl} alt={aiImage.name} className="eq-ai-img-thumb" />
                <span className="eq-ai-img-name">{aiImage.name || 'Ảnh đã chọn'}</span>
                <button
                  type="button"
                  className="eq-ai-img-remove"
                  onClick={() => setAiImage(null)}
                  title="Xoá ảnh"
                >✕</button>
              </div>
            ) : (
              <button
                type="button"
                className="eq-ai-attach-btn"
                onClick={() => aiFileRef.current?.click()}
                title="Chọn ảnh hoặc dán ảnh (Ctrl+V) vào textarea"
              >
                📎 Đính kèm ảnh
              </button>
            )}
          </div>

          {aiError && <div className="eq-ai-error">{aiError}</div>}

          {aiResult && (
            <div className="eq-ai-result">
              <div className="eq-ai-result-label">Xem trước câu hỏi AI tạo</div>

              <div className="eq-ai-result-text">
                <MathText text={aiResult.question_text || ''} />
              </div>

              {/* MCQ choices */}
              {aiResult.choices && (
                <div className="eq-ai-result-choices">
                  {['A', 'B', 'C', 'D'].map(k => (
                    <span key={k} className={`eq-ai-result-choice ${aiResult.answer === k ? 'correct' : ''}`}>
                      <strong>{k}.</strong>&nbsp;<MathText text={aiResult.choices[k] || ''} />
                    </span>
                  ))}
                </div>
              )}

              {/* True/False sub_questions */}
              {aiResult.sub_questions && (
                <div className="eq-ai-result-subs">
                  {aiResult.sub_questions.map(sub => (
                    <div key={sub.label} className={`eq-ai-result-sub ${sub.correct_answer ? 'true' : 'false'}`}>
                      <strong>{sub.label})</strong>&nbsp;<MathText text={sub.text || ''} />
                      <span className="eq-ai-sub-tag">{sub.correct_answer ? 'Đúng' : 'Sai'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Short answer */}
              {q.section === 'PHẦN III' && aiResult.answer != null && (
                <div className="eq-ai-result-short">
                  Đáp án: <strong><MathText text={String(aiResult.answer)} /></strong>
                </div>
              )}

              <div className="eq-ai-apply-row">
                <button className="eq-ai-apply-btn" onClick={handleAIApply} type="button">
                  ✓ Áp dụng
                </button>
                <button
                  className="eq-ai-retry-btn"
                  onClick={handleAIGenerate}
                  disabled={aiLoading}
                  type="button"
                >
                  ↻ Tạo lại
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Labels (ẩn trong chế độ bài đọc — cột phải gọn gàng) ── */}
      {!readingMode && (
        <LabelRow
          q={q}
          grade={grade}
          onChange={onUpdate}
          onAutoClassify={autoClassify}
          classifying={classifying}
        />
      )}

      {/* ── Chế độ bài đọc (READING): chỉ nội dung câu hỏi + đáp án, không đoạn văn ── */}
      {readingMode ? (
        <>
          {clozeMode ? (
            <div className="eq-cloze-note">
              ✍️ Câu điền từ — đáp án sẽ điền vào chỗ trống <strong>({q.question_number})</strong> trong đoạn văn.
              Chỉ cần chọn đáp án đúng bên dưới.
            </div>
          ) : (
            <div className="eq-question-section" style={{ paddingTop: 0 }}>
              <span className="eq-question-label">Nội dung câu hỏi</span>
              <PassageEditor
                value={q.question_text || ''}
                onChange={val => onUpdate({ ...q, question_text: val })}
              />
            </div>
          )}

          <ImageGallery
            images={images}
            onAdd={handleAddImage}
            onDelete={handleDeleteImage}
            figurePath={q.figure_path}
            onDeleteFigure={() => onUpdate({ ...q, figure_path: undefined, has_figure: false })}
          />

          <div className="eq-answers-section">
            <div className="eq-question-label">
              Đáp án (click chữ cái để đánh dấu đúng)
              {!q.answer && <span className="eq-no-answer-note"> — Chưa có đáp án từ đề</span>}
            </div>
            <MCQEditor q={q} onChange={onUpdate} />
          </div>
        </>
      ) : isEnglishLike ? (() => {
        const isLong = (q.passage_text?.length ?? 0) >= PASSAGE_SPLIT_THRESHOLD
        const hasPassage = q.passage_text || q.passage_title
        return (
          <>
            {hasPassage && isLong && (
              <div className="eq-split-togglebar">
                <span className="eq-split-badge">📖 Bài đọc dài</span>
                <button type="button"
                  className={`eq-split-btn ${splitView ? 'active' : ''}`}
                  onClick={() => setSplitView(true)}>
                  ⊞ 2 cột
                </button>
                <button type="button"
                  className={`eq-split-btn ${!splitView ? 'active' : ''}`}
                  onClick={() => setSplitView(false)}>
                  1 cột
                </button>
              </div>
            )}

            {splitView && hasPassage ? (
              /* ── Layout 2 cột ── */
              <div className="eq-split-layout">
                {/* Trái: bài đọc cố định */}
                <div className="eq-split-pane eq-split-pane--passage">
                  <div className="eq-split-pane-label">
                    📄 Đoạn văn / Bài đọc
                    {q.passage_title && <span className="eq-passage-title-tag">{q.passage_title}</span>}
                  </div>
                  <PassageEditor
                    value={q.passage_text || ''}
                    onChange={val => onUpdate({ ...q, passage_text: val })}
                  />
                </div>

                <div className="eq-split-divider" />

                {/* Phải: câu hỏi + đáp án cuộn */}
                <div className="eq-split-pane eq-split-pane--question">
                  <div className="eq-split-pane-label">❓ Câu hỏi & Đáp án</div>

                  <div className="eq-question-section" style={{ paddingTop: 0 }}>
                    <span className="eq-question-label">Nội dung câu hỏi</span>
                    <PassageEditor
                      value={q.question_text || ''}
                      onChange={val => onUpdate({ ...q, question_text: val })}
                    />
                  </div>

                  <ImageGallery
                    images={images}
                    onAdd={handleAddImage}
                    onDelete={handleDeleteImage}
                    figurePath={q.figure_path}
                    onDeleteFigure={() => onUpdate({ ...q, figure_path: undefined, has_figure: false })}
                  />

                  <div className="eq-answers-section">
                    <div className="eq-question-label">
                      Đáp án (click chữ cái để đánh dấu đúng)
                      {!q.answer && <span className="eq-no-answer-note"> — Chưa có đáp án từ đề</span>}
                    </div>
                    <MCQEditor q={q} onChange={onUpdate} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Layout 1 cột ── */
              <>
                {hasPassage && (
                  <div className="eq-passage-block">
                    <div className="eq-passage-label">
                      📄 Đoạn văn / Bài đọc
                      {q.passage_title && <span className="eq-passage-title-tag">{q.passage_title}</span>}
                    </div>
                    <PassageEditor
                      value={q.passage_text || ''}
                      onChange={val => onUpdate({ ...q, passage_text: val })}
                    />
                  </div>
                )}

                <div className="eq-question-section">
                  <span className="eq-question-label">Nội dung câu hỏi</span>
                  <PassageEditor
                    value={q.question_text || ''}
                    onChange={val => onUpdate({ ...q, question_text: val })}
                  />
                </div>

                <ImageGallery
                  images={images}
                  onAdd={handleAddImage}
                  onDelete={handleDeleteImage}
                  figurePath={q.figure_path}
                  onDeleteFigure={() => onUpdate({ ...q, figure_path: undefined, has_figure: false })}
                />

                <div className="eq-answers-section">
                  <div className="eq-question-label">
                    Đáp án (click chữ cái để đánh dấu đúng)
                    {!q.answer && <span className="eq-no-answer-note"> — Chưa có đáp án từ đề</span>}
                  </div>
                  <MCQEditor q={q} onChange={onUpdate} />
                </div>
              </>
            )}
          </>
        )
      })() : (
        /* ── Toán: LaTeX editor đầy đủ ── */
        <>
          <div className="eq-question-section">
            <span className="eq-question-label">Nội dung câu hỏi</span>
            {editingText ? (
              <div
                className={`eq-latex-editor ${isDraggingOver ? 'eq-drop-active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {suspicious && (
                  <div className="eq-llm-fail-note">
                    <span>🤖 AI có thể đọc sai LaTeX — Kiểm tra và nhập lại đúng cú pháp bên dưới. Dán ảnh bằng Ctrl+V hoặc kéo thả ảnh vào đây.</span>
                  </div>
                )}
                {isDraggingOver && (
                  <div className="eq-drop-overlay">🖼 Thả ảnh vào đây để chèn</div>
                )}
                <LatexToolbar taRef={taRef} value={localText} onChange={setLocalText} onImageFile={addImageAndInsertMarker} />
                <div className={`eq-le-panes ${showPreview ? '' : 'no-preview'}`}>
                  <div className="eq-le-left">
                    <div className="eq-le-pane-label">Nhập LaTeX</div>
                    <textarea
                      ref={taRef}
                      className="eq-le-raw"
                      value={localText}
                      onChange={e => setLocalText(e.target.value)}
                      onPaste={handleRawPaste}
                      placeholder={`Nhập nội dung. Bao công thức bằng $...$\nVí dụ: Cho hàm số $f(x)=\\frac{2x+1}{x}$\nToạ độ: $M(-500; 300; 500)$`}
                      rows={6}
                      spellCheck={false}
                    />
                  </div>
                  {showPreview && (
                    <div className="eq-le-right">
                      <div className="eq-le-pane-label">Xem trước</div>
                      <div className="eq-le-preview">
                        <PreviewWithImages text={localText} images={q.images || []} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="eq-edit-actions">
                  <button type="button" className="eq-preview-toggle"
                    onClick={() => setShowPreview(v => !v)}>
                    {showPreview ? '⊟ Ẩn xem trước' : '⊞ Hiện xem trước'}
                  </button>
                  <span style={{ flex: 1 }} />
                  <button className="eq-cancel-btn" onClick={cancelEdit} type="button">✕ Huỷ</button>
                  <button className="eq-save-btn" onClick={saveText} type="button">✓ Lưu</button>
                </div>
              </div>
            ) : (
              <div className="eq-qtext-display" onClick={startEdit} title="Click để chỉnh sửa">
                {q.question_text
                  ? <MathText text={q.question_text} />
                  : <span className="eq-placeholder">Click để nhập nội dung câu hỏi…</span>}
                <span className="eq-edit-hint">✏️</span>
              </div>
            )}
          </div>

          <ImageGallery
            images={images}
            onAdd={handleAddImage}
            onDelete={handleDeleteImage}
            figurePath={q.figure_path}
            onDeleteFigure={() => onUpdate({ ...q, figure_path: undefined, has_figure: false })}
          />

          <div className="eq-answers-section">
            <div className="eq-question-label">
              {q.section === 'PHẦN I' && 'Đáp án (click chữ cái để đánh dấu đúng)'}
              {q.section === 'PHẦN II' && 'Các ý phụ (Đ = Đúng, S = Sai)'}
              {q.section === 'PHẦN III' && 'Đáp án đúng'}
            </div>
            {q.section === 'PHẦN I' && <MCQEditor q={q} onChange={onUpdate} />}
            {q.section === 'PHẦN II' && <TFEditor q={q} onChange={onUpdate} />}
            {q.section === 'PHẦN III' && <ShortEditor q={q} onChange={onUpdate} />}
          </div>
        </>
      )}
    </div>
  )
}

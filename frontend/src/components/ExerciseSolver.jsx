import React, { useEffect, useRef, useState } from 'react'
import Geo3DViewer from './Geo3DViewer.jsx'
import MathText from './MathText.jsx'

/* ── SVG Icons ── */
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
  </svg>
)

const BookOpenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
  </svg>
)

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

const ChevronUpIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const PhotoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const PaperclipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

/* ── phase: 'input' | 'loading' | 'theory' | 'steps' ── */

function Spinner() {
  return (
    <div className="es-loading">
      <div className="es-spinner" />
      <p className="es-loading-text">AI đang phân tích bài tập…</p>
    </div>
  )
}

function TheoryCard({ item, index }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="es-card es-card--theory">
      <button className="es-card-head" onClick={() => setOpen(v => !v)}>
        <span className="es-card-num">{index + 1}</span>
        <span className="es-card-title">{item.title}</span>
        <span className="es-card-toggle">{open ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
      </button>
      {open && (
        <div className="es-card-body">
          <MathText text={item.content} />
        </div>
      )}
    </div>
  )
}

function StepCard({ item, index, revealed, onReveal }) {
  return (
    <div className={`es-card es-card--step ${revealed ? 'es-card--revealed' : ''}`}>
      <button className="es-card-head" onClick={onReveal}>
        <span className="es-card-num es-card-num--step">{index + 1}</span>
        <span className="es-card-title">{item.title}</span>
        {!revealed && <span className="es-card-lock"><LockIcon /></span>}
        {revealed && <span className="es-card-toggle"><ChevronUpIcon /></span>}
      </button>
      {revealed && (
        <div className="es-card-body">
          <MathText text={item.content} />
        </div>
      )}
    </div>
  )
}

export default function ExerciseSolver({ onBack }) {
  const [phase,        setPhase]        = useState('input')
  const [exercise,     setExercise]     = useState('')
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState(null)
  const [revealed,     setRevealed]     = useState([])
  const [isDragging,   setIsDragging]   = useState(false)
  const fileRef    = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  const attachImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onDragOver = (e) => {
    e.preventDefault()
    if ([...e.dataTransfer.types].includes('Files')) setIsDragging(true)
  }
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false)
  }
  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) { attachImage(file); return }
    const text = e.dataTransfer.getData('text')
    if (text) setExercise(prev => prev + text)
  }

  const canSubmit = exercise.trim().length > 0 || imageFile !== null

  const handleSolve = async () => {
    if (!canSubmit) return
    setPhase('loading')
    setError(null)
    try {
      const fd = new FormData()
      if (exercise.trim()) fd.append('exercise', exercise.trim())
      if (imageFile) fd.append('file', imageFile)
      const res = await fetch('/api/solve-exercise', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
      setRevealed([])
      setPhase('theory')
    } catch (e) {
      setError(e.message)
      setPhase('input')
    }
  }

  const resetAll = () => {
    setPhase('input'); setResult(null); setExercise(''); removeImage(); setIsDragging(false)
  }

  const revealStep = (i) =>
    setRevealed(prev => prev.includes(i) ? prev : [...prev, i])

  const revealAll = () =>
    setRevealed((result.steps || []).map((_, i) => i))

  const isGeo  = result?.is_geometry && result?.geometry_data
  const geoData = result?.geometry_data ?? null

  const renderContent = () => {
    if (phase === 'theory') {
      return (
        <div className="es-panel">
          <div className="es-panel-header">
            <span className="es-phase-badge es-phase-badge--theory">
              <BookOpenIcon /> Lý thuyết cần biết
            </span>
          </div>
          <div className="es-cards-list">
            {(result.theory || []).map((item, i) => (
              <TheoryCard key={i} item={item} index={i} />
            ))}
          </div>
          <div className="es-panel-footer">
            <p className="es-hint">Đã hiểu lý thuyết? Bắt đầu xem từng bước giải</p>
            <button className="es-advance-btn" onClick={() => setPhase('steps')}>
              Bắt đầu giải chi tiết <ArrowRightIcon />
            </button>
          </div>
        </div>
      )
    }

    if (phase === 'steps') {
      const allRevealed = revealed.length === (result.steps || []).length
      return (
        <div className="es-panel">
          <div className="es-panel-header">
            <button className="es-back-link" onClick={() => setPhase('theory')}>
              <ArrowLeftIcon /> Xem lại lý thuyết
            </button>
            <span className="es-phase-badge es-phase-badge--steps">
              <PencilIcon /> Từng bước giải
            </span>
          </div>
          <div className="es-cards-list">
            {(result.steps || []).map((item, i) => (
              <StepCard
                key={i}
                item={item}
                index={i}
                revealed={revealed.includes(i)}
                onReveal={() => revealStep(i)}
              />
            ))}
          </div>
          {!allRevealed && (
            <div className="es-panel-footer">
              <button className="es-advance-btn es-advance-btn--alt" onClick={revealAll}>
                Xem tất cả bước giải
              </button>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="es-page">

      {/* Top bar */}
      <div className="es-header">
        <button className="tool-page-back" onClick={onBack}>
          <ArrowLeftIcon /> Quay lại
        </button>
        <span className="es-header-title">
          <SparklesIcon /> Giải bài tập toán
        </span>
        {result && phase !== 'input' && (
          <button className="es-new-btn" onClick={resetAll}>
            <RefreshIcon /> Bài mới
          </button>
        )}
      </div>

      {/* Body */}
      <div className="es-body">

        {/* ── Input phase ── */}
        {phase === 'input' && (
          <div className="es-input-area">
            <div
              className={`es-unified-box${isDragging ? ' es-unified-box--dragging' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {isDragging && (
                <div className="es-drop-overlay">
                  <PhotoIcon /> Thả ảnh vào đây
                </div>
              )}

              {imagePreview && (
                <div className="es-img-chip">
                  <img src={imagePreview} alt="preview" className="es-img-chip-thumb" />
                  <span className="es-img-chip-name">{imageFile?.name}</span>
                  <button className="es-img-chip-remove" onClick={removeImage} title="Xóa ảnh">×</button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="es-unified-textarea"
                value={exercise}
                onChange={e => setExercise(e.target.value)}
                placeholder={
                  imageFile
                    ? "Ghi chú thêm cho AI (không bắt buộc)…"
                    : "Nhập đề bài, LaTeX $x^2+y^2=r^2$, hoặc kéo thả ảnh vào đây…"
                }
                onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleSolve() }}
              />

              {exercise.trim() && (
                <div className="es-preview-pane">
                  <span className="es-preview-label">Xem trước</span>
                  <div className="es-preview-content">
                    <MathText text={exercise} />
                  </div>
                </div>
              )}

              <div className="es-unified-toolbar">
                <button
                  className="es-attach-btn"
                  onClick={() => fileRef.current?.click()}
                  title="Đính kèm ảnh"
                  type="button"
                >
                  <PaperclipIcon /> Đính kèm ảnh
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => attachImage(e.target.files?.[0])}
                />
                <div className="es-toolbar-right">
                  <span className="es-hint-small">Ctrl+Enter</span>
                  <button className="es-solve-btn" onClick={handleSolve} disabled={!canSubmit}>
                    Giải bài <ArrowRightIcon />
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="es-error">{error}</div>}
          </div>
        )}

        {/* ── Loading ── */}
        {phase === 'loading' && <Spinner />}

        {/* ── Theory & Steps ── */}
        {(phase === 'theory' || phase === 'steps') && (
          <div className={`es-result ${isGeo ? 'es-result--split' : ''}`}>
            {isGeo && (
              <div className="es-geo-panel">
                <div className="es-geo-label">Hình không gian</div>
                <div className="es-geo-wrap">
                  <Geo3DViewer initialSceneData={geoData} />
                </div>
              </div>
            )}
            {renderContent()}
          </div>
        )}

      </div>
    </div>
  )
}

import React, { useCallback, useEffect, useState } from 'react'
import { blockReload } from '../realtime/reloadGuard.js'
import UploadStep       from '../components/create-exam/UploadStep.jsx'
import ImageUploadStep  from '../components/create-exam/ImageUploadStep.jsx'
import ImageWordStep    from '../components/create-exam/ImageWordStep.jsx'
import ProcessingStep   from '../components/create-exam/ProcessingStep.jsx'
import ReviewStep       from '../components/create-exam/ReviewStep.jsx'
import ExamPreviewModal from '../components/ExamPreviewModal.jsx'
import { createExam, updateExam } from '../store/examStore.js'
import { authHeaders } from '../auth/mockUsers.js'

function PencilIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

function FileWordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

/* ── Step configs ── */
const STEP = {
  upload:     { id: 'upload',     label: 'Upload',          icon: '📤' },
  word:       { id: 'word',       label: 'File Word',       icon: <FileWordIcon /> },
  processing: { id: 'processing', label: 'AI xử lý',        icon: '🤖' },
  review:     { id: 'review',     label: 'Xem & Chỉnh sửa', icon: <PencilIcon size={14} /> },
}
const MANUAL_STEPS = [{ id: 'review', label: 'Soạn thảo', icon: '✍️' }]

/* outputs: lựa chọn ở bước tải ảnh (đề thi / File Word), null với PDF */
function stepsFor(manual, outputs) {
  if (manual) return MANUAL_STEPS
  if (!outputs?.word) return [STEP.upload, STEP.processing, STEP.review]
  if (!outputs.exam) return [STEP.upload, STEP.word]
  return [STEP.upload, STEP.word, STEP.processing, STEP.review]
}

function StepIndicator({ current, manual, outputs }) {
  const steps = stepsFor(manual, outputs)
  const currentIdx = steps.findIndex(s => s.id === current)
  return (
    <div className="ce-steps">
      {steps.map((s, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <React.Fragment key={s.id}>
            <div className={`ce-step ${done ? 'done' : active ? 'active' : 'pending'}`}>
              <div className="ce-step-circle">{done ? '✓' : s.icon}</div>
              <span className="ce-step-label">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`ce-step-line ${done ? 'done' : ''}`} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const EMPTY_RESULT = {
  source:          'Đề thi thủ công',
  total_questions: 0,
  sections: {
    'PHẦN I':   { questions: [], points_per_q: 0.25 },
    'PHẦN II':  { questions: [], points_per_q: 1.0  },
    'PHẦN III': { questions: [], points_per_q: 0.5  },
    'TỰ LUẬN':  { questions: [], points_per_q: 1.0  },
  },
}

/**
 * Props:
 *   user          — user đang đăng nhập
 *   classId       — lớp sở hữu đề (bắt buộc khi tạo đề mới, đề luôn thuộc một lớp)
 *   onDone        — callback khi lưu xong / hủy, quay lại danh sách đề của lớp
 *   editingExam   — exam object đang sửa (optional)
 *   manualMode    — bắt đầu ở bước soạn thảo với đề trống (optional)
 *   mixResult     — pre-filled result từ Phối đề ngẫu nhiên (optional)
 */
export default function CreateExamPage({ user, classId, onDone, editingExam, manualMode, mixResult, fromImages = false, subject = 'toan' }) {
  // Suốt cả màn hình soạn đề: đang trích xuất PDF hoặc đang sửa câu hỏi mà reload
  // là mất sạch công sức — chỉ hiện banner, nạp bản mới sau khi lưu xong.
  useEffect(() => blockReload('dang-soan-de'), [])

  const isEditing = !!editingExam
  const isManual  = !!manualMode && !isEditing
  const isMix     = !!mixResult && !isEditing && !isManual
  // Môn của đề: khi sửa lấy từ đề đã lưu, khi tạo mới lấy từ lựa chọn ban đầu
  const examSubject = (isEditing ? editingExam.subject : subject) || 'toan'

  const initialResult = isEditing
    ? { source: editingExam.source, total_questions: editingExam.totalQuestions, sections: editingExam.sections }
    : isManual ? EMPTY_RESULT
    : isMix    ? mixResult
    : null

  const [phase,             setPhase]             = useState((isEditing || isManual || isMix) ? 'review' : 'upload')
  const [events,            setEvents]            = useState([])
  const [result,            setResult]            = useState(initialResult)
  const [title,             setTitle]             = useState(isEditing ? editingExam.title : isMix ? 'Đề phối ngẫu nhiên' : '')
  const [examGrade,         setExamGrade]         = useState(isEditing ? (editingExam.grade || null) : null)
  const [editedResult,      setEditedResult]      = useState(null)
  const [showPreview,       setShowPreview]       = useState(false)
  const [previewEditTarget, setPreviewEditTarget] = useState(null)
  // Tạo đề từ ảnh: chọn đầu ra và các ảnh, giữ lại để bước File Word không mất khi tạo đề lỗi
  const [imageOutputs,      setImageOutputs]      = useState(null)
  const [wordFiles,         setWordFiles]         = useState(null)

  /* ── Upload & AI extraction ── */
  // texts: nội dung từng trang đã sửa ở bước File Word; lỗi thì quay lại đúng bước đó
  const handleUpload = useCallback(async (source, texts) => {
    const backPhase = texts ? 'word' : 'upload'
    setPhase('processing')
    setEvents([])
    setResult(null)

    const form = new FormData()
    const isImages = Array.isArray(source)
    if (isImages) source.forEach(file => form.append('files', file))
    else form.append('file', source)
    if (texts) form.append('texts', JSON.stringify(texts))
    form.append('subject', examSubject)
    let taskId
    try {
      const res = await fetch(isImages ? '/api/extract-images' : '/api/extract', {
        method: 'POST', body: form, headers: isImages ? authHeaders() : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.detail || `HTTP ${res.status}`)
      }
      taskId = (await res.json()).task_id
    } catch (e) {
      setPhase(backPhase)
      setEvents([{ type: 'error', message: `Upload thất bại: ${e.message}` }])
      return
    }

    const sse = new EventSource(`/api/progress/${taskId}`)
    sse.onmessage = (e) => {
      const evt = JSON.parse(e.data)
      setEvents(prev => [...prev, evt])
      if (evt.type === 'done') {
        sse.close()
        fetch(`/api/result/${taskId}`)
          .then(r => { if (!r.ok) throw new Error(); return r.json() })
          .then(data => { setResult(data); setTitle(data.source.replace(/\.(pdf|jpe?g|png|webp)$/i, '')); setPhase('review') })
          .catch(() => { setPhase(backPhase); setEvents(prev => [...prev, { type: 'error', message: 'Lấy kết quả thất bại.' }]) })
      }
      if (evt.type === 'error') { sse.close(); setPhase(backPhase) }
    }
    sse.onerror = () => {
      sse.close(); setPhase(backPhase)
      setEvents(prev => [...prev, { type: 'error', message: 'Mất kết nối với server.' }])
    }
  }, [examSubject])

  /* ── Helpers để sync exam lên server ── */
  const syncToServer = (exam) =>
    fetch(`/api/exams/${exam.id}`, {
      method:  'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body:    JSON.stringify({ ...exam, teacherId: user.id }),
    }).then(r => r.json()).catch(err => { console.warn(err); return null })

  /* ── Lưu lại (không phát đề) — dùng cho cả edit lẫn manual ── */
  const handleSaveOnly = async (edited) => {
    const t = title.trim() || 'Đề thi chưa đặt tên'
    let exam
    if (isEditing) {
      exam = updateExam(editingExam, { title: t, result: edited, grade: examGrade })
    } else {
      // Manual mode: dựng object đề mới (chưa publish), gắn với lớp đang mở —
      // syncToServer ngay bên dưới mới là bước ghi thật.
      exam = createExam({ title: t, result: edited, userId: user.id, classId, subject: examSubject, grade: examGrade })
    }
    const res = await syncToServer(exam)
    if (res?.rescored > 0) {
      alert(`✅ Đã lưu đề và tự động chấm lại điểm cho ${res.rescored} bài nộp theo đáp án mới.`)
    }
    onDone()
  }

  const handlePreview      = (edited) => { setEditedResult(edited); setShowPreview(true) }
  const handleEditFromPreview = ()    => { setShowPreview(false); setPreviewEditTarget(null) }

  /* Bước tải ảnh: chỉ tạo đề thì gửi thẳng đi, có File Word thì nhận dạng và sửa trước */
  const handleImagesChosen = (files, outputs) => {
    setImageOutputs(outputs)
    if (!outputs.word) { handleUpload(files); return }
    setEvents([])
    setWordFiles(files)
    setPhase('word')
  }

  const stepId = phase

  return (
    <div className="create-exam-page">
      <div className="ce-header">
        <div className="ce-header-inner">
          <div className="ce-page-title">
            <h1>
              {isEditing ? <><PencilIcon /> Chỉnh sửa đề thi</>
                : isMix   ? '🎲 Phối đề ngẫu nhiên'
                : isManual ? '✍️ Tạo đề thi thủ công'
                : <><PencilIcon /> Tạo đề thi mới</>}
            </h1>
            <p>
              {isEditing ? `Đang sửa: ${editingExam.title}`
                : isMix   ? `${mixResult.total_questions} câu đã được phối — Chỉnh sửa và Lưu`
                : isManual ? 'Thêm câu hỏi rồi Lưu lại'
                : fromImages
                  ? (imageOutputs?.word && !imageOutputs.exam ? 'Tải ảnh — AI nhận dạng — Sửa — Tải file Word'
                    : imageOutputs?.word ? 'Tải ảnh — Sửa & tải file Word — AI tách câu hỏi — Lưu đề'
                    : 'Tải ảnh — AI trích xuất — Chỉnh sửa — Lưu')
                  : 'Upload PDF — AI trích xuất — Chỉnh sửa — Lưu'}
            </p>
          </div>
          <StepIndicator current={stepId} manual={isManual || isEditing || isMix} outputs={fromImages ? imageOutputs : null} />
        </div>
      </div>

      <div className="ce-body">
        {phase === 'upload' && (
          fromImages
            ? <ImageUploadStep onUpload={handleImagesChosen} errorFromPrev={events.find(e => e.type === 'error')} />
            : <UploadStep onUpload={handleUpload} errorFromPrev={events.find(e => e.type === 'error')} />
        )}
        {wordFiles && (
          /* Giữ nguyên khi sang bước tạo đề, để tạo đề lỗi thì quay lại vẫn còn phần đã sửa */
          <div style={{ display: phase === 'word' ? undefined : 'none' }}>
            <ImageWordStep
              files={wordFiles}
              makeExam={imageOutputs.exam}
              onCreateExam={handleUpload}
              onFinish={onDone}
              errorFromPrev={phase === 'word' ? events.find(e => e.type === 'error') : null}
            />
          </div>
        )}
        {phase === 'processing' && (
          <ProcessingStep events={events} source={title} />
        )}
        {phase === 'review' && result && (
          <ReviewStep
            result={result}
            title={title}
            subject={examSubject}
            examGrade={examGrade}
            onExamGradeChange={setExamGrade}
            onTitleChange={setTitle}
            onPreview={handlePreview}
            onSave={handleSaveOnly}
            scrollToQuestion={previewEditTarget}
          />
        )}
      </div>

      {showPreview && editedResult && (
        <ExamPreviewModal
          result={editedResult}
          title={title}
          onClose={() => setShowPreview(false)}
          onSave={() => { setShowPreview(false); handleSaveOnly(editedResult) }}
          onEditQuestion={handleEditFromPreview}
        />
      )}
    </div>
  )
}

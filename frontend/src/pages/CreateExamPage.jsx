import React, { useCallback, useState } from 'react'
import UploadStep       from '../components/create-exam/UploadStep.jsx'
import ProcessingStep   from '../components/create-exam/ProcessingStep.jsx'
import ReviewStep       from '../components/create-exam/ReviewStep.jsx'
import ExamPreviewModal from '../components/ExamPreviewModal.jsx'
import { createExam, updateExam } from '../store/examStore.js'

/* ── Step configs ── */
const UPLOAD_STEPS = [
  { id: 'upload',     label: 'Upload',          icon: '📤' },
  { id: 'processing', label: 'AI xử lý',        icon: '🤖' },
  { id: 'review',     label: 'Xem & Chỉnh sửa', icon: '✏️' },
]
const UPLOAD_ORDER = ['upload', 'processing', 'review']

const MANUAL_STEPS = [
  { id: 'review', label: 'Soạn thảo', icon: '✍️' },
]
const MANUAL_ORDER = ['review']

function StepIndicator({ current, manual }) {
  const steps = manual ? MANUAL_STEPS : UPLOAD_STEPS
  const order = manual ? MANUAL_ORDER : UPLOAD_ORDER
  const currentIdx = order.indexOf(current)
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
export default function CreateExamPage({ user, classId, onDone, editingExam, manualMode, mixResult, subject = 'toan' }) {
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

  /* ── Upload & AI extraction ── */
  const handleUpload = useCallback(async (file) => {
    setPhase('processing')
    setEvents([])
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('subject', examSubject)
    let taskId
    try {
      const res  = await fetch('/api/extract', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      taskId = (await res.json()).task_id
    } catch (e) {
      setPhase('upload')
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
          .then(data => { setResult(data); setTitle(data.source.replace(/\.pdf$/i, '')); setPhase('review') })
          .catch(() => { setPhase('upload'); setEvents(prev => [...prev, { type: 'error', message: 'Lấy kết quả thất bại.' }]) })
      }
      if (evt.type === 'error') { sse.close(); setPhase('upload') }
    }
    sse.onerror = () => {
      sse.close(); setPhase('upload')
      setEvents(prev => [...prev, { type: 'error', message: 'Mất kết nối với server.' }])
    }
  }, [examSubject])

  /* ── Helpers để sync exam lên server ── */
  const syncToServer = (exam) =>
    fetch(`/api/exams/${exam.id}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...exam, teacherId: user.id }),
    }).then(r => r.json()).catch(err => { console.warn(err); return null })

  /* ── Lưu lại (không phát đề) — dùng cho cả edit lẫn manual ── */
  const handleSaveOnly = async (edited) => {
    const t = title.trim() || 'Đề thi chưa đặt tên'
    let exam
    if (isEditing) {
      exam = updateExam(editingExam.id, { title: t, result: edited, grade: examGrade })
    } else {
      // Manual mode: tạo đề mới và lưu vào localStorage (chưa publish), gắn với lớp đang mở
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

  const stepId = phase === 'processing' ? 'processing'
               : phase === 'review'     ? 'review'
               : 'upload'

  return (
    <div className="create-exam-page">
      <div className="ce-header">
        <div className="ce-header-inner">
          <div className="ce-page-title">
            <h1>
              {isEditing ? '✏️ Chỉnh sửa đề thi'
                : isMix   ? '🎲 Phối đề ngẫu nhiên'
                : isManual ? '✍️ Tạo đề thi thủ công'
                : '✏️ Tạo đề thi mới'}
            </h1>
            <p>
              {isEditing ? `Đang sửa: ${editingExam.title}`
                : isMix   ? `${mixResult.total_questions} câu đã được phối — Chỉnh sửa và Lưu`
                : isManual ? 'Thêm câu hỏi rồi Lưu lại'
                : 'Upload PDF — AI trích xuất — Chỉnh sửa — Lưu'}
            </p>
          </div>
          <StepIndicator current={stepId} manual={isManual || isEditing || isMix} />
        </div>
      </div>

      <div className="ce-body">
        {phase === 'upload' && (
          <UploadStep onUpload={handleUpload} errorFromPrev={events.find(e => e.type === 'error')} />
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

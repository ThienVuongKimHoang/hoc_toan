import React, { useEffect, useRef, useState } from 'react'
import { getClassByCode, getClassesByStudent, getExamWindow, getPendingForStudent, joinClassByCode, submitAssignment, uploadFile } from '../store/classStore.js'
import { getPracticeInfo } from '../store/examStore.js'
import SubjectBadge, { SUBJECTS, SUBJECT_BG, GradeBadge, gradeLabel } from '../components/SubjectBadge.jsx'
import { BandChip, IeltsGradeModal, IeltsStatsModal } from '../components/IeltsGrade.jsx'
import ExerciseFolderView from '../components/ExerciseFolderView.jsx'
import { isExerciseDoc } from '../utils/exerciseDocs.js'

/* Môn "chính" của lớp (fallback dữ liệu cũ chưa gắn môn) */
const primarySubject = (cls) => cls?.subject || cls?.subjects?.[0] || null
const inSubject = (item, subject, cls) => ((item?.subject || primarySubject(cls)) === subject)
/* Các môn mà học sinh này ĐÃ ĐĂNG KÝ trong lớp */
const myEnrolledSubjects = (cls, user) => {
  const mine = (cls?.members || []).filter(m =>
    String(m.userId) === String(user?.id) ||
    ((m.email || '').toLowerCase() === (user?.email || '').toLowerCase()))
  const prim = primarySubject(cls)
  const set = new Set(mine.map(m => m.subject || prim).filter(Boolean))
  if (set.size === 0) return (cls?.subjects?.length ? cls.subjects : (prim ? [prim] : []))
  // Giữ thứ tự theo danh sách môn của lớp
  const order = cls?.subjects?.length ? cls.subjects : [...set]
  return order.filter(s => set.has(s))
}

/* ─── SVG icons ─── */
function Svg({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {children}
    </svg>
  )
}
const IC = {
  users:    (s=16) => <Svg size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  book:     (s=16) => <Svg size={s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Svg>,
  clock:    (s=16) => <Svg size={s}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></Svg>,
  check:    (s=16) => <Svg size={s}><polyline points="20 6 9 17 4 12"/></Svg>,
  upload:   (s=16) => <Svg size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Svg>,
  file:     (s=16) => <Svg size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></Svg>,
  link:     (s=16) => <Svg size={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Svg>,
  back:     (s=16) => <Svg size={s}><polyline points="15 18 9 12 15 6"/></Svg>,
  x:        (s=16) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>,
  clip:     (s=16) => <Svg size={s}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></Svg>,
  play:     (s=16) => <Svg size={s}><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></Svg>,
  img:      (s=16) => <Svg size={s}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Svg>,
  audio:    (s=16) => <Svg size={s}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Svg>,
  download: (s=16) => <Svg size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>,
  eye:      (s=16) => <Svg size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Svg>,
  key:      (s=16) => <Svg size={s}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></Svg>,
  folder:   (s=16) => <Svg size={s}><path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5L11 4H4z"/></Svg>,
}

/* ─── File type helper ─── */
function fileType(f) {
  const name = (f.name || '').toLowerCase(); const mime = f.mimeType || ''
  if (/^image\//.test(mime) || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf'))                   return 'pdf'
  if (/^audio\//.test(mime) || /\.(mp3|wav|ogg|m4a)$/.test(name))           return 'audio'
  if (/^video\//.test(mime) || /\.(mp4|webm|mov)$/.test(name))              return 'video'
  if (/^text\//.test(mime)  || /\.(txt|md|csv)$/.test(name))                return 'text'
  return 'other'
}

/* ─── Inline file viewer ─── */
function FileViewerModal({ file, onClose }) {
  const [text, setText] = useState(null)
  const type = fileType(file)
  useEffect(() => {
    if (type === 'text') fetch(file.url).then(r => r.text()).then(setText).catch(() => setText('Không thể đọc file.'))
  }, [file.url, type])
  return (
    <div className="fv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fv-modal">
        <div className="fv-header">
          <span className="fv-name">{file.name}</span>
          <div style={{display:'flex',gap:8}}>
            <a className="mec-btn" href={file.url} target="_blank" rel="noreferrer" download>{IC.download(14)} Tải xuống</a>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="fv-body">
          {type === 'image' && <img src={file.url} alt={file.name} style={{maxWidth:'100%',maxHeight:'75vh',borderRadius:8}} />}
          {type === 'pdf'   && <iframe src={file.url} title={file.name} style={{width:'100%',height:'75vh',border:'none',borderRadius:8}} />}
          {type === 'audio' && <audio controls src={file.url} style={{width:'100%',marginTop:16}} />}
          {type === 'video' && <video controls src={file.url} style={{width:'100%',maxHeight:'75vh',borderRadius:8}} />}
          {type === 'text'  && <pre className="fv-text">{text ?? 'Đang tải...'}</pre>}
          {type === 'other' && (
            <div className="fv-no-preview">{IC.file(40)}<p>Không thể xem trước loại file này.</p>
              <a className="btn-primary" href={file.url} target="_blank" rel="noreferrer" download>{IC.download(14)} Tải xuống</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── File chip ─── */
function FileChip({ file, onRemove, onView }) {
  const type = fileType(file)
  const formatSize = b => !b ? '' : b < 1048576 ? `${(b/1024).toFixed(0)}KB` : `${(b/1048576).toFixed(1)}MB`
  return (
    <div className="file-chip">
      {type === 'image'
        ? <img src={file.url} alt="" className="file-chip-thumb" onClick={() => onView?.(file)} />
        : <div className="file-chip-icon" onClick={() => onView?.(file)}>{IC.file(18)}</div>
      }
      <div className="file-chip-info" onClick={() => onView?.(file)}>
        <div className="file-chip-name">{file.name}</div>
        <div className="file-chip-size">{formatSize(file.size)}</div>
      </div>
      {onRemove && <button className="file-chip-del" onClick={() => onRemove(file.id)}>{IC.x(12)}</button>}
    </div>
  )
}

/* ─── Submit assignment modal ─── */
function SubmitModal({ cls, assignment, user, onClose, onSubmitted }) {
  const [files,      setFiles]      = useState([])
  const [note,       setNote]       = useState('')
  const [dragging,   setDragging]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [viewing,    setViewing]    = useState(null)
  const [err,        setErr]        = useState('')
  const inputRef = useRef(null)

  const processFiles = async (rawFiles) => {
    if (!rawFiles.length) return
    setUploading(true)
    const results = []
    for (const f of rawFiles) {
      try { results.push(await uploadFile(f)) } catch { /* skip */ }
    }
    setUploading(false)
    setFiles(prev => [...prev, ...results])
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  const handleSubmit = async () => {
    if (!assignment.examId && files.length === 0) {
      setErr('Vui lòng nộp ít nhất một file.'); return
    }
    setSubmitting(true)
    try {
      await submitAssignment(cls.id, assignment.id, {
        studentId: user.id, studentName: user.name, files, note,
      })
      onSubmitted()
    } catch (e) { setErr(e.message) }
    finally { setSubmitting(false) }
  }

  const alreadySubmitted = assignment.submissions?.some(s => String(s.studentId) === String(user.id))

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box" style={{maxWidth:540,maxHeight:'92vh',overflowY:'auto'}}>
          <div className="modal-header">
            <h2>📤 Nộp bài: {assignment.title}</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div style={{padding:'0 24px 24px'}}>
            {alreadySubmitted && (
              <div className="cm-info-note" style={{background:'#d1fae5',borderColor:'#6ee7b7',color:'#065f46',marginBottom:12}}>
                {IC.check(14)} Bạn đã nộp bài này. Nộp lại sẽ ghi đè bài cũ.
              </div>
            )}

            {assignment.description && (
              <div className="cm-info-note" style={{marginBottom:12}}>{assignment.description}</div>
            )}

            {/* Teacher attachments */}
            {assignment.attachments?.length > 0 && (
              <>
                <label className="cm-label">📎 Tài liệu từ giáo viên</label>
                <div className="file-chip-list" style={{marginBottom:12}}>
                  {assignment.attachments.map(f => (
                    <FileChip key={f.id} file={f} onView={setViewing} />
                  ))}
                </div>
              </>
            )}

            {/* If exam linked → go take exam, no upload */}
            {assignment.examId ? (
              <div className="mc-exam-link-box">
                <div className="mc-elb-icon">{IC.play(32)}</div>
                <div>
                  <div className="mc-elb-title">Bài tập này yêu cầu làm đề thi</div>
                  <div className="mc-elb-sub">Click nút bên dưới để mở đề thi và làm bài.</div>
                </div>
                <a className="btn-primary" href={`#take/${assignment.examId}/${cls.id}/${assignment.id}`} onClick={onClose}>
                  {IC.play(14)} Làm bài thi
                </a>
              </div>
            ) : (
              <>
                {assignment.writingTask && (
                  <div className="cm-info-note ielts-submit-note" style={{marginBottom:12}}>
                    🤖 Bài <strong>IELTS Writing {assignment.writingTask === 'task1' ? 'Task 1' : 'Task 2'}</strong> —
                    giáo viên sẽ dùng AI chấm điểm (band 0–9) sau khi bạn nộp.
                    Nộp file <strong>.txt / .docx / .pdf</strong> hoặc <strong>ảnh chụp bài viết tay</strong> đều được.
                  </div>
                )}
                <label className="cm-label">📂 File bài làm của bạn</label>
                {files.length > 0 && (
                  <div className="file-chip-list">
                    {files.map(f => (
                      <FileChip key={f.id} file={f}
                        onRemove={id => setFiles(prev => prev.filter(f => f.id !== id))}
                        onView={setViewing} />
                    ))}
                  </div>
                )}
                <div
                  className={`file-dropzone ${dragging ? 'file-dropzone--active' : ''} ${uploading ? 'file-dropzone--uploading' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploading && inputRef.current?.click()}
                >
                  <input ref={inputRef} type="file" multiple style={{display:'none'}}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.zip,.rar"
                    onChange={e => processFiles(Array.from(e.target.files))} />
                  {uploading
                    ? <><span className="fdz-spinner"/>Đang upload…</>
                    : <>{IC.upload(20)}<span>Kéo thả hoặc <u>click để chọn file</u></span><span className="fdz-hint">PDF, Word, ảnh, audio, video, txt, zip…</span></>
                  }
                </div>

                <label className="cm-label" style={{marginTop:14}}>
                  Ghi chú <span style={{color:'#94a3b8',fontWeight:400}}>(tuỳ chọn)</span>
                </label>
                <textarea className="cm-input cm-textarea" rows={2}
                  placeholder="Ghi chú cho giáo viên…"
                  value={note} onChange={e => setNote(e.target.value)} />
              </>
            )}

            {err && <div className="cm-error">{err}</div>}
            {!assignment.examId && (
              <div className="cm-footer">
                <button className="pm-cancel" onClick={onClose}>Huỷ</button>
                <button className="btn-primary cm-submit" onClick={handleSubmit}
                  disabled={submitting || uploading}>
                  {submitting ? '⏳ Đang nộp…' : '📤 Nộp bài'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {viewing && <FileViewerModal file={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

const formatDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

/* Trạng thái cửa sổ thời gian của một đề thi được giao */
function examWindowStatus(a) {
  const now = Date.now()
  const open  = a.openTime ? new Date(a.openTime).getTime() : null
  const close = (a.closeTime || a.dueDate) ? new Date(a.closeTime || a.dueDate).getTime() : null
  if (open && now < open)  return 'pending'
  if (close && now > close) return 'closed'
  return 'open'
}

const SCORE_MODE_LABEL = {
  highest: '🏆 Tính điểm cao nhất',
  average: '➗ Tính điểm trung bình',
  latest:  '🕒 Tính lần làm gần nhất',
}

/* Đề đang trong giờ luyện tập (mở, chưa đóng) hay không */
function practiceActiveNow(info) {
  if (!info?.enabled) return false
  const now = Date.now()
  if (info.openTime  && now < new Date(info.openTime).getTime())  return false
  if (info.closeTime && now > new Date(info.closeTime).getTime()) return false
  return true
}

function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const p = n => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`
}

/* Badge nổi bật kiểu "sale off" báo đề này đang mở luyện tập — bấm vào để vào
   luyện tập ngay, không cần đợi giáo viên gửi link riêng. */
function PracticeActiveBadge({ examId, closeTime }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!closeTime) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [closeTime])
  return (
    <a className="mc-practice-badge" href={`#practice/${examId}`}>
      <span className="mc-practice-fire">🔥</span>
      <span>Đang mở luyện tập{closeTime ? ` · còn ${fmtCountdown(new Date(closeTime).getTime() - now)}` : ''}</span>
      <span className="mc-practice-arrow">→</span>
    </a>
  )
}

/* ─── Exam assignment card (đề thi được giao) ─── */
function ExamAssignmentCard({ assignment, cls, user }) {
  const st = examWindowStatus(assignment)
  const openIso  = assignment.openTime
  const closeIso = assignment.closeTime || assignment.dueDate
  const maxAttempts = assignment.maxAttempts || null
  const scoreMode   = assignment.scoreMode || 'highest'

  const [used, setUsed] = useState(null)   // số lần đã làm (riêng cho lần giao bài này)
  useEffect(() => {
    let alive = true
    getExamWindow(cls.id, assignment.examId, user?.id, user?.email, assignment.id)
      .then(w => { if (alive && w) setUsed(w.attemptsUsed ?? 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [cls.id, assignment.examId, assignment.id, user?.id])

  // Đề này có đang mở chế độ luyện tập không (độc lập với lần giao bài chính thức)
  const [practiceInfo, setPracticeInfo] = useState(null)
  useEffect(() => {
    let alive = true
    getPracticeInfo(assignment.examId).then(info => { if (alive) setPracticeInfo(info) }).catch(() => {})
    return () => { alive = false }
  }, [assignment.examId])

  const exhausted = maxAttempts != null && used != null && used >= maxAttempts

  const statusMeta = {
    pending: { cls: 'cm-window-chip--pending', label: `Mở lúc ${formatDt(openIso)}` },
    open:    { cls: 'cm-window-chip--open',    label: `Đang mở · đóng ${formatDt(closeIso)}` },
    closed:  { cls: 'cm-window-chip--closed',  label: `Đã đóng (${formatDt(closeIso)})` },
  }[st]

  return (
    <div className={`mc-asgn-card mc-asgn-card--exam ${st === 'closed' ? 'mc-asgn-card--overdue' : ''}`}>
      <div className="mc-asgn-main">
        <div className="mc-asgn-title">📋 {assignment.title}</div>
        {assignment.description && <div className="mc-asgn-desc">{assignment.description}</div>}
        <div className="mc-asgn-meta">
          <span className="cm-exam-chip">{IC.play(12)} Đề thi</span>
          {assignment.duration ? <span className="cm-exam-chip">⏱ {assignment.duration} phút</span> : null}
          <span className={`cm-window-chip ${statusMeta.cls}`}>{IC.clock(12)} {statusMeta.label}</span>
        </div>
        <div className="mc-asgn-meta" style={{marginTop:4}}>
          <span className="cm-exam-chip">{SCORE_MODE_LABEL[scoreMode]}</span>
          <span className="cm-exam-chip">
            🔁 {maxAttempts ? `${used ?? '…'}/${maxAttempts} lần` : (used != null ? `${used} lần · không giới hạn` : 'Không giới hạn')}
          </span>
        </div>
        {practiceActiveNow(practiceInfo) && (
          <PracticeActiveBadge examId={assignment.examId} closeTime={practiceInfo.closeTime} />
        )}
      </div>
      {st === 'open' && !exhausted ? (
        <a className="btn-primary mc-submit-btn" href={`#take/${assignment.examId}/${cls.id}/${assignment.id}`}>
          {IC.play(14)} {used > 0 ? 'Làm lại' : 'Làm bài'}
        </a>
      ) : (
        <button className="btn-primary mc-submit-btn" disabled>
          {exhausted ? '🔒 Hết lượt' : st === 'pending' ? '🔒 Chưa mở' : 'Đã đóng'}
        </button>
      )}
    </div>
  )
}

/* ─── Assignment card for student ─── */
function AssignmentCard({ assignment, cls, user, onSubmit }) {
  const [showGrade, setShowGrade] = useState(false)
  const [showStats, setShowStats] = useState(false)

  if (assignment.examId) return <ExamAssignmentCard assignment={assignment} cls={cls} user={user} />

  const mySubmission = assignment.submissions?.find(s => String(s.studentId) === String(user.id))
  const isDuePast   = assignment.dueDate && new Date(assignment.dueDate) < new Date()
  const isWriting   = !!assignment.writingTask
  const taskLabel   = isWriting ? `IELTS Writing ${assignment.writingTask === 'task1' ? 'Task 1' : 'Task 2'}` : null
  const myGrade     = mySubmission?.aiGrade

  return (
    <div className={`mc-asgn-card ${isDuePast && !mySubmission ? 'mc-asgn-card--overdue' : ''} ${mySubmission ? 'mc-asgn-card--done' : ''}`}>
      <div className="mc-asgn-main">
        <div className="mc-asgn-title">{assignment.title}</div>
        {assignment.description && <div className="mc-asgn-desc">{assignment.description}</div>}
        <div className="mc-asgn-meta">
          <span className={`cm-due-chip ${isDuePast ? 'cm-due-chip--past' : ''}`}>
            {IC.clock(12)} Hạn: {formatDt(assignment.dueDate)}{isDuePast && ' (Hết hạn)'}
          </span>
          {isWriting && <span className="cm-exam-chip ielts-task-chip">🤖 {taskLabel} · AI chấm điểm</span>}
          {assignment.attachments?.length > 0 && <span className="cm-exam-chip">{IC.clip(12)} {assignment.attachments.length} file đính kèm</span>}
        </div>
        {mySubmission && (
          <div className="mc-submitted-info">
            {IC.check(13)} Đã nộp lúc {formatDt(mySubmission.submittedAt)}
            {mySubmission.files?.length > 0 && <span> · {mySubmission.files.length} file</span>}
          </div>
        )}
        {isWriting && mySubmission && (
          <div className="ielts-row-actions" style={{marginTop:8}}>
            {myGrade?.status === 'done' && (
              <button className="ielts-band-view" onClick={() => setShowGrade(true)}>
                <BandChip band={myGrade.overallBand} size="sm" /> Xem kết quả AI
              </button>
            )}
            {myGrade?.status === 'pending' && <span className="ielts-pending-chip">⏳ AI đang chấm bài…</span>}
            {myGrade?.status === 'error' && <span className="ielts-error-chip" title={myGrade.error}>⚠️ Chấm lỗi — nộp lại hoặc báo giáo viên</span>}
            <button className="mec-btn" onClick={() => setShowStats(true)}>📊 Bảng điểm lớp</button>
          </div>
        )}
      </div>
      <button
        className={`btn-primary mc-submit-btn ${mySubmission ? 'mc-submit-btn--resubmit' : ''}`}
        onClick={() => onSubmit(assignment)}
        disabled={isDuePast}
      >
        {isDuePast
          ? (mySubmission ? '✅ Đã nộp (hết hạn)' : '🔒 Đã hết hạn')
          : (mySubmission ? '✏️ Nộp lại' : '📤 Nộp bài')}
      </button>
      {showGrade && myGrade && (
        <IeltsGradeModal grade={myGrade} studentName={user.name} taskLabel={taskLabel}
          onClose={() => setShowGrade(false)} />
      )}
      {showStats && (
        <IeltsStatsModal classId={cls.id} assignment={assignment} onClose={() => setShowStats(false)} />
      )}
    </div>
  )
}

/* ─── Class view (student inside a class) ─── */
function ClassView({ cls, user, pendingCount = 0, onBack }) {
  const [submitting, setSubmitting] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [localCls,   setLocalCls]   = useState(cls)

  useEffect(() => {
    // Refresh class data to get latest submissions
    import('../store/classStore.js').then(m => m.getClassById(cls.id)).then(fresh => {
      if (fresh) setLocalCls(fresh)
      else {
        // Lớp đã bị xóa trong lúc đang mở → quay lại danh sách thay vì hiện dữ liệu cũ
        alert('Lớp học này không còn tồn tại.')
        onBack()
      }
    })
  }, [cls.id, refreshKey])

  // AI đang chấm bài của mình → tự refresh để hiện kết quả khi chấm xong
  const hasPendingGrade = (localCls.assignments || []).some(a =>
    a.writingTask && a.submissions?.some(s =>
      String(s.studentId) === String(user.id) && s.aiGrade?.status === 'pending'))
  useEffect(() => {
    if (!hasPendingGrade) return
    const t = setTimeout(() => setRefreshKey(k => k + 1), 8000)
    return () => clearTimeout(t)
  }, [hasPendingGrade, refreshKey])

  const subject = primarySubject(localCls)             // mỗi lớp = 1 môn
  const [tab, setTab] = useState('assignments')       // 'assignments' | 'documents'
  const [asgnTab, setAsgnTab] = useState('homework')  // 'homework' | 'exam'
  const [viewingFile, setViewingFile] = useState(null)
  const [openFolder, setOpenFolder] = useState(null)

  const fmtSize = b => !b ? '' : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`
  const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''

  /* ── Nội dung môn của lớp: Tài liệu + Bài tập (→ Đề thi) ── */
  const subjAssignments = (localCls.assignments||[]).filter(a => inSubject(a, subject, localCls))
  const subjDocs        = (localCls.documents||[]).filter(d => inSubject(d, subject, localCls))
  const homeworks = subjAssignments.filter(a => !a.examId)
  const exams     = subjAssignments.filter(a => !!a.examId)
  const backToSubjects = onBack

  return (
    <div className="cm-detail">
      <div className="cm-detail-header">
        <button className="cm-back-btn" onClick={backToSubjects}>{IC.back(18)} Quay lại</button>
        <div style={{flex:1}}>
          <h2 className="cm-detail-title">
            {localCls.name} <GradeBadge grade={localCls.grade} /> <SubjectBadge subject={subject} />
          </h2>
          {localCls.teacherName && <p className="cm-detail-desc">Giáo viên: <strong>{localCls.teacherName}</strong></p>}
        </div>
      </div>

      <div className="cm-tabs">
        <button className={`cm-tab ${tab==='assignments' ? 'cm-tab--active' : ''}`} onClick={() => setTab('assignments')}>📝 Bài tập</button>
        <button className={`cm-tab ${tab==='documents' ? 'cm-tab--active' : ''}`} onClick={() => setTab('documents')}>📎 Tài liệu</button>
      </div>

      <div className="cm-tab-body">
        {tab === 'assignments' && (
          <div>
            <div className="cm-subtabs" style={{display:'flex',gap:8,marginBottom:12}}>
              <button className={`cm-tab ${asgnTab==='homework' ? 'cm-tab--active' : ''}`}
                onClick={() => setAsgnTab('homework')}>📝 Bài tập ({homeworks.length})</button>
              <button className={`cm-tab ${asgnTab==='exam' ? 'cm-tab--active' : ''}`}
                onClick={() => setAsgnTab('exam')}>📋 Đề thi ({exams.length})</button>
            </div>
            {(() => {
              const list = asgnTab === 'exam' ? exams : homeworks
              if (list.length === 0) return (
                <div className="cm-empty-state">
                  <div className="cm-empty-icon">{IC.book(40)}</div>
                  <p>{asgnTab === 'exam' ? 'Chưa có đề thi nào.' : 'Chưa có bài tập nào.'}</p>
                </div>
              )
              return (
                <div className="mc-asgn-list">
                  {[...list].sort((a,b) => new Date(a.dueDate)-new Date(b.dueDate)).map(a => (
                    <AssignmentCard key={a.id} assignment={a} cls={localCls} user={user} onSubmit={setSubmitting} />
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'documents' && (() => {
          const looseDocs = subjDocs.filter(d => !d.folder)
          const folderMap = new Map()
          subjDocs.forEach(d => {
            if (!d.folder) return
            if (!folderMap.has(d.folder)) folderMap.set(d.folder, [])
            folderMap.get(d.folder).push(d)
          })
          const docsInView = openFolder ? (folderMap.get(openFolder) || []) : looseDocs
          const folderHasExercise = openFolder && docsInView.some(isExerciseDoc)
          const folderTileLabel = (docs) => {
            const exerciseDocs = docs.filter(isExerciseDoc)
            if (!exerciseDocs.length) return `${docs.length} ảnh`
            const cauCount = new Set(exerciseDocs.map(d => d.cauLabel)).size
            return `${cauCount} câu`
          }
          const renderDocRow = (d) => (
            <div key={d.id} className="cm-doc-row">
              <div className="cm-doc-icon" onClick={() => setViewingFile(d)} style={{cursor:'pointer'}}>{IC.file(20)}</div>
              <div className="cm-doc-info">
                <button className="cm-doc-name" onClick={() => setViewingFile(d)}>{d.name}</button>
                <div className="cm-doc-meta">{fmtSize(d.size)} · {fmtDt(d.uploadedAt)}</div>
              </div>
              <a href={d.url} target="_blank" rel="noreferrer" download className="cm-remove-btn" title="Tải xuống">{IC.download(14)}</a>
              <button className="cm-remove-btn" onClick={() => setViewingFile(d)} title="Xem">{IC.eye(14)}</button>
            </div>
          )
          return (
            <div>
              {openFolder && (
                <button className="cm-back-btn" style={{marginBottom:12}} onClick={() => setOpenFolder(null)}>{IC.back(16)} {openFolder}</button>
              )}
              {!openFolder && folderMap.size > 0 && (
                <div className="cm-folder-grid">
                  {[...folderMap.entries()].map(([name, docs]) => (
                    <button key={name} className="cm-folder-tile" onClick={() => setOpenFolder(name)}>
                      {IC.folder(28)}
                      <span className="cm-folder-name">{name}</span>
                      <span className="cm-folder-count">{folderTileLabel(docs)}</span>
                    </button>
                  ))}
                </div>
              )}
              {docsInView.length === 0 ? (
                folderMap.size === 0 && (
                  <div className="cm-empty-state">
                    <div className="cm-empty-icon">{IC.clip(40)}</div>
                    <p>Chưa có tài liệu nào.</p>
                  </div>
                )
              ) : folderHasExercise ? (
                <ExerciseFolderView docs={docsInView} />
              ) : (
                <div className="cm-doc-list">
                  {docsInView.map(renderDocRow)}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {viewingFile && <FileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />}
      {submitting && (
        <SubmitModal
          cls={localCls} assignment={submitting} user={user}
          onClose={() => setSubmitting(null)}
          onSubmitted={() => { setSubmitting(null); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

/* ─── Join class modal ─── */
function JoinModal({ initialCode, user, onClose, onJoined }) {
  const [code,     setCode]     = useState(initialCode || '')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')
  const [info,     setInfo]     = useState(null)   // lớp tra được theo mã (bước 2 xác nhận)

  const gradeMismatch = info?.grade && user?.grade && String(user.grade) !== String(info.grade)

  // Bước 1: tra lớp theo mã → hiện thông tin lớp để xác nhận
  const lookup = async () => {
    if (!code.trim()) { setErr('Vui lòng nhập mã lớp.'); return }
    setLoading(true); setErr('')
    const data = await getClassByCode(code.trim().toUpperCase())
    setLoading(false)
    if (data.error) { setErr(data.error); return }
    setInfo(data)
  }

  // Bước 2: tham gia — mỗi lớp 1 môn nên vào thẳng môn của lớp
  const doJoin = async () => {
    setLoading(true); setErr('')
    const result = await joinClassByCode(code.trim().toUpperCase(), password.trim() || null, user)
    setLoading(false)
    if (result.error) { setErr(result.error); return }
    onJoined(result.className)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:440}}>
        <div className="modal-header"><h2>🏫 Tham gia lớp học</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{padding:'0 24px 24px'}}>
          {!info ? (
            <>
              <label className="cm-label">{IC.key(13)} Mã lớp *</label>
              <input className="cm-input" style={{letterSpacing:4,fontSize:'1.2rem',textAlign:'center'}}
                placeholder="ABC123" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && lookup()} autoFocus />
              {err && <div className="cm-error">{err}</div>}
              <div className="cm-footer">
                <button className="pm-cancel" onClick={onClose}>Huỷ</button>
                <button className="btn-primary cm-submit" onClick={lookup} disabled={loading}>
                  {loading ? '⏳ Đang tra…' : 'Tiếp tục →'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="cm-info-note" style={{marginBottom:12,display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                🏫 <strong>{info.name}</strong> {info.grade && <>· {gradeLabel(info.grade)}</>}
                {info.subject && <SubjectBadge subject={info.subject} size="sm" />}
                {info.teacherName && <span>· GV: {info.teacherName}</span>}
              </div>
              {gradeMismatch ? (
                <div className="cm-error">
                  Lớp này dành cho học sinh <strong>{gradeLabel(info.grade)}</strong>, không khớp cấp độ của bạn ({gradeLabel(user.grade) || 'chưa đặt'}).
                </div>
              ) : info.hasJoinPassword && (
                <>
                  <label className="cm-label">Mật khẩu lớp *</label>
                  <input className="cm-input" type="password" placeholder="Nhập mật khẩu lớp"
                    value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doJoin()} />
                </>
              )}
              {err && <div className="cm-error">{err}</div>}
              <div className="cm-footer">
                <button className="pm-cancel" onClick={() => { setInfo(null); setErr('') }}>← Quay lại</button>
                <button className="btn-primary cm-submit" onClick={doJoin}
                  disabled={loading || gradeMismatch}>
                  {loading ? '⏳ Đang tham gia…' : '🏫 Tham gia'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Main student page ─── */
export default function MyClassesPage({ user, initialJoinCode, initialClassId }) {
  const [classes,     setClasses]     = useState([])
  const [selected,    setSelected]    = useState(null)
  const [showJoin,    setShowJoin]    = useState(false)
  const [joinCode,    setJoinCode]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [autoJoining, setAutoJoining] = useState(!!initialJoinCode)
  const [toast,       setToast]       = useState(null)
  const [pendingItems, setPendingItems] = useState([])

  const reload = async () => {
    setLoading(true)
    const [list, pend] = await Promise.all([
      getClassesByStudent(String(user.id), user.email),
      getPendingForStudent(String(user.id), user.email).catch(() => ({ items: [] })),
    ])
    setClasses(list)
    setPendingItems(pend.items || [])
    if (selected) setSelected(list.find(c => c.id === selected.id) || null)
    setLoading(false)
  }

  useEffect(() => { reload() }, []) // eslint-disable-line

  // Mở thẳng một lớp khi điều hướng từ thông báo (#class/<id>)
  useEffect(() => {
    if (!initialClassId || loading) return
    const c = classes.find(c => c.id === initialClassId)
    if (c) setSelected(c)
  }, [initialClassId, loading, classes])

  // Vào bằng link #join/<code>: mở hộp thoại tham gia (điền sẵn mã) để học sinh
  // CHỌN MÔN — việc tham gia giờ theo từng môn nên không thể tự động tham gia.
  useEffect(() => {
    if (!initialJoinCode) return
    const code = initialJoinCode.trim().toUpperCase()
    // Xóa mã khỏi URL NGAY để F5 không mở lại liên tục.
    window.history.replaceState(null, '', '#my-classes')
    setAutoJoining(false)
    setJoinCode(code)
    setShowJoin(true)
  }, []) // eslint-disable-line

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const handleJoined = (className) => {
    setShowJoin(false)
    showToast(`✅ Đã tham gia lớp "${className}" thành công!`)
    reload()
  }

  const countPending = (cls) => pendingItems.filter(i => i.classId === cls.id).length

  if (autoJoining) return (
    <div className="app">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ fontSize: '2.5rem', animation: 'spin 1s linear infinite' }}>🏫</div>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>Đang tham gia lớp học...</p>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Mã: <strong>{initialJoinCode?.toUpperCase()}</strong></p>
      </div>
    </div>
  )

  if (selected) return (
    <div className="app">
      <div className="create-topbar">
        <h1 className="exam-title" style={{display:'flex',alignItems:'center',gap:10}}>{IC.users(24)} Lớp của tôi</h1>
      </div>
      <ClassView cls={selected} user={user} pendingCount={countPending(selected)} onBack={() => setSelected(null)} />
    </div>
  )

  return (
    <div className="app">
      {toast && <div className="mc-toast">{toast}</div>}
      <div className="create-topbar">
        <h1 className="exam-title" style={{display:'flex',alignItems:'center',gap:10}}>{IC.users(24)} Lớp của tôi</h1>
        <p className="exam-subtitle">Các lớp học bạn đang tham gia và bài tập được giao</p>
      </div>

      <div className="my-exams-toolbar">
        <span className="met-count">{classes.length} lớp</span>
        <button className="btn-primary mec-create-btn" onClick={() => { setJoinCode(''); setShowJoin(true) }}>
          + Tham gia lớp
        </button>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>Đang tải...</div>
      ) : classes.length === 0 ? (
        <div className="my-exams-empty">
          <div className="mee-icon">{IC.users(48)}</div>
          <h3>Bạn chưa tham gia lớp nào</h3>
          <p>Nhập mã lớp từ giáo viên để tham gia</p>
          <button className="btn-primary btn-lg" onClick={() => setShowJoin(true)}>+ Tham gia lớp ngay</button>
        </div>
      ) : (
        <div className="cm-class-grid">
          {classes.map(cls => {
            const pending = countPending(cls)
            const clsPendingItems = pendingItems.filter(i => i.classId === cls.id)
            const isUrgent = clsPendingItems.some(a => a.dueDate && (new Date(a.dueDate) - new Date()) < 86400_000)
            const subject = primarySubject(cls)
            const hasPhoto = !!SUBJECT_BG[subject]
            const badgeRow = (
              <div className="cm-class-subject-row" style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
                <GradeBadge grade={cls.grade} size="sm" />
                {myEnrolledSubjects(cls, user).map(s => <SubjectBadge key={s} subject={s} size="sm" />)}
              </div>
            )
            return (
              <div key={cls.id} className="cm-class-card cm-subject-card" data-subject={subject || 'khac'} style={{cursor:'pointer'}} onClick={() => setSelected(cls)}>
                {hasPhoto && (
                  <div className="cm-tour-photo">
                    <img src={SUBJECT_BG[subject]} alt="" loading="lazy" />
                    <div className="cm-tour-badge-float">{badgeRow}</div>
                  </div>
                )}
                <div className="cm-class-card-header">
                  {!hasPhoto && <div className="cm-class-icon cm-subject-icon">{SUBJECTS[subject]?.icon ?? '🏫'}</div>}
                  <div className="cm-title-accent" />
                  <div style={{flex:1}}>
                    <div className="cm-class-title">{cls.name}</div>
                  </div>
                  {pending > 0 && <span className="mc-pending-badge">{pending} cần nộp</span>}
                </div>
                {cls.teacherName && <div className="cm-class-teacher-line">GV: {cls.teacherName}</div>}
                {!hasPhoto && badgeRow}
                {cls.description && <div className="cm-class-desc-preview">{cls.description}</div>}
                <div className="cm-stat-glow-row">
                  <div className={`cm-stat-glow ${isUrgent ? 'cm-stat-glow--urgent' : pending > 0 ? 'cm-stat-glow--danger' : ''}`}>
                    <span className="cm-stat-glow-ic">{IC.book(15)}</span>
                    <b>{pending}</b>
                    <em>cần làm</em>
                  </div>
                </div>
                <div className="cm-class-footer">
                  <span className="cm-class-date">Tham gia: {new Date(cls.createdAt).toLocaleDateString('vi-VN')}</span>
                  <button className="btn-primary cm-enter-btn">Xem chi tiết <span className="cm-enter-arrow">→</span></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showJoin && (
        <JoinModal
          initialCode={joinCode} user={user}
          onClose={() => setShowJoin(false)}
          onJoined={handleJoined}
        />
      )}
    </div>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getExamsByTeacher, fetchExamsByTeacher, getSubmissions as getExamSubmissions, fetchExamById, scaledScore, deleteStudentSubmissions } from '../store/examStore.js'
import QuestionStats from '../components/QuestionStats.jsx'
import {
  addAssignment, addDocument, addMemberToClass, createClass,
  deleteAssignmentSubmission,
  deleteClass, getClassById, getClassesByTeacher, getSubmissions,
  joinUrl, removeAssignment, removeDocument, removeMemberFromClass,
  searchStudents, updateClassInfo, uploadFile,
} from '../store/classStore.js'
import TeacherToolsModal from '../components/TeacherToolsModal.jsx'
import ExerciseSolver from '../components/ExerciseSolver.jsx'
import Geo3DViewer from '../components/Geo3DViewer.jsx'
import SubjectBadge, { SubjectPicker, SUBJECTS } from '../components/SubjectBadge.jsx'
import { BandChip, GradeButton, IeltsGradeModal, IeltsStatsTable } from '../components/IeltsGrade.jsx'

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
  users:   (s=16) => <Svg size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  plus:    (s=16) => <Svg size={s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>,
  trash:   (s=16) => <Svg size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>,
  pencil:  (s=16) => <Svg size={s}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></Svg>,
  book:    (s=16) => <Svg size={s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Svg>,
  clip:    (s=16) => <Svg size={s}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></Svg>,
  clock:   (s=16) => <Svg size={s}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></Svg>,
  check:   (s=16) => <Svg size={s}><polyline points="20 6 9 17 4 12"/></Svg>,
  search:  (s=16) => <Svg size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>,
  x:       (s=16) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>,
  upload:  (s=16) => <Svg size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Svg>,
  file:    (s=16) => <Svg size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></Svg>,
  link:    (s=16) => <Svg size={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Svg>,
  back:    (s=16) => <Svg size={s}><polyline points="15 18 9 12 15 6"/></Svg>,
  eye:     (s=16) => <Svg size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Svg>,
  copy:    (s=16) => <Svg size={s}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>,
  lock:    (s=16) => <Svg size={s}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Svg>,
  chart:   (s=16) => <Svg size={s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Svg>,
  img:     (s=16) => <Svg size={s}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Svg>,
  audio:   (s=16) => <Svg size={s}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Svg>,
  download:(s=16) => <Svg size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>,
}

/* ─── File type helpers ─── */
function fileType(f) {
  const name = (f.name || '').toLowerCase()
  const mime = f.mimeType || ''
  if (/^image\//.test(mime) || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf'))                    return 'pdf'
  if (/^audio\//.test(mime) || /\.(mp3|wav|ogg|m4a|aac)$/.test(name))        return 'audio'
  if (/^video\//.test(mime) || /\.(mp4|webm|mov)$/.test(name))               return 'video'
  if (/^text\//.test(mime)  || /\.(txt|md|csv)$/.test(name))                 return 'text'
  return 'other'
}

/* ─── Inline file viewer modal ─── */
function FileViewerModal({ file, onClose }) {
  const [text, setText] = useState(null)
  const type = fileType(file)

  useEffect(() => {
    if (type === 'text') {
      fetch(file.url).then(r => r.text()).then(setText).catch(() => setText('Không thể đọc file.'))
    }
  }, [file.url, type])

  return (
    <div className="fv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fv-modal">
        <div className="fv-header">
          <span className="fv-name">{file.name}</span>
          <div style={{ display:'flex', gap:8 }}>
            <a className="mec-btn" href={file.url} target="_blank" rel="noreferrer" download>
              {IC.download(14)} Tải xuống
            </a>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="fv-body">
          {type === 'image' && <img src={file.url} alt={file.name} style={{maxWidth:'100%',maxHeight:'75vh',borderRadius:8}} />}
          {type === 'pdf'   && <iframe src={file.url} title={file.name} style={{width:'100%',height:'75vh',border:'none',borderRadius:8}} />}
          {type === 'audio' && <audio controls src={file.url} style={{width:'100%',marginTop:16}} />}
          {type === 'video' && <video controls src={file.url} style={{width:'100%',maxHeight:'75vh',borderRadius:8}} />}
          {type === 'text'  && (
            <pre className="fv-text">{text ?? 'Đang tải...'}</pre>
          )}
          {type === 'other' && (
            <div className="fv-no-preview">
              {IC.file(40)}
              <p>Không thể xem trước loại file này.</p>
              <a className="btn-primary" href={file.url} target="_blank" rel="noreferrer" download>
                {IC.download(14)} Tải xuống
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Drag-drop file uploader ─── */
function FileDropZone({ onUploaded, uploading, setUploading }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const processFiles = useCallback(async (files) => {
    if (!files.length) return
    setUploading(true)
    const results = []
    for (const f of files) {
      try { results.push(await uploadFile(f)) } catch { /* skip */ }
    }
    setUploading(false)
    if (results.length) onUploaded(results)
  }, [onUploaded, setUploading])

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className={`file-dropzone ${dragging ? 'file-dropzone--active' : ''} ${uploading ? 'file-dropzone--uploading' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple style={{ display:'none' }}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.mp4,.ogg,.zip,.rar"
        onChange={e => processFiles(Array.from(e.target.files))} />
      {uploading
        ? <><span className="fdz-spinner" />Đang upload...</>
        : <>{IC.upload(20)}<span>Kéo thả file vào đây hoặc <u>click để chọn</u></span><span className="fdz-hint">Hỗ trợ: PDF, Word, ảnh, audio, video, txt, zip…</span></>
      }
    </div>
  )
}

/* ─── File chip (thumbnail/info) ─── */
function FileChip({ file, onRemove, onView }) {
  const type = fileType(file)
  const icon = { image: IC.img, audio: IC.audio, video: IC.eye, pdf: IC.file, text: IC.file, other: IC.file }[type] || IC.file
  const formatSize = (b) => !b ? '' : b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(0)}KB` : `${(b/1048576).toFixed(1)}MB`
  return (
    <div className="file-chip">
      {type === 'image'
        ? <img src={file.url} alt="" className="file-chip-thumb" onClick={() => onView(file)} />
        : <div className="file-chip-icon" onClick={() => onView(file)}>{icon(18)}</div>
      }
      <div className="file-chip-info" onClick={() => onView(file)}>
        <div className="file-chip-name">{file.name}</div>
        <div className="file-chip-size">{formatSize(file.size)}</div>
      </div>
      {onRemove && <button className="file-chip-del" onClick={() => onRemove(file.id)}>{IC.x(12)}</button>}
    </div>
  )
}

/* ─── Submissions panel ─── */
function SubmissionsPanel({ classId, assignment, members, allAssignments, onClose }) {
  const [data, setData] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)   // học sinh đang chờ xác nhận xóa
  const [delBusy, setDelBusy] = useState(false)
  const [viewGrade, setViewGrade] = useState(null)     // submission đang xem kết quả AI
  const [statsKey, setStatsKey] = useState(0)          // refresh bảng thống kê sau khi chấm
  const isExam = !!assignment.examId
  const isWriting = !!assignment.writingTask
  const taskLabel = isWriting ? `IELTS Writing ${assignment.writingTask === 'task1' ? 'Task 1' : 'Task 2'}` : null

  const reload = useCallback(() => {
    if (isExam) {
      // Đề thi: kết quả nằm ở bài nộp của ĐỀ, lọc theo lớp VÀ theo LẦN GIAO BÀI
      // (một đề có thể được giao nhiều lần trong cùng lớp — mỗi lần là một bài tập riêng).
      // Bài nộp cũ chưa gắn assignmentId được quy về lần giao bài sớm nhất.
      const mode = assignment.scoreMode || 'highest'
      const sameExam = (allAssignments || []).filter(x => x.examId === assignment.examId)
      const legacyOwner = sameExam.length
        ? [...sameExam].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0].id
        : assignment.id
      Promise.all([
        getExamSubmissions(assignment.examId),
        fetchExamById(assignment.examId),
      ])
        .then(([d, examObj]) => {
          const all = (d.submissions || []).filter(s =>
            String(s.classId) === String(classId) &&
            (s.assignmentId
              ? String(s.assignmentId) === String(assignment.id)
              : legacyOwner === assignment.id))
          const byStudent = new Map()
          all.forEach(s => {
            const k = String(s.studentId)
            if (!byStudent.has(k)) byStudent.set(k, [])
            byStudent.get(k).push(s)
          })
          const rows = [...byStudent.values()].map(list => {
            list.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
            const last   = list[list.length - 1]
            // Quy đổi điểm từng lần về thang 10 trước khi gộp.
            const scores = list.map(s => scaledScore(s.score, s.maxScore))
            let score
            if (mode === 'average')     score = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
            else if (mode === 'latest') score = scaledScore(last.score, last.maxScore)
            else                        score = Math.max(...scores)   // highest
            return {
              studentId: last.studentId, studentName: last.studentName,
              score, maxScore: 10, attempts: list.length,
              submittedAt: last.submittedAt,
              timeSpent: last.timeSpent,
              violations: list.reduce((n, s) => n + (s.violationCount || 0), 0),
            }
          })
          // rawSubs: giữ từng lần làm để thống kê theo câu (gộp "Tên ×N" nếu sai nhiều lần)
          setData({ submissions: rows, rawSubs: all, examObj, mode })
        })
        .catch(() => setData({ submissions: [], rawSubs: [], examObj: null, mode }))
    } else {
      getSubmissions(classId, assignment.id)
        .then(setData)
        .catch(() => setData({ submissions: [], members: members || [] }))
    }
  }, [classId, assignment.id, isExam])

  useEffect(() => { reload() }, [reload])

  const handleDelete = async () => {
    if (!confirmDel) return
    setDelBusy(true)
    try {
      if (isExam) {
        await deleteStudentSubmissions(assignment.examId, confirmDel.studentId, classId, assignment.id)
      } else {
        await deleteAssignmentSubmission(classId, assignment.id, confirmDel.studentId)
      }
      setConfirmDel(null)
      reload()
    } catch (e) {
      alert(e?.message || 'Xóa bài làm thất bại')
    } finally {
      setDelBusy(false)
    }
  }

  if (!data) return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:640}}>
        <div className="modal-header"><h2>📊 Bài nộp</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{padding:40,textAlign:'center',color:'#64748b'}}>Đang tải...</div>
      </div>
    </div>
  )

  const { submissions } = data
  const submittedIds = new Set(submissions.map(s => String(s.studentId)))
  const notSubmitted = members.filter(m => !submittedIds.has(String(m.userId)))
  const formatDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
  const fmtDur = sec => (sec == null || sec < 0) ? null : (sec < 60 ? `${sec} giây` : (sec % 60 ? `${Math.floor(sec/60)} phút ${sec%60} giây` : `${Math.floor(sec/60)} phút`))

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box" style={{maxWidth:680,maxHeight:'90vh',overflowY:'auto'}}>
          <div className="modal-header">
            <h2>📊 {isExam ? 'Kết quả' : 'Bài nộp'} — {assignment.title}</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div style={{padding:'0 24px 24px'}}>
            {isExam && (
              <div className="cm-info-note" style={{marginBottom:12}}>
                🏆 Cách tính điểm: <strong>{
                  data.mode === 'average' ? 'Trung bình các lần' :
                  data.mode === 'latest' ? 'Lần làm gần nhất' : 'Điểm cao nhất'
                }</strong>
                {assignment.maxAttempts ? ` · Tối đa ${assignment.maxAttempts} lần` : ' · Không giới hạn số lần'}
              </div>
            )}
            {isWriting && (
              <div className="ielts-panel-stats">
                <h4 className="sub-section-title" style={{marginTop:0}}>📊 Bảng điểm {taskLabel} (AI chấm)</h4>
                <IeltsStatsTable classId={classId} assignmentId={assignment.id} refreshKey={statsKey}
                  onViewStudent={sid => {
                    const s = (data?.submissions || []).find(x => String(x.studentId) === String(sid))
                    if (s?.aiGrade) setViewGrade(s)
                  }} />
              </div>
            )}
            <div className="sub-stats-row">
              <div className="sub-stat sub-stat--done">
                {IC.check(18)}<span>{submissions.length}/{members.length}</span><small>Đã nộp</small>
              </div>
              <div className="sub-stat sub-stat--missing">
                {IC.clock(18)}<span>{notSubmitted.length}</span><small>Chưa nộp</small>
              </div>
              <div className="sub-progress">
                <div className="sub-progress-bar" style={{width:`${members.length ? Math.round(100*submissions.length/members.length) : 0}%`}} />
              </div>
            </div>

            {submissions.length > 0 && (
              <>
                <h4 className="sub-section-title">✅ Đã nộp ({submissions.length})</h4>
                {submissions.map(s => (
                  <div key={s.studentId} className="sub-row">
                    <div className="sub-avatar">{s.studentName?.[0] ?? '?'}</div>
                    <div className="sub-info">
                      <div className="sub-name">
                        {s.studentName}
                        {isExam && s.violations > 0 && (
                          <span className="sub-violation-chip" title="Số lần vi phạm khóa màn hình">
                            ⚠️ {s.violations}
                          </span>
                        )}
                      </div>
                      <div className="sub-time">
                        {IC.clock(11)} {formatDt(s.submittedAt)}
                        {isExam && s.attempts > 1 && <span> · {s.attempts} lần làm</span>}
                      </div>
                      {isExam && fmtDur(s.timeSpent) && (() => {
                        const limitSec = assignment.duration ? assignment.duration * 60 : 0
                        const pct = limitSec > 0 ? Math.min(100, Math.round((s.timeSpent / limitSec) * 100)) : 100
                        const color = !limitSec ? '#6366f1' : pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e'
                        return (
                          <div className="sub-timebar" title="Thời gian làm bài">
                            <div className="sub-timebar-fill" style={{ width: `${pct}%`, background: color }} />
                            <span className="sub-timebar-label">⏱ {fmtDur(s.timeSpent)}</span>
                          </div>
                        )
                      })()}
                      {s.note && <div className="sub-note">"{s.note}"</div>}
                      {s.files?.length > 0 && (
                        <div className="file-chip-list" style={{marginTop:6}}>
                          {s.files.map(f => (
                            <FileChip key={f.id} file={f} onView={setViewing} />
                          ))}
                        </div>
                      )}
                    </div>
                    {isWriting ? (
                      <div className="ielts-row-actions">
                        {s.aiGrade?.status === 'done' && (
                          <button className="ielts-band-view" title="Xem kết quả chấm AI"
                            onClick={() => setViewGrade(s)}>
                            <BandChip band={s.aiGrade.overallBand} size="sm" /> Xem kết quả
                          </button>
                        )}
                        {s.aiGrade?.status === 'pending' && <span className="ielts-pending-chip">⏳ Đang chấm…</span>}
                        {s.aiGrade?.status === 'error' && (
                          <span className="ielts-error-chip" title={s.aiGrade.error}>⚠️ Lỗi chấm</span>
                        )}
                        <GradeButton classId={classId} assignmentId={assignment.id}
                          studentId={s.studentId} hasGrade={s.aiGrade?.status === 'done'}
                          onDone={() => { reload(); setStatsKey(k => k + 1) }} />
                      </div>
                    ) : isExam && s.score != null ? (
                      <span className="sub-badge sub-badge--done">
                        {s.score}/{s.maxScore ?? '—'} điểm
                      </span>
                    ) : (
                      <span className="sub-badge sub-badge--done">{IC.check(11)} Đã nộp</span>
                    )}
                    <button
                      className="sub-del-btn"
                      title="Xóa bài làm của học sinh này"
                      onClick={() => setConfirmDel(s)}
                    >✕</button>
                  </div>
                ))}
              </>
            )}

            {isExam && data.examObj && (data.rawSubs?.length ?? 0) > 0 && (
              <div style={{marginTop:16}}>
                <QuestionStats exam={data.examObj} subs={data.rawSubs} />
              </div>
            )}

            {notSubmitted.length > 0 && (
              <>
                <h4 className="sub-section-title" style={{marginTop:16}}>⏳ Chưa nộp ({notSubmitted.length})</h4>
                {notSubmitted.map(m => (
                  <div key={m.userId} className="sub-row sub-row--missing">
                    <div className="sub-avatar sub-avatar--missing">{m.name?.[0] ?? '?'}</div>
                    <div className="sub-info">
                      <div className="sub-name">{m.name}</div>
                      <div className="sub-time">{m.email}</div>
                    </div>
                    <span className="sub-badge sub-badge--missing">Chưa nộp</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      {viewing && <FileViewerModal file={viewing} onClose={() => setViewing(null)} />}
      {viewGrade && (
        <IeltsGradeModal grade={viewGrade.aiGrade} studentName={viewGrade.studentName}
          taskLabel={taskLabel} onClose={() => setViewGrade(null)} />
      )}
      {confirmDel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !delBusy && setConfirmDel(null)}>
          <div className="modal-box sub-del-modal">
            <div className="sub-del-icon">🗑️</div>
            <h3 className="sub-del-title">Xóa bài làm?</h3>
            <p className="sub-del-text">
              Bạn có muốn xóa bài làm của học sinh{' '}
              <strong>{confirmDel.studentName || 'học sinh này'}</strong> hay không?
              {isExam && confirmDel.attempts > 1 && ` Tất cả ${confirmDel.attempts} lần làm sẽ bị xóa.`}
              {' '}Hành động này không thể hoàn tác.
            </p>
            <div className="sub-del-actions">
              <button className="mec-btn" disabled={delBusy} onClick={() => setConfirmDel(null)}>Hủy</button>
              <button className="mec-btn mec-btn--delete" disabled={delBusy} onClick={handleDelete}>
                {delBusy ? '⏳…' : '🗑️ Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Class form modal (create/edit) ─── */
function ClassFormModal({ initial, onClose, onSave, loading }) {
  const [name,     setName]     = useState(initial?.name ?? '')
  const [desc,     setDesc]     = useState(initial?.description ?? '')
  const [subject,  setSubject]  = useState(initial?.subject ?? null)
  const [password, setPassword] = useState(initial?.joinPassword ?? '')
  const [showPwd,  setShowPwd]  = useState(false)
  const [err,      setErr]      = useState('')

  const submit = () => {
    if (!name.trim()) { setErr('Vui lòng nhập tên lớp.'); return }
    onSave({ name: name.trim(), description: desc.trim(), subject, joinPassword: password.trim() || null })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:480}}>
        <div className="modal-header">
          <h2>{initial ? '✏️ Sửa lớp học' : '🏫 Tạo lớp học mới'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:'0 24px 24px'}}>
          <label className="cm-label">Tên lớp *</label>
          <input className="cm-input" placeholder="VD: Lớp 12A1, Nhóm Toán nâng cao…"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />

          <label className="cm-label" style={{marginTop:14}}>Loại hình lớp học</label>
          <SubjectPicker value={subject} onChange={setSubject} />
          {subject === 'anh' && (
            <div className="cm-info-note" style={{marginTop:8}}>
              🇬🇧 Lớp Tiếng Anh: bài tập nộp file có thể bật <strong>chấm điểm IELTS Writing bằng AI</strong>.
            </div>
          )}

          <label className="cm-label" style={{marginTop:14}}>Mô tả</label>
          <textarea className="cm-input cm-textarea" rows={2}
            placeholder="Mô tả ngắn (tuỳ chọn)" value={desc} onChange={e => setDesc(e.target.value)} />

          <label className="cm-label" style={{marginTop:14}}>
            {IC.lock(13)} Mật khẩu tham gia <span style={{color:'#94a3b8',fontWeight:400}}>(tuỳ chọn)</span>
          </label>
          <div className="pm-pwd-wrap">
            <input className="pm-input" type={showPwd ? 'text' : 'password'}
              placeholder="Để trống nếu không cần mật khẩu"
              value={password} onChange={e => setPassword(e.target.value)} />
            <button className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>{showPwd ? '🙈' : '👁️'}</button>
          </div>

          {err && <div className="cm-error">{err}</div>}
          <div className="cm-footer">
            <button className="pm-cancel" onClick={onClose}>Huỷ</button>
            <button className="btn-primary cm-submit" onClick={submit} disabled={loading}>
              {loading ? '⏳ Đang tạo…' : initial ? '💾 Lưu thay đổi' : '🏫 Tạo lớp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Add student modal ─── */
function AddStudentModal({ classMembers, onClose, onAdd }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const memberIds = new Set(classMembers.map(m => String(m.userId)))

  useEffect(() => {
    searchStudents('').then(setResults)
  }, [])

  const handleSearch = q => {
    setQuery(q)
    searchStudents(q).then(setResults)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:480}}>
        <div className="modal-header"><h2>👤 Thêm học sinh</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{padding:'0 24px 24px'}}>
          <div className="cm-search-wrap">
            <span className="cm-search-icon">{IC.search(15)}</span>
            <input className="cm-input cm-search-input" placeholder="Tìm tên hoặc email học sinh…"
              value={query} onChange={e => handleSearch(e.target.value)} autoFocus />
          </div>
          <div className="cm-student-list">
            {results.length === 0
              ? <div className="cm-empty-hint">Không tìm thấy học sinh nào.</div>
              : results.map(s => {
                const already = memberIds.has(String(s.id))
                return (
                  <div key={s.id} className={`cm-student-row ${already ? 'cm-student-row--added' : ''}`}>
                    <div className="cm-student-avatar">{s.avatar || s.name[0]}</div>
                    <div className="cm-student-info">
                      <div className="cm-student-name">{s.name}</div>
                      <div className="cm-student-email">{s.email}</div>
                    </div>
                    {already
                      ? <span className="cm-added-badge">{IC.check(13)} Đã thêm</span>
                      : <button className="cm-add-btn" onClick={() => onAdd(s)}>{IC.plus(13)} Thêm</button>
                    }
                  </div>
                )
              })
            }
          </div>
          <div className="cm-footer" style={{borderTop:'1px solid #f1f5f9',paddingTop:12}}>
            <button className="pm-cancel" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Assignment form modal ─── */
function AssignmentModal({ teacherId, cls, onClose, onSave }) {
  // Hiện cache localStorage ngay, rồi cập nhật bằng danh sách chuẩn từ server
  const [exams, setExams] = useState(() => getExamsByTeacher(teacherId).filter(e => e.published))
  useEffect(() => {
    let alive = true
    fetchExamsByTeacher(teacherId).then(list => {
      if (alive) setExams(list.filter(e => e.published))
    })
    return () => { alive = false }
  }, [teacherId])
  const isEnglishClass = cls?.subject === 'anh'
  const today = new Date().toISOString().slice(0, 10)
  const weekLater = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)

  const [mode, setMode] = useState('exam')   // 'exam' | 'homework'
  const [title,       setTitle]       = useState('')
  const [desc,        setDesc]        = useState('')
  const [examId,      setExamId]      = useState('')
  // Homework deadline
  const [dueDate,     setDueDate]     = useState('')
  const [dueTime,     setDueTime]     = useState('23:59')
  // Exam window (mở / đóng)
  const [openDate,    setOpenDate]    = useState(today)
  const [openTime,    setOpenTime]    = useState('08:00')
  const [closeDate,   setCloseDate]   = useState(weekLater)
  const [closeTime,   setCloseTime]   = useState('23:59')
  const [maxAttempts, setMaxAttempts] = useState('')        // '' = không giới hạn
  const [scoreMode,   setScoreMode]   = useState('highest') // highest | average | latest
  const [lockScreen,  setLockScreen]  = useState(false)     // khóa màn hình chống gian lận
  const [writingTask, setWritingTask] = useState('')        // '' | task1 | task2 (IELTS Writing, lớp Anh)
  const [attachments, setAttachments] = useState([])
  const [uploading,   setUploading]   = useState(false)
  const [viewing,     setViewing]     = useState(null)
  const [err,         setErr]         = useState('')

  const handleUploaded = (files) => setAttachments(prev => [...prev, ...files])
  const removeAttach   = (id) => setAttachments(prev => prev.filter(f => f.id !== id))

  const pickExam = (id) => {
    setExamId(id)
    const ex = exams.find(e => e.id === id)
    if (ex && !title.trim()) setTitle(ex.title)
  }

  const submit = () => {
    if (mode === 'exam') {
      if (!examId)    { setErr('Vui lòng chọn đề thi để giao.'); return }
      if (!openDate || !closeDate) { setErr('Vui lòng chọn thời gian mở và đóng.'); return }
      const openIso  = new Date(`${openDate}T${openTime}`).toISOString()
      const closeIso = new Date(`${closeDate}T${closeTime}`).toISOString()
      if (new Date(closeIso) <= new Date(openIso)) { setErr('Thời gian đóng phải sau thời gian mở.'); return }
      const ex = exams.find(e => e.id === examId)
      onSave({
        title: (title.trim() || ex?.title || 'Đề thi'),
        description: desc.trim(), examId,
        openTime: openIso, closeTime: closeIso,
        dueDate: closeIso, duration: ex?.settings?.duration ?? null,
        maxAttempts: maxAttempts ? Math.max(1, parseInt(maxAttempts, 10) || 1) : null,
        scoreMode,
        lockScreen,
        attachments: [],
      })
      return
    }
    // homework
    if (!title.trim()) { setErr('Vui lòng nhập tiêu đề bài tập.'); return }
    if (!dueDate)      { setErr('Vui lòng chọn ngày hạn nộp.');    return }
    if (writingTask === 'task1' && attachments.length === 0) {
      setErr('IELTS Writing Task 1 cần đính kèm ảnh đề bài (biểu đồ/bảng/sơ đồ) để AI chấm chính xác.'); return
    }
    const iso = new Date(`${dueDate}T${dueTime}`).toISOString()
    onSave({ title: title.trim(), description: desc.trim(), examId: null, dueDate: iso, attachments, writingTask: writingTask || null })
  }

  const selectedExam = exams.find(e => e.id === examId)

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box" style={{maxWidth:560,maxHeight:'92vh',overflowY:'auto'}}>
          <div className="modal-header">
            <h2>{mode === 'exam' ? '📋 Giao đề thi' : '📝 Giao bài tập'}</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div style={{padding:'0 24px 24px'}}>
            {/* Mode switch */}
            <div className="cm-mode-tabs">
              <button className={`cm-mode-tab ${mode === 'exam' ? 'active' : ''}`}
                onClick={() => { setMode('exam'); setErr('') }}>📋 Giao đề thi</button>
              <button className={`cm-mode-tab ${mode === 'homework' ? 'active' : ''}`}
                onClick={() => { setMode('homework'); setErr('') }}>📝 Bài tập / nộp file</button>
            </div>

            {mode === 'exam' ? (
              <>
                <label className="cm-label">Chọn đề thi *</label>
                {exams.length === 0 ? (
                  <div className="cm-info-note">Bạn chưa có đề thi nào đã xuất bản. Hãy tạo & xuất bản đề trước.</div>
                ) : (
                  <select className="cm-input cm-select" value={examId} onChange={e => pickExam(e.target.value)} autoFocus>
                    <option value="">— Chọn đề —</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                )}
                {selectedExam && (
                  <div className="cm-info-note">
                    📊 {selectedExam.totalQuestions} câu · ⏱ {selectedExam.settings?.duration ?? '—'} phút làm bài
                  </div>
                )}

                <label className="cm-label" style={{marginTop:14}}>🟢 Mở đề *</label>
                <div style={{display:'flex',gap:10}}>
                  <input type="date" className="cm-input" style={{flex:2}}
                    value={openDate} onChange={e => setOpenDate(e.target.value)} />
                  <input type="time" className="cm-input" style={{flex:1}}
                    value={openTime} onChange={e => setOpenTime(e.target.value)} />
                </div>

                <label className="cm-label" style={{marginTop:14}}>🔴 Đóng đề *</label>
                <div style={{display:'flex',gap:10}}>
                  <input type="date" className="cm-input" style={{flex:2}}
                    value={closeDate} onChange={e => setCloseDate(e.target.value)} />
                  <input type="time" className="cm-input" style={{flex:1}}
                    value={closeTime} onChange={e => setCloseTime(e.target.value)} />
                </div>

                <div style={{display:'flex',gap:12,marginTop:14}}>
                  <div style={{flex:1}}>
                    <label className="cm-label">🔁 Số lần làm tối đa</label>
                    <input type="number" min="1" className="cm-input"
                      placeholder="Không giới hạn"
                      value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} />
                  </div>
                  <div style={{flex:1.4}}>
                    <label className="cm-label">🏆 Cách tính điểm</label>
                    <select className="cm-input cm-select" value={scoreMode} onChange={e => setScoreMode(e.target.value)}>
                      <option value="highest">Lấy điểm cao nhất</option>
                      <option value="average">Lấy điểm trung bình</option>
                      <option value="latest">Lấy lần làm gần nhất</option>
                    </select>
                  </div>
                </div>
                <div className="cm-info-note" style={{marginTop:8}}>
                  {scoreMode === 'highest' && '🏆 Điểm ghi nhận = lần làm CAO NHẤT.'}
                  {scoreMode === 'average' && '➗ Điểm ghi nhận = TRUNG BÌNH các lần làm.'}
                  {scoreMode === 'latest'  && '🕒 Điểm ghi nhận = lần làm GẦN NHẤT.'}
                  {maxAttempts ? ` Tối đa ${maxAttempts} lần làm.` : ' Không giới hạn số lần làm.'}
                </div>

                <label className="cm-lock-toggle" style={{marginTop:14}}>
                  <input type="checkbox" checked={lockScreen}
                    onChange={e => setLockScreen(e.target.checked)} />
                  <div>
                    <div className="cm-lock-title">🔒 Khóa màn hình khi làm bài</div>
                    <div className="cm-lock-sub">
                      Bắt buộc toàn màn hình, chặn rời tab / copy / phím tắt. Mỗi lần vi phạm được ghi lại cho bạn xem.
                    </div>
                  </div>
                </label>

                <label className="cm-label" style={{marginTop:14}}>Ghi chú cho học sinh <span style={{color:'#94a3b8',fontWeight:400}}>(tuỳ chọn)</span></label>
                <textarea className="cm-input cm-textarea" rows={2}
                  placeholder="VD: Làm nghiêm túc, không trao đổi…"
                  value={desc} onChange={e => setDesc(e.target.value)} />

                <div className="cm-info-note" style={{marginTop:12}}>
                  📌 Học sinh trong lớp vào mục <strong>Lớp của tôi</strong> → bấm <strong>Làm bài</strong> để thi trực tiếp, không cần link công khai.
                </div>
              </>
            ) : (
              <>
                <label className="cm-label">Tiêu đề *</label>
                <input className="cm-input" placeholder="VD: Bài tập về nhà số 3"
                  value={title} onChange={e => setTitle(e.target.value)} autoFocus />

                <label className="cm-label" style={{marginTop:14}}>Mô tả / Hướng dẫn</label>
                <textarea className="cm-input cm-textarea" rows={3}
                  placeholder="Hướng dẫn làm bài (tuỳ chọn)"
                  value={desc} onChange={e => setDesc(e.target.value)} />

                <label className="cm-label" style={{marginTop:14}}>⏰ Hạn nộp *</label>
                <div style={{display:'flex',gap:10}}>
                  <input type="date" className="cm-input" style={{flex:2}}
                    value={dueDate} min={today} onChange={e => setDueDate(e.target.value)} />
                  <input type="time" className="cm-input" style={{flex:1}}
                    value={dueTime} onChange={e => setDueTime(e.target.value)} />
                </div>

                {isEnglishClass && (
                  <>
                    <label className="cm-label" style={{marginTop:14}}>🤖 Chấm điểm AI (IELTS Writing)</label>
                    <div className="wt-picker">
                      {[['', '✍️ Không chấm AI'], ['task1', '📊 Part 1 · Writing Task 1'], ['task2', '📝 Part 2 · Writing Task 2']].map(([v, l]) => (
                        <button key={v} type="button"
                          className={`wt-pick ${writingTask === v ? 'wt-pick--active' : ''}`}
                          onClick={() => setWritingTask(v)}>{l}</button>
                      ))}
                    </div>
                    {writingTask && (
                      <div className="cm-info-note" style={{marginTop:8}}>
                        {writingTask === 'task1'
                          ? <>📊 <strong>Task 1</strong>: AI chấm theo band descriptors Task 1. Hãy <strong>đính kèm ảnh đề bài</strong> (biểu đồ/bảng/sơ đồ) bên dưới — AI sẽ trích xuất hình ảnh đề để chấm chính xác.</>
                          : <>📝 <strong>Task 2</strong>: AI chấm theo band descriptors Task 2. Ghi đề bài vào phần Mô tả hoặc đính kèm ảnh đề.</>}
                        {' '}Bài nộp của học sinh sẽ được chấm tự động (band 0–9, 4 tiêu chí, nhận xét chi tiết).
                      </div>
                    )}
                  </>
                )}

                <label className="cm-label" style={{marginTop:14}}>
                  📎 Tài liệu đính kèm {writingTask === 'task1'
                    ? <span style={{color:'#dc2626',fontWeight:600}}>(ảnh đề bài — bắt buộc)</span>
                    : <span style={{color:'#94a3b8',fontWeight:400}}>(tuỳ chọn)</span>}
                </label>
                {attachments.length > 0 && (
                  <div className="file-chip-list">
                    {attachments.map(f => (
                      <FileChip key={f.id} file={f} onRemove={removeAttach} onView={setViewing} />
                    ))}
                  </div>
                )}
                <FileDropZone onUploaded={handleUploaded} uploading={uploading} setUploading={setUploading} />
              </>
            )}

            {err && <div className="cm-error">{err}</div>}
            <div className="cm-footer">
              <button className="pm-cancel" onClick={onClose}>Huỷ</button>
              <button className="btn-primary cm-submit" onClick={submit} disabled={uploading}>
                {mode === 'exam' ? '📋 Giao đề' : '📝 Giao bài'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {viewing && <FileViewerModal file={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

/* ─── Class detail panel ─── */
function ClassDetail({ cls, teacherId, onBack, onUpdated }) {
  const [tab,            setTab]            = useState('members')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showAssignment, setShowAssignment] = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [viewSubs,       setViewSubs]       = useState(null)
  const [viewingFile,    setViewingFile]    = useState(null)
  const [copiedJoin,     setCopiedJoin]     = useState(false)
  const fileInputRef = useRef(null)

  const refresh = () => onUpdated()

  const copyJoin = () => {
    navigator.clipboard.writeText(joinUrl(cls.joinCode))
    setCopiedJoin(true)
    setTimeout(() => setCopiedJoin(false), 2000)
  }

  /* Members */
  const handleAddMember = async (student) => {
    await addMemberToClass(cls.id, student)
    refresh()
  }
  const handleRemoveMember = async (userId) => {
    if (!confirm('Xoá học sinh khỏi lớp?')) return
    await removeMemberFromClass(cls.id, userId)
    refresh()
  }

  /* Assignments */
  const handleAddAssignment = async (data) => {
    await addAssignment(cls.id, data)
    setShowAssignment(false)
    refresh()
  }
  const handleRemoveAssignment = async (aId) => {
    if (!confirm('Xoá bài tập này?')) return
    await removeAssignment(cls.id, aId)
    refresh()
  }

  /* Documents */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const doc = await uploadFile(file)
      await addDocument(cls.id, doc)
      refresh()
    } catch (err) { alert('Upload thất bại: ' + err.message) }
    finally { setUploading(false); e.target.value = '' }
  }
  const handleRemoveDoc = async (doc) => {
    if (!confirm(`Xoá tài liệu "${doc.name}"?`)) return
    await fetch(`/api/class-documents/${encodeURIComponent(doc.filename)}`, { method: 'DELETE' }).catch(() => {})
    await removeDocument(cls.id, doc.id)
    refresh()
  }

  const formatDt = iso => iso
    ? new Date(iso).toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
    : '—'
  const formatSize = b => !b ? '' : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`

  return (
    <div className="cm-detail">
      {/* Header */}
      <div className="cm-detail-header">
        <button className="cm-back-btn" onClick={onBack}>{IC.back(18)} Quay lại</button>
        <div style={{flex:1}}>
          <h2 className="cm-detail-title">{cls.name} <SubjectBadge subject={cls.subject} /></h2>
          {cls.description && <p className="cm-detail-desc">{cls.description}</p>}
        </div>
        <div className="cm-detail-stats">
          <span className="cm-stat-chip">{IC.users(14)} {cls.members?.length ?? 0}</span>
          <span className="cm-stat-chip">{IC.book(14)} {cls.assignments?.length ?? 0}</span>
          <span className="cm-stat-chip">{IC.clip(14)} {cls.documents?.length ?? 0}</span>
        </div>
      </div>

      {/* Join link */}
      <div className="cm-join-section">
        <div className="cm-join-info">
          <span className="cm-join-label">{IC.link(14)} Mã tham gia: <strong>{cls.joinCode}</strong></span>
          {cls.joinPassword && <span className="cm-join-pwd">{IC.lock(12)} Có mật khẩu</span>}
        </div>
        <button className={`mec-btn ${copiedJoin ? 'mec-btn--practice-on' : ''}`} onClick={copyJoin}>
          {copiedJoin ? <>{IC.check(14)} Đã sao chép</> : <>{IC.copy(14)} Sao chép link</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="cm-tabs">
        {[['members','👤 Học sinh'],['assignments','📝 Bài tập'],['documents','📎 Tài liệu']].map(([k,l]) => (
          <button key={k} className={`cm-tab ${tab===k ? 'cm-tab--active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="cm-tab-body">
        {/* ── Members ── */}
        {tab === 'members' && (
          <div>
            <div className="cm-section-toolbar">
              <span className="cm-section-count">{cls.members?.length ?? 0} học sinh</span>
              <button className="btn-primary cm-action-btn" onClick={() => setShowAddStudent(true)}>
                {IC.plus(14)} Thêm học sinh
              </button>
            </div>
            {(cls.members?.length ?? 0) === 0 ? (
              <div className="cm-empty-state">
                <div className="cm-empty-icon">{IC.users(40)}</div>
                <p>Lớp chưa có học sinh nào. Chia sẻ link tham gia hoặc thêm trực tiếp.</p>
                <button className="btn-primary" onClick={() => setShowAddStudent(true)}>{IC.plus(14)} Thêm học sinh</button>
              </div>
            ) : (
              <div className="cm-member-list">
                {cls.members.map((m, i) => (
                  <div key={m.userId} className="cm-member-row">
                    <div className="cm-member-num">{i + 1}</div>
                    <div className="cm-member-avatar">{m.name?.[0] ?? '?'}</div>
                    <div className="cm-member-info">
                      <div className="cm-member-name">{m.name}</div>
                      <div className="cm-member-email">{m.email}</div>
                    </div>
                    <div className="cm-member-added">Thêm: {formatDt(m.addedAt)}</div>
                    <button className="cm-remove-btn" onClick={() => handleRemoveMember(m.userId)}>{IC.x(14)}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Assignments ── */}
        {tab === 'assignments' && (
          <div>
            <div className="cm-section-toolbar">
              <span className="cm-section-count">{cls.assignments?.length ?? 0} bài tập</span>
              <button className="btn-primary cm-action-btn" onClick={() => setShowAssignment(true)}>
                {IC.plus(14)} Giao bài tập
              </button>
            </div>
            {(cls.assignments?.length ?? 0) === 0 ? (
              <div className="cm-empty-state">
                <div className="cm-empty-icon">{IC.book(40)}</div>
                <p>Chưa có bài tập nào.</p>
                <button className="btn-primary" onClick={() => setShowAssignment(true)}>{IC.plus(14)} Giao bài tập</button>
              </div>
            ) : (
              <div className="cm-assignment-list">
                {[...cls.assignments].sort((a,b) => new Date(a.dueDate)-new Date(b.dueDate)).map(a => {
                  const past = a.dueDate && new Date(a.dueDate) < new Date()
                  const subCount = a.submissions?.length ?? 0
                  const total = cls.members?.length ?? 0
                  const isExam = !!a.examId
                  const now = Date.now()
                  const winOpen  = a.openTime ? new Date(a.openTime).getTime() : null
                  const winClose = (a.closeTime || a.dueDate) ? new Date(a.closeTime || a.dueDate).getTime() : null
                  const winSt = isExam
                    ? (winOpen && now < winOpen ? 'pending' : (winClose && now > winClose ? 'closed' : 'open'))
                    : null
                  return (
                    <div key={a.id} className={`cm-assignment-card ${past && !isExam ? 'cm-assignment-card--past' : ''}`}>
                      <div className="cm-asgn-left">
                        <div className="cm-asgn-title">{isExam ? '📋 ' : ''}{a.title}</div>
                        {a.description && <div className="cm-asgn-desc">{a.description}</div>}
                        <div className="cm-asgn-meta">
                          {isExam ? (
                            <>
                              <span className="cm-exam-chip">{IC.link(12)} Đề thi</span>
                              <span className={`cm-window-chip cm-window-chip--${winSt}`}>
                                {IC.clock(12)} {winSt === 'pending' ? `Mở ${formatDt(a.openTime)}`
                                  : winSt === 'closed' ? `Đã đóng ${formatDt(a.closeTime || a.dueDate)}`
                                  : `Đang mở · đóng ${formatDt(a.closeTime || a.dueDate)}`}
                              </span>
                            </>
                          ) : (
                            <span className={`cm-due-chip ${past ? 'cm-due-chip--past' : ''}`}>
                              {IC.clock(12)} {formatDt(a.dueDate)}{past && ' (Hết hạn)'}
                            </span>
                          )}
                          {a.writingTask && (
                            <span className="cm-exam-chip ielts-task-chip">
                              🤖 IELTS Writing {a.writingTask === 'task1' ? 'Task 1' : 'Task 2'} · Chấm AI
                            </span>
                          )}
                          {a.attachments?.length > 0 && <span className="cm-exam-chip">{IC.clip(12)} {a.attachments.length} file</span>}
                        </div>
                        {a.attachments?.length > 0 && (
                          <div className="file-chip-list" style={{marginTop:6}}>
                            {a.attachments.map(f => (
                              <FileChip key={f.id} file={f} onView={setViewingFile} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="cm-asgn-right">
                        <button className="mec-btn mec-btn--results" onClick={() => setViewSubs(a)}>
                          {IC.chart(14)} {isExam ? 'Xem điểm' : `${subCount}/${total} nộp`}
                        </button>
                        <button className="cm-remove-btn" onClick={() => handleRemoveAssignment(a.id)}>{IC.trash(14)}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Documents ── */}
        {tab === 'documents' && (
          <div>
            <div className="cm-section-toolbar">
              <span className="cm-section-count">{cls.documents?.length ?? 0} tài liệu</span>
              <button className="btn-primary cm-action-btn"
                onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? '⏳ Đang upload…' : <>{IC.upload(14)} Upload</>}
              </button>
              <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileSelect} />
            </div>
            {(cls.documents?.length ?? 0) === 0 ? (
              <div className="cm-empty-state">
                <div className="cm-empty-icon">{IC.clip(40)}</div>
                <p>Chưa có tài liệu nào.</p>
                <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>{IC.upload(14)} Upload tài liệu</button>
              </div>
            ) : (
              <div className="cm-doc-list">
                {cls.documents.map(d => (
                  <div key={d.id} className="cm-doc-row">
                    <div className="cm-doc-icon" onClick={() => setViewingFile(d)} style={{cursor:'pointer'}}>{IC.file(20)}</div>
                    <div className="cm-doc-info">
                      <button className="cm-doc-name" onClick={() => setViewingFile(d)}>{d.name}</button>
                      <div className="cm-doc-meta">{formatSize(d.size)} · {formatDt(d.uploadedAt)}</div>
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" download className="cm-remove-btn" title="Tải xuống">{IC.download(14)}</a>
                    <button className="cm-remove-btn" onClick={() => handleRemoveDoc(d)}>{IC.trash(14)}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddStudent && (
        <AddStudentModal classMembers={cls.members||[]} onClose={() => setShowAddStudent(false)} onAdd={handleAddMember} />
      )}
      {showAssignment && (
        <AssignmentModal teacherId={teacherId} cls={cls} onClose={() => setShowAssignment(false)} onSave={handleAddAssignment} />
      )}
      {viewSubs && (
        <SubmissionsPanel classId={cls.id} assignment={viewSubs} members={cls.members||[]}
          allAssignments={cls.assignments||[]} onClose={() => setViewSubs(null)} />
      )}
      {viewingFile && <FileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  )
}

/* ─── Main page ─── */
export default function ClassManagementPage({ user }) {
  const [classes,    setClasses]    = useState([])
  const [selected,   setSelected]   = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editCls,    setEditCls]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [showTools,  setShowTools]  = useState(false)
  const [activeTool, setActiveTool] = useState(null) // 'geo3d' | 'solver' | null

  const reload = async () => {
    const fresh = await getClassesByTeacher(String(user.id))
    setClasses(fresh)
    if (selected) setSelected(fresh.find(c => c.id === selected.id) || null)
  }

  useEffect(() => { reload() }, [])

  const handleCreate = async ({ name, description, subject, joinPassword }) => {
    setLoading(true)
    try {
      await createClass({ name, description, subject, teacherId: user.id, teacherName: user.name, joinPassword })
      setShowCreate(false)
      reload()
    } finally { setLoading(false) }
  }

  const handleEdit = async ({ name, description, subject, joinPassword }) => {
    await updateClassInfo(editCls.id, { name, description, subject: subject || null, joinPassword })
    setEditCls(null)
    reload()
  }

  const handleDelete = async (id) => {
    if (!confirm('Xoá lớp học này? Hành động không thể hoàn tác.')) return
    await deleteClass(id)
    if (selected?.id === id) setSelected(null)
    reload()
  }

  const formatDt = iso => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  const toolOverlays = (
    <>
      {showTools && (
        <TeacherToolsModal
          onSelectTool={id => setActiveTool(id)}
          onClose={() => setShowTools(false)}
        />
      )}
      {activeTool === 'solver' && (
        <ExerciseSolver onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'geo3d' && (
        <div className="tt-overlay" onClick={e => e.target === e.currentTarget && setActiveTool(null)}>
          <div className="tt-geo-window">
            <div className="es-header">
              <span className="es-header-title">📐 Vẽ hình không gian</span>
              <button className="modal-close" onClick={() => setActiveTool(null)}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Geo3DViewer />
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (selected) return (
    <div className="app">
      <div className="create-topbar">
        <h1 className="exam-title" style={{display:'flex',alignItems:'center',gap:10}}>{IC.users(24)} Quản lý lớp học</h1>
      </div>
      <ClassDetail cls={selected} teacherId={user.id} onBack={() => setSelected(null)} onUpdated={reload} />
      {toolOverlays}
    </div>
  )

  return (
    <div className="app">
      <div className="create-topbar">
        <h1 className="exam-title" style={{display:'flex',alignItems:'center',gap:10}}>{IC.users(24)} Quản lý lớp học</h1>
        <p className="exam-subtitle">Tạo lớp học, giao bài tập và upload tài liệu cho học sinh</p>
      </div>

      <div className="my-exams-toolbar">
        <span className="met-count">{classes.length} lớp học</span>
        <button className="tt-tools-btn" onClick={() => setShowTools(true)}>
          🛠 Công cụ
        </button>
        <button className="btn-primary mec-create-btn" onClick={() => setShowCreate(true)}>
          {IC.plus(15)} Tạo lớp mới
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="my-exams-empty">
          <div className="mee-icon">{IC.users(48)}</div>
          <h3>Chưa có lớp học nào</h3>
          <p>Tạo lớp học đầu tiên để quản lý học sinh và giao bài tập</p>
          <button className="btn-primary btn-lg" onClick={() => setShowCreate(true)}>{IC.plus(16)} Tạo lớp học ngay</button>
        </div>
      ) : (
        <div className="cm-class-grid">
          {classes.map(cls => (
            <div key={cls.id} className="cm-class-card">
              <div className="cm-class-card-header">
                <div className="cm-class-icon">{SUBJECTS[cls.subject]?.icon ?? '🏫'}</div>
                <div className="cm-class-title">{cls.name}</div>
              </div>
              <div className="cm-class-subject-row"><SubjectBadge subject={cls.subject} /></div>
              {cls.description && <div className="cm-class-desc-preview">{cls.description}</div>}
              <div className="cm-class-stats">
                <span>{IC.users(13)} {cls.members?.length ?? 0} học sinh</span>
                <span>{IC.book(13)} {cls.assignments?.length ?? 0} bài tập</span>
                <span>{IC.clip(13)} {cls.documents?.length ?? 0} tài liệu</span>
              </div>
              <div className="cm-class-footer">
                <span className="cm-class-date">Tạo: {formatDt(cls.createdAt)}</span>
                <div className="cm-class-actions">
                  <button className="mec-btn" onClick={() => setEditCls(cls)}>{IC.pencil(14)}</button>
                  <button className="mec-btn mec-btn--delete" onClick={() => handleDelete(cls.id)}>{IC.trash(14)}</button>
                  <button className="btn-primary cm-enter-btn" onClick={() => setSelected(cls)}>Vào lớp →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <ClassFormModal loading={loading} onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editCls    && <ClassFormModal initial={editCls} onClose={() => setEditCls(null)} onSave={handleEdit} />}
      {toolOverlays}
    </div>
  )
}

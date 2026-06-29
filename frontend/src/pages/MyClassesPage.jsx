import React, { useEffect, useRef, useState } from 'react'
import { getClassesByStudent, getExamWindow, getPendingForStudent, joinClassByCode, submitAssignment, uploadFile } from '../store/classStore.js'

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
                <a className="btn-primary" href={`#take/${assignment.examId}/${cls.id}`} onClick={onClose}>
                  {IC.play(14)} Làm bài thi
                </a>
              </div>
            ) : (
              <>
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

/* ─── Exam assignment card (đề thi được giao) ─── */
function ExamAssignmentCard({ assignment, cls, user }) {
  const st = examWindowStatus(assignment)
  const openIso  = assignment.openTime
  const closeIso = assignment.closeTime || assignment.dueDate
  const maxAttempts = assignment.maxAttempts || null
  const scoreMode   = assignment.scoreMode || 'highest'

  const [used, setUsed] = useState(null)   // số lần đã làm
  useEffect(() => {
    let alive = true
    getExamWindow(cls.id, assignment.examId, user?.id, user?.email)
      .then(w => { if (alive && w) setUsed(w.attemptsUsed ?? 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [cls.id, assignment.examId, user?.id])

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
      </div>
      {st === 'open' && !exhausted ? (
        <a className="btn-primary mc-submit-btn" href={`#take/${assignment.examId}/${cls.id}`}>
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
  if (assignment.examId) return <ExamAssignmentCard assignment={assignment} cls={cls} user={user} />

  const mySubmission = assignment.submissions?.find(s => String(s.studentId) === String(user.id))
  const isDuePast   = assignment.dueDate && new Date(assignment.dueDate) < new Date()

  return (
    <div className={`mc-asgn-card ${isDuePast && !mySubmission ? 'mc-asgn-card--overdue' : ''} ${mySubmission ? 'mc-asgn-card--done' : ''}`}>
      <div className="mc-asgn-main">
        <div className="mc-asgn-title">{assignment.title}</div>
        {assignment.description && <div className="mc-asgn-desc">{assignment.description}</div>}
        <div className="mc-asgn-meta">
          <span className={`cm-due-chip ${isDuePast ? 'cm-due-chip--past' : ''}`}>
            {IC.clock(12)} Hạn: {formatDt(assignment.dueDate)}{isDuePast && ' (Hết hạn)'}
          </span>
          {assignment.attachments?.length > 0 && <span className="cm-exam-chip">{IC.clip(12)} {assignment.attachments.length} file đính kèm</span>}
        </div>
        {mySubmission && (
          <div className="mc-submitted-info">
            {IC.check(13)} Đã nộp lúc {formatDt(mySubmission.submittedAt)}
            {mySubmission.files?.length > 0 && <span> · {mySubmission.files.length} file</span>}
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
    })
  }, [cls.id, refreshKey])

  return (
    <div className="cm-detail">
      <div className="cm-detail-header">
        <button className="cm-back-btn" onClick={onBack}>{IC.back(18)} Quay lại</button>
        <div style={{flex:1}}>
          <h2 className="cm-detail-title">{localCls.name}</h2>
          {localCls.description && <p className="cm-detail-desc">{localCls.description}</p>}
          {localCls.teacherName && <p className="cm-detail-desc">Giáo viên: <strong>{localCls.teacherName}</strong></p>}
        </div>
        <div className="cm-detail-stats">
          {pendingCount > 0 && (
            <span className="cm-stat-chip" style={{background:'#fef3c7',color:'#92400e'}}>
              {IC.clock(14)} {pendingCount} cần làm
            </span>
          )}
        </div>
      </div>

      {(localCls.assignments?.length ?? 0) === 0 ? (
        <div className="cm-empty-state">
          <div className="cm-empty-icon">{IC.book(40)}</div>
          <p>Lớp chưa có bài tập nào.</p>
        </div>
      ) : (
        <div className="mc-asgn-list">
          {[...localCls.assignments].sort((a,b) => new Date(a.dueDate)-new Date(b.dueDate)).map(a => (
            <AssignmentCard key={a.id} assignment={a} cls={localCls} user={user}
              onSubmit={setSubmitting} />
          ))}
        </div>
      )}

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

  const submit = async () => {
    if (!code.trim()) { setErr('Vui lòng nhập mã lớp.'); return }
    setLoading(true); setErr('')
    const result = await joinClassByCode(code.trim().toUpperCase(), password.trim() || null, user)
    setLoading(false)
    if (result.error) { setErr(result.error); return }
    onJoined(result.className)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:420}}>
        <div className="modal-header"><h2>🏫 Tham gia lớp học</h2><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{padding:'0 24px 24px'}}>
          <label className="cm-label">{IC.key(13)} Mã lớp *</label>
          <input className="cm-input" style={{letterSpacing:4,fontSize:'1.2rem',textAlign:'center'}}
            placeholder="ABC123" maxLength={6}
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />

          <label className="cm-label" style={{marginTop:14}}>
            Mật khẩu <span style={{color:'#94a3b8',fontWeight:400}}>(nếu có)</span>
          </label>
          <input className="cm-input" type="password" placeholder="Nhập mật khẩu lớp"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />

          {err && <div className="cm-error">{err}</div>}
          <div className="cm-footer">
            <button className="pm-cancel" onClick={onClose}>Huỷ</button>
            <button className="btn-primary cm-submit" onClick={submit} disabled={loading}>
              {loading ? '⏳ Đang tham gia…' : '🏫 Tham gia lớp'}
            </button>
          </div>
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

  // Tự động tham gia lớp khi truy cập qua link #join/<code>
  useEffect(() => {
    if (!initialJoinCode) return
    const code = initialJoinCode.trim().toUpperCase()
    let cancelled = false
    joinClassByCode(code, null, user).then(result => {
      if (cancelled) return
      setAutoJoining(false)
      if (result.error) {
        // Có thể cần mật khẩu hoặc lỗi khác → mở modal để người dùng xử lý
        setJoinCode(code)
        setShowJoin(true)
      } else {
        setToast(`✅ Đã tham gia lớp "${result.className}" thành công!`)
        setTimeout(() => setToast(null), 3500)
        reload()
      }
    })
    return () => { cancelled = true }
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
            return (
              <div key={cls.id} className="cm-class-card" style={{cursor:'pointer'}} onClick={() => setSelected(cls)}>
                <div className="cm-class-card-header">
                  <div className="cm-class-icon">🏫</div>
                  <div style={{flex:1}}>
                    <div className="cm-class-title">{cls.name}</div>
                    {cls.teacherName && <div style={{fontSize:'0.78rem',color:'#64748b'}}>GV: {cls.teacherName}</div>}
                  </div>
                  {pending > 0 && <span className="mc-pending-badge">{pending} cần nộp</span>}
                </div>
                {cls.description && <div className="cm-class-desc-preview">{cls.description}</div>}
                <div className="cm-class-stats">
                  <span>{IC.book(13)} {cls.assignments?.length ?? 0} bài tập</span>
                  <span>{cls.members?.length ?? 0} học sinh</span>
                </div>
                <div className="cm-class-footer">
                  <span className="cm-class-date">Tham gia: {new Date(cls.createdAt).toLocaleDateString('vi-VN')}</span>
                  <span style={{fontSize:'0.82rem',color:'#2563eb',fontWeight:600}}>Xem chi tiết →</span>
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

import React, { useEffect, useRef, useState } from 'react'
import { classShareUrl, deleteExam, examStatus, fetchExamById, fetchExamsByTeacher, getExamsByTeacher, lobbyUrl, practiceShareUrl, setExamPublic, shareUrl } from '../store/examStore.js'
import PublishModal from '../components/PublishModal.jsx'
import PracticeSettingsModal from '../components/PracticeSettingsModal.jsx'

/* ─── SVG primitives ─── */
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
  books:    (s) => <Svg size={s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Svg>,
  file:     (s) => <Svg size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></Svg>,
  pencil:   (s) => <Svg size={s}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></Svg>,
  clock:    (s) => <Svg size={s}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></Svg>,
  calendar: (s) => <Svg size={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>,
  lock:     (s) => <Svg size={s}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Svg>,
  timer:    (s) => <Svg size={s}><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14 15"/><path d="M9 3h6"/></Svg>,
  key:      (s) => <Svg size={s}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></Svg>,
  eyeOff:   (s) => <Svg size={s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="2" y1="2" x2="22" y2="22"/></Svg>,
  list:     (s) => <Svg size={s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Svg>,
  link:     (s) => <Svg size={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Svg>,
  check:    (s) => <Svg size={s}><polyline points="20 6 9 17 4 12"/></Svg>,
  play:     (s) => <Svg size={s}><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></Svg>,
  gear:     (s) => <Svg size={s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></Svg>,
  rocket:   (s) => <Svg size={s}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></Svg>,
  chart:    (s) => <Svg size={s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Svg>,
  trash:    (s) => <Svg size={s}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>,
  dotGreen: (s) => <svg width={s} height={s} viewBox="0 0 8 8" style={{flexShrink:0,verticalAlign:'middle'}}><circle cx="4" cy="4" r="4" fill="#22c55e"/></svg>,
  dotGray:  (s) => <svg width={s} height={s} viewBox="0 0 8 8" style={{flexShrink:0,verticalAlign:'middle'}}><circle cx="4" cy="4" r="4" fill="#94a3b8"/></svg>,
  hourglass:(s) => <Svg size={s}><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></Svg>,
  plus:     (s) => <Svg size={s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>,
  copy:     (s) => <Svg size={s}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>,
  globe:    (s) => <Svg size={s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Svg>,
}

/* ── Mini link row inside dropdown ── */
function MiniLinkRow({ category, categoryColor, label, url, onCopy, copied }) {
  return (
    <div className="mlr-row">
      <div className="mlr-meta">
        <span className="mlr-cat" style={{ color: categoryColor, background: categoryColor + '18' }}>
          {category}
        </span>
        <span className="mlr-label">{label}</span>
      </div>
      <div className="mlr-url-row">
        <span className="mlr-url">{url}</span>
        <button className={`mlr-copy ${copied ? 'mlr-copy--done' : ''}`}
          onClick={onCopy} title={copied ? 'Đã sao chép' : 'Sao chép'}>
          {copied
            ? <Svg size={13}><polyline points="20 6 9 17 4 12"/></Svg>
            : <Svg size={13}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>
          }
          <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
        </button>
      </div>
    </div>
  )
}

const STATUS_META = {
  draft:   { label: 'Nháp',         color: '#94a3b8', bg: '#f1f5f9', icon: (s) => IC.pencil(s)   },
  pending: { label: 'Chưa mở',      color: '#f59e0b', bg: '#fef3c7', icon: (s) => IC.hourglass(s) },
  open:    { label: 'Đang diễn ra', color: '#059669', bg: '#d1fae5', icon: (s) => IC.dotGreen(s)  },
  expired: { label: 'Đã kết thúc',  color: '#94a3b8', bg: '#f1f5f9', icon: (s) => IC.dotGray(s)  },
}

function StatusBadge({ status }) {
  // Đề chưa "Phát đề" qua link công khai (status 'draft') vẫn là đề bình thường —
  // đã dùng được để giao trong lớp, nên không gắn mác đặc biệt nào cả.
  if (status === 'draft') return null
  const m = STATUS_META[status] || STATUS_META.draft
  return (
    <span className="exam-status-badge"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}30`, display:'inline-flex', alignItems:'center', gap:5 }}>
      {m.icon(10)} {m.label}
    </span>
  )
}

function MetaChip({ icon, children }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
      {icon}{children}
    </span>
  )
}

export default function MyExamsPage({ user, onCreateExam, onEdit, onResults }) {
  const isGuest = user?.role === 'khach'
  // Hiện cache localStorage ngay (đỡ nháy trống), rồi cập nhật từ DB qua server
  const [exams,          setExams]          = useState(() => getExamsByTeacher(user?.id))
  const [republish,      setRepublish]      = useState(null)
  const [practiceExam,   setPracticeExam]   = useState(null)
  const [togglingPublic, setTogglingPublic] = useState(null)
  const [openLinkId,     setOpenLinkId]     = useState(null)
  const [copiedKey,      setCopiedKey]      = useState(null)

  const reload = () => {
    fetchExamsByTeacher(user.id).then(setExams)
  }

  // Sửa đề cần sections đầy đủ — đề lấy từ DB chỉ có metadata nên tải trọn trước
  const handleEdit = async (exam) => {
    const full = exam.sections ? exam : await fetchExamById(exam.id)
    if (full) onEdit(full)
    else alert('Không tải được nội dung đề thi từ server.')
  }

  useEffect(() => {
    if (!openLinkId) return
    const handler = (e) => {
      if (!e.target.closest('.mec-link-wrap')) setOpenLinkId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openLinkId])

  const copyUrl = (key, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }
  useEffect(() => { reload() }, [user.id])
  useEffect(() => {
    const t = setInterval(() => setExams(prev => [...prev]), 10_000)
    return () => clearInterval(t)
  }, [])

  const handleTogglePublic = async (exam) => {
    setTogglingPublic(exam.id)
    try {
      await setExamPublic(exam.id, !exam.isPublic)
      reload()
    } catch { /* ignore */ }
    finally { setTogglingPublic(null) }
  }

  const handleDelete = async (id) => {
    if (confirm('Xoá đề thi này? Hành động không thể hoàn tác.')) {
      await deleteExam(id)
      reload()
    }
  }

  const formatDt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—'

  return (
    <div className="app">
      <div className="create-topbar">
        <h1 className="exam-title" style={{ display:'flex', alignItems:'center', gap:10 }}>
          {IC.books(24)} Đề thi của tôi
        </h1>
        <p className="exam-subtitle">Quản lý, chia sẻ và theo dõi đề thi bạn đã tạo</p>
      </div>

      <div className="my-exams-toolbar">
        <span className="met-count">{exams.length} đề thi</span>
        <button
          className="btn-primary mec-create-btn"
          onClick={onCreateExam}
          disabled={isGuest}
        >
          {isGuest ? '🔒' : IC.plus(15)} Tạo đề mới
        </button>
      </div>
      {isGuest && (
        <p style={{ margin: '-12px 0 16px', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right' }}>
          Chỉ dành cho thành viên đăng ký
        </p>
      )}

      {exams.length === 0 ? (
        <div className="my-exams-empty">
          <div className="mee-icon">{IC.file(48)}</div>
          <h3>Chưa có đề thi nào</h3>
          <p>Tạo đề thi đầu tiên bằng cách upload file PDF</p>
          <button
            className="btn-primary btn-lg mec-create-btn"
            onClick={onCreateExam}
            disabled={isGuest}
          >
            {isGuest ? '🔒' : IC.pencil(16)} Tạo đề thi ngay
          </button>
          {isGuest && (
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Chỉ dành cho thành viên đăng ký
            </p>
          )}
        </div>
      ) : (
        <div className="my-exams-list">
          {exams.map(exam => {
            const status = examStatus(exam)
            return (
              <div key={exam.id} className={`my-exam-card mec--${status}`}>
                <div className="mec-left">
                  <div className="mec-title">{exam.title}</div>
                  <div className="mec-meta">
                    <MetaChip icon={IC.list(13)}>{exam.totalQuestions} câu</MetaChip>
                    <MetaChip icon={IC.file(13)}>{exam.source}</MetaChip>
                    <MetaChip icon={IC.clock(13)}>{formatDt(exam.createdAt)}</MetaChip>
                    {exam.updatedAt && <MetaChip icon={IC.pencil(13)}>Sửa: {formatDt(exam.updatedAt)}</MetaChip>}
                  </div>
                  {exam.settings && (
                    <div className="mec-time">
                      <MetaChip icon={IC.calendar(13)}>Mở: {formatDt(exam.settings.openTime)}</MetaChip>
                      <MetaChip icon={IC.lock(13)}>Đóng: {formatDt(exam.settings.closeTime)}</MetaChip>
                      <MetaChip icon={IC.timer(13)}>{exam.settings.duration} phút</MetaChip>
                      {exam.settings.password    && <MetaChip icon={IC.key(13)}>Có mật khẩu</MetaChip>}
                      {exam.settings.hideResults && <MetaChip icon={IC.eyeOff(13)}>Ẩn kết quả</MetaChip>}
                    </div>
                  )}
                </div>

                <div className="mec-right">
                  <StatusBadge status={status} />

                  <div className="mec-actions">
                    {exam.published && (
                      <div className="mec-link-wrap">
                        <button
                          className={`mec-btn ${openLinkId === exam.id ? 'mec-btn--link-open' : ''}`}
                          onClick={() => setOpenLinkId(id => id === exam.id ? null : exam.id)}
                          title="Xem link chia sẻ">
                          {IC.link(15)} Link
                          <span className="mec-link-count">
                            {1 + (exam.classes?.length || 0) + 1 + (exam.practiceSettings?.enabled ? 1 : 0)}
                          </span>
                        </button>

                        {openLinkId === exam.id && (
                          <div className="mec-link-dropdown">
                            <div className="mld-title">
                              {IC.link(12)} Link chia sẻ
                            </div>

                            <MiniLinkRow
                              category="Đề thi"
                              categoryColor="#2563eb"
                              label={(exam.classes?.length > 0) ? 'Tất cả lớp' : 'Link chung'}
                              url={shareUrl(exam.id)}
                              onCopy={() => copyUrl(`${exam.id}-general`, shareUrl(exam.id))}
                              copied={copiedKey === `${exam.id}-general`}
                            />

                            {(exam.classes || []).map(cls => (
                              <MiniLinkRow
                                key={cls.id}
                                category="Đề thi"
                                categoryColor="#2563eb"
                                label={`Lớp ${cls.name}`}
                                url={classShareUrl(exam.id, cls.id)}
                                onCopy={() => copyUrl(`${exam.id}-${cls.id}`, classShareUrl(exam.id, cls.id))}
                                copied={copiedKey === `${exam.id}-${cls.id}`}
                              />
                            ))}

                            <MiniLinkRow
                              category="Sảnh chờ"
                              categoryColor="#7c3aed"
                              label="Link sảnh chờ"
                              url={lobbyUrl(exam.id)}
                              onCopy={() => copyUrl(`${exam.id}-lobby`, lobbyUrl(exam.id))}
                              copied={copiedKey === `${exam.id}-lobby`}
                            />

                            {exam.practiceSettings?.enabled && (
                              <MiniLinkRow
                                category="Luyện tập"
                                categoryColor="#059669"
                                label="Link luyện tập"
                                url={practiceShareUrl(exam.id)}
                                onCopy={() => copyUrl(`${exam.id}-practice`, practiceShareUrl(exam.id))}
                                copied={copiedKey === `${exam.id}-practice`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      className={`mec-btn mec-btn--practice ${exam.practiceSettings?.enabled ? 'mec-btn--practice-on' : ''}`}
                      onClick={() => setPracticeExam(exam)}
                      title="Cài đặt chế độ luyện tập">
                      {IC.play(15)} Luyện tập
                      {exam.practiceSettings?.enabled && <span className="mec-practice-dot" />}
                    </button>

                    <button className="mec-btn mec-btn--edit"
                      onClick={() => handleEdit(exam)}
                      title="Sửa câu hỏi">
                      {IC.pencil(15)} Sửa
                    </button>

                    <button className="mec-btn mec-btn--publish"
                      onClick={() => setRepublish(exam)}
                      title={exam.published ? 'Cập nhật cài đặt' : 'Phát đề'}>
                      {exam.published ? <>{IC.gear(15)} Cài đặt</> : <>{IC.rocket(15)} Phát đề</>}
                    </button>

                    {exam.published && (
                      <button className="mec-btn mec-btn--results"
                        onClick={() => onResults(exam)}
                        title="Xem kết quả học sinh">
                        {IC.chart(15)} Kết quả
                      </button>
                    )}

                    {exam.published && (
                      <button
                        className={`mec-btn ${exam.isPublic ? 'mec-btn--public-on' : 'mec-btn--public-off'}`}
                        onClick={() => handleTogglePublic(exam)}
                        disabled={togglingPublic === exam.id}
                        title={exam.isPublic ? 'Đang công khai — Click để đặt riêng tư' : 'Đặt công khai'}
                      >
                        {togglingPublic === exam.id ? '⏳' : exam.isPublic ? '🌐 Công khai' : '🔒 Riêng tư'}
                      </button>
                    )}

                    <button className="mec-btn mec-btn--delete"
                      onClick={() => handleDelete(exam.id)} title="Xoá đề thi">
                      {IC.trash(15)}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {republish && (
        <PublishModal
          exam={republish}
          onClose={() => setRepublish(null)}
          onPublished={() => { setRepublish(null); reload() }}
        />
      )}

      {practiceExam && (
        <PracticeSettingsModal
          exam={practiceExam}
          onClose={() => setPracticeExam(null)}
          onSaved={() => { setPracticeExam(null); reload() }}
        />
      )}
    </div>
  )
}

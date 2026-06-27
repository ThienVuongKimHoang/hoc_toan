import React, { useEffect, useRef, useState } from 'react'
import { fetchExamById, fetchPublicExams } from '../store/examStore.js'
import MathText from '../components/MathText.jsx'

function examStatusFromSettings(settings) {
  if (!settings) return 'open'
  const now   = Date.now()
  const open  = settings.openTime  ? new Date(settings.openTime).getTime()  : null
  const close = settings.closeTime ? new Date(settings.closeTime).getTime() : null
  if (open  && now < open)  return 'pending'
  if (close && now > close) return 'expired'
  return 'open'
}

const STATUS = {
  open:    { label: 'Đang mở',  color: '#059669', bg: '#dcfce7' },
  pending: { label: 'Chưa mở', color: '#d97706', bg: '#fef3c7' },
  expired: { label: 'Đã đóng', color: '#64748b', bg: '#f1f5f9' },
}

const ACCENT = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2']

/* ── Doc preview (always visible) ── */
function DocPreview({ exam, accent }) {
  const preview = exam?.questionsPreview
  if (!preview || preview.length === 0) return null
  return (
    <div className="dp-page dp-page--lobby">
      <div className="dp-hd" style={{ borderLeftColor: accent }}>
        <span className="dp-badge" style={{ background: accent+'18', color: accent }}>ĐỀ THI</span>
        {exam.source && <span className="dp-source">{exam.source}</span>}
      </div>
      <div className="dp-divider" style={{ background: accent }} />
      <div className="dp-qs dp-qs--lobby">
        {preview.map((q, i) => (
          <div key={i} className="dp-q">
            <span className="dp-qn" style={{ color: accent }}>Câu {q.num}.</span>
            <MathText text={q.text} className="dp-qt" />
          </div>
        ))}
      </div>
      <div className="dp-fade" />
    </div>
  )
}

/* ── SVG icons ── */
function Svg({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}
const IC = {
  search:   <Svg size={18}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>,
  key:      <Svg size={17}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></Svg>,
  arrow:    <Svg size={16}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Svg>,
  back:     <Svg size={16}><polyline points="15 18 9 12 15 6"/></Svg>,
  list:     <Svg size={14}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Svg>,
  timer:    <Svg size={14}><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14 15"/><path d="M9 3h6"/></Svg>,
  play:     <Svg size={15}><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></Svg>,
  practice: <Svg size={15}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></Svg>,
  clock:    <Svg size={14}><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></Svg>,
  globe:    <Svg size={20}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Svg>,
  empty:    <Svg size={48}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6"/><path d="M12 9v6"/></Svg>,
  spin:     <Svg size={18}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></Svg>,
}

function PublicExamCard({ exam, onGoExam, onGoPractice }) {
  const accent = ACCENT[exam.id.charCodeAt(0) % ACCENT.length]
  const status = examStatusFromSettings(exam.settings)
  const sm     = STATUS[status]
  const dur    = exam.settings?.duration

  return (
    <div className="pec-card">
      <div className="pec-accent" style={{ background: accent }} />
      <div className="pec-body">
        <div className="pec-top-row">
          <span className="pec-status-pill" style={{ color: sm.color, background: sm.bg }}>
            {sm.label}
          </span>
          {exam.practiceEnabled && (
            <span className="pec-practice-pill">Luyện tập</span>
          )}
        </div>

        <h3 className="pec-title">{exam.title}</h3>

        <DocPreview exam={exam} accent={accent} />

        <div className="pec-meta">
          <span className="pec-chip">{IC.list} {exam.totalQuestions} câu</span>
          {dur && <span className="pec-chip">{IC.timer} {dur} phút</span>}
        </div>

        <div className="pec-actions">
          {status === 'expired' ? (
            <span className="pec-closed-note">Đề thi đã đóng</span>
          ) : (
            <button
              className="pec-btn pec-btn--take"
              onClick={() => onGoExam(exam.id)}
              disabled={status === 'pending'}
              style={{ '--ac': accent }}
            >
              {status === 'pending' ? <>{IC.clock} Chưa mở</> : <>{IC.play} Làm bài</>}
            </button>
          )}
          {exam.practiceEnabled && (
            <button className="pec-btn pec-btn--practice" onClick={() => onGoPractice(exam.id)}>
              {IC.practice} Luyện tập
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExamLobbyPage({ onGoExam, onGoPractice, onGoHome, initialCode = '' }) {
  const [code,        setCode]        = useState(initialCode)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [publicExams, setPublicExams] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    fetchPublicExams()
      .then(setPublicExams)
      .finally(() => setLoadingList(false))
    inputRef.current?.focus()
  }, [])

  // Auto-submit khi có mã đề từ URL (#lobby/MÃĐỀ)
  useEffect(() => {
    if (!initialCode) return
    setLoading(true)
    fetchExamById(initialCode.trim())
      .then(exam => {
        if (!exam || !exam.published) {
          setError('Không tìm thấy đề thi. Kiểm tra lại mã đề.')
          setLoading(false)
          inputRef.current?.select()
          return
        }
        onGoExam(initialCode.trim())
      })
      .catch(() => {
        setError('Có lỗi xảy ra. Vui lòng thử lại.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredExams = searchQuery.trim()
    ? publicExams.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.source || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : publicExams

  const handleSearch = async (e) => {
    e.preventDefault()
    const id = code.trim()
    if (!id) { setError('Vui lòng nhập mã đề thi.'); return }
    setLoading(true); setError('')
    try {
      const exam = await fetchExamById(id)
      if (!exam || !exam.published) {
        setError('Không tìm thấy đề thi. Kiểm tra lại mã đề.')
        setLoading(false)
        inputRef.current?.select()
        return
      }
      onGoExam(id)
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  return (
    <div className="lobby-page">

      {/* ── Hero ── */}
      <div className="lobby-hero">
        <button className="lobby-back" onClick={onGoHome}>
          {IC.back} Trang chủ
        </button>

        <div className="lobby-hero-content">
          <h1 className="lobby-title">Sảnh Chờ Thi</h1>
          <p className="lobby-desc">
            Nhập mã đề thi do giáo viên cung cấp để vào làm bài ngay
          </p>

          <form className="lobby-search-bar" onSubmit={handleSearch}>
            <span className="lsb-icon">{IC.key}</span>
            <input
              ref={inputRef}
              className="lsb-input"
              value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
              placeholder="Nhập mã đề thi…"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
            {code && !loading && (
              <button type="button" className="lsb-clear"
                onClick={() => { setCode(''); setError(''); inputRef.current?.focus() }}>✕</button>
            )}
            <button type="submit" className="lsb-submit" disabled={loading || !code.trim()}>
              {loading
                ? <span className="lsb-spin">{IC.spin}</span>
                : <>{IC.arrow} Vào thi</>
              }
            </button>
          </form>

          {error && <div className="lobby-error">{error}</div>}
        </div>
      </div>

      {/* ── Public exams ── */}
      <div className="lobby-list-section">
        <div className="lobby-list-header">
          <div className="llh-left">
            {IC.globe}
            <div>
              <div className="llh-title">Đề thi công khai</div>
              <div className="llh-sub">Các đề thi được giáo viên chia sẻ công khai</div>
            </div>
          </div>
          {!loadingList && (
            <span className="llh-count">
              {searchQuery.trim() ? `${filteredExams.length} / ${publicExams.length}` : publicExams.length} đề
            </span>
          )}
        </div>

        {/* ── Search bar ── */}
        {!loadingList && publicExams.length > 0 && (
          <div className="pec-search-wrap">
            <span className="pec-search-icon">{IC.search}</span>
            <input
              className="pec-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên đề thi…"
              spellCheck={false}
            />
            {searchQuery && (
              <button className="pec-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        )}

        {loadingList ? (
          <div className="lobby-list-loading">
            <span className="lsb-spin">{IC.spin}</span> Đang tải…
          </div>
        ) : publicExams.length === 0 ? (
          <div className="lobby-list-empty">
            <div className="lle-icon">{IC.empty}</div>
            <p>Chưa có đề thi công khai nào.</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="lobby-list-empty">
            <div className="lle-icon">{IC.search}</div>
            <p>Không tìm thấy đề thi nào khớp với "<strong>{searchQuery}</strong>"</p>
          </div>
        ) : (
          <div className="pec-grid">
            {filteredExams.map(exam => (
              <PublicExamCard
                key={exam.id}
                exam={exam}
                onGoExam={onGoExam}
                onGoPractice={onGoPractice}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

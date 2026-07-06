import React, { useEffect, useRef, useState } from 'react'
import { fetchExamById, getPracticeInfo, verifyPracticePassword } from '../store/examStore.js'
import QuestionCard from '../components/QuestionCard.jsx'
import ReadingTakeView from '../components/ReadingTakeView.jsx'

const SECTION_LABELS = {
  'PHẦN I':    { label: 'Phần I – Trắc nghiệm',    color: '#2563eb' },
  'PHẦN II':   { label: 'Phần II – Đúng / Sai',     color: '#7c3aed' },
  'PHẦN III':  { label: 'Phần III – Trả lời ngắn',  color: '#059669' },
  'TIẾNG ANH': { label: 'Tiếng Anh – Trắc nghiệm', color: '#0f766e' },
  'READING':   { label: 'Reading – Bài đọc',       color: '#0e7490' },
}

function getSectionList(exam) {
  // Chỉ giữ các phần có câu hỏi — phần rỗng bị bỏ qua khi làm bài
  return Object.keys(exam?.sections || {}).filter(
    s => s in SECTION_LABELS && (exam.sections[s]?.questions?.length ?? 0) > 0
  )
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const p = n => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`
}

function fmtDt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── Gate screens ── */
function GateScreen({ icon, title, desc, children, onGoHome }) {
  return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">{icon}</div>
        <h1 className="etl-title">{title}</h1>
        {desc && <p style={{ color: '#64748b', marginTop: 8, textAlign: 'center' }}>{desc}</p>}
        {children}
        {onGoHome && (
          <button className="mec-btn" style={{ marginTop: 16 }} onClick={onGoHome}>← Trang chủ</button>
        )}
      </div>
    </div>
  )
}

/* ── Password gate ── */
function PasswordGate({ examId, onVerified, onGoHome }) {
  const [pwd,     setPwd]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const ref = useRef(null)

  const handle = async (e) => {
    e.preventDefault()
    if (!pwd.trim()) return
    setLoading(true); setError('')
    const ok = await verifyPracticePassword(examId, pwd.trim())
    setLoading(false)
    if (ok) onVerified()
    else { setError('Sai mật khẩu. Vui lòng thử lại.'); ref.current?.select() }
  }

  return (
    <div className="et-locked">
      <div className="etl-card" style={{ maxWidth: 380 }}>
        <div className="etl-icon">🔑</div>
        <h1 className="etl-title">Nhập mật khẩu</h1>
        <p style={{ color: '#64748b', marginTop: 6 }}>Đề luyện tập này được bảo vệ bằng mật khẩu</p>
        <form onSubmit={handle} style={{ width: '100%', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={ref}
            type="password"
            className="lobby-input"
            style={{ paddingLeft: 16 }}
            placeholder="Nhập mật khẩu…"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setError('') }}
            autoFocus
          />
          {error && <div className="lobby-error">{error}</div>}
          <button type="submit" className="lobby-submit" disabled={loading || !pwd.trim()}>
            {loading ? '⏳ Đang xác minh…' : '→ Tiếp tục'}
          </button>
        </form>
        <button className="mec-btn" style={{ marginTop: 12 }} onClick={onGoHome}>← Quay lại</button>
      </div>
    </div>
  )
}

/* ── Timer setup ── */
function TimerSetupModal({ defaultMins, onStart }) {
  const [useTimer, setUseTimer] = useState(true)
  const [hrs,  setHrs]  = useState(Math.floor(defaultMins / 60))
  const [mins, setMins] = useState(defaultMins % 60)
  return (
    <div className="modal-overlay">
      <div className="modal-box practice-setup-box">
        <div className="nsm-icon">🏋️</div>
        <h2 className="nsm-title">Chế độ Tập Luyện</h2>
        <p className="nsm-sub">Câu trả lời hiển thị ngay. Kết quả không được lưu.</p>

        <div className="ps-timer-toggle">
          <label className="pm-toggle-switch">
            <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} />
            <span className="pm-toggle-slider" />
          </label>
          <span className="ps-toggle-label">{useTimer ? 'Có đặt thời gian' : 'Không giới hạn thời gian'}</span>
        </div>

        {useTimer && (
          <div className="pm-duration-wrap" style={{ justifyContent: 'center', marginTop: 16 }}>
            <div className="pm-dur-input-group">
              <button className="dur-btn" onClick={() => setHrs(h => Math.max(0, h - 1))}>−</button>
              <div className="dur-display">
                <input type="number" min="0" max="5" value={hrs}
                  onChange={e => setHrs(Math.max(0, Math.min(5, +e.target.value || 0)))}
                  className="dur-input" />
                <span className="dur-unit">giờ</span>
              </div>
              <button className="dur-btn" onClick={() => setHrs(h => Math.min(5, h + 1))}>+</button>
            </div>
            <div className="pm-dur-input-group">
              <button className="dur-btn" onClick={() => setMins(m => m <= 0 ? 55 : m - 5)}>−</button>
              <div className="dur-display">
                <input type="number" min="0" max="55" step="5" value={mins}
                  onChange={e => setMins(Math.max(0, Math.min(55, +e.target.value || 0)))}
                  className="dur-input" />
                <span className="dur-unit">phút</span>
              </div>
              <button className="dur-btn" onClick={() => setMins(m => m >= 55 ? 0 : m + 5)}>+</button>
            </div>
          </div>
        )}

        <button className="btn-hero-primary nsm-confirm" style={{ marginTop: 24 }}
          onClick={() => onStart(useTimer ? hrs * 60 + mins : null)}>
          Bắt đầu tập luyện →
        </button>
      </div>
    </div>
  )
}

/* ── Timer bar ── */
function PracticeTimerBar({ totalMs, onTimeUp, onStop }) {
  const [msLeft, setMsLeft] = useState(totalMs)
  const ref = useRef(totalMs)

  useEffect(() => {
    const t = setInterval(() => {
      ref.current -= 1000
      if (ref.current <= 0) { clearInterval(t); onTimeUp(); return }
      setMsLeft(ref.current)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const pct     = Math.round((msLeft / totalMs) * 100)
  const urgent  = pct < 20
  const warning = pct < 50

  return (
    <div className={`timer-bar ${urgent ? 'urgent' : warning ? 'warning' : ''}`}>
      <div className="tb-left">
        <span className="tb-icon">{urgent ? '🔴' : warning ? '🟡' : '🟢'}</span>
        <span className="tb-label">Tập luyện</span>
      </div>
      <div className="tb-center"><span className="tb-time">{fmtMs(msLeft)}</span></div>
      <div className="tb-track">
        <div className="tb-fill"
          style={{ width: `${pct}%`, background: urgent ? '#ef4444' : warning ? '#f59e0b' : '#22c55e' }} />
      </div>
      <button className="tb-stop-btn" onClick={onStop}>⏹ Kết thúc</button>
    </div>
  )
}

/* ── Section navigation ── */
function SectionNav({ sections, sectionList, active, onChange }) {
  const idx  = sectionList.indexOf(active)
  const prev = sectionList[idx - 1]
  const next = sectionList[idx + 1]
  return (
    <div className="section-nav-bar">
      {prev
        ? <button className="snb-btn snb-prev" onClick={() => onChange(prev)}>← {SECTION_LABELS[prev]?.label ?? prev}</button>
        : <span />}
      <div className="snb-dots">
        {sectionList.map(s => sections?.[s]?.questions?.length > 0 && (
          <button key={s} className={`snb-dot ${active === s ? 'active' : ''}`}
            style={{ '--dot-color': SECTION_LABELS[s]?.color ?? '#475569' }}
            onClick={() => onChange(s)} title={SECTION_LABELS[s]?.label ?? s} />
        ))}
      </div>
      {next
        ? <button className="snb-btn snb-next" onClick={() => onChange(next)}>{SECTION_LABELS[next]?.label ?? next} →</button>
        : <span />}
    </div>
  )
}

/* ── Root ── */
export default function PracticeExamPage({ examId, onGoHome }) {
  const [step,    setStep]    = useState('loading') // loading | gate-disabled | gate-schedule | gate-password | timer-setup | practice | ended
  const [info,    setInfo]    = useState(null)
  const [exam,    setExam]    = useState(null)
  const [timerMs, setTimerMs] = useState(null)
  const [activeSection, setActiveSection] = useState(null) // set after exam loads

  useEffect(() => {
    ;(async () => {
      const info = await getPracticeInfo(examId)
      if (!info) { setStep('gate-disabled'); return }
      setInfo(info)

      if (!info.enabled) { setStep('gate-disabled'); return }

      const now = Date.now()
      if (info.openTime  && now < new Date(info.openTime).getTime())  { setStep('gate-schedule'); return }
      if (info.closeTime && now > new Date(info.closeTime).getTime()) { setStep('gate-expired');  return }

      if (info.hasPassword) { setStep('gate-password'); return }

      // No password — load exam and go to timer setup
      const e = await fetchExamById(examId)
      setExam(e)
      setActiveSection(getSectionList(e)[0] || 'PHẦN I')
      setStep('timer-setup')
    })()
  }, [examId])

  const handlePasswordVerified = async () => {
    const e = await fetchExamById(examId)
    setExam(e)
    setActiveSection(getSectionList(e)[0] || 'PHẦN I')
    setStep('timer-setup')
  }

  if (step === 'loading') return (
    <GateScreen icon="⏳" title="Đang tải…" />
  )

  if (step === 'gate-disabled') return (
    <GateScreen icon="🚫" title="Chưa mở luyện tập"
      desc="Đề thi này chưa bật chế độ luyện tập. Vui lòng liên hệ giáo viên."
      onGoHome={onGoHome} />
  )

  if (step === 'gate-schedule') return (
    <GateScreen icon="⏰" title="Chưa đến giờ mở"
      desc={`Chế độ luyện tập sẽ mở lúc ${fmtDt(info?.openTime)}`}
      onGoHome={onGoHome} />
  )

  if (step === 'gate-expired') return (
    <GateScreen icon="🔒" title="Đã kết thúc"
      desc={`Chế độ luyện tập đã đóng lúc ${fmtDt(info?.closeTime)}`}
      onGoHome={onGoHome} />
  )

  if (step === 'gate-password') return (
    <PasswordGate examId={examId} onVerified={handlePasswordVerified} onGoHome={onGoHome} />
  )

  if (!exam) return (
    <GateScreen icon="❌" title="Không tìm thấy đề thi" onGoHome={onGoHome} />
  )

  if (step === 'timer-setup') return (
    <TimerSetupModal
      defaultMins={90}
      onStart={(mins) => { setTimerMs(mins ? mins * 60_000 : null); setStep('practice') }}
    />
  )

  if (step === 'ended') return (
    <GateScreen icon="🏁" title="Kết thúc tập luyện"
      desc="Bài tập luyện không được lưu."
      onGoHome={onGoHome} />
  )

  const sectionList   = getSectionList(exam)
  const curSection    = activeSection || sectionList[0] || 'PHẦN I'
  const questions     = exam.sections?.[curSection]?.questions ?? []
  const scrollTop     = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <div className="et-exam">
      {timerMs !== null ? (
        <PracticeTimerBar
          totalMs={timerMs}
          onTimeUp={() => setStep('ended')}
          onStop={() => { if (confirm('Kết thúc tập luyện?')) setStep('ended') }}
        />
      ) : (
        <div className="practice-no-timer-bar">
          <span>🏋️ Chế độ Tập Luyện — Không giới hạn thời gian</span>
          <button className="tb-stop-btn" onClick={() => { if (confirm('Kết thúc tập luyện?')) setStep('ended') }}>
            ⏹ Kết thúc
          </button>
        </div>
      )}

      <div className="app" style={{ paddingTop: 16 }}>
        <div className="result-meta">
          <div className="result-title">
            <h2>🏋️ {exam.title}</h2>
            <span className="total-badge practice-badge">Tập luyện</span>
          </div>
          <button className="mec-btn" onClick={onGoHome}>← Trang chủ</button>
        </div>

        {sectionList.length > 1 && (
          <div className="section-tabs">
            {sectionList.map(sec => {
              const count = exam.sections?.[sec]?.questions?.length ?? 0
              const meta  = SECTION_LABELS[sec] ?? { label: sec, color: '#475569' }
              return (
                <button key={sec}
                  className={`tab-btn ${curSection === sec ? 'active' : ''}`}
                  style={{ '--tab-color': meta.color }}
                  onClick={() => { setActiveSection(sec); scrollTop() }}>
                  {meta.label}<span className="tab-count">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {exam.sections?.[curSection] && (
          <div className="section-desc">
            <span style={{ color: SECTION_LABELS[curSection]?.color }}>
              {SECTION_LABELS[curSection]?.label ?? curSection}
            </span>
            {' — '}{exam.sections[curSection].questions.length} câu ×{' '}
            {exam.sections[curSection].points_per_q}đ/câu
          </div>
        )}

        <div className="question-list">
          {questions.length === 0 ? (
            <p className="empty-msg">Không có câu hỏi nào trong phần này.</p>
          ) : curSection === 'READING' ? (
            <ReadingTakeView questions={questions} examMode={false} />
          ) : (
            questions.map((q, i) => (
              <QuestionCard
                key={`${q.section}-${q.question_number}-${i}`}
                q={q} index={i} examMode={false}
              />
            ))
          )}
        </div>

        <SectionNav
          sections={exam.sections}
          sectionList={sectionList}
          active={curSection}
          onChange={s => { setActiveSection(s); scrollTop() }}
        />
      </div>
    </div>
  )
}

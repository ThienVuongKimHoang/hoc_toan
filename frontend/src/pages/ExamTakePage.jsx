import React, { useEffect, useRef, useState } from 'react'
import { calcMaxScore, calcScore, examStatus, fetchExamById, submitResult, scaledScore } from '../store/examStore.js'
import { getExamWindow } from '../store/classStore.js'
import QuestionCard from '../components/QuestionCard.jsx'
import ReadingTakeView from '../components/ReadingTakeView.jsx'
import NameSelectModal from '../components/NameSelectModal.jsx'

const SECTION_LABELS = {
  'PHẦN I':    { label: 'Phần I – Trắc nghiệm',         color: '#2563eb' },
  'PHẦN II':   { label: 'Phần II – Đúng / Sai',          color: '#7c3aed' },
  'PHẦN III':  { label: 'Phần III – Trả lời ngắn',       color: '#059669' },
  'TIẾNG ANH': { label: 'Tiếng Anh – Trắc nghiệm',      color: '#0f766e' },
  'READING':   { label: 'Reading – Bài đọc',            color: '#0e7490' },
}

function getSectionList(exam) {
  return Object.keys(exam?.sections || {}).filter(s => s in SECTION_LABELS)
}

/* ── Countdown hook ── */
function useCountdown(targetIso) {
  const calc = () => Math.max(0, new Date(targetIso).getTime() - Date.now())
  const [ms, setMs] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setMs(calc()), 1000)
    return () => clearInterval(t)
  }, [targetIso])
  return ms
}

function fmtMs(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const p = n => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── Timer bar ── */
function TimerBar({ endIso, durationMins }) {
  const msLeft = useCountdown(endIso)
  const total  = durationMins * 60_000
  const pct    = Math.round((msLeft / total) * 100)
  const urgent = pct < 20
  const warn   = pct < 50
  return (
    <div className={`timer-bar ${urgent ? 'urgent' : warn ? 'warning' : ''}`}>
      <div className="tb-left">
        <span className="tb-icon">{urgent ? '🔴' : warn ? '🟡' : '🟢'}</span>
        <span className="tb-label">Thời gian còn lại</span>
      </div>
      <div className="tb-center">
        <span className="tb-time">{fmtMs(msLeft)}</span>
      </div>
      <div className="tb-track">
        <div className="tb-fill"
          style={{ width: `${pct}%`, background: urgent ? '#ef4444' : warn ? '#f59e0b' : '#22c55e' }}
        />
      </div>
    </div>
  )
}

/* ── Locked / Expired views ── */
function LockedView({ exam, onGoHome }) {
  const ms = useCountdown(exam.settings.openTime)
  return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">🔒</div>
        <h1 className="etl-title">{exam.title}</h1>
        <div className="etl-meta">
          <span>📋 {exam.totalQuestions} câu hỏi</span>
          <span>⏱ {exam.settings.duration} phút</span>
          {exam.settings.password && <span>🔑 Có mật khẩu</span>}
        </div>
        <div className="etl-divider" />
        <div className="etl-countdown-label">Đề thi sẽ mở sau</div>
        <div className="etl-countdown">{fmtMs(ms)}</div>
        <div className="etl-open-time">📅 Mở lúc {fmtDate(exam.settings.openTime)}</div>
        <div className="etl-close-time">🔒 Đóng lúc {fmtDate(exam.settings.closeTime)}</div>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )
}

function ExpiredView({ exam, onGoHome }) {
  return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">⏰</div>
        <h1 className="etl-title">{exam.title}</h1>
        <div className="etl-expired-msg">Đề thi đã kết thúc</div>
        <div className="etl-close-time">🔒 Đóng lúc {fmtDate(exam.settings.closeTime)}</div>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )
}

/* ── Password gate ── */
function PasswordGate({ exam, onCorrect }) {
  const [pwd, setPwd]   = useState('')
  const [err, setErr]   = useState('')
  const [show, setShow] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    if (pwd === exam.settings.password) onCorrect()
    else setErr('Mật khẩu không đúng.')
  }
  return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">🔑</div>
        <h1 className="etl-title">{exam.title}</h1>
        <div className="etl-meta">
          <span>📋 {exam.totalQuestions} câu hỏi</span>
          <span>⏱ {exam.settings.duration} phút</span>
        </div>
        <p className="etl-pwd-note">Đề thi này được bảo vệ bằng mật khẩu.</p>
        <form className="etl-pwd-form" onSubmit={submit}>
          <div className="etl-pwd-input-wrap">
            <input autoFocus type={show ? 'text' : 'password'}
              placeholder="Nhập mật khẩu đề thi…" value={pwd}
              onChange={e => { setPwd(e.target.value); setErr('') }}
              className="etl-pwd-input"
            />
            <button type="button" className="pwd-toggle" onClick={() => setShow(v => !v)}>
              {show ? '🙈' : '👁️'}
            </button>
          </div>
          {err && <div className="etl-pwd-err">{err}</div>}
          <button type="submit" className="btn-hero-primary" style={{ width: '100%' }}>
            Vào làm bài →
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Section navigation bar (bottom) ── */
function SectionNav({ sections, sectionList, active, onChange }) {
  const idx  = sectionList.indexOf(active)
  const prev = sectionList[idx - 1]
  const next = sectionList[idx + 1]
  return (
    <div className="section-nav-bar">
      {prev ? (
        <button className="snb-btn snb-prev" onClick={() => onChange(prev)}>
          ← {SECTION_LABELS[prev]?.label ?? prev}
        </button>
      ) : <span />}
      <div className="snb-dots">
        {sectionList.map(s =>
          sections[s]?.questions?.length > 0 && (
            <button
              key={s}
              className={`snb-dot ${active === s ? 'active' : ''}`}
              style={{ '--dot-color': SECTION_LABELS[s]?.color ?? '#475569' }}
              onClick={() => onChange(s)}
              title={SECTION_LABELS[s]?.label ?? s}
            />
          )
        )}
      </div>
      {next ? (
        <button className="snb-btn snb-next" onClick={() => onChange(next)}>
          {SECTION_LABELS[next]?.label ?? next} →
        </button>
      ) : <span />}
    </div>
  )
}

/* ── Main exam view ── */
function ExamView({ exam, studentName, studentId, className, classId, onGoHome }) {
  const hideResults    = exam.settings?.hideResults || false
  const sectionList    = getSectionList(exam)
  const [activeSection, setActiveSection] = useState(sectionList[0] || 'PHẦN I')
  const [answers,       setAnswers]       = useState({})
  const [submitted,     setSubmitted]     = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitErr,     setSubmitErr]     = useState('')
  const [finalScore,    setFinalScore]    = useState(null)
  const [finalMax,      setFinalMax]      = useState(null)

  const startedAt  = useRef(Date.now()).current
  const endByDur   = startedAt + exam.settings.duration * 60_000
  const endByClose = new Date(exam.settings.closeTime).getTime()
  const endTime    = Math.min(endByDur, endByClose)
  const endIso     = new Date(endTime).toISOString()
  const msLeft     = useCountdown(endIso)

  // Auto-submit on time up
  useEffect(() => {
    if (msLeft === 0 && !submitted) handleSubmit(true)
  }, [msLeft])

  const handleAnswerChange = (key, val) => {
    setAnswers(prev => ({ ...prev, [key]: val }))
  }

  const handleSubmit = async (auto = false) => {
    if (!auto && !confirm('Nộp bài? Bạn không thể thay đổi sau khi nộp.')) return
    setSubmitting(true)
    const score    = calcScore(exam, answers)
    const maxScore = calcMaxScore(exam)
    const timeSpent = Math.max(0, Math.round((Date.now() - startedAt) / 1000))  // giây
    try {
      await submitResult(exam.id, { studentName, studentId, answers, score, maxScore, className, classId,
                                    startedAt: new Date(startedAt).toISOString(), timeSpent })
      setFinalScore(score)
      setFinalMax(maxScore)
      setSubmitted(true)
    } catch (e) {
      setSubmitErr(e?.message || 'Nộp bài thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  if (submitted) {
    return (
      <div className="et-locked">
        <div className="etl-card">
          <div className="etl-icon">✅</div>
          <h1 className="etl-title">
            {msLeft === 0 ? 'Hết giờ — Đã nộp tự động' : 'Đã nộp bài!'}
          </h1>
          {hideResults ? (
            <div className="etl-hide-msg">
              <p>Kết quả sẽ được công bố bởi giáo viên.</p>
              <p className="etl-name-tag">Bài làm của: <strong>{studentName}</strong></p>
            </div>
          ) : (
            <div className="etl-score">
              <div className="etl-score-num">{scaledScore(finalScore, finalMax)} <span>/ 10</span></div>
              <div className="etl-score-label">điểm</div>
              <p className="etl-name-tag">Bài làm của: <strong>{studentName}</strong></p>
            </div>
          )}
          <button className="btn-primary" style={{ marginTop: 24 }} onClick={onGoHome}>← Trang chủ</button>
        </div>
      </div>
    )
  }

  const questions = exam.sections?.[activeSection]?.questions ?? []

  return (
    <div className="et-exam">
      <TimerBar endIso={endIso} durationMins={exam.settings.duration} />

      <div className="app" style={{ paddingTop: 16 }}>
        <div className="result-meta">
          <div className="result-title">
            <h2>📋 {exam.title}</h2>
            <span className="total-badge">{exam.totalQuestions} câu hỏi</span>
          </div>
          <div className="et-meta-right">
            {className && <span className="et-class-badge">🏫 {className}</span>}
            <span className="et-student-name">👤 {studentName}</span>
            <button className="btn-submit-exam" disabled={submitting}
              onClick={() => handleSubmit(false)}>
              {submitting ? '⏳ Đang nộp…' : '✅ Nộp bài'}
            </button>
          </div>
        </div>

        {submitErr && <div className="pm-error" style={{ margin: '8px 0' }}>⚠️ {submitErr}</div>}

        {sectionList.length > 1 && (
          <div className="section-tabs">
            {sectionList.map(sec => {
              const count = exam.sections?.[sec]?.questions?.length ?? 0
              const meta  = SECTION_LABELS[sec] ?? { label: sec, color: '#475569' }
              return (
                <button key={sec}
                  className={`tab-btn ${activeSection === sec ? 'active' : ''}`}
                  style={{ '--tab-color': meta.color }}
                  onClick={() => { setActiveSection(sec); scrollTop() }}
                >
                  {meta.label}<span className="tab-count">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {exam.sections?.[activeSection] && (
          <div className="section-desc">
            <span style={{ color: SECTION_LABELS[activeSection]?.color }}>
              {SECTION_LABELS[activeSection]?.label ?? activeSection}
            </span>
            {' — '}{exam.sections[activeSection].questions.length} câu ×{' '}
            {exam.sections[activeSection].points_per_q}đ/câu
          </div>
        )}

        <div className="question-list">
          {questions.length === 0 ? (
            <p className="empty-msg">Không có câu hỏi nào trong phần này.</p>
          ) : activeSection === 'READING' ? (
            <ReadingTakeView
              questions={questions}
              examMode={true}
              onAnswerChange={handleAnswerChange}
            />
          ) : (
            questions.map((q, i) => (
              <QuestionCard
                key={`${q.section}-${q.question_number}-${i}`}
                q={q} index={i}
                examMode={true}
                onAnswerChange={handleAnswerChange}
              />
            ))
          )}
        </div>

        {/* Section navigation at bottom */}
        <SectionNav
          sections={exam.sections}
          sectionList={sectionList}
          active={activeSection}
          onChange={(s) => { setActiveSection(s); scrollTop() }}
        />

        {/* Submit button at bottom */}
        <div className="et-bottom-submit">
          {submitErr && <div className="pm-error">⚠️ {submitErr}</div>}
          <button className="btn-submit-exam btn-submit-bottom" disabled={submitting}
            onClick={() => handleSubmit(false)}>
            {submitting ? '⏳ Đang nộp…' : '✅ Nộp bài'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Root component ── */
export default function ExamTakePage({ examId, classId, user, onGoHome, onGoLogin }) {
  const [exam,        setExam]        = useState(null)
  const [notFound,    setNotFound]    = useState(false)
  const [status,      setStatus]      = useState('pending')
  const [pwdUnlocked, setPwdUnlocked] = useState(false)
  const [studentName, setStudentName] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const e = await fetchExamById(examId)
      if (cancelled) return
      if (!e) { setNotFound(true); return }

      // Làm bài qua LỚP: dùng cửa sổ thời gian của bài được giao, không cần link công khai.
      if (classId) {
        const win = await getExamWindow(classId, examId, user?.id, user?.email)
        if (cancelled) return
        if (win && win.assigned) {
          const merged = {
            ...e,
            published: true,
            settings: {
              ...e.settings,
              openTime:  win.openTime  || e.settings?.openTime,
              closeTime: win.closeTime || e.settings?.closeTime,
              duration:  win.duration  ?? e.settings?.duration,
              password:  null,   // lớp học là cổng vào — không cần mật khẩu công khai
            },
            _classGated:   true,
            _className:    win.className,
            _maxAttempts:  win.maxAttempts ?? null,
            _attemptsUsed: win.attemptsUsed ?? 0,
            _scoreMode:    win.scoreMode || 'highest',
          }
          setExam(merged)
          setStatus(examStatus(merged))
          return
        }
      }

      // Link công khai (như cũ): cần đề đã xuất bản.
      if (!e.published) { setNotFound(true); return }
      setExam(e)
      setStatus(examStatus(e))
    })()
    return () => { cancelled = true }
  }, [examId, classId, user?.id])

  useEffect(() => {
    if (!exam) return
    const t = setInterval(() => setStatus(examStatus(exam)), 5_000)
    return () => clearInterval(t)
  }, [exam])

  /* ── Not found ── */
  if (notFound) return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">❌</div>
        <h1 className="etl-title">Không tìm thấy đề thi</h1>
        <p style={{ color: '#64748b', marginTop: 8 }}>Link không hợp lệ hoặc đề thi đã bị xoá.</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )

  /* ── Loading ── */
  if (!exam) return (
    <div className="et-locked">
      <div className="etl-card" style={{ padding: 40 }}>
        <div className="etl-icon">⏳</div>
        <p>Đang tải…</p>
      </div>
    </div>
  )

  /* ── Login required ── */
  if (!user) return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">🔐</div>
        <h1 className="etl-title">{exam.title}</h1>
        <div className="etl-meta">
          <span>📋 {exam.totalQuestions} câu hỏi</span>
          <span>⏱ {exam.settings?.duration} phút</span>
        </div>
        <div className="etl-divider" />
        <p style={{ color: '#64748b', margin: '12px 0' }}>
          Bạn cần đăng nhập để làm bài thi.
        </p>
        <div className="etl-login-actions">
          <button className="etl-action-btn etl-action-btn--login" onClick={onGoLogin}>
            <span className="etl-action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </span>
            Đăng nhập
          </button>
          <button className="etl-action-btn etl-action-btn--home" onClick={onGoHome}>
            <span className="etl-action-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </span>
            Trang chủ
          </button>
        </div>
      </div>
    </div>
  )

  if (status === 'expired') return <ExpiredView exam={exam} onGoHome={onGoHome} />
  if (status === 'pending') return <LockedView  exam={exam} onGoHome={onGoHome} />

  // Hết lượt làm (giao theo lớp có giới hạn số lần)
  if (exam._classGated && exam._maxAttempts && exam._attemptsUsed >= exam._maxAttempts) {
    return (
      <div className="et-locked">
        <div className="etl-card">
          <div className="etl-icon">🔒</div>
          <h1 className="etl-title">{exam.title}</h1>
          <div className="etl-expired-msg">Bạn đã làm đủ {exam._maxAttempts} lần cho phép.</div>
          <p style={{ color: '#64748b', marginTop: 8 }}>
            Đề này giới hạn số lần làm. Liên hệ giáo viên nếu cần thêm lượt.
          </p>
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
        </div>
      </div>
    )
  }

  if (exam.settings?.password && !pwdUnlocked) {
    return <PasswordGate exam={exam} onCorrect={() => setPwdUnlocked(true)} />
  }

  /* ── Name selection ── */
  if (!studentName) {
    return (
      <NameSelectModal
        accountName={user.name || null}
        onConfirm={name => setStudentName(name)}
      />
    )
  }

  const classInfo = classId && exam?.classes?.length
    ? (exam.classes.find(c => c.id === classId) || null)
    : null
  const resolvedClassName = classInfo?.name || exam?._className || null

  return (
    <ExamView
      exam={exam}
      studentName={studentName}
      studentId={String(user.id)}
      className={resolvedClassName}
      classId={classId}
      onGoHome={onGoHome}
    />
  )
}

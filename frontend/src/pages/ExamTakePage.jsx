import React, { useEffect, useMemo, useRef, useState } from 'react'
import { examStatus, fetchExamById, startAttempt, submitResult, scaledScore, verifyLockEscape } from '../store/examStore.js'
import { getExamWindow } from '../store/classStore.js'
import QuestionCard, { SECTION_PREFIX } from '../components/QuestionCard.jsx'
import ReadingTakeView from '../components/ReadingTakeView.jsx'
import { buildShuffleMap, reorderByQuestionNumber } from '../utils/shuffle.js'
import './ExamTakePage.css'

const SECTION_LABELS = {
  'PHẦN I': { label: 'Phần I – Trắc nghiệm', short: 'Phần I', color: '#2563eb' },
  'PHẦN II': { label: 'Phần II – Đúng / Sai', short: 'Phần II', color: '#7c3aed' },
  'PHẦN III': { label: 'Phần III – Trả lời ngắn', short: 'Phần III', color: '#059669' },
  'TỰ LUẬN': { label: 'Tự luận – Upload bài làm', short: 'Tự luận', color: '#d97706' },
  'TIẾNG ANH': { label: 'Tiếng Anh – Trắc nghiệm', short: 'Tiếng Anh', color: '#0f766e' },
  'READING': { label: 'Reading – Bài đọc', short: 'Reading', color: '#0e7490' },
}

/* Câu này đã trả lời chưa — dùng tô màu ô số trong bảng điều hướng.
   'done' = đã trả lời · 'partial' = mới chọn vài ý (PHẦN II) · 'none' = chưa làm. */
function answerStateOf(sec, q, val) {
  if (sec === 'PHẦN II') {
    const subs = q.sub_questions || []
    const user = (val && typeof val === 'object') ? val : {}
    const done = subs.filter(s => user[s.label] !== undefined).length
    if (!subs.length || done === 0) return 'none'
    return done === subs.length ? 'done' : 'partial'
  }
  if (sec === 'TỰ LUẬN') return Array.isArray(val) && val.length > 0 ? 'done' : 'none'
  if (sec === 'PHẦN III') return String(val ?? '').trim() ? 'done' : 'none'
  return val != null && val !== '' ? 'done' : 'none'
}

function getSectionList(exam) {
  // Chỉ giữ các phần có câu hỏi — phần rỗng bị bỏ qua khi làm bài
  return Object.keys(exam?.sections || {}).filter(
    s => s in SECTION_LABELS && (exam.sections[s]?.questions?.length ?? 0) > 0
  )
}

/* ── Lưu trạng thái đang làm bài (giờ bắt đầu + câu trả lời) vào localStorage,
   để thoát trang rồi quay lại (F5, mất mạng, đóng tab...) không bị tính lại từ đầu ── */
function attemptKey(examId, classId, assignmentId, studentId) {
  return `hoctoan_attempt_${examId}_${classId || 'x'}_${assignmentId || 'x'}_${studentId}`
}
function loadAttempt(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}
function saveAttempt(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* vd: quota đầy — bỏ qua */ }
}
function clearAttempt(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

/* ── Vé "đã bấm Bắt đầu làm bài" do server cấp cho lượt này ──
   Giữ trong sessionStorage (chỉ sống trong tab đang thi, F5 không mất) — không có
   vé thì màn hình làm bài KHÔNG mở, dù URL #take/... đúng hay bấm Back về history
   cũ. Vé bị xoá ngay khi nộp bài, nên muốn vào lại phải xin vé mới (server kiểm
   tra lại thành viên lớp / giờ mở / số lượt còn lại). */
function ticketKey(examId, classId, assignmentId, studentId) {
  return attemptKey(examId, classId, assignmentId, studentId) + '_ticket'
}
function loadTicket(key) {
  try { return sessionStorage.getItem(key) || null } catch { return null }
}
function saveTicket(key, val) {
  try { sessionStorage.setItem(key, val) } catch { /* ignore */ }
}
function clearTicket(key) {
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}

/* ── Đánh dấu 1 lượt làm bài "vừa nộp xong" (trong tab hiện tại), để App.jsx chặn
   việc bấm nút Back trên trình duyệt quay lại được màn hình làm bài đã nộp. Cờ này
   chỉ được đọc khi điều hướng bằng Back/Forward (popstate) — bấm "Làm bài"/"Làm lại"
   là điều hướng mới (hashchange), nên không bị chặn nhầm. ── */
export function markExamJustSubmitted(examId, classId, assignmentId, studentId) {
  try { sessionStorage.setItem(attemptKey(examId, classId, assignmentId, studentId) + '_submitted', '1') } catch { /* ignore */ }
}
export function clearExamJustSubmitted(examId, classId, assignmentId, studentId) {
  try { sessionStorage.removeItem(attemptKey(examId, classId, assignmentId, studentId) + '_submitted') } catch { /* ignore */ }
}
export function wasExamJustSubmitted(examId, classId, assignmentId, studentId) {
  try { return sessionStorage.getItem(attemptKey(examId, classId, assignmentId, studentId) + '_submitted') === '1' } catch { return false }
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

/* ── Khóa màn hình khi làm bài (chống gian lận, khóa cứng) ── */
function requestFs() {
  const el = document.documentElement
  return (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el)
}
function isFs() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
}
// Vào fullscreen + khóa phím Esc (Keyboard Lock API — Chrome/Edge desktop)
async function enterFsLock() {
  try { await requestFs() } catch { /* trình duyệt có thể chặn */ }
  try { await navigator.keyboard?.lock?.(['Escape', 'F11']) } catch { /* không hỗ trợ */ }
}
function releaseKeyboard() {
  try { navigator.keyboard?.unlock?.() } catch { /* bỏ qua */ }
}

function useExamLock(enabled) {
  const [violations, setViolations] = useState(0)
  const [warning, setWarning] = useState('')
  const [blocked, setBlocked] = useState(false)   // đề bị che, phải quay lại mới làm tiếp
  const [askUnlock, setAskUnlock] = useState(false)   // đang hỏi mật khẩu thoát
  const [unlocked, setUnlocked] = useState(false)   // đã thoát khóa bằng mật khẩu
  const countRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    if (!enabled || unlocked) return
    const pressed = new Set()   // các phím đang được giữ (theo e.code)

    const flag = (reason, doBlock = true) => {
      const now = Date.now()
      if (now - lastRef.current > 500) {   // gộp sự kiện trùng (blur + visibilitychange)
        lastRef.current = now
        countRef.current += 1
        setViolations(countRef.current)
        setWarning(reason)
      }
      if (doBlock) setBlocked(true)
    }

    const onVisibility = () => { if (document.hidden) flag('Bạn đã rời khỏi màn hình làm bài!') }
    const onBlur = () => flag('Cửa sổ làm bài bị mất tiêu điểm!')
    const onFsChange = () => {
      if (!isFs()) {
        flag('Bạn đã thoát chế độ toàn màn hình!')
        enterFsLock()   // cố tự ép lại (nếu trình duyệt cần thao tác thì nút "Quay lại" sẽ xử lý)
      }
    }
    const block = (e) => { e.preventDefault(); return false }
    const onKeyUp = (e) => { pressed.delete(e.code) }
    const onKey = (e) => {
      pressed.add(e.code)
      // Cửa thoát bí mật: giữ Shift + 1 + 3 → hỏi mật khẩu
      if (e.shiftKey && pressed.has('Digit1') && pressed.has('Digit3')) {
        e.preventDefault()
        setAskUnlock(true)
        return false
      }
      const k = (e.key || '').toLowerCase()
      // Chặn Esc (thoát fullscreen) và Alt+F4 (đóng cửa sổ)
      if (e.key === 'Escape' || (e.altKey && e.key === 'F4')) {
        e.preventDefault(); e.stopPropagation()
        return false
      }
      const combo =
        e.key === 'F12' || e.key === 'PrintScreen' ||
        (e.ctrlKey && ['c', 'v', 'x', 'p', 'u', 's', 'a', 'w'].includes(k)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
        ((e.metaKey || e.ctrlKey) && ['c', 'v', 'x', 'p'].includes(k)) ||
        (e.altKey && ['tab', 'f4'].includes(k)) ||   // Alt+Tab, Alt+F4
        (e.ctrlKey && k === 'f4')                     // Ctrl+F4 (đóng tab)
      if (combo) { e.preventDefault(); e.stopPropagation(); flag('Phím tắt bị chặn trong lúc làm bài.', false); return false }
    }
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; return '' }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    document.addEventListener('paste', block)
    document.addEventListener('selectstart', block)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('paste', block)
      document.removeEventListener('selectstart', block)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
      releaseKeyboard()
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    }
  }, [enabled, unlocked])

  // Học sinh bấm "Quay lại làm bài" — thao tác này cho phép vào lại fullscreen + khóa phím
  const resume = async () => {
    await enterFsLock()
    setBlocked(false)
    setWarning('')
  }

  // Nhập mật khẩu để thoát khóa hoàn toàn (xác minh ở server)
  const tryUnlock = async (pw) => {
    const ok = await verifyLockEscape(pw)
    if (ok) {
      setUnlocked(true)
      setAskUnlock(false)
      setBlocked(false)
      setWarning('')
      releaseKeyboard()
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    }
    return ok
  }

  return {
    violations, warning, blocked, resume, unlocked,
    askUnlock, closeUnlock: () => setAskUnlock(false), tryUnlock,
    dismissWarning: () => setWarning(''),
  }
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

/* ── Ô nhập mật khẩu thoát khóa (Shift + 1 + 3) ── */
function UnlockPrompt({ onSubmit, onClose }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const ok = await onSubmit(pwd)
    setBusy(false)
    if (!ok) setErr('Sai mật khẩu thoát.')
  }
  return (
    <div className="et-unlock-overlay">
      <form className="et-unlock-card" onSubmit={submit}>
        <div className="et-unlock-icon">🔓</div>
        <h2>Thoát chế độ khóa</h2>
        <p className="et-unlock-sub">Nhập mật khẩu để gỡ khóa màn hình.</p>
        <input
          type="password" autoFocus className="et-unlock-input"
          placeholder="Mật khẩu thoát"
          value={pwd} onChange={e => { setPwd(e.target.value); setErr('') }}
        />
        {err && <div className="pm-error" style={{ marginTop: 8 }}>⚠️ {err}</div>}
        <div className="et-unlock-actions">
          <button type="button" className="btn-primary" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="submit" className="btn-submit-exam" disabled={busy}>
            {busy ? '⏳ Đang kiểm tra…' : 'Thoát khóa'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Password gate ── */
function PasswordGate({ exam, onCorrect }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
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

/* ── Cổng xác nhận vào làm bài ──
   Bấm nút ở đây mới gọi server xin vé; server kiểm tra lại thành viên lớp, giờ mở
   và số lượt còn lại. Không qua bước này thì đề không hiện, dù có URL. */
function AttemptStartGate({ exam, examId, classId, assignmentId, resuming, onStarted, onGoHome }) {
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  const start = async () => {
    setBusy(true); setErr('')
    try {
      const res = await startAttempt(examId, { classId, assignmentId })
      onStarted(res.ticket)
    } catch (e) {
      setErr(e.message || 'Không vào được đề thi.')
      setBusy(false)
    }
  }

  const used = exam._attemptsUsed ?? 0
  const max  = exam._maxAttempts ?? null

  return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">📝</div>
        <h1 className="etl-title">{exam.title}</h1>
        <div className="etl-meta">
          <span>📋 {exam.totalQuestions} câu hỏi</span>
          <span>⏱ {exam.settings?.duration} phút</span>
          {exam._className && <span>🏫 {exam._className}</span>}
        </div>
        <div className="etl-divider" />
        <p style={{ color: '#64748b', margin: '12px 0' }}>
          {resuming
            ? 'Bạn đang có một lượt làm dở — bấm để tiếp tục đúng bài và đúng giờ còn lại.'
            : 'Bấm nút bên dưới để bắt đầu. Đồng hồ chạy ngay khi vào đề.'}
          {max ? ` Bạn đã làm ${used}/${max} lượt.` : (used > 0 ? ` Bạn đã làm ${used} lượt (không giới hạn).` : '')}
        </p>
        {err && <div className="etl-expired-msg">{err}</div>}
        <button className="btn-submit-exam" style={{ marginTop: 8 }} disabled={busy} onClick={start}>
          {busy ? '⏳ Đang vào đề…' : resuming ? '▶️ Tiếp tục làm bài' : '🚀 Bắt đầu làm bài'}
        </button>
        <button className="btn-primary" style={{ marginTop: 10 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )
}

/* ── Main exam view ── */
function ExamView({ exam, studentName, studentId, className, classId, assignmentId, ticket, onTicketUsed, onGoHome, onGoClass }) {
  const hideResults = exam.settings?.hideResults || false
  const sectionList = getSectionList(exam)
  // Đề có phần tự luận: điểm chấm tay đến sau (0đ cho đến khi giáo viên chấm), nhưng
  // điểm hiển thị luôn tính trên TỔNG điểm toàn đề (kể cả tự luận) — khớp với điểm
  // giáo viên thấy, tránh 2 màn hình ra 2 điểm khác nhau cho cùng 1 bài.
  const hasEssay = sectionList.includes('TỰ LUẬN')
  // Lượt làm bài đang dở (nếu có) — đọc 1 lần lúc mount để khôi phục giờ bắt đầu + đáp án đã chọn
  const attemptKeyStr = attemptKey(exam.id, classId, assignmentId, studentId)
  const savedAttemptRef = useRef(undefined)
  if (savedAttemptRef.current === undefined) savedAttemptRef.current = loadAttempt(attemptKeyStr)
  const savedAttempt = savedAttemptRef.current
  // Trộn thứ tự câu hỏi/đáp án (nếu đề bật) — tính 1 lần khi vào lượt làm bài,
  // giữ nguyên (không xáo lại) khi F5; xóa cùng lượt làm bài khi nộp bài.
  const [shuffleMap] = useState(() =>
    savedAttempt?.shuffleMap || (exam.settings?.shuffleQuestions ? buildShuffleMap(exam) : null)
  )

  const [activeSection, setActiveSection] = useState(sectionList[0] || 'PHẦN I')
  const [answers, setAnswers] = useState(() => savedAttempt?.answers || {})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [finalScore, setFinalScore] = useState(null)
  const [finalMax, setFinalMax] = useState(null)
  // Câu đánh dấu "xem lại sau" — lưu cùng lượt làm bài để F5 không mất
  const [flags, setFlags] = useState(() => savedAttempt?.flags || [])
  const [focusMode, setFocusMode] = useState(false)   // chế độ tập trung: 1 câu / màn hình
  const [focusKey, setFocusKey] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)   // ngăn kéo bảng câu hỏi (mobile)
  const [scrollTo, setScrollTo] = useState(null)    // key câu cần cuộn tới sau khi đổi phần

  // Danh sách phẳng mọi câu theo đúng thứ tự học sinh thấy — dùng cho bảng số
  // câu, chế độ tập trung và đếm tiến độ.
  const flatQuestions = useMemo(() => {
    const out = []
    for (const sec of sectionList) {
      const raw = exam.sections?.[sec]?.questions ?? []
      const qs = reorderByQuestionNumber(raw, shuffleMap?.sections?.[sec])
      qs.forEach((q, i) => {
        out.push({
          sec, q, i,
          no: i + 1,                                        // số hiển thị trong phần
          key: `${SECTION_PREFIX[sec] || 'I'}_${q.question_number}`,
        })
      })
    }
    return out
  }, [exam, sectionList.join('|'), shuffleMap])

  const toggleFlag = (key) =>
    setFlags(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))

  // Khóa màn hình (chống gian lận) — bật theo cài đặt của giáo viên
  const lockOn = !!exam.settings?.lockScreen
  const [lockStarted, setLockStarted] = useState(!lockOn)
  const [startedAt, setStartedAt] = useState(() => savedAttempt?.startedAt ?? (lockOn ? null : Date.now()))
  const { violations, warning, blocked, resume, unlocked,
    askUnlock, closeUnlock, tryUnlock, dismissWarning } = useExamLock(lockOn && lockStarted && !submitted)
  const lockActive = lockOn && !unlocked

  const beginLocked = async () => {
    await enterFsLock()
    setStartedAt(prev => prev ?? Date.now())   // đã có giờ bắt đầu từ lượt cũ thì giữ nguyên, không reset
    setLockStarted(true)
  }

  const effStart = startedAt ?? Date.now()
  const endByDur = effStart + exam.settings.duration * 60_000
  const endByClose = new Date(exam.settings.closeTime).getTime()
  const endTime = Math.min(endByDur, endByClose)
  const endIso = new Date(endTime).toISOString()
  const msLeft = useCountdown(endIso)

  // Hết giờ → tự động nộp bài
  useEffect(() => {
    if (msLeft === 0 && !submitted) handleSubmit(true)
  }, [msLeft])

  // Lưu lại lượt làm bài (giờ bắt đầu + đáp án) sau mỗi thay đổi, để thoát ra rồi
  // quay lại (F5, mất mạng, đóng tab...) không bị tính lại từ đầu.
  useEffect(() => {
    if (submitted || startedAt == null) return
    saveAttempt(attemptKeyStr, { startedAt, answers, shuffleMap, flags })
  }, [answers, startedAt, submitted, attemptKeyStr, shuffleMap, flags])

  // Bấm số câu ở bảng điều hướng khi đang ở phần khác → đổi phần xong mới cuộn tới câu đó
  useEffect(() => {
    if (!scrollTo) return
    const el = document.getElementById(`etx-q-${scrollTo}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollTo(null)
  }, [scrollTo, activeSection])

  const handleAnswerChange = (key, val) => {
    setAnswers(prev => ({ ...prev, [key]: val }))
  }

  const handleSubmit = async (auto = false) => {
    if (!auto && !confirm('Nộp bài? Bạn không thể thay đổi sau khi nộp.')) return
    setSubmitting(true)
    const timeSpent = Math.max(0, Math.round((Date.now() - effStart) / 1000))  // giây
    try {
      // Điểm do SERVER chấm (client không còn nhận đáp án đúng qua GET đề nữa,
      // nên không thể tự tính điểm ở đây như trước).
      const result = await submitResult(exam.id, {
        studentName, studentId, answers, className, classId, assignmentId,
        startedAt: new Date(effStart).toISOString(), timeSpent,
        violationCount: lockOn ? violations : null, shuffleMap, ticket
      })
      setFinalScore(result.score)
      setFinalMax(result.maxScore)
      setSubmitted(true)
      clearAttempt(attemptKeyStr)
      // Vé đã tiêu: muốn vào lại đề (kể cả bấm Back) phải bấm "Bắt đầu làm bài"
      // lần nữa và server sẽ kiểm tra lại giờ mở + số lượt còn lại.
      onTicketUsed?.()
      // Đánh dấu lượt này "vừa nộp" — App.jsx dựa vào cờ này để chặn bấm Back trên
      // trình duyệt quay lại được màn hình làm bài (chỉ chặn khi Back/Forward, không
      // chặn khi bấm "Làm bài"/"Làm lại" để bắt đầu lượt mới).
      markExamJustSubmitted(exam.id, classId, assignmentId, studentId)
      // Thay (không push) hash "take/..." bằng nơi sẽ về sau khi nộp.
      window.history.replaceState(null, '', classId ? `#class/${classId}/exam` : window.location.pathname)
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
              {hasEssay && (
                <div className="etl-essay-pending">
                  ✍️ Bài có phần <strong>tự luận</strong> — giáo viên sẽ chấm và cập nhật điểm sau (điểm dưới đây đã tính trên tổng điểm toàn đề).
                </div>
              )}
              <div className="etl-score-num">{scaledScore(finalScore, finalMax)} <span>/ 10</span></div>
              <div className="etl-score-label">điểm</div>
              <p className="etl-name-tag">Bài làm của: <strong>{studentName}</strong></p>
            </div>
          )}
          {classId && onGoClass ? (
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => onGoClass(classId, 'exam')}>← Về lớp học</button>
          ) : (
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={onGoHome}>← Trang chủ</button>
          )}
        </div>
      </div>
    )
  }

  // Cổng vào chế độ khóa: yêu cầu toàn màn hình trước khi bắt đầu
  if (lockOn && !lockStarted) {
    return (
      <div className="et-locked">
        <div className="etl-card">
          <div className="etl-icon">🔒</div>
          <h1 className="etl-title">{exam.title}</h1>
          <div className="etl-meta">
            <span>📋 {exam.totalQuestions} câu hỏi</span>
            <span>⏱ {exam.settings.duration} phút</span>
          </div>
          <div className="etl-divider" />
          <div className="et-lock-notice">
            <p><strong>Đề này bật chế độ khóa màn hình.</strong> Trong lúc làm bài:</p>
            <ul>
              <li>Bài làm chạy ở chế độ <strong>toàn màn hình bắt buộc</strong>.</li>
              <li>Rời tab / thoát toàn màn hình sẽ <strong>che kín đề</strong> — phải quay lại mới làm tiếp được.</li>
              <li>Copy / dán / chuột phải / phím tắt (kể cả Esc) bị vô hiệu hóa.</li>
              <li>Mỗi lần vi phạm được <strong>ghi lại cho giáo viên</strong>.</li>
            </ul>
          </div>
          <button className="btn-submit-exam" style={{ marginTop: 16 }} onClick={beginLocked}>
            🚀 Vào toàn màn hình & bắt đầu
          </button>
          <button className="btn-primary" style={{ marginTop: 10 }} onClick={onGoHome}>← Trang chủ</button>
        </div>
      </div>
    )
  }

  const items = flatQuestions.filter(f => f.sec === activeSection)
  const doneCount = flatQuestions.filter(f => answerStateOf(f.sec, f.q, answers[f.key]) === 'done').length
  const focusItem = focusMode
    ? (flatQuestions.find(f => f.key === focusKey) || items[0] || flatQuestions[0] || null)
    : null
  const focusIdx = focusItem ? flatQuestions.indexOf(focusItem) : -1
  const secIdx = sectionList.indexOf(activeSection)
  const nextSection = sectionList[secIdx + 1]

  const pctLeft = Math.max(0, Math.min(100, (msLeft / (exam.settings.duration * 60_000)) * 100))
  // Dưới 5 phút → cam, dưới 1 phút → đỏ (kèm nhấp nháy) để học sinh không lỡ giờ
  const timeTone = msLeft <= 60_000 ? 'is-urgent' : msLeft <= 5 * 60_000 ? 'is-warn' : ''

  const goToQuestion = (item) => {
    setActiveSection(item.sec)
    setSideOpen(false)
    if (focusMode) { setFocusKey(item.key); scrollTop() }
    else setScrollTo(item.key)
  }
  const goStep = (delta) => {
    const next = flatQuestions[focusIdx + delta]
    if (!next) return
    setActiveSection(next.sec)
    setFocusKey(next.key)
    scrollTop()
  }
  const toggleFocus = () => {
    if (!focusMode && !focusKey) setFocusKey((items[0] || flatQuestions[0])?.key || null)
    setFocusMode(v => !v)
    scrollTop()
  }

  const renderQuestion = (item) => {
    const flagged = flags.includes(item.key)
    return (
      <div className="etx-q" id={`etx-q-${item.key}`} key={item.key}>
        <QuestionCard
          q={item.q} index={item.i} displayNumber={item.no}
          examMode={true}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          choiceOrders={shuffleMap?.choices}
          headerExtra={
            <button type="button" className={`etx-flag ${flagged ? 'is-on' : ''}`}
              title={flagged ? 'Bỏ đánh dấu' : 'Đánh dấu để xem lại sau'}
              onClick={(e) => { e.stopPropagation(); toggleFlag(item.key) }}>
              {flagged ? '🚩' : '⚑'}<span>{flagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="et-exam etx">
      {askUnlock && (
        <UnlockPrompt onSubmit={tryUnlock} onClose={closeUnlock} />
      )}
      {lockActive && blocked && !submitted && (
        <div className="et-lock-overlay">
          <div className="et-lock-overlay-card">
            <div className="et-lock-overlay-icon">🔒</div>
            <h1>Đề đang bị khóa</h1>
            <p className="et-lock-overlay-reason">{warning || 'Bạn đã rời khỏi chế độ làm bài.'}</p>
            <p className="et-lock-overlay-sub">
              Bạn không thể tiếp tục cho đến khi quay lại chế độ toàn màn hình.
              Lần vi phạm này đã được ghi lại cho giáo viên.
            </p>
            <div className="et-lock-overlay-count">Tổng số lần vi phạm: <strong>{violations}</strong></div>
            <button className="btn-submit-exam et-lock-resume" onClick={resume}>
              ↩️ Quay lại làm bài (toàn màn hình)
            </button>
          </div>
        </div>
      )}
      {/* ── Thanh trên cùng gộp: đồng hồ · tên đề · tập trung · nộp bài ── */}
      <header className={`etx-top ${timeTone}`}>
        {lockActive && (
          <>
            <div className="et-lock-status">🔒 Chế độ khóa màn hình đang bật · Vi phạm: <strong>{violations}</strong></div>
            {warning && !blocked && (
              <div className="et-lock-warning" onClick={dismissWarning}>
                ⚠️ {warning} <span className="et-lock-warning-count">(lần thứ {violations})</span>
                <button className="et-lock-warning-x" onClick={dismissWarning}>✕</button>
              </div>
            )}
          </>
        )}
        <div className="etx-top-in">
          <div className="etx-clock-wrap" title="Thời gian còn lại">
            <span className="etx-clock">{fmtMs(msLeft)}</span>
            <span className="etx-clock-label">còn lại</span>
          </div>
          <div className="etx-titlebox">
            <h1 className="etx-title">{exam.title}</h1>
            <p className="etx-sub">
              {className ? `${className} · ` : ''}{studentName} · đã làm {doneCount}/{flatQuestions.length} câu
            </p>
          </div>
          <div className="etx-top-act">
            <button className="etx-ghost etx-side-toggle" onClick={() => setSideOpen(v => !v)}>
              ☰ <b>{doneCount}</b>/{flatQuestions.length}
            </button>
            <button className={`etx-ghost ${focusMode ? 'is-on' : ''}`} onClick={toggleFocus}
              title="Chỉ hiển thị 1 câu mỗi màn hình">
              {focusMode ? '▦ Xem tất cả' : '◎ Tập trung'}
            </button>
            <button className="etx-submit" disabled={submitting} onClick={() => handleSubmit(false)}>
              {submitting ? '⏳ Đang nộp…' : '✅ Nộp bài'}
            </button>
          </div>
        </div>
        <div className="etx-timeline">
          <div className="etx-timeline-fill" style={{ width: `${pctLeft}%` }} />
        </div>
      </header>

      <div className="etx-layout">
        {/* ── Cột trái: bảng số câu hỏi ── */}
        <aside className={`etx-side ${sideOpen ? 'is-open' : ''}`}>
          <div className="etx-side-top">
            <div className="etx-side-title">Danh sách câu hỏi</div>
            <button className="etx-side-close" onClick={() => setSideOpen(false)}>✕</button>
          </div>
          <div className="etx-progress">
            <div className="etx-progress-bar">
              <div className="etx-progress-fill"
                style={{ width: `${flatQuestions.length ? (doneCount / flatQuestions.length) * 100 : 0}%` }} />
            </div>
            <span className="etx-progress-text">Đã làm <b>{doneCount}</b>/{flatQuestions.length}</span>
          </div>

          {sectionList.map(sec => {
            const meta = SECTION_LABELS[sec] ?? { short: sec, color: '#475569' }
            const list = flatQuestions.filter(f => f.sec === sec)
            const done = list.filter(f => answerStateOf(sec, f.q, answers[f.key]) === 'done').length
            return (
              <div key={sec} className={`etx-secblock ${activeSection === sec ? 'is-active' : ''}`}
                style={{ '--sec': meta.color }}>
                <button className="etx-secblock-head" onClick={() => list[0] && goToQuestion(list[0])}>
                  <span className="etx-secdot" />
                  <span className="etx-secname">{meta.short ?? sec}</span>
                  <em>{done}/{list.length}</em>
                </button>
                <div className="etx-qgrid">
                  {list.map(f => {
                    const st = answerStateOf(sec, f.q, answers[f.key])
                    const cur = focusMode ? focusItem?.key === f.key : false
                    return (
                      <button key={f.key}
                        className={`etx-qbtn is-${st} ${flags.includes(f.key) ? 'is-flag' : ''} ${cur ? 'is-current' : ''}`}
                        onClick={() => goToQuestion(f)}
                        title={`${meta.short ?? sec} · câu ${f.no}${flags.includes(f.key) ? ' (đã đánh dấu)' : ''}`}>
                        {f.no}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="etx-legend">
            <span><i className="etx-lg etx-lg--done" /> Đã làm</span>
            <span><i className="etx-lg etx-lg--partial" /> Đang làm</span>
            <span><i className="etx-lg etx-lg--none" /> Chưa làm</span>
            <span><i className="etx-lg etx-lg--flag" /> Đánh dấu</span>
          </div>
        </aside>
        {sideOpen && <div className="etx-scrim" onClick={() => setSideOpen(false)} />}

        {/* ── Cột phải: nội dung câu hỏi ── */}
        <main className="etx-main">
          {submitErr && <div className="pm-error" style={{ marginBottom: 10 }}>⚠️ {submitErr}</div>}

          {focusMode ? (
            !focusItem ? (
              <p className="empty-msg">Không có câu hỏi nào.</p>
            ) : activeSection === 'READING' ? (
              <ReadingTakeView questions={items.map(f => f.q)} examMode={true}
                savedAnswers={answers} onAnswerChange={handleAnswerChange} />
            ) : (
              <>
                <div className="etx-focus-head">
                  <span className="etx-focus-count">Câu {focusIdx + 1} / {flatQuestions.length}</span>
                  <span className="etx-focus-sec" style={{ color: SECTION_LABELS[focusItem.sec]?.color }}>
                    {SECTION_LABELS[focusItem.sec]?.label ?? focusItem.sec}
                  </span>
                </div>
                {renderQuestion(focusItem)}
                <div className="etx-focus-nav">
                  <button className="etx-navbtn" disabled={focusIdx <= 0} onClick={() => goStep(-1)}>
                    ← Câu trước
                  </button>
                  <button className="etx-navbtn" disabled={focusIdx >= flatQuestions.length - 1}
                    onClick={() => goStep(1)}>
                    Câu tiếp theo →
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              {sectionList.length > 1 && (
                <div className="etx-tabs">
                  {sectionList.map(sec => {
                    const meta = SECTION_LABELS[sec] ?? { short: sec, color: '#475569' }
                    const count = exam.sections?.[sec]?.questions?.length ?? 0
                    return (
                      <button key={sec}
                        className={`etx-tab ${activeSection === sec ? 'is-active' : ''}`}
                        style={{ '--sec': meta.color }}
                        onClick={() => { setActiveSection(sec); scrollTop() }}>
                        {meta.short ?? sec}<span>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {exam.sections?.[activeSection] && (
                <p className="etx-secdesc">
                  <b style={{ color: SECTION_LABELS[activeSection]?.color }}>
                    {SECTION_LABELS[activeSection]?.label ?? activeSection}
                  </b>
                  {' — '}{exam.sections[activeSection].questions.length} câu
                  {exam.sections[activeSection].points_per_q ? ` × ${exam.sections[activeSection].points_per_q}đ/câu` : ''}
                </p>
              )}

              <div className="etx-qlist">
                {items.length === 0 ? (
                  <p className="empty-msg">Không có câu hỏi nào trong phần này.</p>
                ) : activeSection === 'READING' ? (
                  <ReadingTakeView questions={items.map(f => f.q)} examMode={true}
                    savedAnswers={answers} onAnswerChange={handleAnswerChange} />
                ) : (
                  items.map(renderQuestion)
                )}
              </div>

              {nextSection && (
                <button className="etx-nextsec" onClick={() => { setActiveSection(nextSection); scrollTop() }}>
                  Sang {SECTION_LABELS[nextSection]?.label ?? nextSection} →
                </button>
              )}
            </>
          )}

          <div className="etx-bottom">
            {submitErr && <div className="pm-error">⚠️ {submitErr}</div>}
            <button className="etx-submit etx-submit--lg" disabled={submitting}
              onClick={() => handleSubmit(false)}>
              {submitting ? '⏳ Đang nộp…' : '✅ Nộp bài'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ── Root component ── */
export default function ExamTakePage({ examId, classId, assignmentId, user, onGoHome, onGoClass, onGoLogin }) {
  const [exam, setExam] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [status, setStatus] = useState('pending')
  const [pwdUnlocked, setPwdUnlocked] = useState(false)
  // Vé của lượt làm này — server cấp khi học sinh bấm "Bắt đầu làm bài"
  const [ticket, setTicket] = useState(null)
  useEffect(() => {
    if (user?.id == null) return
    setTicket(loadTicket(ticketKey(examId, classId, assignmentId, String(user.id))))
  }, [examId, classId, assignmentId, user?.id])

  // Vào trang này bằng điều hướng MỚI (bấm "Làm bài"/"Làm lại") luôn là 1 lượt làm bài
  // hợp lệ — xoá cờ "vừa nộp" của lượt trước để không bị App.jsx chặn nhầm lượt mới này.
  // Cleanup: RỜI khỏi màn hình làm bài cũng xoá cờ. Cờ chỉ có nhiệm vụ chặn bấm Back
  // NGAY tại màn hình vừa nộp; để sót lại thì lần vào sau (đề còn lượt) bị đá ngược về
  // lớp học mà không tải đề — đúng lỗi "làm xong lần 1 không vào lần 2 được".
  useEffect(() => {
    if (user?.id == null) return
    clearExamJustSubmitted(examId, classId, assignmentId, user.id)
    return () => clearExamJustSubmitted(examId, classId, assignmentId, user.id)
  }, [examId, classId, assignmentId, user?.id])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        const e = await fetchExamById(examId)
        if (cancelled) return
        if (!e) { setNotFound(true); return }

        // Làm bài qua LỚP: dùng cửa sổ thời gian của bài được giao, không cần link công khai.
        let keepClassTag = false   // lớp cũ giao qua "Phát đề" (không có assignment) — vẫn gắn lớp nếu là thành viên
        if (classId) {
          const win = await getExamWindow(classId, examId, user?.id, user?.email, assignmentId)
          if (cancelled) return
          if (win && win.assigned && win.isMember !== false) {
            const merged = {
              ...e,
              published: true,
              settings: {
                ...e.settings,
                openTime: win.openTime || e.settings?.openTime,
                closeTime: win.closeTime || e.settings?.closeTime,
                duration: win.duration ?? e.settings?.duration,
                password: null,   // lớp học là cổng vào — không cần mật khẩu công khai
                lockScreen: win.lockScreen ?? e.settings?.lockScreen ?? false,
                shuffleQuestions: win.shuffleQuestions ?? e.settings?.shuffleQuestions ?? false,
              },
              _classGated: true,
              _className: win.className,
              _assignmentId: win.assignmentId || assignmentId || null,
              _maxAttempts: win.maxAttempts ?? null,
              _attemptsUsed: win.attemptsUsed ?? 0,
              _scoreMode: win.scoreMode || 'highest',
            }
            setExam(merged)
            setStatus(examStatus(merged))
            return
          }
          // Lớp không giao bài này nhưng học sinh LÀ thành viên → cho phép gắn lớp (luồng cũ).
          // Không thuộc lớp / lớp đã xóa → làm như link công khai, KHÔNG gắn lớp.
          keepClassTag = !!(win && win.isMember === true)
        }

        // Link công khai (như cũ): cần đề đã xuất bản.
        if (!e.published) { setNotFound(true); return }
        setExam({ ...e, _classTag: keepClassTag })
        setStatus(examStatus(e))
      })()
    return () => { cancelled = true }
  }, [examId, classId, assignmentId, user?.id])

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
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </span>
            Đăng nhập
          </button>
          <button className="etl-action-btn etl-action-btn--home" onClick={onGoHome}>
            <span className="etl-action-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            Trang chủ
          </button>
        </div>
      </div>
    </div>
  )

  if (status === 'expired') return <ExpiredView exam={exam} onGoHome={onGoHome} />
  if (status === 'pending') return <LockedView exam={exam} onGoHome={onGoHome} />

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

  // Cổng xác nhận: phải bấm "Bắt đầu làm bài" (server cấp vé) mới mở đề — dán URL
  // #take/... hay bấm Back về history cũ đều dừng ở đây chứ không nhảy thẳng vào đề.
  if (!ticket) {
    return (
      <AttemptStartGate
        exam={exam}
        resuming={!!loadAttempt(attemptKey(examId, classId, assignmentId, String(user.id)))}
        examId={examId} classId={classId} assignmentId={assignmentId}
        onStarted={(t) => {
          saveTicket(ticketKey(examId, classId, assignmentId, String(user.id)), t)
          setTicket(t)
        }}
        onGoHome={onGoHome}
      />
    )
  }

  // Chỉ gắn bài nộp vào lớp khi: được giao qua lớp (đã xác minh thành viên)
  // hoặc luồng cũ mà học sinh là thành viên. Lớp đã xóa / bị mời ra khỏi lớp
  // → nộp như link công khai (không classId).
  const effectiveClassId = (exam._classGated || exam._classTag) ? classId : null
  const classInfo = effectiveClassId && exam?.classes?.length
    ? (exam.classes.find(c => c.id === effectiveClassId) || null)
    : null
  const resolvedClassName = effectiveClassId ? (classInfo?.name || exam?._className || null) : null

  return (
    <ExamView
      exam={exam}
      studentName={user.name}
      studentId={String(user.id)}
      className={resolvedClassName}
      classId={effectiveClassId}
      assignmentId={exam._classGated ? (exam._assignmentId || null) : null}
      ticket={ticket}
      onTicketUsed={() => clearTicket(ticketKey(examId, classId, assignmentId, String(user.id)))}
      onGoHome={onGoHome}
      onGoClass={onGoClass}
    />
  )
}

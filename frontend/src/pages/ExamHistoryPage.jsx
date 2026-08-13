import React, { useEffect, useMemo, useState } from 'react'
import { fetchMySubmissions, scaledScore } from '../store/examStore.js'
import SubjectBadge from '../components/SubjectBadge.jsx'

function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcClock        = (s) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>
const IcHome          = (s) => <Ic size={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ic>
const IcUser          = (s) => <Ic size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ic>
const IcChevronRight  = (s) => <Ic size={s}><polyline points="9 18 15 12 9 6"/></Ic>
const IcChevronLeft   = (s) => <Ic size={s}><polyline points="15 18 9 12 15 6"/></Ic>
const IcBook          = (s) => <Ic size={s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Ic>
const IcFile          = (s) => <Ic size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></Ic>

const formatDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const formatDtShort = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

const formatDuration = (sec) => {
  if (sec == null) return null
  const m = Math.round(sec / 60)
  return m > 0 ? `${m} phút` : `${sec} giây`
}

function ScoreBar({ score, total }) {
  const pct   = (score / total) * 100
  const color = pct >= 80 ? '#059669' : pct >= 60 ? '#f59e0b' : '#ef4444'
  // Chạy từ 0 → điểm thật ngay sau khi mount (rAF để đảm bảo trình duyệt vẽ
  // frame 0% trước, rồi mới chuyển sang giá trị đích để CSS transition bắt được).
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return (
    <div className="prof-score-bar">
      <div className="psb-fill" style={{ width: `${width}%`, background: color, color }} />
    </div>
  )
}

function ScoreTag({ scaled }) {
  return scaled == null
    ? <span className="phi-score-pending">Chờ công bố</span>
    : <><span className="phi-score-num">{scaled}</span><span className="phi-score-total">/10</span></>
}

/* ── Điều hướng 3 cấp đồng bộ vào URL hash: #history | #history/<classKey> |
   #history/<classKey>/<examId> — '__none__' (bài làm ngoài lớp học) mã hoá
   thành 'none' trên URL, cùng cách ClassManagementPage.jsx làm với khối. */
const NO_CLASS_KEY   = '__none__'
const NO_CLASS_LABEL = 'Ôn luyện ngoài lớp học'

function navFromHash() {
  const h = window.location.hash.slice(1)
  if (!h.startsWith('history')) return { classKey: null, examId: null }
  const rest = h === 'history' ? '' : h.slice('history/'.length)
  const [c, e] = rest.split('/')
  const classKey = c ? (c === 'none' ? NO_CLASS_KEY : c) : null
  return { classKey, examId: e || null }
}

/* ── Trang riêng: Lịch sử làm bài — drill-down Lớp → Đề → Lần làm ── */
export default function ExamHistoryPage({ user, onGoHome, onGoProfile }) {
  const [submissions, setSubmissions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [nav,         setNav]         = useState(navFromHash)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchMySubmissions(user.id)
      .then(res => { if (alive) setSubmissions(res.submissions || []) })
      .catch(() => { if (alive) setSubmissions([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user.id])

  // Đồng bộ với lịch sử trình duyệt: nút Back / vuốt back trên điện thoại lùi
  // đúng 1 cấp (lần làm → đề → lớp) thay vì thoát thẳng ra khỏi trang.
  useEffect(() => {
    const onPop = () => setNav(navFromHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop) }
  }, [])

  // Đi vào 1 cấp: đẩy state trình duyệt rồi cập nhật state (pushState không tự phát event).
  const goNav = (classKey, examId = null) => {
    const seg = classKey ? (classKey === NO_CLASS_KEY ? 'none' : classKey) : ''
    const h = 'history' + (seg ? `/${seg}${examId ? `/${examId}` : ''}` : '')
    window.history.pushState(null, '', `#${h}`)
    setNav({ classKey: classKey ?? null, examId: examId ?? null })
  }
  const goBack = () => window.history.back()

  // ── Nhóm: Lớp → Đề → Lần làm (kèm đánh số "Lần N" theo thứ tự thời gian) ──
  const classGroups = useMemo(() => {
    const byClass = new Map()
    for (const s of submissions) {
      const key = s.classId || NO_CLASS_KEY
      if (!byClass.has(key)) {
        byClass.set(key, { key, className: s.classId ? (s.className || 'Lớp học') : NO_CLASS_LABEL, subs: [] })
      }
      byClass.get(key).subs.push(s)
    }
    return Array.from(byClass.values()).map(c => {
      const byExam = new Map()
      for (const s of c.subs) {
        if (!byExam.has(s.examId)) byExam.set(s.examId, [])
        byExam.get(s.examId).push(s)
      }
      const exams = Array.from(byExam.entries()).map(([examId, subs]) => {
        const asc  = [...subs].sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
        const desc = [...subs].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
        const attemptNumberOf = new Map(asc.map((s, i) => [s.id, i + 1]))
        let best = null
        for (const s of desc) {
          if (s.score == null) continue
          const sc = scaledScore(s.score, s.maxScore)
          if (best == null || sc > best) best = sc
        }
        return {
          examId, examTitle: subs[0].examTitle || 'Đề thi', examSubject: subs[0].examSubject,
          attempts: desc, attemptNumberOf, count: subs.length, best, lastAt: desc[0]?.submittedAt,
        }
      }).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
      return {
        key: c.key, className: c.className, exams,
        examCount: exams.length, attemptCount: c.subs.length, lastAt: exams[0]?.lastAt,
      }
    }).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
  }, [submissions])

  const activeClass = nav.classKey ? classGroups.find(c => c.key === nav.classKey) : null
  const activeExam   = activeClass && nav.examId ? activeClass.exams.find(e => e.examId === nav.examId) : null
  const level        = activeExam ? 'attempts' : activeClass ? 'exams' : 'classes'

  return (
    <div className="prof-page eh-tech">
      <div className="container prof-container">
        <div className="prof-section">
          <h3 className="prof-section-title">{IcClock(16)} Lịch sử làm bài</h3>

          {nav.classKey && (
            <div className="prof-hist-crumbs">
              <button className="phc-back" onClick={goBack}>{IcChevronLeft(15)} Quay lại</button>
              <div className="phc-trail">
                <button className="phc-link" onClick={() => goNav(null)}>Tất cả lớp</button>
                <span className="phc-sep">{IcChevronRight(11)}</span>
                {activeExam ? (
                  <>
                    <button className="phc-link" onClick={() => goNav(activeClass.key)}>{activeClass?.className}</button>
                    <span className="phc-sep">{IcChevronRight(11)}</span>
                    <span className="phc-current">{activeExam.examTitle}</span>
                  </>
                ) : (
                  <span className="phc-current">{activeClass?.className}</span>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <p className="prof-section-desc">Đang tải…</p>
          ) : classGroups.length === 0 ? (
            <p className="prof-section-desc">Chưa có bài làm nào. Hãy vào một đề thi để bắt đầu!</p>

          ) : level === 'classes' ? (
            <div className="prof-hist-list">
              {classGroups.map((c, i) => (
                <button key={c.key} className="prof-hist-row" style={{ animationDelay: `${i * 40}ms` }} onClick={() => goNav(c.key)}>
                  <div className="phr-icon phr-icon--class">{IcBook(18)}</div>
                  <div className="phr-body">
                    <div className="phr-title">{c.className}</div>
                    <div className="phr-meta">{c.examCount} đề · {c.attemptCount} lần làm · gần nhất {formatDtShort(c.lastAt)}</div>
                  </div>
                  <span className="hist-arrow">{IcChevronRight(16)}</span>
                </button>
              ))}
            </div>

          ) : level === 'exams' ? (
            <div className="prof-hist-list">
              {activeClass.exams.map((e, i) => (
                <button key={e.examId} className="prof-hist-row" style={{ animationDelay: `${i * 40}ms` }} onClick={() => goNav(activeClass.key, e.examId)}>
                  <div className="phr-icon phr-icon--exam">{IcFile(18)}</div>
                  <div className="phr-body">
                    <div className="phr-title">{e.examTitle}</div>
                    <div className="phr-meta">
                      {e.examSubject && <SubjectBadge subject={e.examSubject} size="sm" />}
                      {e.count} lần làm · gần nhất {formatDtShort(e.lastAt)}
                    </div>
                  </div>
                  <div className="phr-score"><ScoreTag scaled={e.best} /></div>
                  <span className="hist-arrow">{IcChevronRight(16)}</span>
                </button>
              ))}
            </div>

          ) : (
            <div className="prof-history-list">
              {activeExam.attempts.map((s, i) => {
                const pending = s.score == null
                const scaled  = pending ? null : scaledScore(s.score, s.maxScore)
                const dur     = formatDuration(s.timeSpent)
                return (
                  <a key={s.id} className="prof-history-item" style={{ animationDelay: `${i * 40}ms` }}
                     href={`#results/${s.examId}/${s.id}`} title="Xem lại bài làm">
                    <div className="phi-left">
                      <div className="phi-title">Lần {activeExam.attemptNumberOf.get(s.id)}</div>
                      <div className="phi-meta">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {IcClock(12)} {formatDt(s.submittedAt)}
                        </span>
                        {dur && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {IcClock(12)} {dur}
                          </span>
                        )}
                      </div>
                      {!pending && <ScoreBar score={scaled} total={10} />}
                    </div>
                    <div className="phi-score">
                      <ScoreTag scaled={scaled} />
                      <span className="hist-arrow">{IcChevronRight(16)}</span>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Back ── */}
        <div className="prof-back-row" style={{ gap: 10 }}>
          <button className="prof-btn prof-btn--ghost" onClick={onGoProfile}>
            {IcUser(15)} Hồ sơ cá nhân
          </button>
          <button className="prof-btn prof-btn--ghost" onClick={onGoHome}>
            {IcHome(15)} Về trang chủ
          </button>
        </div>
      </div>
    </div>
  )
}

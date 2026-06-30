import React, { useState } from 'react'

export const SECTION_PREFIXES = {
  'PHẦN I':    'I',
  'PHẦN II':   'II',
  'PHẦN III':  'III',
  'TIẾNG ANH': 'EN',
  'READING':   'RD',
}

const MC_SECTIONS = new Set(['PHẦN I', 'TIẾNG ANH', 'READING'])

/* Một bài làm (attempt) cho câu này có đúng hay không. */
function isAnswerCorrect(sec, q, ans) {
  if (MC_SECTIONS.has(sec)) {
    return !!q.answer && ans === q.answer
  }
  if (sec === 'PHẦN II') {
    const sqs = q.sub_questions || []
    return sqs.length > 0 && sqs.every(sq => ans?.[sq.label] === sq.correct_answer)
  }
  if (sec === 'PHẦN III') {
    const ua = (ans || '').toString().trim().toLowerCase()
    const ca = (q.answer || '').toString().trim().toLowerCase()
    return !!ua && !!ca && ua === ca
  }
  return false
}

/* ── Hiển thị đáp án 1 lần làm của 1 học sinh cho 1 câu ──
   - Trắc nghiệm / Tiếng Anh / Reading: chữ cái (A/B/C/D), xanh nếu đúng, đỏ nếu sai.
   - Đúng/Sai (PHẦN II): "Đ Đ S S", câu con nào sai có dấu x.
   - Trả lời ngắn (PHẦN III): nội dung học sinh nhập. */
function AnswerAttempt({ sec, q, ans }) {
  if (sec === 'PHẦN II') {
    const userAns = ans || {}
    const sqs     = q.sub_questions || []
    return (
      <span className="qs-attempt qs-attempt--tf">
        {sqs.map((sq, i) => {
          const u    = userAns[sq.label]
          const has  = u === true || u === false
          const mark = u === true ? 'Đ' : u === false ? 'S' : '·'
          const ok   = has && u === sq.correct_answer
          return (
            <span
              key={i}
              className={`qs-mark ${!has ? 'qs-blank' : ok ? 'qs-ok' : 'qs-bad'}`}
            >
              {mark}{has && !ok ? 'x' : ''}
            </span>
          )
        })}
      </span>
    )
  }

  const u  = (ans || '').toString().trim()
  const ok = isAnswerCorrect(sec, q, ans)
  return (
    <span className={`qs-attempt qs-mark ${!u ? 'qs-blank' : ok ? 'qs-ok' : 'qs-bad'}`}>
      {u || '·'}
    </span>
  )
}

/* ── Per-question statistics ──
   subs: danh sách bài làm (mỗi lần làm là một phần tử, có `answers`,
   `studentName` và tuỳ chọn `studentId`).
   Khi mở rộng một câu sẽ hiện đáp án TỪNG học sinh đã chọn. Nếu một học
   sinh làm đề nhiều lần (vd. trong lớp học), các lần làm hiện cạnh nhau:
   trắc nghiệm "A A A", đúng/sai "Đ Đ S S | Đ Đ S S". */
export default function QuestionStats({ exam, subs }) {
  const [expanded, setExpanded] = useState({})
  const [showSection, setShowSection] = useState({})

  if (!exam?.sections || !subs.length) return null

  const sectionKeys = Object.keys(exam.sections).filter(
    s => s in SECTION_PREFIXES && exam.sections[s]?.questions?.length
  )
  if (!sectionKeys.length) return null

  const buildStats = (sec) => {
    const questions = exam.sections[sec]?.questions || []
    const prefix    = SECTION_PREFIXES[sec]

    // Gộp các lần làm theo học sinh (giữ thứ tự thời gian).
    const studentMap = new Map()   // id → { name, attempts: [sub,...] }
    subs.forEach(sub => {
      const name = sub.studentName || 'Ẩn danh'
      const id   = String(sub.studentId ?? name)
      if (!studentMap.has(id)) studentMap.set(id, { name, attempts: [] })
      studentMap.get(id).attempts.push(sub)
    })
    studentMap.forEach(v =>
      v.attempts.sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
    )
    const students = [...studentMap.values()]

    return questions.map(q => {
      const key        = `${prefix}_${q.question_number}`
      let correctCount = 0
      let wrongCount   = 0

      subs.forEach(sub => {
        if (isAnswerCorrect(sec, q, sub.answers?.[key])) correctCount++
        else wrongCount++
      })

      return { num: q.question_number, key, q, sec, correctCount, wrongCount, total: subs.length, students }
    })
  }

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))
  const toggleSec = (sec) => setShowSection(p => ({ ...p, [sec]: !p[sec] }))

  return (
    <div className="er-qstats">
      <h3 className="er-qstats-title">📋 Thống kê chi tiết theo câu</h3>
      {sectionKeys.map(sec => {
        const stats   = buildStats(sec)
        const isOpen  = showSection[sec] !== false
        return (
          <div key={sec} className="er-qstats-section">
            <button className="er-qstats-sec-header" onClick={() => toggleSec(sec)}>
              <span>{sec}</span>
              <span className="er-qstats-sec-count">{stats.length} câu</span>
              <span className="er-qstats-sec-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="er-qstats-body">
                {stats.map(s => {
                  const pct   = s.total > 0 ? Math.round(s.correctCount / s.total * 100) : 0
                  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
                  const isExp = expanded[s.key]
                  return (
                    <div key={s.key} className="er-qstat-row">
                      <div className="er-qstat-main">
                        <span className="er-qstat-num">Câu {s.num}</span>
                        <div className="er-qstat-bar-track">
                          <div className="er-qstat-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="er-qstat-fraction" style={{ color }}>
                          {s.correctCount}/{s.total}
                        </span>
                        <span className="er-qstat-pct" style={{ color }}>({pct}%)</span>
                        <button className="er-qstat-toggle qs-toggle-ans" onClick={() => toggle(s.key)}>
                          {isExp ? '▲' : '▼'} Đáp án
                          {s.wrongCount > 0 && <span className="qs-toggle-wrong"> · {s.wrongCount} sai</span>}
                        </button>
                      </div>
                      {isExp && (
                        <div className="qs-ans-list">
                          {s.students.map((st, i) => (
                            <div key={i} className="qs-ans-row">
                              <span className="qs-ans-name">{st.name}</span>
                              <span className="qs-ans-sep">:</span>
                              <span className="qs-ans-vals">
                                {st.attempts.map((att, j) => (
                                  <React.Fragment key={j}>
                                    {j > 0 && (
                                      <span className="qs-attempt-sep">
                                        {s.sec === 'PHẦN II' ? '|' : ''}
                                      </span>
                                    )}
                                    <AnswerAttempt sec={s.sec} q={s.q} ans={att.answers?.[s.key]} />
                                  </React.Fragment>
                                ))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

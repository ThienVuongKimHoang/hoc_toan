import React, { useState } from 'react'

export const SECTION_PREFIXES = {
  'PHẦN I':    'I',
  'PHẦN II':   'II',
  'PHẦN III':  'III',
  'TIẾNG ANH': 'EN',
  'READING':   'RD',
}

/* ── Per-question statistics ──
   subs: danh sách bài làm (mỗi lần làm là một phần tử, có `answers`,
   `studentName` và tuỳ chọn `studentId`).
   Nếu một học sinh làm sai cùng một câu nhiều lần (vd. bài tập làm 3 lần)
   thì gộp lại thành "Nguyễn Văn A ×3". */
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
    return questions.map(q => {
      const key          = `${prefix}_${q.question_number}`
      let correctCount   = 0
      const wrongMap     = new Map()   // studentId|name → { name, count }

      subs.forEach(sub => {
        const ans = sub.answers?.[key]
        let ok = false
        if (sec === 'PHẦN I' || sec === 'TIẾNG ANH' || sec === 'READING') {
          ok = q.answer && ans === q.answer
        } else if (sec === 'PHẦN II') {
          const sqs = q.sub_questions || []
          ok = sqs.length > 0 && sqs.every(sq => ans?.[sq.label] === sq.correct_answer)
        } else if (sec === 'PHẦN III') {
          const ua = (ans || '').toString().trim().toLowerCase()
          const ca = (q.answer || '').toString().trim().toLowerCase()
          ok = !!ua && !!ca && ua === ca
        }
        if (ok) correctCount++
        else {
          const name = sub.studentName || 'Ẩn danh'
          const id   = String(sub.studentId ?? name)
          const cur  = wrongMap.get(id) || { name, count: 0 }
          cur.count++
          wrongMap.set(id, cur)
        }
      })

      const wrongStudents = [...wrongMap.values()].sort((a, b) => b.count - a.count)
      const wrongCount    = subs.length - correctCount
      return { num: q.question_number, key, correctCount, total: subs.length, wrongStudents, wrongCount }
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
                        {s.wrongStudents.length > 0 && (
                          <button className="er-qstat-toggle" onClick={() => toggle(s.key)}>
                            {isExp ? '▲' : '▼'} {s.wrongCount} sai
                          </button>
                        )}
                        {s.wrongStudents.length === 0 && (
                          <span className="er-qstat-all-correct">✓ Tất cả đúng</span>
                        )}
                      </div>
                      {isExp && s.wrongStudents.length > 0 && (
                        <div className="er-qstat-wrong-wrap">
                          <span className="er-qstat-wrong-label">Trả lời sai:</span>
                          <div className="er-qstat-wrong-names">
                            {s.wrongStudents.map((w, i) => (
                              <span key={i} className="er-qstat-wrong-chip">
                                {w.name}{w.count > 1 ? ` ×${w.count}` : ''}
                              </span>
                            ))}
                          </div>
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

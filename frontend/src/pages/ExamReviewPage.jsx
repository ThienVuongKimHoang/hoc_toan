import React, { useEffect, useState } from 'react'
import { fetchSubmissionReview, scaledScore } from '../store/examStore.js'
import QuestionCard from '../components/QuestionCard.jsx'
import ReadingTakeView from '../components/ReadingTakeView.jsx'
import { reorderByQuestionNumber } from '../utils/shuffle.js'

const SECTION_LABELS = {
  'PHẦN I':    { label: 'Phần I – Trắc nghiệm',    color: '#2563eb' },
  'PHẦN II':   { label: 'Phần II – Đúng / Sai',     color: '#7c3aed' },
  'PHẦN III':  { label: 'Phần III – Trả lời ngắn',  color: '#059669' },
  'TỰ LUẬN':   { label: 'Tự luận',                  color: '#d97706' },
  'TIẾNG ANH': { label: 'Tiếng Anh – Trắc nghiệm', color: '#0f766e' },
  'READING':   { label: 'Reading – Bài đọc',       color: '#0e7490' },
}

function getSectionList(exam) {
  return Object.keys(exam?.sections || {}).filter(
    s => s in SECTION_LABELS && (exam.sections[s]?.questions?.length ?? 0) > 0
  )
}

const formatDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const formatDuration = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m > 0 ? `${m} phút ${s} giây` : `${s} giây`
}

/* ── Trang xem lại một bài đã làm: đề + đáp án đã chọn + đáp án đúng + điểm ── */
export default function ExamReviewPage({ examId, subId, onGoHome }) {
  const [state, setState]           = useState('loading')  // loading | error | hidden | ready
  const [errMsg, setErrMsg]         = useState('')
  const [exam, setExam]             = useState(null)
  const [submission, setSubmission] = useState(null)
  const [activeSection, setActiveSection] = useState(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetchSubmissionReview(examId, subId)
      .then(res => {
        if (!alive) return
        if (!res.revealed) { setState('hidden'); return }
        setExam(res.exam)
        setSubmission(res.submission)
        setActiveSection(getSectionList(res.exam)[0] || null)
        setState('ready')
      })
      .catch(e => { if (alive) { setErrMsg(e.message || 'Không thể xem lại bài làm'); setState('error') } })
    return () => { alive = false }
  }, [examId, subId])

  if (state === 'loading') return (
    <div className="et-exam review-status-screen">
      <p>Đang tải bài làm…</p>
    </div>
  )

  if (state === 'error') return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">⚠️</div>
        <h1 className="etl-title">Không thể xem lại bài làm</h1>
        <p className="review-status-desc">{errMsg}</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )

  if (state === 'hidden') return (
    <div className="et-locked">
      <div className="etl-card">
        <div className="etl-icon">⏳</div>
        <h1 className="etl-title">Kết quả chưa được công bố</h1>
        <p className="review-status-desc">Giáo viên chưa công bố đáp án/điểm cho đề này. Quay lại sau nhé.</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onGoHome}>← Trang chủ</button>
      </div>
    </div>
  )

  const sectionList = getSectionList(exam)
  const curSection  = activeSection || sectionList[0] || null
  const rawQuestions = curSection ? (exam.sections?.[curSection]?.questions ?? []) : []
  // Đề bật "Trộn thứ tự": server đã lưu lại đúng bản đồ trộn học sinh thấy lúc làm bài
  // (submission.shuffleMap, xem ExamTakePage) — dùng lại ở đây để "Câu 1, 2, 3…" và thứ
  // tự A/B/C/D khi xem lại KHỚP với lúc làm, tránh học sinh tưởng nhầm câu/đáp án.
  const shuffleMap = submission.shuffleMap || null
  const questions  = reorderByQuestionNumber(rawQuestions, shuffleMap?.sections?.[curSection])
  const scrollTop   = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const essayMax    = (exam.sections?.['TỰ LUẬN']?.questions || []).reduce((s, q) => s + (Number(q.points) || 0), 0)
  const hasEssay    = sectionList.includes('TỰ LUẬN')
  const essayGraded = hasEssay && submission.manualScores && Object.keys(submission.manualScores).length > 0
  // Điểm hiển thị luôn tính trên TỔNG điểm toàn đề (kể cả tự luận, dù chưa chấm — phần
  // đó tạm là 0đ cho đến khi giáo viên chấm) để khớp với điểm giáo viên thấy, tránh
  // cùng một bài mà 2 màn hình ra 2 điểm khác nhau.
  const pendingEssay  = hasEssay && essayMax > 0 && !essayGraded

  return (
    <div className="et-exam">
      <div className="et-sticky-top">
        <div className="et-info-bar">
          <div className="et-info-left">
            <span className="et-info-title">📄 {exam.title}</span>
          </div>
          <div className="et-meta-right">
            <span className="review-submitted-at">Nộp lúc {formatDt(submission.submittedAt)}</span>
            <button className="mec-btn" onClick={onGoHome}>← Trang chủ</button>
          </div>
        </div>
      </div>

      <div className="app" style={{ paddingTop: 16 }}>
        <div className="review-score-card">
          <div className="review-score-num">
            {scaledScore(submission.score, submission.maxScore)}<span>/10</span>
          </div>
          <div className="review-score-meta">
            <span>{submission.score}/{submission.maxScore} điểm</span>
            <span>⏱ {formatDuration(submission.timeSpent)}</span>
            {submission.className && <span>🏫 {submission.className}</span>}
          </div>
          {pendingEssay && (
            <p className="review-essay-pending">
              ✍️ Phần tự luận đang chờ giáo viên chấm — điểm trên đã tính trên tổng điểm toàn đề (0đ cho phần tự luận cho đến khi được chấm).
            </p>
          )}
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

        <div className="question-list">
          {questions.length === 0 ? (
            <p className="empty-msg">Không có câu hỏi nào trong phần này.</p>
          ) : curSection === 'READING' ? (
            <ReadingTakeView questions={questions} examMode={false} savedAnswers={submission.answers} />
          ) : (
            questions.map((q, i) => (
              <QuestionCard
                key={`${q.section}-${q.question_number}-${i}`}
                q={q} index={i} displayNumber={i + 1} examMode={false} readOnly
                answers={submission.answers}
                choiceOrders={shuffleMap?.choices}
                shuffleChoices={!!shuffleMap}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

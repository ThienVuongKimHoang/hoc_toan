import { SECTION_PREFIX } from '../components/QuestionCard.jsx'

/* ── Trộn thứ tự câu hỏi & đáp án trắc nghiệm khi học sinh làm bài ──
   Kết quả được tính 1 lần/lượt làm bài rồi lưu nguyên vào localStorage
   (không phải seed) — xem ExamTakePage.jsx (attemptKey/saveAttempt). */

export function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Phần có đáp án trắc nghiệm (choices A-D) — READING loại khỏi phạm vi vì
// câu hỏi nhóm theo đoạn văn và ReadingTakeView render nhãn A-D riêng.
const MC_SECTIONS = ['PHẦN I', 'TIẾNG ANH']

export function buildShuffleMap(exam) {
  const sections = {}
  const choices = {}
  for (const [sec, data] of Object.entries(exam?.sections || {})) {
    if (sec === 'READING') continue
    const qs = data?.questions || []
    if (qs.length > 1) {
      sections[sec] = shuffleArray(qs.map(q => q.question_number))
    }
    if (MC_SECTIONS.includes(sec)) {
      const prefix = SECTION_PREFIX[sec] || 'I'
      for (const q of qs) {
        const keys = Object.keys(q.choices || {})
        if (keys.length > 1) {
          choices[`${prefix}_${q.question_number}`] = shuffleArray(keys)
        }
      }
    }
  }
  return { sections, choices }
}

// Sắp `questions` theo `order` (mảng question_number). Bỏ qua số không còn
// tồn tại, và nối thêm ở cuối các câu hiện có mà `order` không liệt kê
// (phòng trường hợp giáo viên sửa đề giữa lúc học sinh đang làm bài).
export function reorderByQuestionNumber(questions, order) {
  if (!order || !order.length) return questions
  const byNum = new Map(questions.map(q => [q.question_number, q]))
  const seen = new Set()
  const out = []
  for (const num of order) {
    const q = byNum.get(num)
    if (q && !seen.has(num)) { out.push(q); seen.add(num) }
  }
  for (const q of questions) {
    if (!seen.has(q.question_number)) out.push(q)
  }
  return out
}

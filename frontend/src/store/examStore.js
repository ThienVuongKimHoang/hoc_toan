import { authHeaders } from '../auth/mockUsers.js'

/* Store này TỪNG cache toàn bộ đề thi vào localStorage['hoctoan_exams'].
   Cache đó đã được bỏ hẳn vì hai lý do:
     1. Một đề kèm ảnh base64 nặng vài MB, localStorage chỉ ~5 MB/origin → tràn
        quota và setItem ném QuotaExceededError.
     2. Đọc cache trước server khiến giáo viên sửa đề xong vẫn thấy bản cũ.
   Server là nguồn thật duy nhất. main.jsx xoá nốt key cũ trên máy người dùng. */

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export function deleteExam(id, teacherId) {
  // trả promise để caller chờ server xóa xong rồi mới reload danh sách từ DB
  return fetch(`/api/exams/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
}

/** Đề thi do giáo viên đang đăng nhập tạo (metadata, không kèm sections). */
export async function fetchMyExams() {
  try {
    const res = await fetch('/api/my-exams', { headers: authHeaders() })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

/** Đề thi thuộc MỘT LỚP cụ thể, lấy từ server — dùng cho tab "Đề thi" trong lớp
    và dropdown "Giao đề thi". teacherId phải là giáo viên (chính/co-teacher) của lớp. */
export async function fetchExamsByClass(classId, teacherId) {
  try {
    const res = await fetch(`/api/classes/${classId}/exams?teacherId=${encodeURIComponent(teacherId || '')}`, { headers: authHeaders() })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

/** Tạo đề thi mới từ kết quả extraction — luôn gắn với một lớp cụ thể (classId). */
export function createExam({ title, result, userId, classId, subject = 'toan', grade = null }) {
  const id = genId()
  const exam = {
    id,
    title,
    createdBy:      userId,
    classId:        classId || null,
    subject,
    grade,
    createdAt:      new Date().toISOString(),
    source:         result.source,
    totalQuestions: result.total_questions,
    sections:       result.sections,
    published:      false,
    settings:       null,
  }
  return exam
}

/** Cập nhật đề thi đã tồn tại (sau khi edit).
 *  Nhận nguyên object đề đang sửa thay vì tra theo id: trước đây hàm này đọc
 *  localStorage nên sửa đề trên MÁY KHÁC (cache trống) sẽ trả null và mất bài sửa. */
export function updateExam(exam, { title, result, grade }) {
  if (!exam) return null
  const updated = {
    ...exam,
    title,
    grade:          grade !== undefined ? grade : exam.grade,
    source:         result.source,
    totalQuestions: result.total_questions,
    sections:       result.sections,
    updatedAt:      new Date().toISOString(),
  }
  return updated
}

/** Phát đề — lưu settings, đánh dấu published, đồng bộ lên server. */
export async function publishExam(examId, settings, teacherId) {
  const exam = await fetchExamById(examId)
  if (!exam) return null
  const updated = {
    ...exam,
    published: true,
    settings: {
      duration:    settings.duration,
      openTime:    settings.openTime,
      closeTime:   settings.closeTime,
      password:    settings.password || null,
      // hideResults là cờ CŨ, nay suy ra từ cấu hình hiển thị (điểm không hiện ngay
      // sau khi nộp = ẩn kết quả) — giữ lại cho dữ liệu/màn hình cũ còn đọc nó.
      hideResults: settings.showScoreType !== SHOW.AFTER_SUBMIT,
      lockScreen:  settings.lockScreen || false,
      shuffleQuestions: settings.shuffleQuestions || false,
    },
    showScoreType:  settings.showScoreType,
    showAnswerType: settings.showAnswerType,
    answerMinScore: settings.answerMinScore ?? null,
    resultsRevealed: settings.resultsRevealed ?? exam.resultsRevealed ?? false,
    classes: settings.classes || exam.classes || [],
  }
  try {
    await fetch(`/api/exams/${examId}`, {
      method:  'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body:    JSON.stringify({ ...updated, teacherId }),
    })
  } catch (e) {
    console.warn('Không thể lưu đề thi lên server:', e)
  }
  return updated
}

/** Trạng thái đề thi so với thời điểm hiện tại */
export function examStatus(exam) {
  if (!exam?.published || !exam?.settings) return 'draft'
  const now   = Date.now()
  const open  = new Date(exam.settings.openTime).getTime()
  const close = new Date(exam.settings.closeTime).getTime()
  if (now < open)  return 'pending'
  if (now > close) return 'expired'
  return 'open'
}

/** URL chia sẻ trực tiếp */
export function shareUrl(examId) {
  return `${window.location.origin}${window.location.pathname}#take/${examId}`
}

/** URL chia sẻ qua sảnh chờ (học sinh nhập mã đề) */
export function lobbyUrl(examId) {
  return `${window.location.origin}${window.location.pathname}#lobby/${examId}`
}

/** URL chia sẻ theo lớp */
export function classShareUrl(examId, classId) {
  return `${window.location.origin}${window.location.pathname}#take/${examId}/${classId}`
}

/** Tải đề thi. Truyền teacherId khi giáo viên cần xem/sửa đề (kèm đáp án đúng) —
 * không truyền thì server tự ẩn đáp án (học sinh làm bài thật).
 * Luôn đi thẳng server: đề là dữ liệu vừa nặng vừa hay đổi (thang điểm, đáp án),
 * cache lại chỉ sinh ra bản cũ chấm lệch thang. */
export async function fetchExamById(id, teacherId) {
  try {
    const qs = teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : ''
    const res = await fetch(`/api/exams/${id}${qs}`, { headers: authHeaders() })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Học sinh nộp bài */
/** Xác nhận bắt đầu một lượt làm bài — server kiểm tra thành viên lớp / giờ mở /
 *  số lượt còn lại rồi cấp "vé". Màn hình làm bài chỉ mở khi có vé này, nên chỉ
 *  dán URL #take/... hay bấm Back về history cũ sẽ không vào thẳng được đề. */
export async function startAttempt(examId, { classId, assignmentId } = {}) {
  const res = await fetch(`/api/exams/${examId}/attempt-start`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify({ classId: classId || null, assignmentId: assignmentId || null }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Không vào được đề thi.')
  return data
}

export async function submitResult(examId, { studentName, studentId, answers, score, maxScore, className, classId, assignmentId, startedAt, timeSpent, violationCount, shuffleMap, ticket }) {
  const body = {
    studentName,
    studentId,
    answers,
    score,
    maxScore,
    className: className || null,
    classId:   classId   || null,
    assignmentId: assignmentId || null,   // lần giao bài (khi cùng đề giao nhiều lần)
    submittedAt: new Date().toISOString(),
    startedAt: startedAt || null,
    timeSpent: timeSpent ?? null,   // giây làm bài
    violationCount: violationCount ?? null,   // số lần vi phạm khóa màn hình
    // Đề bật "Trộn thứ tự": gửi kèm bản đồ trộn để server lưu lại, dùng khi học sinh
    // xem lại bài làm (khớp đúng thứ tự/nhãn câu đã thấy lúc làm, xem ExamReviewPage).
    shuffleMap: shuffleMap || null,
    ticket: ticket || null,   // vé của lượt làm này (tiêu khi nộp)
  }
  const res = await fetch(`/api/exams/${examId}/submit`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = 'Nộp bài thất bại'
    try { const e = await res.json(); if (e?.error) msg = e.error } catch {}
    throw new Error(msg)
  }
  return res.json()
}

/** Giáo viên lấy danh sách bài nộp */
export async function getSubmissions(examId, teacherId) {
  const res = await fetch(`/api/exams/${examId}/submissions?teacherId=${encodeURIComponent(teacherId || '')}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Không thể lấy kết quả')
  return res.json()
}

/** Học sinh lấy lịch sử làm bài của chính mình (mọi đề đã nộp) */
export async function fetchMySubmissions(studentId) {
  const res = await fetch(`/api/students/${studentId}/submissions`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Không thể lấy lịch sử làm bài')
  return res.json()
}

/** Xem lại chi tiết một bài đã làm: đề + đáp án đã chọn + đáp án đúng + điểm */
export async function fetchSubmissionReview(examId, subId) {
  const res = await fetch(`/api/exams/${examId}/submissions/${subId}/review`, { headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Không thể xem lại bài làm')
  }
  return res.json()
}

/** Giáo viên chấm tay câu tự luận cho một bài nộp.
 *  manualScores   = { TL_1: 1.5, ... }
 *  manualComments = { TL_1: "nhận xét", ... } — bỏ qua thì server GIỮ NGUYÊN nhận xét
 *  đã lưu; truyền vào thì ghi đè nguyên cụm, nên phải gửi đủ mọi câu chứ không chỉ
 *  câu vừa sửa. */
export async function gradeSubmission(examId, subId, manualScores, teacherId, manualComments) {
  const res = await fetch(`/api/exams/${examId}/submissions/${subId}/grade`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify({
      manualScores, teacherId,
      ...(manualComments ? { manualComments } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Không thể lưu điểm chấm')
  }
  return res.json()
}

/** Giáo viên xóa TẤT CẢ bài làm của một học sinh (mọi lần làm) cho đề này */
export async function deleteStudentSubmissions(examId, studentId, classId = null, assignmentId = null, teacherId = null) {
  const res = await fetch(`/api/exams/${examId}/submissions/delete-student`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify({ studentId, classId, assignmentId, teacherId }),
  })
  if (!res.ok) throw new Error('Không thể xóa bài làm của học sinh')
  return res.json()
}

/* ═══════════════════════════════════════════
   Cài đặt hiển thị (Điểm & Đáp án)
   Cùng một thang giá trị cho cả điểm lẫn đáp án — xem database.py / api.py.
═══════════════════════════════════════════ */
export const SHOW = {
  NEVER:        0,   // không cho học sinh xem
  AFTER_SUBMIT: 1,   // ngay sau khi nộp bài
  AFTER_CLOSE:  2,   // sau khi hết hạn / đóng đề
  MANUAL:       3,   // khi giáo viên chủ động công bố
}

/** Nhãn ngắn cho một mốc hiển thị (dùng ở chip trạng thái trên thẻ bài tập) */
export function showTypeLabel(type) {
  return {
    [SHOW.NEVER]:        'Không cho xem',
    [SHOW.AFTER_SUBMIT]: 'Ngay sau khi nộp',
    [SHOW.AFTER_CLOSE]:  'Sau khi đóng đề',
    [SHOW.MANUAL]:       'Khi GV công bố',
  }[type] ?? 'Ngay sau khi nộp'
}

/** Giáo viên đọc cấu hình hiển thị hiện tại của đề */
export async function fetchDisplaySettings(examId) {
  const res = await fetch(`/api/exams/${examId}/display-settings`, { headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Không tải được cài đặt hiển thị')
  }
  return res.json()
}

/** Giáo viên lưu cấu hình hiển thị điểm/đáp án */
export async function saveDisplaySettings(examId, cfg) {
  const res = await fetch(`/api/exams/${examId}/display-settings`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify(cfg),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Lưu cài đặt hiển thị thất bại')
  }
  return res.json()
}

/** Giáo viên công bố kết quả */
export async function revealResults(examId, teacherId) {
  const res = await fetch(`/api/exams/${examId}/reveal?teacherId=${encodeURIComponent(teacherId || '')}`, { method: 'POST', headers: authHeaders() })
  if (!res.ok) throw new Error('Không thể công bố kết quả')
  return res.json()
}

/** Giáo viên ẩn kết quả */
export async function hideResultsToggle(examId, teacherId) {
  const res = await fetch(`/api/exams/${examId}/hide-results?teacherId=${encodeURIComponent(teacherId || '')}`, { method: 'POST', headers: authHeaders() })
  if (!res.ok) throw new Error('Không thể ẩn kết quả')
  return res.json()
}

/** Bật/tắt chế độ công khai đề thi */
export async function setExamPublic(examId, isPublic, teacherId) {
  const res = await fetch(`/api/exams/${examId}/toggle-public`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify({ isPublic, teacherId }),
  })
  if (!res.ok) throw new Error('Thao tác thất bại')
  return res.json()
}

/** Lấy danh sách đề thi công khai */
export async function fetchPublicExams() {
  const res = await fetch('/api/public-exams')
  if (!res.ok) return []
  return res.json()
}

/** Giáo viên lưu cài đặt chế độ luyện tập */
export async function savePracticeSettings(examId, settings, teacherId) {
  const res = await fetch(`/api/exams/${examId}/practice-settings`, {
    method:  'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body:    JSON.stringify({ ...settings, teacherId }),
  })
  if (!res.ok) throw new Error('Lưu cài đặt luyện tập thất bại')
  return res.json()
}

/** Lấy thông tin luyện tập (public, không có mật khẩu) */
export async function getPracticeInfo(examId) {
  const res = await fetch(`/api/exams/${examId}/practice-info`)
  if (!res.ok) return null
  return res.json()
}

/** Xác minh mật khẩu luyện tập */
export async function verifyPracticePassword(examId, password) {
  const res = await fetch(`/api/exams/${examId}/practice-verify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ password }),
  })
  if (res.status === 401) return false
  return res.ok
}

/** Xác minh mật khẩu thoát khóa màn hình (kiểm tra ở server) */
export async function verifyLockEscape(password) {
  try {
    const res = await fetch('/api/lock/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** URL chia sẻ chế độ luyện tập */
export function practiceShareUrl(examId) {
  return `${window.location.origin}${window.location.pathname}#practice/${examId}`
}

/** Tính điểm từ answers + exam data */
export function calcScore(exam, answers) {
  let score = 0
  const secs = exam.sections || {}

  // PHẦN I — trắc nghiệm (key: I_N)
  const p1 = secs['PHẦN I']
  if (p1) {
    const ppq = p1.points_per_q || 0.25
    ;(p1.questions || []).forEach(q => {
      if (answers[`I_${q.question_number}`] === q.answer) score += ppq
    })
  }

  // PHẦN II — đúng/sai (key: II_N)
  const p2 = secs['PHẦN II']
  if (p2) {
    const ppq = p2.points_per_q || 1.0
    ;(p2.questions || []).forEach(q => {
      const userAns = answers[`II_${q.question_number}`] || {}
      const subs    = q.sub_questions || []
      const nRight  = subs.filter(s => userAns[s.label] === s.correct_answer).length
      const total   = subs.length
      let pts = 0
      if (nRight === total)          pts = ppq
      else if (nRight === total - 1) pts = ppq * 0.5
      else if (nRight === total - 2) pts = ppq * 0.25
      else if (nRight === total - 3) pts = ppq * 0.1
      score += pts
    })
  }

  // PHẦN III — trả lời ngắn (key: III_N)
  const p3 = secs['PHẦN III']
  if (p3) {
    const ppq = p3.points_per_q || 0.5
    ;(p3.questions || []).forEach(q => {
      const userAns = (answers[`III_${q.question_number}`] || '').trim().toLowerCase()
      const correct = (q.answer || '').toString().trim().toLowerCase()
      if (userAns && correct && userAns === correct) score += ppq
    })
  }

  // TIẾNG ANH — trắc nghiệm (key: EN_N)
  const en = secs['TIẾNG ANH']
  if (en) {
    const ppq = en.points_per_q || 0.25
    ;(en.questions || []).forEach(q => {
      if (q.answer && answers[`EN_${q.question_number}`] === q.answer) score += ppq
    })
  }

  // READING — trắc nghiệm bài đọc (key: RD_N)
  const rd = secs['READING']
  if (rd) {
    const ppq = rd.points_per_q || 0.25
    ;(rd.questions || []).forEach(q => {
      if (q.answer && answers[`RD_${q.question_number}`] === q.answer) score += ppq
    })
  }

  return Math.round(score * 100) / 100
}

export function calcMaxScore(exam) {
  const secs = exam.sections || {}
  let max = 0

  const p1 = secs['PHẦN I']
  if (p1) max += (p1.questions || []).length * (p1.points_per_q || 0.25)

  const p2 = secs['PHẦN II']
  if (p2) max += (p2.questions || []).length * (p2.points_per_q || 1.0)

  const p3 = secs['PHẦN III']
  if (p3) max += (p3.questions || []).length * (p3.points_per_q || 0.5)

  // Chỉ tính điểm tối đa từ câu có đáp án
  const en = secs['TIẾNG ANH']
  if (en) {
    const ppq = en.points_per_q || 0.25
    const answered = (en.questions || []).filter(q => q.answer)
    max += answered.length * ppq
  }

  const rd = secs['READING']
  if (rd) {
    const ppq = rd.points_per_q || 0.25
    const answered = (rd.questions || []).filter(q => q.answer)
    max += answered.length * ppq
  }

  // TỰ LUẬN — điểm tối đa = tổng điểm GV đặt cho từng câu (chấm tay, không tự động)
  const tl = secs['TỰ LUẬN']
  if (tl) {
    ;(tl.questions || []).forEach(q => { max += Number(q.points) || 0 })
  }

  return Math.round(max * 100) / 100
}

/**
 * Quy đổi điểm về thang 10.
 * Nếu số câu không đủ để tổng điểm = 10, ta tính theo %
 * (điểm đạt được / tổng điểm) rồi nhân hệ số 10.
 * Khi maxScore không hợp lệ → trả về điểm gốc.
 */
export function scaledScore(score, maxScore) {
  const s = score ?? 0
  if (!maxScore || maxScore <= 0) return Math.round(s * 100) / 100
  return Math.round((s / maxScore) * 10 * 100) / 100
}

const KEY = 'hoctoan_exams'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export function getAllExams() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] }
  catch { return [] }
}

export function getExamById(id) {
  return getAllExams().find(e => e.id === id) || null
}

function persist(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function saveExam(exam) {
  const list = getAllExams()
  const idx  = list.findIndex(e => e.id === exam.id)
  if (idx >= 0) list[idx] = exam
  else list.push(exam)
  persist(list)
  return exam
}

export function deleteExam(id) {
  persist(getAllExams().filter(e => e.id !== id))
  // trả promise để caller chờ server xóa xong rồi mới reload danh sách từ DB
  return fetch(`/api/exams/${id}`, { method: 'DELETE' }).catch(() => {})
}

export function getExamsByTeacher(userId) {
  // So sánh lỏng theo chuỗi: createdBy có thể là số (dữ liệu cũ) hoặc chuỗi (server)
  return getAllExams().filter(e => String(e.createdBy) === String(userId))
}

/** Đề thi của giáo viên lấy từ SERVER (metadata), gộp với cache localStorage.
    Dùng cho modal giao đề trong lớp — đề vẫn hiện đủ khi đổi trình duyệt/máy. */
export async function fetchExamsByTeacher(userId) {
  const local = getExamsByTeacher(userId)
  try {
    const res = await fetch(`/api/my-exams?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return local
    const server = await res.json()
    const byId = new Map(local.map(e => [e.id, e]))
    for (const e of server) byId.set(e.id, { ...byId.get(e.id), ...e })
    return [...byId.values()]
  } catch {
    return local
  }
}

/** Tạo đề thi mới từ kết quả extraction */
export function createExam({ title, result, userId, subject = 'toan', grade = null }) {
  const id = genId()
  const exam = {
    id,
    title,
    createdBy:      userId,
    subject,
    grade,
    createdAt:      new Date().toISOString(),
    source:         result.source,
    totalQuestions: result.total_questions,
    sections:       result.sections,
    published:      false,
    settings:       null,
  }
  saveExam(exam)
  return exam
}

/** Cập nhật đề thi đã tồn tại (sau khi edit) */
export function updateExam(examId, { title, result, grade }) {
  const exam = getExamById(examId)
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
  saveExam(updated)
  return updated
}

/** Phát đề — lưu settings, đánh dấu published, đồng bộ lên server.
    Lấy đề từ localStorage, nếu trình duyệt này không có thì tải từ server
    (để "Phát đề / Cài đặt" vẫn dùng được trên máy khác). */
export async function publishExam(examId, settings) {
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
      hideResults: settings.hideResults || false,
      lockScreen:  settings.lockScreen || false,
    },
    classes: settings.classes || exam.classes || [],
  }
  saveExam(updated)
  try {
    await fetch(`/api/exams/${examId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updated),
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

/** Tải đề thi: ưu tiên localStorage, nếu không có thì fetch từ server */
export async function fetchExamById(id) {
  const local = getExamById(id)
  if (local) return local
  try {
    const res = await fetch(`/api/exams/${id}`)
    if (!res.ok) return null
    const exam = await res.json()
    saveExam(exam)
    return exam
  } catch {
    return null
  }
}

/** Học sinh nộp bài */
export async function submitResult(examId, { studentName, studentId, answers, score, maxScore, className, classId, assignmentId, startedAt, timeSpent, violationCount }) {
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
  }
  const res = await fetch(`/api/exams/${examId}/submit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
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
export async function getSubmissions(examId) {
  const res = await fetch(`/api/exams/${examId}/submissions`)
  if (!res.ok) throw new Error('Không thể lấy kết quả')
  return res.json()
}

/** Giáo viên chấm tay câu tự luận cho một bài nộp. manualScores = { TL_1: 1.5, ... } */
export async function gradeSubmission(examId, subId, manualScores) {
  const res = await fetch(`/api/exams/${examId}/submissions/${subId}/grade`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ manualScores }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Không thể lưu điểm chấm')
  }
  return res.json()
}

/** Giáo viên xóa MỘT bài nộp (một lần làm) theo id — dùng cho link công khai */
export async function deleteSubmission(examId, subId) {
  const res = await fetch(`/api/exams/${examId}/submissions/${subId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Không thể xóa bài nộp')
  return res.json()
}

/** Giáo viên xóa TẤT CẢ bài làm của một học sinh (mọi lần làm) cho đề này */
export async function deleteStudentSubmissions(examId, studentId, classId = null, assignmentId = null) {
  const res = await fetch(`/api/exams/${examId}/submissions/delete-student`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ studentId, classId, assignmentId }),
  })
  if (!res.ok) throw new Error('Không thể xóa bài làm của học sinh')
  return res.json()
}

/** Giáo viên công bố kết quả */
export async function revealResults(examId) {
  const res = await fetch(`/api/exams/${examId}/reveal`, { method: 'POST' })
  if (!res.ok) throw new Error('Không thể công bố kết quả')
  return res.json()
}

/** Giáo viên ẩn kết quả */
export async function hideResultsToggle(examId) {
  const res = await fetch(`/api/exams/${examId}/hide-results`, { method: 'POST' })
  if (!res.ok) throw new Error('Không thể ẩn kết quả')
  return res.json()
}

/** Bật/tắt chế độ công khai đề thi */
export async function setExamPublic(examId, isPublic) {
  const exam = getExamById(examId)
  if (exam) saveExam({ ...exam, isPublic })
  const res = await fetch(`/api/exams/${examId}/toggle-public`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ isPublic }),
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
export async function savePracticeSettings(examId, settings) {
  const exam = getExamById(examId)
  if (exam) saveExam({ ...exam, practiceSettings: settings })
  const res = await fetch(`/api/exams/${examId}/practice-settings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(settings),
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
      else if (nRight === total - 2) pts = ppq * 0.2
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

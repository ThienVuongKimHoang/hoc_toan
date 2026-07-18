const API = '/api/classes'
const REG_KEY = 'hoctoan_registered_users'

export async function getClassesByTeacher(teacherId) {
  const res = await fetch(`${API}?teacherId=${teacherId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getClassesByStudent(studentId, email) {
  const qs = new URLSearchParams({ studentId: String(studentId) })
  if (email) qs.set('email', email)
  const res = await fetch(`${API}?${qs}`)
  if (!res.ok) return []
  return res.json()
}

export async function getClassById(classId) {
  const res = await fetch(`${API}/${classId}`)
  if (!res.ok) return null
  return res.json()
}

export async function createClass({ name, description, grade, subject, teacherId, teacherName, joinPassword }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, description,
      grade: grade || null,
      subject: subject || null,           // mỗi lớp = 1 môn
      teacherId, teacherName: teacherName || '',
      joinPassword: joinPassword || null,
      createdAt: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error('Tạo lớp thất bại')
  return res.json()
}

export async function updateClassInfo(classId, updates) {
  const res = await fetch(`${API}/${classId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Cập nhật thất bại')
  return res.json()
}

export async function deleteClass(classId) {
  const res = await fetch(`${API}/${classId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Xóa lớp thất bại')
  return res.json()
}

/** Xem sơ bộ lớp theo mã (tên/khối/môn) trước khi tham gia. */
export async function getClassByCode(code) {
  const res = await fetch(`${API}/by-code/${encodeURIComponent(code)}`)
  const data = await res.json().catch(() => ({ error: `Lỗi máy chủ: HTTP ${res.status}` }))
  return res.ok ? data : { error: data.error || 'Mã lớp không hợp lệ.' }
}

/** Tham gia lớp: mỗi lớp 1 môn nên học sinh vào thẳng môn của lớp (không cần chọn môn). */
export async function joinClassByCode(code, password, user) {
  const res = await fetch(`${API}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code, password: password || null,
      userId: user.id, userName: user.name, userEmail: user.email,
    }),
  })
  const data = await res.json().catch(() => ({ error: `Lỗi máy chủ: HTTP ${res.status}` }))
  return data
}

/** Thêm học sinh vào lớp THEO MÔN (subject). */
export async function addMemberToClass(classId, student, subject = null) {
  const res = await fetch(`${API}/${classId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: student.id, name: student.name, email: student.email, subject: subject || null }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Thêm học sinh thất bại')
  return data
}

/** Xoá học sinh khỏi lớp; có subject → chỉ xoá khỏi môn đó. */
export async function removeMemberFromClass(classId, userId, subject = null) {
  const qs = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  const res = await fetch(`${API}/${classId}/members/${userId}${qs}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Xóa thành viên thất bại')
  return res.json()
}

export async function addAssignment(classId, { title, description, subject, examId, dueDate, openTime, closeTime, duration, maxAttempts, scoreMode, lockScreen, attachments, writingTask }) {
  const res = await fetch(`${API}/${classId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title, description, subject: subject || null, examId: examId || null,
      dueDate, openTime: openTime || null, closeTime: closeTime || null,
      duration: duration ?? null,
      maxAttempts: maxAttempts ?? null,
      scoreMode: scoreMode || 'highest',
      lockScreen: !!lockScreen,
      writingTask: writingTask || null,
      attachments: attachments || [],
    }),
  })
  if (!res.ok) throw new Error('Giao bài thất bại')
  return res.json()
}

/** Bài/đề học sinh CHƯA hoàn thành (tính từ DB, đề thi xét theo bài nộp của đề). */
export async function getPendingForStudent(studentId, email) {
  const qs = new URLSearchParams({ studentId: String(studentId) })
  if (email) qs.set('email', email)
  const res = await fetch(`/api/students/pending?${qs}`)
  if (!res.ok) return { count: 0, items: [] }
  return res.json()
}

/** Cửa sổ thời gian của một đề thi được giao trong lớp (cho trang làm bài).
    assignmentId phân biệt lần giao bài khi cùng một đề được giao nhiều lần. */
export async function getExamWindow(classId, examId, studentId, email, assignmentId) {
  const qs = new URLSearchParams()
  if (studentId != null) qs.set('studentId', String(studentId))
  if (email) qs.set('email', email)
  if (assignmentId) qs.set('assignmentId', String(assignmentId))
  const s = qs.toString()
  const res = await fetch(`${API}/${classId}/exam-window/${examId}${s ? `?${s}` : ''}`)
  if (!res.ok) return null
  return res.json()
}

export async function removeAssignment(classId, assignmentId) {
  const res = await fetch(`${API}/${classId}/assignments/${assignmentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Xóa bài tập thất bại')
  return res.json()
}

export async function submitAssignment(classId, assignmentId, { studentId, studentName, files, note }) {
  const res = await fetch(`${API}/${classId}/assignments/${assignmentId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, studentName, files: files || [], note: note || '' }),
  })
  if (!res.ok) throw new Error('Nộp bài thất bại')
  return res.json()
}

export async function deleteAssignmentSubmission(classId, assignmentId, studentId) {
  const res = await fetch(`${API}/${classId}/assignments/${assignmentId}/submissions/${studentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Xóa bài làm thất bại')
  return res.json()
}

export async function getSubmissions(classId, assignmentId) {
  const res = await fetch(`${API}/${classId}/assignments/${assignmentId}/submissions`)
  if (!res.ok) throw new Error('Không lấy được bài nộp')
  return res.json()
}

export async function addDocument(classId, doc) {
  const res = await fetch(`${API}/${classId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  })
  if (!res.ok) throw new Error('Thêm tài liệu thất bại')
  return res.json()
}

export async function removeDocument(classId, docId) {
  await fetch(`${API}/${classId}/documents/${docId}`, { method: 'DELETE' })
}

/** Chấm (hoặc chấm lại) bài IELTS Writing của một học sinh bằng AI */
export async function gradeSubmission(classId, assignmentId, studentId) {
  const res = await fetch(`${API}/${classId}/assignments/${assignmentId}/grade/${studentId}`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Chấm bài thất bại')
  return data
}

/** Bảng tóm tắt thống kê điểm AI từng học sinh */
export async function getGradesSummary(classId, assignmentId) {
  const res = await fetch(`${API}/${classId}/assignments/${assignmentId}/grades-summary`)
  if (!res.ok) throw new Error('Không lấy được bảng điểm')
  return res.json()
}

export function joinUrl(joinCode) {
  return `${window.location.origin}${window.location.pathname}#join/${joinCode}`
}

/** Upload file lên server, trả về metadata */
export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/class-documents/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload thất bại')
  return res.json()
}

/** Tìm kiếm học sinh từ server (async); grade → chỉ học sinh cùng cấp độ. */
export async function searchStudents(query = '', grade = '') {
  try {
    const params = new URLSearchParams({ role: 'hoc_sinh', q: query })
    if (grade) params.set('grade', grade)
    const r = await fetch(`/api/users/search?${params}`)
    if (r.ok) return r.json()
  } catch {}
  return []
}

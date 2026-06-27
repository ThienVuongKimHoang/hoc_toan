const API = '/api/classes'
const REG_KEY = 'hoctoan_registered_users'

export async function getClassesByTeacher(teacherId) {
  const res = await fetch(`${API}?teacherId=${teacherId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getClassesByStudent(studentId) {
  const res = await fetch(`${API}?studentId=${studentId}`)
  if (!res.ok) return []
  return res.json()
}

export async function getClassById(classId) {
  const res = await fetch(`${API}/${classId}`)
  if (!res.ok) return null
  return res.json()
}

export async function createClass({ name, description, teacherId, teacherName, joinPassword }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, teacherId, teacherName: teacherName || '', joinPassword: joinPassword || null, createdAt: new Date().toISOString() }),
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

export async function joinClassByCode(code, password, user) {
  const res = await fetch(`${API}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, password: password || null, userId: user.id, userName: user.name, userEmail: user.email }),
  })
  return res.json()
}

export async function addMemberToClass(classId, student) {
  const res = await fetch(`${API}/${classId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: student.id, name: student.name, email: student.email }),
  })
  if (!res.ok) throw new Error('Thêm học sinh thất bại')
  return res.json()
}

export async function removeMemberFromClass(classId, userId) {
  const res = await fetch(`${API}/${classId}/members/${userId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Xóa thành viên thất bại')
  return res.json()
}

export async function addAssignment(classId, { title, description, examId, dueDate, attachments }) {
  const res = await fetch(`${API}/${classId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, examId: examId || null, dueDate, attachments: attachments || [] }),
  })
  if (!res.ok) throw new Error('Giao bài thất bại')
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

/** Tìm kiếm học sinh từ server (async) */
export async function searchStudents(query = '') {
  try {
    const params = new URLSearchParams({ role: 'hoc_sinh', q: query })
    const r = await fetch(`/api/users/search?${params}`)
    if (r.ok) return r.json()
  } catch {}
  return []
}

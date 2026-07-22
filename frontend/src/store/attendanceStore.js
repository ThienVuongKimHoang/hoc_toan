const API = '/api/classes'

/** Lưu điểm danh 1 buổi (ghi đè nếu đã điểm danh ngày đó rồi). */
export async function submitAttendance(classId, { teacherId, date, records }) {
  const res = await fetch(`${API}/${classId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId, date, records: records || [] }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Lưu điểm danh thất bại')
  return data
}

/** Lấy điểm danh 1 ngày cụ thể (null nếu chưa điểm danh ngày đó). */
export async function getAttendanceSession(classId, date) {
  const res = await fetch(`${API}/${classId}/attendance?date=${encodeURIComponent(date)}`)
  if (!res.ok) return null
  return res.json()
}

/** Lịch sử điểm danh của lớp, mỗi buổi kèm số lượng theo từng trạng thái. */
export async function getAttendanceHistory(classId, limit = 30) {
  const res = await fetch(`${API}/${classId}/attendance/history?limit=${limit}`)
  if (!res.ok) return []
  return res.json()
}

/** Tiến độ học tập của từng học sinh trong lớp (chuyên cần, nộp bài, điểm theo thời gian). Chỉ GV xem được. */
export async function getClassProgress(classId, teacherId) {
  const res = await fetch(`${API}/${classId}/progress?teacherId=${teacherId}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không lấy được tiến độ lớp')
  return data
}

/** Báo cáo tổng hợp (vắng học/bỏ bài/điểm thấp) toàn hệ thống — chỉ super_admin xem được. */
export async function getReports({ type = '', classId = '', limit = 50, offset = 0, viewerId }) {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset), viewerId: String(viewerId) })
  if (type) qs.set('type', type)
  if (classId) qs.set('classId', classId)
  const res = await fetch(`/api/admin/reports?${qs}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không lấy được báo cáo')
  return data
}

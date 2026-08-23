import { authHeaders } from '../auth/mockUsers.js'

const API = '/api/classes'

/** Lưu điểm danh 1 buổi (ghi đè nếu đã điểm danh ngày đó rồi). */
export async function submitAttendance(classId, { teacherId, date, records }) {
  const res = await fetch(`${API}/${classId}/attendance`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
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
  const res = await fetch(`${API}/${classId}/progress?teacherId=${teacherId}`, { headers: authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không lấy được tiến độ lớp')
  return data
}

/* Chuỗi query dùng chung cho danh sách báo cáo và xuất file — cùng một bộ lọc. */
function reportQuery({ type = '', classId = '', q = '', dateFrom = '', dateTo = '', status = '', viewerId }) {
  const qs = new URLSearchParams()
  if (viewerId != null) qs.set('viewerId', String(viewerId))
  if (type)     qs.set('type', type)
  if (classId)  qs.set('classId', classId)
  if (q)        qs.set('q', q)
  if (dateFrom) qs.set('dateFrom', dateFrom)
  if (dateTo)   qs.set('dateTo', dateTo)
  if (status)   qs.set('status', status)
  return qs
}

/** Báo cáo tổng hợp (vắng học/bỏ bài/điểm thấp) toàn hệ thống — chỉ super_admin xem được. */
export async function getReports({ limit = 50, offset = 0, ...filters } = {}) {
  const qs = reportQuery(filters)
  qs.set('limit', String(limit))
  qs.set('offset', String(offset))
  const res = await fetch(`/api/admin/reports?${qs}`, { headers: authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không lấy được báo cáo')
  return data
}

/** Đánh dấu nhiều báo cáo đã xử lý ('da_xu_ly') hoặc mở lại ('moi'). */
export async function markReports(ids, status) {
  const res = await fetch('/api/admin/reports/mark', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ids, status }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không cập nhật được trạng thái')
  return data
}

/** Gửi nhắc nhở tới học sinh của các báo cáo được chọn. */
export async function notifyReports(ids, message = '') {
  const res = await fetch('/api/admin/reports/notify', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ids, message }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không gửi được nhắc nhở')
  return data
}

/** Tải báo cáo đã lọc về máy dạng CSV (Excel mở được).
 *  Phải fetch kèm token rồi tạo blob — link <a> thẳng không mang được header xác thực. */
export async function downloadReportsCsv(filters = {}) {
  const res = await fetch(`/api/admin/reports/export?${reportQuery(filters)}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Không xuất được file báo cáo')
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

import { authHeaders } from '../auth/mockUsers.js'

const API = '/api/tools/image-convert'

/** Nhận dạng 1 ảnh và lưu vào phiên → { markdown, figures, warnings }. */
export async function recognizeImage(file, sessionId, pageId) {
  const form = new FormData()
  form.append('file', file)
  form.append('sessionId', sessionId)
  form.append('pageId', pageId)
  const res = await fetch(`${API}/recognize`, { method: 'POST', headers: authHeaders(), body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không nhận dạng được ảnh')
  return data
}

async function sessionRequest(path, options, fallback) {
  const res = await fetch(`${API}/sessions${path}`, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || fallback)
  return data
}

export const listSessions = () =>
  sessionRequest('', { headers: authHeaders() }, 'Không lấy được danh sách phiên')

export const getSession = (sessionId) =>
  sessionRequest(`/${sessionId}`, { headers: authHeaders() }, 'Không mở được phiên')

/** `figures` chỉ gửi khi có đổi hình, lưu tự động lúc gõ không cần gửi lại ảnh. */
export const savePage = (sessionId, pageId, body) =>
  sessionRequest(`/${sessionId}/pages/${pageId}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  }, 'Không lưu được')

export const deletePage = (sessionId, pageId) =>
  sessionRequest(`/${sessionId}/pages/${pageId}`, { method: 'DELETE', headers: authHeaders() }, 'Không xoá được trang')

export const deleteSession = (sessionId) =>
  sessionRequest(`/${sessionId}`, { method: 'DELETE', headers: authHeaders() }, 'Không xoá được phiên')

/** Ghép các trang đã nhận dạng thành file rồi tải về máy.
 *  Phải fetch kèm token rồi tạo blob — link <a> thẳng không mang được header xác thực. */
export async function exportDocument(format, pages) {
  const res = await fetch(`${API}/export`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ format, pages }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Không tạo được file')
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = { docx: 'tai-lieu.docx', mathtype: 'tai-lieu-mathtype.docx', latex: 'tai-lieu-latex.zip' }[format]
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

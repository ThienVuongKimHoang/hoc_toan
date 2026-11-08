import { authHeaders } from '../auth/mockUsers.js'

const API = '/api/tools/image-convert'

/** Nhận dạng 1 ảnh → { markdown, figures, warnings }. */
export async function recognizeImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API}/recognize`, { method: 'POST', headers: authHeaders(), body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Không nhận dạng được ảnh')
  return data
}

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
  a.download = format === 'docx' ? 'tai-lieu.docx' : 'tai-lieu-latex.zip'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

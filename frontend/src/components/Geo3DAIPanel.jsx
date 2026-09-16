import React, { useEffect, useRef, useState } from 'react'
import { authHeaders } from '../auth/mockUsers.js'

/**
 * Ô nhập cho trang vẽ hình: ảnh đề bài và/hoặc đề bài bằng chữ → gọi AI dựng hình.
 *
 * Dựng theo .es-unified-box của ExerciseSolver nhưng CỐ Ý BỎ khung xem trước LaTeX:
 * người dùng chính ở đây là học sinh khối 11-12, không được thấy LaTeX. Vì vậy cũng
 * không import MathText, và câu gợi ý trong ô không nhắc gì tới LaTeX.
 */

const PhotoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const PaperclipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
)

const SparkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>
  </svg>
)

const PLACEHOLDER =
  'Nhập đề bài hình không gian — ví dụ: Cho hình chóp S.ABCD có đáy ABCD là hình '
  + 'vuông cạnh a, SA vuông góc với đáy — hoặc tải ảnh đề bài lên.'

/* Bấm vào là điền sẵn vào ô, thay cho 6 "hình mẫu" đã bỏ: vẫn thuần AI nhưng học sinh
   có chỗ bắt đầu và học được cách diễn đạt đề. */
const EXAMPLES = [
  'Cho hình chóp S.ABCD có đáy ABCD là hình vuông cạnh a, SA vuông góc với đáy, SA = a.',
  'Cho hình lăng trụ đứng ABC.A\'B\'C\' có đáy là tam giác đều cạnh a.',
  'Cho hình hộp chữ nhật ABCD.A\'B\'C\'D\' với AB = 3, AD = 2, AA\' = 2.',
]

/* Nén phía trình duyệt trước khi gửi. Thuật toán lấy theo loadImageFile trong
   create-exam/EditableQuestion.jsx, nhưng trả về Blob cho FormData thay vì data URL,
   nên chép lại chứ không sửa file kia (file đó đang được dùng nhiều nơi, không test). */
function compressImage(file, { maxDim = 1400, quality = 0.8 } = {}) {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith('image/')) { resolve(file); return }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        if (scale >= 1 && file.size <= 1.5 * 1024 * 1024) { resolve(file); return }
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(b => resolve(b || file), 'image/jpeg', quality)
      }
      img.onerror = () => resolve(file)   // nén hỏng thì gửi ảnh gốc, server còn chặn cỡ
      img.src = reader.result
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

/** Đổi mã lỗi HTTP thành MỘT câu tiếng Việt. Không bao giờ để lọt JSON hay lỗi thô. */
function messageFor(status, serverMsg) {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  if (status === 413) return 'Ảnh quá lớn. Chụp lại hoặc chọn ảnh nhỏ hơn.'
  if (status === 415) return 'Định dạng ảnh không hỗ trợ. Dùng JPG, PNG hoặc WEBP.'
  if (status === 429) return 'Bạn đang tạo hình quá nhanh. Chờ khoảng một phút rồi thử lại.'
  if (status === 422) {
    return serverMsg
      || 'AI chưa dựng được hình từ đề này. Thử mô tả rõ hơn: loại hình (chóp, lăng trụ '
         + 'hay hộp), tên các đỉnh, và quan hệ vuông góc hoặc song song.'
  }
  return 'Không kết nối được máy chủ AI. Thử lại sau ít phút.'
}

export default function Geo3DAIPanel({ onResult, onError, busy, setBusy, compact, onExpand }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  // Huỷ lượt đang chạy khi component biến mất, tránh setState sau unmount.
  useEffect(() => () => abortRef.current?.abort(), [])

  const attach = (f) => {
    if (!f || !f.type.startsWith('image/')) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onDragOver = (e) => {
    e.preventDefault()
    if ([...e.dataTransfer.types].includes('Files')) setDragging(true)
  }
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
  }
  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) { attach(f); return }
    const t = e.dataTransfer.getData('text')
    if (t) setText(prev => prev + t)
  }

  // Dán ảnh bằng Ctrl+V — ExerciseSolver không có, mà học sinh hay chụp màn hình đề.
  const onPaste = (e) => {
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        attach(item.getAsFile())
        return
      }
    }
  }

  const canSubmit = (text.trim().length > 0 || file !== null) && !busy

  const submit = async () => {
    if (!canSubmit) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    // Lượt gọi Vision mất 20-40 giây; quá 60 giây thì coi như hỏng.
    const timer = setTimeout(() => ac.abort('timeout'), 60000)
    setBusy(true); onError(null)
    try {
      const fd = new FormData()
      if (text.trim()) fd.append('prompt', text.trim())
      if (file) fd.append('file', await compressImage(file), file.name || 'de-bai.jpg')
      // KHÔNG tự đặt Content-Type: trình duyệt phải tự sinh boundary cho FormData.
      const res = await fetch('/api/geo3d/generate', {
        method: 'POST', body: fd, headers: authHeaders(), signal: ac.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { onError(messageFor(res.status, data.error)); return }
      onResult(data)
    } catch (e) {
      if (ac.signal.aborted && e?.name !== 'AbortError') return
      onError(ac.signal.reason === 'timeout'
        ? 'AI phản hồi quá lâu. Thử lại hoặc rút gọn đề bài.'
        : messageFor(0))
    } finally {
      clearTimeout(timer)
      setBusy(false)
    }
  }

  // Sau khi dựng xong thì thu lại thành một dòng để nhường chỗ cho hình.
  if (compact) {
    return (
      <div className="g3d-ai-collapsed">
        <span className="g3d-ai-collapsed-text">{text.trim() || 'Đề bài từ ảnh'}</span>
        <button className="g3d-btn-sm" onClick={onExpand}>✎ Sửa đề</button>
      </div>
    )
  }

  return (
    <div
      className={`g3d-ai-box${dragging ? ' g3d-ai-box--dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="g3d-ai-drop"><PhotoIcon /> Thả ảnh vào đây</div>
      )}

      {preview && (
        <div className="g3d-ai-chip">
          <img src={preview} alt="Ảnh đề bài" className="g3d-ai-chip-thumb" />
          <span className="g3d-ai-chip-name">{file?.name || 'Ảnh đề bài'}</span>
          <button className="g3d-ai-chip-remove" onClick={removeImage} title="Bỏ ảnh">×</button>
        </div>
      )}

      <textarea
        className="g3d-ai-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        onPaste={onPaste}
        placeholder={file ? 'Ghi chú thêm cho AI (không bắt buộc)…' : PLACEHOLDER}
        disabled={busy}
        onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') submit() }}
      />

      {!text.trim() && !file && (
        <div className="g3d-ai-examples">
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="g3d-ai-example" onClick={() => setText(ex)}>
              {ex.slice(0, 42)}…
            </button>
          ))}
        </div>
      )}

      <div className="g3d-ai-toolbar">
        <button className="g3d-ai-attach" onClick={() => fileRef.current?.click()}
          disabled={busy} type="button" title="Đính kèm ảnh đề bài">
          <PaperclipIcon /> Đính kèm ảnh
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { attach(e.target.files?.[0]); e.target.value = '' }} />
        <div className="g3d-ai-toolbar-right">
          <span className="g3d-ai-hint">Ctrl+Enter</span>
          <button className="g3d-ai-submit" onClick={submit} disabled={!canSubmit}>
            {busy ? <><span className="g3d-spinner" /> Đang dựng hình…</> : <><SparkIcon /> Vẽ hình</>}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES = 40
const MAX_BYTES = 15 * 1024 * 1024

const byName = (a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })

const OUTPUTS = [
  { key: 'exam', title: 'Lưu thành đề thi', desc: 'AI tách câu hỏi, đáp án để giao cho học sinh làm online' },
  { key: 'word', title: 'File Word', desc: 'Sửa nội dung trong khung 3 cột rồi tải file .docx, công thức giữ dạng công thức' },
]

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)

function startLabel({ exam, word }, count) {
  const n = count || ''
  if (exam && word) return `Bắt đầu với ${n} ảnh: File Word trước, rồi tạo đề`
  if (word) return `Chuyển ${n} ảnh sang Word`
  return `Bắt đầu tạo đề từ ${n} ảnh`
}

/* Chọn đầu ra (đề thi, file Word hoặc cả hai) và nhiều ảnh các trang đề. Thứ tự trang theo tên file vì AI đọc đề từ trên xuống
   qua từng trang, xếp sai trang là đánh số câu sai. */
export default function ImageUploadStep({ onUpload, errorFromPrev }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [outputs, setOutputs] = useState({ exam: true, word: false })
  const inputRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => () => itemsRef.current.forEach(it => URL.revokeObjectURL(it.preview)), [])

  const addFiles = (fileList) => {
    const all = [...fileList]
    const valid = all.filter(f => ACCEPT.includes(f.type) && f.size <= MAX_BYTES)
    setError(valid.length < all.length ? 'Chỉ nhận ảnh JPG, PNG hoặc WEBP, tối đa 15 MB mỗi ảnh. Các file khác đã được bỏ qua.' : '')
    setItems(prev => {
      const next = [...prev, ...valid.map(file => ({ file, preview: URL.createObjectURL(file) }))].sort(byName)
      if (next.length > MAX_FILES) {
        next.slice(MAX_FILES).forEach(it => URL.revokeObjectURL(it.preview))
        setError(`Mỗi đề tối đa ${MAX_FILES} ảnh.`)
      }
      return next.slice(0, MAX_FILES)
    })
  }

  const remove = (target) => {
    URL.revokeObjectURL(target.preview)
    setItems(prev => prev.filter(it => it !== target))
  }

  const shownError = error || errorFromPrev?.message

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Bạn muốn nhận kết quả dạng nào? Có thể chọn cả hai.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 16 }}>
        {OUTPUTS.map(o => {
          const on = outputs[o.key]
          return (
            <label key={o.key} style={{
              position: 'relative', display: 'block', padding: '12px 40px 12px 12px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${on ? '#15803d' : '#e2e8f0'}`, background: on ? '#f0fdf4' : '#fff',
            }}>
              <input type="checkbox" checked={on} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                onChange={e => setOutputs(prev => ({ ...prev, [o.key]: e.target.checked }))} />
              <span aria-hidden="true" style={{
                position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                border: `2px solid ${on ? '#15803d' : '#cbd5e1'}`, background: on ? '#15803d' : '#fff',
              }}>{on && <CheckIcon />}</span>
              <span style={{ display: 'block', fontWeight: 600 }}>{o.title}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 2 }}>{o.desc}</span>
            </label>
          )
        })}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragging ? '#15803d' : '#cbd5e1'}`, borderRadius: 12, padding: '32px 16px',
          textAlign: 'center', cursor: 'pointer', background: dragging ? '#f0fdf4' : '#f8fafc',
        }}
      >
        <div style={{ fontWeight: 600 }}>Bấm để chọn hoặc kéo thả ảnh các trang đề vào đây</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          JPG, PNG, WEBP. Các trang được xếp theo tên file, nên đặt tên theo thứ tự trang.
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} multiple hidden
          onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {items.map((it, index) => (
            <div key={it.preview} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, background: '#fff', minWidth: 0 }}>
              <img src={it.preview} alt={`Trang ${index + 1}`} style={{ display: 'block', width: '100%', height: 120, objectFit: 'contain' }} />
              <div style={{ fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {index + 1}. {it.file.name}
              </div>
              <button type="button" className="cm-remove-btn" onClick={() => remove(it)}>Bỏ</button>
            </div>
          ))}
        </div>
      )}

      {shownError && <div role="alert" style={{ marginTop: 12, color: '#b91c1c', fontSize: 14 }}>{shownError}</div>}

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button className="btn-primary" disabled={items.length === 0 || !(outputs.exam || outputs.word)}
          onClick={() => onUpload(items.map(it => it.file), outputs)}>
          {startLabel(outputs, items.length)}
        </button>
        {!(outputs.exam || outputs.word) && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#b45309' }}>Hãy chọn ít nhất một dạng kết quả ở trên.</div>
        )}
      </div>
    </div>
  )
}

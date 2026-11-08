import React, { useEffect, useRef, useState } from 'react'
import { blockReload } from '../realtime/reloadGuard.js'
import { exportDocument, recognizeImage } from '../store/imageConvertStore.js'
import ImageConvertEditor from '../components/ImageConvertEditor.jsx'

const MAX_FILES = 50
const ACCEPT = 'image/jpeg,image/png,image/webp'

const FORMATS = [
  { value: 'docx', title: 'Word (.docx)', desc: 'Công thức là công thức Word, sửa trực tiếp được' },
  { value: 'latex', title: 'LaTeX (.zip)', desc: 'Gồm main.tex và thư mục hình, mở được trên Overleaf' },
]

const STATUS_LABEL = {
  pending: { text: 'Chờ xử lý', color: '#64748b' },
  working: { text: 'Đang nhận dạng…', color: '#0369a1' },
  done: { text: 'Xong', color: '#15803d' },
  error: { text: 'Lỗi', color: '#b91c1c' },
}

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

const byName = (a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })

export default function ImageConvertPage({ onBack }) {
  const [items, setItems] = useState([])
  const [format, setFormat] = useState('docx')
  const [converting, setConverting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const inputRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => () => itemsRef.current.forEach(it => URL.revokeObjectURL(it.preview)), [])

  // Nội dung đã nhận dạng và đã sửa chỉ nằm trong state: tự reload là mất hết.
  const hasResults = items.some(it => it.status === 'done')
  useEffect(() => (hasResults ? blockReload('chuyen-anh-ket-qua') : undefined), [hasResults])

  const leave = () => {
    if (!hasResults || confirm('Rời trang sẽ mất nội dung đã nhận dạng và đã sửa. Tiếp tục?')) onBack()
  }

  const addFiles = (fileList) => {
    setError('')
    const images = [...fileList].filter(f => ACCEPT.split(',').includes(f.type))
    if (images.length < fileList.length) setError('Chỉ nhận ảnh JPG, PNG hoặc WEBP, các file khác đã được bỏ qua.')
    const added = images.map(file => ({
      id: `${file.name}-${file.size}-${Math.random()}`,
      file, preview: URL.createObjectURL(file), status: 'pending', result: null, error: '',
    }))
    setItems(prev => {
      const next = [...prev, ...added].sort(byName)
      const kept = next.slice(0, MAX_FILES)
      if (next.length > MAX_FILES) {
        next.slice(MAX_FILES).forEach(it => URL.revokeObjectURL(it.preview))
        setError(`Mỗi lần tối đa ${MAX_FILES} ảnh.`)
      }
      return kept
    })
  }

  const updateMarkdown = (id, markdown) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, result: { ...it.result, markdown } } : it)))

  const removeItem = (id) => setItems(prev => {
    const target = prev.find(it => it.id === id)
    if (target) URL.revokeObjectURL(target.preview)
    return prev.filter(it => it.id !== id)
  })

  const patchItem = (id, patch) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))

  // Làm lần lượt từng ảnh để không chạm giới hạn tốc độ của Groq; ảnh lỗi bấm lại là chạy lại.
  const convert = async () => {
    setConverting(true)
    setError('')
    const release = blockReload('chuyen-anh')
    try {
      for (const item of itemsRef.current.filter(it => it.status !== 'done')) {
        patchItem(item.id, { status: 'working', error: '' })
        try {
          patchItem(item.id, { status: 'done', result: await recognizeImage(item.file) })
        } catch (err) {
          patchItem(item.id, { status: 'error', error: err.message })
        }
      }
    } finally {
      release()
      setConverting(false)
    }
  }

  const download = async () => {
    setExporting(true)
    setError('')
    try {
      const pages = items.filter(it => it.status === 'done')
        .map(({ result }) => ({ markdown: result.markdown, figures: result.figures }))
      await exportDocument(format, pages)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const doneCount = items.filter(it => it.status === 'done').length
  const remaining = items.length - doneCount
  const busy = converting || exporting

  return (
    <div className="es-page" style={{ overflowY: 'auto' }}>
      <div className="es-header">
        <button className="tool-page-back" onClick={leave} disabled={converting}>
          <ArrowLeftIcon /> Quay lại
        </button>
        <span className="es-header-title"><FileIcon /> Chuyển ảnh sang Word / LaTeX</span>
      </div>

      <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: 16, boxSizing: 'border-box' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          style={{
            border: `2px dashed ${dragging ? '#0369a1' : '#cbd5e1'}`, borderRadius: 12, padding: '28px 16px',
            textAlign: 'center', cursor: 'pointer', background: dragging ? '#e0f2fe' : '#f8fafc',
          }}
        >
          <div style={{ fontWeight: 600 }}>Bấm để chọn hoặc kéo thả ảnh vào đây</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            JPG, PNG, WEBP, tối đa 15 MB mỗi ảnh. Các trang được xếp theo tên file.
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, index) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                <img src={it.preview} alt={`Trang ${index + 1}`} style={{ width: 48, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {it.file.name}</div>
                  <div style={{ fontSize: 13, color: STATUS_LABEL[it.status].color }}>
                    {STATUS_LABEL[it.status].text}
                    {it.status === 'done' && it.result.figures.length > 0 && ` · ${it.result.figures.length} hình`}
                    {it.error && `: ${it.error}`}
                  </div>
                  {it.result?.warnings?.map(w => (
                    <div key={w} style={{ fontSize: 13, color: '#b45309' }}>{w}</div>
                  ))}
                </div>
                {it.status === 'done' && (
                  <button type="button" className="cm-tab" style={{ color: '#0369a1' }} onClick={() => setEditingId(it.id)}>Chỉnh sửa</button>
                )}
                <button type="button" className="cm-remove-btn" title="Bỏ ảnh này" disabled={converting}
                  onClick={() => removeItem(it.id)}>Bỏ</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {FORMATS.map(f => (
            <label key={f.value} style={{
              display: 'flex', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${format === f.value ? '#0369a1' : '#e2e8f0'}`,
              background: format === f.value ? '#e0f2fe' : '#fff',
            }}>
              <input type="radio" name="image-convert-format" value={f.value} checked={format === f.value}
                onChange={() => setFormat(f.value)} />
              <span>
                <span style={{ fontWeight: 600 }}>{f.title}</span>
                <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{f.desc}</span>
              </span>
            </label>
          ))}
        </div>

        {error && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 14 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={convert} disabled={busy || remaining === 0}>
            {converting ? `Đang nhận dạng ${doneCount}/${items.length}…`
              : doneCount > 0 && remaining > 0 ? `Nhận dạng ${remaining} ảnh còn lại` : 'Bắt đầu nhận dạng'}
          </button>
          <button className="btn-primary" onClick={download} disabled={busy || doneCount === 0}>
            {exporting ? 'Đang tạo file…' : `Tải ${format === 'docx' ? 'file Word' : 'file LaTeX'}`}
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
          Nội dung do AI đọc từ ảnh nên có thể sai sót, hãy bấm Chỉnh sửa để đối chiếu với ảnh gốc trước khi tải.
        </p>
      </div>

      {editingId && items.some(it => it.id === editingId && it.status === 'done') && (
        <ImageConvertEditor
          pages={items.filter(it => it.status === 'done')}
          currentId={editingId}
          onSelect={setEditingId}
          onChange={updateMarkdown}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

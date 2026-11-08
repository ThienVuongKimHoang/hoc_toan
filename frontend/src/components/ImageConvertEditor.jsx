import React, { useDeferredValue, useLayoutEffect, useRef, useState } from 'react'
import MathText from './MathText.jsx'

const FIG_RE = /\[\[FIG:(\d+)\]\]/g
const PASTE_MAX_BYTES = 8 * 1024 * 1024
const PASTE_FULL_WIDTH_PX = 1000   // ảnh dán rộng từng này px trở lên thì chiếm hết khổ trang

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

/* Server chỉ nhận PNG/JPEG, định dạng khác trong clipboard được đổi sang PNG. */
async function figureFromImage(file) {
  const bitmap = await createImageBitmap(file)
  let data
  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    data = await readAsDataUrl(file)
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    data = canvas.toDataURL('image/png')
  }
  const widthPct = Math.max(15, Math.min(100, Math.round(bitmap.width * 100 / PASTE_FULL_WIDTH_PX)))
  bitmap.close()
  return { data, widthPct }
}

const paneStyle = {
  display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
  border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden',
}
const paneTitleStyle = {
  padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#475569',
  borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0,
}
const paneBodyStyle = { flex: 1, minHeight: 0, overflow: 'auto' }
const navButtonStyle = (disabled) => ({ color: disabled ? '#cbd5e1' : '#0369a1', cursor: disabled ? 'default' : 'pointer' })

/* MathText không xử lý **đậm**, nên tách ở đây; dòng bảng giữ nguyên để không vỡ bảng. */
function PreviewText({ text }) {
  return text.split(/(\n\s*\n)/).map((block, i) => {
    if (!block.trim()) return <div key={i} style={{ height: 8 }} />
    if (block.trim().startsWith('|')) return <MathText key={i} text={block.trim()} />
    return (
      <div key={i}>
        {block.split(/\*\*(.+?)\*\*/s).map((part, j) => (
          j % 2 ? <strong key={j}><MathText text={part} /></strong> : <MathText key={j} text={part} />
        ))}
      </div>
    )
  })
}

function Preview({ markdown, figures }) {
  const byId = new Map(figures.map(f => [String(f.id), f]))
  // split với nhóm bắt: các phần tử lẻ là số thứ tự hình.
  return markdown.split(/\[\[FIG:(\d+)\]\]/).map((part, i) => {
    if (i % 2 === 0) return <PreviewText key={i} text={part} />
    const figure = byId.get(part)
    return figure ? (
      <img key={i} src={figure.data} alt={`Hình ${part}`}
        style={{ display: 'block', width: `${figure.widthPct}%`, maxWidth: '100%', margin: '8px auto' }} />
    ) : null
  })
}

/** Sửa nội dung từng trang đã nhận dạng trước khi xuất file. Mọi thay đổi được lưu ngay vào state của trang cha. */
export default function ImageConvertEditor({ pages, currentId, saveLabel, onSelect, onChange, onClose }) {
  const textareaRef = useRef(null)
  const caretRef = useRef(null)
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const [pasteError, setPasteError] = useState('')
  const index = Math.max(0, pages.findIndex(p => p.id === currentId))
  const page = pages[index]
  const { markdown, figures } = page.result
  const previewSource = useDeferredValue(markdown)

  const used = new Set([...markdown.matchAll(FIG_RE)].map(m => m[1]))
  const unusedFigures = figures.filter(f => !used.has(String(f.id)))

  useLayoutEffect(() => {
    if (caretRef.current == null) return
    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(caretRef.current, caretRef.current)
    caretRef.current = null
  }, [markdown])

  /* Thay đoạn [start, end) bằng dấu hình và đặt con trỏ ngay sau đó. */
  const placeFigure = (text, start, end, id) => {
    const tag = `\n\n[[FIG:${id}]]\n\n`
    caretRef.current = start + tag.length
    return text.slice(0, start) + tag + text.slice(end)
  }

  const insertFigure = (id) => {
    const start = textareaRef.current?.selectionStart ?? markdown.length
    const end = textareaRef.current?.selectionEnd ?? start
    onChange(page.id, placeFigure(markdown, start, end, id))
  }

  const pasteImage = async (file, pageId, start, end) => {
    setPasteError('')
    if (file.size > PASTE_MAX_BYTES) {
      setPasteError('Ảnh dán vượt quá 8 MB.')
      return
    }
    try {
      const figure = await figureFromImage(file)
      // Đọc ảnh là bất đồng bộ nên phải lấy nội dung mới nhất, không dùng bản lúc bấm dán.
      const { result } = pagesRef.current.find(p => p.id === pageId)
      const id = Math.max(0, ...result.figures.map(f => Number(f.id) || 0)) + 1
      onChange(pageId, placeFigure(result.markdown, start, end, id), { id, ...figure })
    } catch {
      setPasteError('Không đọc được ảnh vừa dán.')
    }
  }

  const handlePaste = (e) => {
    // Copy từ Word/Excel có cả chữ lẫn ảnh chụp của đoạn đó: lúc này người dùng muốn dán chữ.
    if (e.clipboardData.getData('text/plain').trim()) return
    const file = [...e.clipboardData.files].find(f => f.type.startsWith('image/'))
    if (!file) return
    e.preventDefault()
    pasteImage(file, page.id, e.target.selectionStart, e.target.selectionEnd)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', flexShrink: 0 }}>
        <strong style={{ flex: '1 1 160px', minWidth: 0 }}>
          Chỉnh sửa trang {index + 1}/{pages.length}
          {saveLabel && <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: '#64748b' }}>{saveLabel}</span>}
        </strong>
        <button type="button" className="cm-tab" style={navButtonStyle(index === 0)} disabled={index === 0} onClick={() => onSelect(pages[index - 1].id)}>Trang trước</button>
        <button type="button" className="cm-tab" style={navButtonStyle(index === pages.length - 1)} disabled={index === pages.length - 1} onClick={() => onSelect(pages[index + 1].id)}>Trang sau</button>
        <button type="button" className="btn-primary" onClick={onClose}>Xong</button>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gridAutoRows: 'minmax(360px, 1fr)',
      }}>
        <section style={paneStyle}>
          <div style={paneTitleStyle}>Ảnh gốc</div>
          <div style={paneBodyStyle}>
            <img src={page.preview} alt={`Ảnh gốc trang ${index + 1}`} style={{ display: 'block', width: '100%' }} />
          </div>
        </section>

        <section style={paneStyle}>
          <div style={paneTitleStyle}>Nội dung (công thức đặt giữa hai dấu $, Ctrl+V để dán ảnh tại con trỏ)</div>
          <textarea
            key={page.id}
            ref={textareaRef}
            aria-label={`Nội dung trang ${index + 1}`}
            value={markdown}
            spellCheck={false}
            onChange={e => onChange(page.id, e.target.value)}
            onPaste={handlePaste}
            style={{ flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'none', padding: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14, lineHeight: 1.6 }}
          />
          {pasteError && (
            <div role="alert" style={{ padding: '6px 12px', fontSize: 13, color: '#b91c1c', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>{pasteError}</div>
          )}
          {unusedFigures.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderTop: '1px solid #e2e8f0', overflowX: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>Hình đã gỡ, bấm để chèn tại con trỏ:</span>
              {unusedFigures.map(f => (
                <button key={f.id} type="button" title={`Chèn hình ${f.id}`} onClick={() => insertFigure(f.id)}
                  style={{ padding: 2, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                  <img src={f.data} alt={`Hình ${f.id}`} style={{ display: 'block', height: 44 }} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={paneStyle}>
          <div style={paneTitleStyle}>Xem trước</div>
          <div style={{ ...paneBodyStyle, padding: 12, lineHeight: 1.7, overflowWrap: 'anywhere' }}>
            <Preview markdown={previewSource} figures={figures} />
          </div>
        </section>
      </div>
    </div>
  )
}

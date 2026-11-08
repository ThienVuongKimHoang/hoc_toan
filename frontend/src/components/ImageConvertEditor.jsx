import React, { useDeferredValue, useRef } from 'react'
import MathText from './MathText.jsx'

const FIG_RE = /\[\[FIG:(\d+)\]\]/g

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
export default function ImageConvertEditor({ pages, currentId, onSelect, onChange, onClose }) {
  const textareaRef = useRef(null)
  const index = Math.max(0, pages.findIndex(p => p.id === currentId))
  const page = pages[index]
  const { markdown, figures } = page.result
  const previewSource = useDeferredValue(markdown)

  const used = new Set([...markdown.matchAll(FIG_RE)].map(m => m[1]))
  const unusedFigures = figures.filter(f => !used.has(String(f.id)))

  const insertFigure = (id) => {
    const position = textareaRef.current?.selectionStart ?? markdown.length
    onChange(page.id, `${markdown.slice(0, position)}\n\n[[FIG:${id}]]\n\n${markdown.slice(position)}`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', flexShrink: 0 }}>
        <strong style={{ flex: '1 1 160px', minWidth: 0 }}>Chỉnh sửa trang {index + 1}/{pages.length}</strong>
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
          <div style={paneTitleStyle}>Nội dung (công thức đặt giữa hai dấu $)</div>
          <textarea
            key={page.id}
            ref={textareaRef}
            aria-label={`Nội dung trang ${index + 1}`}
            value={markdown}
            spellCheck={false}
            onChange={e => onChange(page.id, e.target.value)}
            style={{ flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'none', padding: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14, lineHeight: 1.6 }}
          />
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

import React from 'react'

export const FORMATS = [
  { value: 'docx', title: 'Word (.docx)', desc: 'Công thức là công thức Word, sửa trực tiếp được' },
  { value: 'mathtype', title: 'Word + MathType (.docx)', desc: 'Công thức là đối tượng MathType, cần có MathType để sửa' },
  { value: 'latex', title: 'LaTeX (.zip)', desc: 'Gồm main.tex và thư mục hình, mở được trên Overleaf' },
]

const STATUS_LABEL = {
  pending: { text: 'Chờ xử lý', color: '#64748b' },
  working: { text: 'Đang nhận dạng…', color: '#0369a1' },
  done: { text: 'Xong', color: '#15803d' },
  error: { text: 'Lỗi', color: '#b91c1c' },
}

/* Danh sách trang kèm trạng thái nhận dạng, nút Chỉnh sửa và Bỏ. */
export function PageList({ items, onEdit, onRemove, removeDisabled }) {
  if (!items.length) return null
  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, index) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
          <img src={it.preview} alt={`Trang ${index + 1}`} style={{ width: 48, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {it.name}</div>
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
            <button type="button" className="cm-tab" style={{ color: '#0369a1' }} onClick={() => onEdit(it.id)}>Chỉnh sửa</button>
          )}
          {onRemove && (
            <button type="button" className="cm-remove-btn" title="Bỏ ảnh này" disabled={removeDisabled}
              onClick={() => onRemove(it)}>Bỏ</button>
          )}
        </div>
      ))}
    </div>
  )
}

/* Ô chọn định dạng file tải về. */
export function FormatPicker({ formats = FORMATS, value, onChange, name }) {
  return (
    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
      {formats.map(f => (
        <label key={f.value} style={{
          display: 'flex', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer',
          border: `2px solid ${value === f.value ? '#0369a1' : '#e2e8f0'}`,
          background: value === f.value ? '#e0f2fe' : '#fff',
        }}>
          <input type="radio" name={name} value={f.value} checked={value === f.value}
            onChange={() => onChange(f.value)} />
          <span>
            <span style={{ fontWeight: 600 }}>{f.title}</span>
            <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{f.desc}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

// SiteContentTab.jsx — Super admin chỉnh sửa nội dung trang chủ (thiết kế 1a)
import React, { useEffect, useRef, useState } from 'react'
import { SCHEDULE_COLORS } from './HomePage.jsx'

/* Lịch học: mỗi dòng trong ô = "Tên lớp @màu" (màu: xanhla, vang, cam, tim, do, xanhduong, hong, trang) */
const cellToText = entries => (entries || []).map(e => {
  const [label, color] = Array.isArray(e) ? e : [e?.label, e?.color]
  return color && color !== 'trang' ? `${label} @${color}` : label
}).join('\n')

const textToCell = text => String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const m = l.match(/^(.*?)\s*@(\w+)\s*$/)
  return m && SCHEDULE_COLORS[m[2]] ? [m[1], m[2]] : [l, 'trang']
})

const box = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 18 }
const h3s = { margin: '0 0 14px', fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }
const lbl = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '.03em' }
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }
const ta  = { ...inp, resize: 'vertical', minHeight: 60 }
const rowBox = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 10, background: '#f8fafc', position: 'relative' }
const delBtn = { position: 'absolute', top: 10, right: 10, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }
const addBtn = { background: '#eef2ff', color: '#4338ca', border: '1.5px dashed #c7d2fe', borderRadius: 10, padding: '9px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', width: '100%' }

/* Bảng màu nền trang chủ */
const DEFAULT_BG = '#FFFBF0'
const BG_PALETTE = [
  { hex: DEFAULT_BG, name: 'Nắng vàng (mặc định)' },
  { hex: '#FFFFFF', name: 'Trắng tinh' },
  { hex: '#FDF2F8', name: 'Hồng phấn' },
  { hex: '#F0F9FF', name: 'Xanh da trời nhạt' },
  { hex: '#F0FDF4', name: 'Xanh lá nhạt' },
  { hex: '#FAF5FF', name: 'Tím lavender' },
  { hex: '#FFF7ED', name: 'Cam đào' },
  { hex: '#FEFCE8', name: 'Vàng chanh' },
  { hex: '#F8FAFC', name: 'Xám sương' },
  { hex: '#F5F5F4', name: 'Be đá' },
]

/* Xem trước phần mở đầu trang chủ với màu nền đã chọn */
function HeroPreview({ info }) {
  const bg = info?.bgColor || DEFAULT_BG
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: '#f1f5f9', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #e2e8f0' }}>
        {['#f87171', '#fbbf24', '#34d399'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginLeft: 6 }}>Xem trước trang chủ · {bg.toUpperCase()}</span>
      </div>
      <div style={{ background: bg, padding: '22px 24px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'center', transition: 'background .25s ease' }}>
        <div>
          <span style={{ background: '#FCEFD2', color: '#8A6410', fontSize: '0.6rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>Toán · Lý · Hóa · Ngữ Văn</span>
          <div style={{ font: "800 1.05rem/1.25 'Baloo 2','Be Vietnam Pro',sans-serif", color: '#2B2416', margin: '8px 0 6px' }}>
            {info?.heroTitle || 'Tiêu đề lớn (hero)'}
          </div>
          <div style={{ fontSize: '0.7rem', lineHeight: 1.55, color: '#6B5C3E', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {info?.heroDesc || 'Mô tả ngắn xuất hiện dưới tiêu đề…'}
          </div>
          <span style={{ display: 'inline-block', marginTop: 10, background: '#2B2416', color: bg, fontSize: '0.62rem', fontWeight: 700, padding: '6px 13px', borderRadius: 999 }}>Đăng ký học thử miễn phí</span>
        </div>
        <div style={{ position: 'relative', justifySelf: 'center', width: '100%', maxWidth: 130 }}>
          {info?.heroImage ? (
            <img src={info.heroImage} alt="" style={{ width: '100%', aspectRatio: '4/4.6', objectFit: 'cover', borderRadius: 12, transform: 'rotate(2deg)', boxShadow: '0 10px 20px -10px rgba(122,88,10,.4)' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '4/4.6', borderRadius: 12, transform: 'rotate(2deg)', background: 'linear-gradient(160deg,#FCEFD2,#F2A70C55)', display: 'grid', placeItems: 'center', fontSize: 26 }}>☀️</div>
          )}
          <div style={{ position: 'absolute', left: -10, bottom: 8, background: '#fff', border: '1px solid #F0E4C8', borderRadius: 8, padding: '4px 8px', boxShadow: '0 6px 14px -8px rgba(122,88,10,.35)' }}>
            <div style={{ font: "800 0.72rem 'Baloo 2',sans-serif", color: '#F2A70C' }}>{info?.heroBadge || '1.500+'}</div>
            <div style={{ fontSize: '0.52rem', fontWeight: 600, color: '#6B5C3E' }}>{info?.heroBadgeLabel || 'học viên'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhotoField({ value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef(null)
  const upload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await fetch('/api/class-documents/upload', { method: 'POST', body: form })
      if (!r.ok) throw new Error()
      const meta = await r.json()
      onChange(meta.url || '')
    } catch { alert('Upload ảnh thất bại') }
    finally { setUploading(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {value ? (
        <img src={value} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
      ) : (
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 20 }}>📷</div>
      )}
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#475569' }}>
        {uploading ? 'Đang tải…' : (value ? 'Đổi ảnh' : 'Thêm ảnh')}
      </button>
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Xóa ảnh</button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={upload} />
    </div>
  )
}

function UploadBtn({ onUploaded, hasImage, onClear }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef(null)
  const upload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await fetch('/api/class-documents/upload', { method: 'POST', body: form })
      if (!r.ok) throw new Error()
      const meta = await r.json()
      onUploaded(meta.url || '')
    } catch { alert('Upload ảnh thất bại') }
    finally { setUploading(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#475569' }}>
        {uploading ? 'Đang tải…' : (hasImage ? 'Đổi ảnh' : 'Thêm ảnh')}
      </button>
      {hasImage && (
        <button type="button" onClick={onClear}
          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Xóa ảnh</button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={upload} />
    </span>
  )
}

export default function SiteContentTab() {
  const [c, setC] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/site-content').then(r => r.json()).then(setC).catch(() => setC(null))
  }, [])

  if (!c) return <div style={{ padding: 40, color: '#64748b' }}>Đang tải nội dung…</div>

  const setInfo = (k, v) => setC({ ...c, info: { ...c.info, [k]: v } })
  const setList = (key, i, k, v) => {
    const list = [...(c[key] || [])]
    list[i] = { ...list[i], [k]: v }
    setC({ ...c, [key]: list })
  }
  const addItem = (key, item) => setC({ ...c, [key]: [...(c[key] || []), item] })
  const delItem = (key, i) => setC({ ...c, [key]: c[key].filter((_, j) => j !== i) })
  const moveItem = (key, i, d) => {
    const list = [...(c[key] || [])]
    const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setC({ ...c, [key]: list })
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const r = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
      })
      if (!r.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { alert('Lưu thất bại') }
    finally { setSaving(false) }
  }

  const MoveBtns = ({ listKey, i }) => (
    <span style={{ position: 'absolute', top: 10, right: 70, display: 'flex', gap: 4 }}>
      <button type="button" onClick={() => moveItem(listKey, i, -1)} title="Lên"
        style={{ ...delBtn, position: 'static', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>↑</button>
      <button type="button" onClick={() => moveItem(listKey, i, 1)} title="Xuống"
        style={{ ...delBtn, position: 'static', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>↓</button>
    </span>
  )

  return (
    <div style={{ maxWidth: 860 }}>
      {/* ── Thông tin chung & Hero ── */}
      <div style={box}>
        <h3 style={h3s}>🏫 Thông tin trung tâm & phần mở đầu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div><label style={lbl}>Tên trung tâm</label><input style={inp} value={c.info?.name || ''} onChange={e => setInfo('name', e.target.value)} /></div>
          <div><label style={lbl}>Số điện thoại</label><input style={inp} value={c.info?.phone || ''} onChange={e => setInfo('phone', e.target.value)} /></div>
          <div><label style={lbl}>Địa chỉ</label><input style={inp} value={c.info?.address || ''} onChange={e => setInfo('address', e.target.value)} /></div>
          <div><label style={lbl}>Link Facebook</label><input style={inp} value={c.info?.fb || ''} onChange={e => setInfo('fb', e.target.value)} /></div>
        </div>
        <label style={lbl}>Tiêu đề lớn (hero)</label>
        <input style={inp} value={c.info?.heroTitle || ''} onChange={e => setInfo('heroTitle', e.target.value)} />
        <label style={lbl}>Mô tả ngắn (hero)</label>
        <textarea style={ta} value={c.info?.heroDesc || ''} onChange={e => setInfo('heroDesc', e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div><label style={lbl}>Số nổi bật (vd 1.500+)</label><input style={inp} value={c.info?.heroBadge || ''} onChange={e => setInfo('heroBadge', e.target.value)} /></div>
          <div><label style={lbl}>Chú thích số nổi bật</label><input style={inp} value={c.info?.heroBadgeLabel || ''} onChange={e => setInfo('heroBadgeLabel', e.target.value)} /></div>
        </div>
        <label style={lbl}>Ảnh lớn trang chủ</label>
        <PhotoField value={c.info?.heroImage || ''} onChange={v => setInfo('heroImage', v)} />

        {/* ── Màu nền trang chủ ── */}
        <label style={lbl}>🎨 Màu nền trang chủ</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          {BG_PALETTE.map(p => {
            const active = (c.info?.bgColor || DEFAULT_BG).toUpperCase() === p.hex.toUpperCase()
            return (
              <button key={p.hex} type="button" title={p.name} onClick={() => setInfo('bgColor', p.hex)}
                style={{
                  width: 34, height: 34, borderRadius: 10, cursor: 'pointer', background: p.hex,
                  border: active ? '2.5px solid #4f46e5' : '1.5px solid #e2e8f0',
                  boxShadow: active ? '0 0 0 3px #c7d2fe' : 'none', transition: 'all .15s ease',
                  display: 'grid', placeItems: 'center', fontSize: 13, color: '#4f46e5', fontWeight: 800,
                }}>
                {active ? '✓' : ''}
              </button>
            )
          })}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', marginLeft: 4 }}>
            <input type="color" value={c.info?.bgColor || DEFAULT_BG} onChange={e => setInfo('bgColor', e.target.value)}
              style={{ width: 34, height: 30, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: 2, background: '#fff', cursor: 'pointer' }} />
            Màu khác
          </label>
          {c.info?.bgColor && c.info.bgColor.toUpperCase() !== DEFAULT_BG && (
            <button type="button" onClick={() => setInfo('bgColor', DEFAULT_BG)}
              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              ↺ Về mặc định
            </button>
          )}
        </div>
        <HeroPreview info={c.info} />
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 6 }}>
          Xem trước cập nhật ngay khi chọn màu — nhấn <b>Lưu nội dung trang chủ</b> ở cuối trang để áp dụng lên trang chủ thật.
        </div>
      </div>

      {/* ── Số liệu thống kê ── */}
      <div style={box}>
        <h3 style={h3s}>📊 Số liệu nổi bật</h3>
        {(c.stats || []).map((s, i) => (
          <div key={i} style={rowBox}>
            <button type="button" style={delBtn} onClick={() => delItem('stats', i)}>Xóa</button>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0 12px', paddingRight: 60 }}>
              <div><label style={lbl}>Giá trị</label><input style={inp} value={s.value || ''} onChange={e => setList('stats', i, 'value', e.target.value)} /></div>
              <div><label style={lbl}>Mô tả</label><input style={inp} value={s.label || ''} onChange={e => setList('stats', i, 'label', e.target.value)} /></div>
            </div>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem('stats', { value: '', label: '' })}>＋ Thêm số liệu</button>
      </div>

      {/* ── Giáo viên ── */}
      <div style={box}>
        <h3 style={h3s}>👩‍🏫 Đội ngũ giáo viên <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>(hiển thị dạng trượt, 3 người / trang)</span></h3>
        {(c.teachers || []).map((t, i) => (
          <div key={i} style={rowBox}>
            <MoveBtns listKey="teachers" i={i} />
            <button type="button" style={delBtn} onClick={() => delItem('teachers', i)}>Xóa</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', paddingRight: 60 }}>
              <div><label style={lbl}>Tên</label><input style={inp} value={t.name || ''} onChange={e => setList('teachers', i, 'name', e.target.value)} /></div>
              <div><label style={lbl}>Môn dạy</label><input style={inp} value={t.subject || ''} onChange={e => setList('teachers', i, 'subject', e.target.value)} /></div>
            </div>
            <label style={lbl}>Giới thiệu</label>
            <textarea style={ta} value={t.bio || ''} onChange={e => setList('teachers', i, 'bio', e.target.value)} />
            <label style={lbl}>Ảnh chân dung</label>
            <PhotoField value={t.photo || ''} onChange={v => setList('teachers', i, 'photo', v)} />
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem('teachers', { name: '', subject: '', bio: '', photo: '' })}>＋ Thêm giáo viên</button>
      </div>

      {/* ── Khóa học ── */}
      <div style={box}>
        <h3 style={h3s}>📚 Khóa học & học phí</h3>
        {(c.courses || []).map((k, i) => (
          <div key={i} style={rowBox}>
            <MoveBtns listKey="courses" i={i} />
            <button type="button" style={delBtn} onClick={() => delItem('courses', i)}>Xóa</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '0 12px', paddingRight: 60 }}>
              <div><label style={lbl}>Tên khóa</label><input style={inp} value={k.name || ''} onChange={e => setList('courses', i, 'name', e.target.value)} /></div>
              <div><label style={lbl}>Học phí / tháng</label><input style={inp} value={k.fee || ''} onChange={e => setList('courses', i, 'fee', e.target.value)} /></div>
            </div>
            <label style={lbl}>Mô tả</label>
            <textarea style={ta} value={k.desc || ''} onChange={e => setList('courses', i, 'desc', e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.8rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!k.featured} onChange={e => setList('courses', i, 'featured', e.target.checked)} />
              ⭐ Khóa nổi bật (thẻ nền tối)
            </label>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem('courses', { name: '', desc: '', fee: '', featured: false })}>＋ Thêm khóa học</button>
      </div>

      {/* ── Lịch học ── */}
      <div style={box}>
        <h3 style={h3s}>🗓 Lịch học trong tuần</h3>
        <label style={lbl}>Ghi chú dưới tiêu đề</label>
        <input style={inp} value={c.schedule?.note || ''} onChange={e => setC({ ...c, schedule: { ...c.schedule, note: e.target.value } })} />
        <div style={{ fontSize: '0.74rem', color: '#64748b', margin: '10px 0', lineHeight: 1.6 }}>
          Mỗi dòng trong ô là một lớp. Thêm <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>@màu</code> ở cuối để tô màu:
          {' '}{Object.keys(SCHEDULE_COLORS).filter(k => k !== 'trang').map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: SCHEDULE_COLORS[k].bar, display: 'inline-block' }} />@{k}
            </span>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ fontSize: '0.7rem', color: '#64748b', padding: 6, textAlign: 'left', minWidth: 110 }}>Khung giờ</th>
                {(c.schedule?.days || []).map((d, i) => (
                  <th key={i} style={{ fontSize: '0.7rem', color: '#64748b', padding: 6, minWidth: 150 }}>{d}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {(c.schedule?.slots || []).map((slot, si) => (
                <tr key={si}>
                  <td style={{ padding: 4, verticalAlign: 'top' }}>
                    <input style={{ ...inp, fontWeight: 700, fontSize: '0.75rem' }} value={slot.time || ''}
                      onChange={e => {
                        const slots = [...c.schedule.slots]
                        slots[si] = { ...slots[si], time: e.target.value }
                        setC({ ...c, schedule: { ...c.schedule, slots } })
                      }} />
                  </td>
                  {(c.schedule?.days || []).map((_, di) => (
                    <td key={di} style={{ padding: 4, verticalAlign: 'top' }}>
                      <textarea
                        style={{ ...ta, minHeight: 88, fontSize: '0.72rem', lineHeight: 1.5 }}
                        defaultValue={cellToText((slot.cells || [])[di])}
                        onBlur={e => {
                          const slots = [...c.schedule.slots]
                          const cells = [...(slots[si].cells || [])]
                          while (cells.length < (c.schedule.days || []).length) cells.push([])
                          cells[di] = textToCell(e.target.value)
                          slots[si] = { ...slots[si], cells }
                          setC({ ...c, schedule: { ...c.schedule, slots } })
                        }} />
                    </td>
                  ))}
                  <td style={{ padding: 4, verticalAlign: 'top' }}>
                    <button type="button" style={{ ...delBtn, position: 'static' }}
                      onClick={() => setC({ ...c, schedule: { ...c.schedule, slots: c.schedule.slots.filter((_, j) => j !== si) } })}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" style={{ ...addBtn, marginTop: 8 }}
          onClick={() => setC({ ...c, schedule: { ...c.schedule, slots: [...(c.schedule?.slots || []), { time: '', cells: (c.schedule?.days || []).map(() => []) }] } })}>
          ＋ Thêm khung giờ
        </button>
      </div>

      {/* ── Thành tích học viên ── */}
      <div style={box}>
        <h3 style={h3s}>🏆 Thành tích học viên <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>(ảnh + chú thích)</span></h3>
        {(c.achievements || []).map((a, i) => (
          <div key={i} style={rowBox}>
            <MoveBtns listKey="achievements" i={i} />
            <button type="button" style={delBtn} onClick={() => delItem('achievements', i)}>Xóa</button>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingRight: 60 }}>
              {a.image ? (
                <img src={a.image} alt="" style={{ width: 120, height: 90, borderRadius: 10, objectFit: 'cover', border: '2px solid #e2e8f0', flex: 'none' }} />
              ) : (
                <div style={{ width: 120, height: 90, borderRadius: 10, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 26, flex: 'none' }}>🖼</div>
              )}
              <div style={{ flex: 1 }}>
                <label style={lbl}>Chú thích</label>
                <textarea style={ta} value={a.caption || ''} onChange={e => setList('achievements', i, 'caption', e.target.value)} />
                <div style={{ marginTop: 8 }}>
                  <UploadBtn onUploaded={url => setList('achievements', i, 'image', url)} hasImage={!!a.image}
                    onClear={() => setList('achievements', i, 'image', '')} />
                </div>
              </div>
            </div>
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem('achievements', { image: '', caption: '' })}>＋ Thêm thành tích</button>
      </div>

      {/* ── Cảm nhận học viên ── */}
      <div style={box}>
        <h3 style={h3s}>💬 Học viên nói gì</h3>
        {(c.testimonials || []).map((t, i) => (
          <div key={i} style={rowBox}>
            <button type="button" style={delBtn} onClick={() => delItem('testimonials', i)}>Xóa</button>
            <label style={lbl}>Cảm nhận</label>
            <textarea style={ta} value={t.quote || ''} onChange={e => setList('testimonials', i, 'quote', e.target.value)} />
            <label style={lbl}>Người chia sẻ</label>
            <input style={inp} value={t.who || ''} onChange={e => setList('testimonials', i, 'who', e.target.value)} />
          </div>
        ))}
        <button type="button" style={addBtn} onClick={() => addItem('testimonials', { quote: '', who: '' })}>＋ Thêm cảm nhận</button>
      </div>

      {/* ── Save bar ── */}
      <div style={{ position: 'sticky', bottom: 0, background: 'rgba(248,250,252,.92)', backdropFilter: 'blur(6px)', padding: '14px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} disabled={saving}
          style={{ background: '#4f46e5', color: '#fff', border: 0, borderRadius: 12, padding: '12px 28px', fontSize: '0.9rem', fontWeight: 800, cursor: saving ? 'wait' : 'pointer', boxShadow: '0 6px 18px -6px rgba(79,70,229,.5)' }}>
          {saving ? 'Đang lưu…' : '💾 Lưu nội dung trang chủ'}
        </button>
        {saved && <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>✓ Đã lưu — trang chủ đã cập nhật</span>}
        <a href="#" onClick={e => { e.preventDefault(); window.open(window.location.pathname, '_blank') }}
          style={{ marginLeft: 'auto', color: '#4f46e5', fontSize: '0.8rem', fontWeight: 700 }}>Xem trang chủ ↗</a>
      </div>
    </div>
  )
}

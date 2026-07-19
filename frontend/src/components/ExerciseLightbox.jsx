import React, { useEffect, useRef, useState } from 'react'

const SWIPE_THRESHOLD_PX = 50

const ChevronLeft = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const ChevronRight = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

function buildItems(cauGroup) {
  const de = cauGroup.de.map((doc, i) => ({
    doc, label: cauGroup.de.length > 1 ? `Đề bài ${i + 1}/${cauGroup.de.length}` : 'Đề bài',
  }))
  const dapAn = cauGroup.dapAn.map((doc, i) => ({
    doc, label: `Đáp án · lời giải, bước ${i + 1}/${cauGroup.dapAn.length}`,
  }))
  return [...de, ...dapAn]
}

/* Lightbox xem liên tục các ảnh trong 1 Câu — Đề rồi đến từng bước Đáp án giải theo thứ tự.
   Chỉ lướt trong phạm vi câu này (không tự nhảy sang câu khác). */
export default function ExerciseLightbox({ cauGroup, startIndex = 0, onClose }) {
  const items = buildItems(cauGroup)
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)))
  const touchStartX = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, items.length - 1))
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  if (!items.length) return null
  const current = items[index]

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > SWIPE_THRESHOLD_PX) setIndex(i => Math.max(i - 1, 0))
    else if (dx < -SWIPE_THRESHOLD_PX) setIndex(i => Math.min(i + 1, items.length - 1))
  }

  return (
    <div className="exlb-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="exlb-header">
        <span className="exlb-title">{cauGroup.cauLabel} · {current.label}</span>
        <span className="exlb-counter">{index + 1}/{items.length}</span>
        <button className="exlb-close" onClick={onClose}><XIcon /></button>
      </div>

      <div className="exlb-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {index > 0 && (
          <button className="exlb-nav exlb-nav--prev" onClick={() => setIndex(i => i - 1)} title="Bước trước (←)">
            <ChevronLeft />
          </button>
        )}
        <img key={current.doc.id} src={current.doc.url} alt={current.label} className="exlb-image" />
        {index < items.length - 1 && (
          <button className="exlb-nav exlb-nav--next" onClick={() => setIndex(i => i + 1)} title="Bước tiếp theo (→)">
            <ChevronRight />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="exlb-dots">
          {items.map((it, i) => (
            <button key={it.doc.id}
              className={`exlb-dot ${i === index ? 'is-active' : ''} ${it.doc.section === 'dap_an' ? 'is-dapan' : ''}`}
              onClick={() => setIndex(i)} title={it.label} />
          ))}
        </div>
      )}
    </div>
  )
}

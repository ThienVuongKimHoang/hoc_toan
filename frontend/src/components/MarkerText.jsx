import React from 'react'
import MathText from './MathText.jsx'

// Chuỗi nội dung (question_text hoặc từng đáp án choices[key]) có thể chứa
// marker [img:id] trỏ tới 1 ảnh trong mảng q.images — dùng chung cho câu hỏi
// VÀ từng đáp án A/B/C/D để không phải trùng lặp logic parse/render ảnh.
const MARKER_SPLIT_RE = /(\[img:[^\]]*\])/g
const MARKER_ONE_RE = /^\[img:([^\]]*)\]$/

export function imageSrc(img) {
  if (!img) return ''
  if (img.dataUrl) return img.dataUrl
  if (img.url) return `/images/${img.url.replace('images/', '')}`
  return ''
}

export function referencedImageIds(text) {
  if (!text) return []
  return [...String(text).matchAll(/\[img:([^\]]*)\]/g)].map(m => m[1])
}

export function InlineImage({ img, className = 'figure-img' }) {
  const src = imageSrc(img)
  if (!src) return null
  return (
    <span className="marker-inline-img">
      <img src={src} alt={img.name || 'Hình minh họa'} className={className} loading="lazy" />
    </span>
  )
}

// Render text với marker [img:id] → ảnh thật; phần chữ còn lại qua MathText.
// `showMissingPlaceholder`: hiện 📷 thay chỗ ảnh chưa tìm thấy trong `images`
// (dùng cho preview trong editor — giúp GV biết đang thiếu ảnh).
export default function MarkerText({ text, images, showMissingPlaceholder = false }) {
  const str = text == null ? '' : String(text)
  if (!str) return null
  const parts = str.split(MARKER_SPLIT_RE)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(MARKER_ONE_RE)
        if (m) {
          const img = (images || []).find(im => im.id === m[1])
          if (img) return <InlineImage key={i} img={img} />
          return showMissingPlaceholder
            ? <span key={i} className="eq-img-ref-placeholder">📷</span>
            : null
        }
        return part ? <MathText key={i} text={part} /> : null
      })}
    </>
  )
}

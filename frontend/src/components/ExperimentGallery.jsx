import React from 'react'
import { experimentsFor } from '../experiments/registry.js'
import { SUBJECTS } from './SubjectBadge.jsx'
import './ExperimentGallery.css'

/* Ảnh minh hoạ từng thí nghiệm — SVG nội tuyến, không tải ảnh ngoài */
const THUMBS = {
  incline: () => (
    <svg viewBox="0 0 240 130" aria-hidden="true">
      <defs>
        <linearGradient id="eg-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0cf9f" /><stop offset="1" stopColor="#c48a4f" />
        </linearGradient>
      </defs>
      <rect width="240" height="130" fill="#f8fafc" />
      <path d="M0 112 H240" stroke="#cbd5e1" strokeWidth="2" />
      <polygon points="40,40 40,112 200,112" fill="url(#eg-wood)" />
      <line x1="40" y1="40" x2="200" y2="112" stroke="#7c4a1e" strokeWidth="2.5" />
      <g transform="translate(98 66) rotate(24.2)">
        <rect x="-17" y="-22" width="34" height="22" rx="5" fill="#4b5563" stroke="#1f2937" strokeWidth="1.2" />
      </g>
      <g strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M94 56 V92" stroke="#e11d48" />
        <path d="M94 56 L107 27" stroke="#2563eb" />
        <path d="M84 64 L68 57" stroke="#ea580c" />
      </g>
      <path d="M94 96 l-3.5 -6 h7 z" fill="#e11d48" />
      <path d="M108.5 23.5 l-0.6 7 l-5.8 -3.2 z" fill="#2563eb" />
      <path d="M64 55 l6.5 -1 l-2.5 6 z" fill="#ea580c" />
      <path d="M176 112 A 24 24 0 0 0 178.2 102.3" fill="none" stroke="#334155" strokeWidth="1.6" />
    </svg>
  ),
}

const FlaskIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 006 21h12a1.7 1.7 0 001.5-2.5L14 9V3" /><path d="M7 15h10" />
  </svg>
)
const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
)

/* Danh sách thẻ thí nghiệm cho một lớp (môn + khối). onOpen(exp) mở thí nghiệm. */
export default function ExperimentGallery({ subject, grade, onOpen }) {
  const list = experimentsFor(subject, grade)
  const subjectLabel = SUBJECTS[subject]?.label || 'môn này'

  if (!list.length) {
    return (
      <div className="eg-empty">
        <span className="eg-empty-ico"><FlaskIcon /></span>
        <div className="eg-empty-title">Chưa có thí nghiệm cho {subjectLabel}{grade ? ` lớp ${grade}` : ''}</div>
        <p>Các thí nghiệm ảo đang được xây dựng dần theo chương trình. Hiện có: Mặt phẳng nghiêng (Vật lý 10).</p>
      </div>
    )
  }

  return (
    <div className="eg-grid">
      {list.map(exp => {
        const Thumb = THUMBS[exp.id]
        return (
          <button key={exp.id} className="eg-card" style={{ '--eg-accent': exp.accent }} onClick={() => onOpen(exp)}>
            <div className="eg-thumb">{Thumb ? <Thumb /> : <FlaskIcon />}</div>
            <div className="eg-body">
              <span className="eg-topic">{exp.topic}</span>
              <span className="eg-title">{exp.title}</span>
              <span className="eg-desc">{exp.desc}</span>
              <span className="eg-open">Mở thí nghiệm <ArrowRight /></span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

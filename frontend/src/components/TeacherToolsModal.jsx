import React from 'react'

const WrenchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
)

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const CubeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

const SparklesIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
)

const PenToolIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

const TOOLS = [
  {
    id: 'geo3d',
    Icon: CubeIcon,
    title: 'Vẽ hình không gian',
    desc: 'Tạo và tương tác với các hình hộp, chóp, lăng trụ 3D',
    color: '#7c3aed',
    bg: '#ede9fe',
  },
  {
    id: 'solver',
    Icon: SparklesIcon,
    title: 'Giải bài tập',
    desc: 'AI phân tích lý thuyết cần thiết rồi giải chi tiết từng bước',
    color: '#0369a1',
    bg: '#e0f2fe',
  },
  {
    id: 'whiteboard',
    Icon: PenToolIcon,
    title: 'Bảng trắng',
    desc: 'Bảng vẽ vô hạn: phóng to/thu nhỏ, kéo chọn để di chuyển nét vẽ',
    color: '#c2410c',
    bg: '#ffedd5',
  },
]

export default function TeacherToolsModal({ onSelectTool, onClose }) {
  return (
    <div className="tt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tt-modal">
        <div className="tt-header">
          <span className="tt-header-icon"><WrenchIcon /></span>
          <span className="tt-title">Công cụ giảng dạy</span>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>
        <p className="tt-sub">Chọn công cụ bạn muốn sử dụng</p>
        <div className="tt-cards">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className="tt-card"
              style={{ '--tt-color': t.color, '--tt-bg': t.bg }}
              onClick={() => { onClose(); onSelectTool(t.id) }}
            >
              <div className="tt-card-icon" style={{ color: t.color }}>
                <t.Icon />
              </div>
              <div className="tt-card-title">{t.title}</div>
              <div className="tt-card-desc">{t.desc}</div>
              <div className="tt-card-arrow"><ArrowRightIcon /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

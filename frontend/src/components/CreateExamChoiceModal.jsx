import React, { useState } from 'react'
import { SUBJECTS } from './SubjectBadge.jsx'

function PencilIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

/* Các môn có thể tạo đề (giống loại hình lớp học) */
const SUBJECT_CHOICES = ['toan', 'ly', 'hoa', 'anh', 'toeic', 'ielts', 'thieunhi', 'ngupap', 'van']

const CHOICES = [
  {
    id:    'ai',
    icon:  '🤖',
    title: 'Tạo đề với AI',
    desc:  'Tải lên file PDF hoặc ảnh đề thi, AI tự động trích xuất toàn bộ câu hỏi và đáp án.',
    tags:  ['AI tự động', 'PDF', 'Ảnh'],
    color: '#2563eb',
    bg:    '#eff6ff',
    border:'#93c5fd',
  },
  {
    id:    'manual',
    icon:  '✍️',
    title: 'Nhập thủ công',
    desc:  'Tự nhập từng câu hỏi, chọn đáp án và chỉnh sửa trực tiếp trong trình soạn thảo.',
    tags:  ['Trắc nghiệm', 'Đúng / Sai', 'Trả lời ngắn'],
    color: '#7c3aed',
    bg:    '#f5f3ff',
    border:'#c4b5fd',
  },
  {
    id:    'mix',
    icon:  '🎲',
    title: 'Phối đề ngẫu nhiên',
    desc:  'Chọn chủ đề và số câu, hệ thống tự động lấy ngẫu nhiên từ ngân hàng câu hỏi đã lưu.',
    tags:  ['Ngân hàng câu hỏi', 'Ngẫu nhiên', 'Theo chủ đề'],
    color: '#0891b2',
    bg:    '#ecfeff',
    border:'#67e8f9',
  },
]

const AI_SOURCES = [
  {
    id:    'upload',
    icon:  '📄',
    title: 'Từ file PDF',
    desc:  'Tải lên một file đề thi PDF.',
    tags:  ['Một file', 'PDF'],
    color: '#2563eb',
    bg:    '#eff6ff',
    border:'#93c5fd',
  },
  {
    id:    'images',
    icon:  '🖼️',
    title: 'Từ ảnh',
    desc:  'Tải lên ảnh chụp hoặc ảnh quét các trang đề, xếp theo tên file.',
    tags:  ['Nhiều ảnh', 'JPG', 'PNG', 'WEBP'],
    color: '#15803d',
    bg:    '#f0fdf4',
    border:'#86efac',
  },
]

export default function CreateExamChoiceModal({ onChoice, onClose, initialSubject = null }) {
  const [subject, setSubject] = useState(initialSubject)
  const [choosingAiSource, setChoosingAiSource] = useState(false)
  const pick = (id) => {
    if (id === 'ai') setChoosingAiSource(true)
    else onChoice(id, subject)
  }
  const cards = choosingAiSource ? AI_SOURCES : CHOICES

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box cec-box">
        <div className="modal-header">
          <h2><PencilIcon /> Tạo đề thi mới</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!subject ? (
          <>
            {/* Bước 1 — chọn môn */}
            <p className="cec-subtitle">Bạn muốn tạo đề môn gì?</p>
            <div className="cec-subject-grid">
              {SUBJECT_CHOICES.map(key => (
                <button
                  key={key}
                  type="button"
                  className={`cec-subject-card subject-badge--${key}`}
                  onClick={() => setSubject(key)}
                >
                  <span className="cec-subject-icon">{SUBJECTS[key].icon}</span>
                  <span className="cec-subject-label">{SUBJECTS[key].label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Bước 2 — chọn cách tạo */}
            <div className="cec-step2-head">
              {choosingAiSource ? (
                <button className="cec-back-btn" type="button" onClick={() => setChoosingAiSource(false)}>
                  ← Quay lại
                </button>
              ) : (
                <button className="cec-back-btn" type="button" onClick={() => setSubject(null)}>
                  ← Đổi môn
                </button>
              )}
              <span className={`rs-subject-pill subject-badge--${subject}`}>
                {SUBJECTS[subject].icon} {SUBJECTS[subject].label}
              </span>
            </div>
            <p className="cec-subtitle">{choosingAiSource ? 'Đề thi của bạn ở dạng nào?' : 'Chọn cách bạn muốn tạo đề thi'}</p>

            <div className="cec-choices">
              {cards.map(c => (
                <button
                  key={c.id}
                  className="cec-card"
                  style={{ '--cec-color': c.color, '--cec-bg': c.bg, '--cec-border': c.border }}
                  onClick={() => pick(c.id)}
                >
                  <div className="cec-card-icon">{c.icon}</div>
                  <div className="cec-card-body">
                    <div className="cec-card-title">{c.title}</div>
                    <div className="cec-card-desc">{c.desc}</div>
                    <div className="cec-card-tags">
                      {c.tags.map(t => (
                        <span key={t} className="cec-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="cec-card-arrow">→</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

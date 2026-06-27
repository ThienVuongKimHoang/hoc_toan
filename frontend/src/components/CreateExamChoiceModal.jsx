import React from 'react'

const CHOICES = [
  {
    id:    'upload',
    icon:  '🤖',
    title: 'Tạo từ file PDF',
    desc:  'Upload file đề thi PDF, AI tự động trích xuất toàn bộ câu hỏi và đáp án.',
    tags:  ['AI tự động', 'PDF', 'Nhanh chóng'],
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

export default function CreateExamChoiceModal({ onChoice, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box cec-box">
        <div className="modal-header">
          <h2>✏️ Tạo đề thi mới</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="cec-subtitle">Chọn cách bạn muốn tạo đề thi</p>

        <div className="cec-choices">
          {CHOICES.map(c => (
            <button
              key={c.id}
              className="cec-card"
              style={{ '--cec-color': c.color, '--cec-bg': c.bg, '--cec-border': c.border }}
              onClick={() => onChoice(c.id)}
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
      </div>
    </div>
  )
}

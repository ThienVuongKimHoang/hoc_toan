import React, { useRef, useState } from 'react'

const TIPS = [
  { icon: '📄', text: 'Đề thi chuẩn THPT 3 phần: Trắc nghiệm, Đúng/Sai, Trả lời ngắn' },
  { icon: '🔍', text: 'AI nhận diện chính xác hơn khi PDF có văn bản, không phải ảnh scan' },
  { icon: '⚡', text: 'Xử lý trung bình 8 trang / 30 giây' },
]

export default function UploadStep({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const [error,    setError]    = useState('')
  const inputRef = useRef(null)

  const validate = (file) => {
    if (!file) return 'Không tìm thấy file.'
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))
      return 'Chỉ hỗ trợ file PDF.'
    if (file.size > 50 * 1024 * 1024)
      return 'File quá lớn. Tối đa 50 MB.'
    return ''
  }

  const handleFile = (file) => {
    const err = validate(file)
    if (err) { setError(err); return }
    setError('')
    onUpload(file)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  return (
    <div className="upload-step">
      {/* Drop zone */}
      <div
        className={`us-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="us-file-input"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        {/* Animated illustration */}
        <div className={`us-illustration ${dragging ? 'lift' : ''}`}>
          <div className="us-pdf-icon">
            <div className="us-pdf-body">
              <span className="us-pdf-ext">PDF</span>
              <div className="us-pdf-lines">
                <div /><div /><div />
              </div>
            </div>
            <div className="us-pdf-arrow">↑</div>
          </div>
          {dragging && (
            <div className="us-drop-particles">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="us-particle" style={{ '--i': i }} />
              ))}
            </div>
          )}
        </div>

        <div className="us-text-group">
          <h3 className="us-main-text">
            {dragging ? 'Thả file vào đây!' : 'Kéo & thả file PDF vào đây'}
          </h3>
          <div className="us-divider">
            <span className="us-divider-line" />
            <span className="us-divider-or">hoặc</span>
            <span className="us-divider-line" />
          </div>
          <button className="us-browse-btn" type="button" tabIndex={-1}>
            📂 Chọn file từ máy tính
          </button>
          <p className="us-format-note">
            Hỗ trợ: <strong>PDF</strong> &nbsp;·&nbsp; Tối đa <strong>50 MB</strong>
          </p>
        </div>
      </div>

      {error && (
        <div className="us-error">⚠️ {error}</div>
      )}

      {/* Tips */}
      <div className="us-tips">
        <div className="us-tips-title">💡 Mẹo để AI trích xuất chính xác hơn</div>
        <div className="us-tips-grid">
          {TIPS.map((t, i) => (
            <div className="us-tip-card" key={i}>
              <span className="us-tip-icon">{t.icon}</span>
              <span className="us-tip-text">{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

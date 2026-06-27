import React, { useCallback, useState } from 'react'

export default function UploadZone({ onUpload, disabled }) {
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(
    (file) => {
      if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
        alert('Vui lòng chọn file PDF!')
        return
      }
      onUpload(file)
    },
    [onUpload],
  )

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const onInputChange = (e) => {
    const file = e.target.files[0]
    handleFile(file)
    e.target.value = ''
  }

  return (
    <label
      className={`upload-zone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={disabled ? undefined : onDrop}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={onInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <div className="upload-icon">📄</div>
      <p className="upload-title">Kéo thả file PDF hoặc click để chọn</p>
      <p className="upload-hint">Hỗ trợ đề thi PDF — tự động trích xuất câu hỏi bằng AI</p>
    </label>
  )
}

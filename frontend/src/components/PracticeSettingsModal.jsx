import React, { useState } from 'react'
import { practiceShareUrl, savePracticeSettings } from '../store/examStore.js'

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(str) {
  return str ? new Date(str).toISOString() : null
}

export default function PracticeSettingsModal({ exam, teacherId, onClose, onSaved }) {
  const ps = exam.practiceSettings || {}

  const [enabled,   setEnabled]   = useState(ps.enabled   ?? false)
  const [password,  setPassword]  = useState(ps.password  ?? '')
  const [openTime,  setOpenTime]  = useState(toLocalInput(ps.openTime))
  const [closeTime, setCloseTime] = useState(toLocalInput(ps.closeTime))
  const [showPwd,   setShowPwd]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [error,     setError]     = useState('')

  const link = practiceShareUrl(exam.id)

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSave = async () => {
    if (enabled && openTime && closeTime && new Date(closeTime) <= new Date(openTime)) {
      setError('Thời gian đóng phải sau thời gian mở.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await savePracticeSettings(exam.id, {
        enabled,
        password:  password.trim() || null,
        openTime:  fromLocalInput(openTime),
        closeTime: fromLocalInput(closeTime),
      }, teacherId)
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box psm-box">
        <div className="modal-header">
          <h2>🏋️ Cài đặt Luyện Tập</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="psm-exam-name">{exam.title}</p>

        {/* Enable toggle */}
        <div className="psm-row psm-enable-row">
          <div className="psm-row-label">
            <span className="psm-row-icon">🔓</span>
            <div>
              <div className="psm-row-title">Bật chế độ luyện tập</div>
              <div className="psm-row-desc">Học sinh truy cập link luyện tập mà không cần đăng nhập. Kết quả không được lưu.</div>
            </div>
          </div>
          <label className="pm-toggle-switch">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            <span className="pm-toggle-slider" />
          </label>
        </div>

        {enabled && (
          <>
            {/* Share link */}
            <div className="psm-link-box">
              <div className="psm-link-label">🔗 Link luyện tập</div>
              <div className="psm-link-row">
                <span className="psm-link-url">{link}</span>
                <button className="psm-copy-btn" onClick={handleCopy}>
                  {copied ? '✓ Đã sao chép' : '📋 Sao chép'}
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="psm-section">
              <div className="psm-section-title">🔑 Mật khẩu (tuỳ chọn)</div>
              <div className="psm-pwd-row">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="psm-input"
                  placeholder="Để trống nếu không cần mật khẩu"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button className="psm-show-btn" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Schedule */}
            <div className="psm-section">
              <div className="psm-section-title">📅 Lịch mở (tuỳ chọn)</div>
              <div className="psm-schedule-grid">
                <div className="psm-dt-group">
                  <label className="psm-dt-label">Mở từ</label>
                  <input
                    type="datetime-local"
                    className="psm-input"
                    value={openTime}
                    onChange={e => setOpenTime(e.target.value)}
                  />
                </div>
                <div className="psm-dt-group">
                  <label className="psm-dt-label">Đóng lúc</label>
                  <input
                    type="datetime-local"
                    className="psm-input"
                    value={closeTime}
                    onChange={e => setCloseTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="psm-hint">Để trống = không giới hạn thời gian</p>
            </div>
          </>
        )}

        {error && <div className="pm-error">{error}</div>}

        <div className="psm-footer">
          <button className="mec-btn" onClick={onClose}>Huỷ</button>
          <button className="btn-primary psm-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Đang lưu…' : '💾 Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  )
}

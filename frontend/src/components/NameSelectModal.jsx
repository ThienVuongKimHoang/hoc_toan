import React, { useState } from 'react'

/**
 * Modal chọn tên trước khi vào làm bài.
 * Props:
 *   accountName  – tên tài khoản hiện tại (có thể null)
 *   onConfirm(name) – callback khi xác nhận
 */
export default function NameSelectModal({ accountName, onConfirm }) {
  const [mode,   setMode]   = useState(accountName ? 'account' : 'custom')
  const [custom, setCustom] = useState('')
  const [err,    setErr]    = useState('')

  const handleConfirm = () => {
    const name = mode === 'account' ? accountName : custom.trim()
    if (!name) { setErr('Vui lòng nhập tên của bạn.'); return }
    onConfirm(name)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box nsm-box">
        <div className="nsm-icon">✏️</div>
        <h2 className="nsm-title">Bạn sẽ làm bài với tên gì?</h2>
        <p className="nsm-sub">Tên này sẽ được lưu vào kết quả bài thi.</p>

        <div className="nsm-options">
          {accountName && (
            <button
              className={`nsm-option ${mode === 'account' ? 'active' : ''}`}
              onClick={() => { setMode('account'); setErr('') }}
            >
              <span className="nsmo-icon">👤</span>
              <div className="nsmo-text">
                <div className="nsmo-label">Dùng tên tài khoản</div>
                <div className="nsmo-value">{accountName}</div>
              </div>
              <div className="nsmo-radio">{mode === 'account' ? '🔵' : '⚪'}</div>
            </button>
          )}

          <button
            className={`nsm-option ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => { setMode('custom'); setErr('') }}
          >
            <span className="nsmo-icon">✍️</span>
            <div className="nsmo-text">
              <div className="nsmo-label">Nhập tên khác</div>
              <div className="nsmo-value">{mode === 'custom' && custom ? custom : 'Nhập tên…'}</div>
            </div>
            <div className="nsmo-radio">{mode === 'custom' ? '🔵' : '⚪'}</div>
          </button>
        </div>

        {mode === 'custom' && (
          <input
            autoFocus
            className="nsm-input"
            type="text"
            placeholder="Nhập họ tên của bạn…"
            value={custom}
            maxLength={60}
            onChange={e => { setCustom(e.target.value); setErr('') }}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          />
        )}

        {err && <div className="nsm-err">⚠️ {err}</div>}

        <button className="btn-hero-primary nsm-confirm" onClick={handleConfirm}>
          Vào làm bài →
        </button>
      </div>
    </div>
  )
}

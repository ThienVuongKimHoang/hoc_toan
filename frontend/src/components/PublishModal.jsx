import React, { useEffect, useState } from 'react'
import { classShareUrl, lobbyUrl, publishExam, shareUrl } from '../store/examStore.js'

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LinkCard({ category, categoryColor, label, url, onCopy, copied }) {
  return (
    <div className={`pm-link-card ${copied ? 'pm-link-card--copied' : ''}`}>
      <div className="pm-lc-meta">
        <span className="pm-lc-cat" style={{ background: categoryColor + '18', color: categoryColor }}>
          {category}
        </span>
        <span className="pm-lc-label">{label}</span>
      </div>
      <div className="pm-lc-url-row">
        <span className="pm-lc-url">{url}</span>
        <button className="pm-lc-copy" onClick={onCopy} title={copied ? 'Đã sao chép' : 'Sao chép link'}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
        </button>
      </div>
    </div>
  )
}

function pad(n) { return String(n).padStart(2, '0') }

function addMinutes(dateIso, mins) {
  const d = new Date(dateIso)
  d.setMinutes(d.getMinutes() + mins)
  return toLocalIso(d)
}

function toLocalIso(d) {
  const Y = d.getFullYear()
  const M = pad(d.getMonth() + 1)
  const D = pad(d.getDate())
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  return `${Y}-${M}-${D}T${h}:${m}`
}

const DEFAULT_DURATION = 90

export default function PublishModal({ exam, onClose, onPublished }) {
  const [durH,        setDurH]        = useState(1)
  const [durM,        setDurM]        = useState(30)
  const defaultOpen = toLocalIso(new Date(Date.now() + 5 * 60 * 1000))
  const [openTime,    setOpenTime]    = useState(defaultOpen)
  const [closeTime,   setCloseTime]   = useState(addMinutes(defaultOpen, DEFAULT_DURATION))
  const [closeManual, setCloseManual] = useState(false)
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [hideResults, setHideResults] = useState(false)
  const [lockScreen,  setLockScreen]  = useState(false)
  const [classes,          setClasses]          = useState([])
  const [publishedClasses, setPublishedClasses] = useState([])
  const [link,             setLink]             = useState(null)
  const [copiedKey,        setCopiedKey]        = useState(null)
  const [error,            setError]            = useState('')

  const addClass = () => {
    const id = Math.random().toString(36).slice(2, 8)
    setClasses(prev => [...prev, { id, name: '' }])
  }
  const removeClass = (id) => setClasses(prev => prev.filter(c => c.id !== id))
  const updateClassName = (id, name) => setClasses(prev => prev.map(c => c.id === id ? { ...c, name } : c))

  const copyUrl = (key, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  const durationMins = durH * 60 + durM

  useEffect(() => {
    if (!closeManual) setCloseTime(addMinutes(openTime, durationMins))
  }, [openTime, durationMins, closeManual])

  // Điền sẵn nếu đề đã published
  useEffect(() => {
    if (exam.settings) {
      setHideResults(exam.settings.hideResults || false)
      setLockScreen(exam.settings.lockScreen || false)
    }
  }, [exam])

  const validate = () => {
    if (!openTime)  return 'Vui lòng chọn thời gian mở đề.'
    if (!closeTime) return 'Vui lòng chọn thời gian đóng đề.'
    const open  = new Date(openTime).getTime()
    const close = new Date(closeTime).getTime()
    if (close <= open) return 'Thời gian đóng phải sau thời gian mở.'
    if (close - open < durationMins * 60_000)
      return `Khoảng thời gian giữa mở và đóng phải ≥ thời gian thi (${durationMins} phút).`
    return ''
  }

  const handlePublish = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    const validClasses = classes.filter(c => c.name.trim())
    await publishExam(exam.id, {
      duration:    durationMins,
      openTime:    new Date(openTime).toISOString(),
      closeTime:   new Date(closeTime).toISOString(),
      password:    password.trim() || null,
      hideResults,
      lockScreen,
      classes:     validClasses,
    })
    setPublishedClasses(validClasses)
    setLink(shareUrl(exam.id))
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box publish-modal">
        <div className="modal-header">
          <h2>🚀 Phát đề thi</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!link ? (
          <>
            <div className="pm-row">
              <div className="pm-label">📋 Đề thi</div>
              <div className="pm-exam-title">{exam.title}</div>
              <div className="pm-exam-meta">{exam.totalQuestions} câu hỏi · {exam.source}</div>
            </div>

            <div className="pm-divider" />

            {/* Thời gian thi */}
            <div className="pm-row">
              <div className="pm-label">⏱ Thời gian thi</div>
              <div className="pm-duration-wrap">
                <div className="pm-dur-input-group">
                  <button className="dur-btn" onClick={() => setDurH(h => Math.max(0, h - 1))}>−</button>
                  <div className="dur-display">
                    <input type="number" min="0" max="5" value={durH}
                      onChange={e => setDurH(Math.max(0, Math.min(5, +e.target.value || 0)))}
                      className="dur-input" />
                    <span className="dur-unit">giờ</span>
                  </div>
                  <button className="dur-btn" onClick={() => setDurH(h => Math.min(5, h + 1))}>+</button>
                </div>
                <div className="pm-dur-input-group">
                  <button className="dur-btn" onClick={() => setDurM(m => m <= 0 ? 55 : m - 5)}>−</button>
                  <div className="dur-display">
                    <input type="number" min="0" max="55" step="5" value={durM}
                      onChange={e => setDurM(Math.max(0, Math.min(55, +e.target.value || 0)))}
                      className="dur-input" />
                    <span className="dur-unit">phút</span>
                  </div>
                  <button className="dur-btn" onClick={() => setDurM(m => m >= 55 ? 0 : m + 5)}>+</button>
                </div>
                <div className="dur-total">{durH > 0 ? `${durH}h ` : ''}{durM > 0 ? `${durM}p` : ''} = {durationMins} phút</div>
              </div>
            </div>

            {/* Mở đề */}
            <div className="pm-row">
              <div className="pm-label">📅 Mở đề lúc</div>
              <input type="datetime-local" className="pm-datetime" value={openTime}
                min={toLocalIso(new Date())}
                onChange={e => { setOpenTime(e.target.value); setCloseManual(false) }} />
            </div>

            {/* Đóng đề */}
            <div className="pm-row">
              <div className="pm-label">
                🔒 Đóng đề lúc
                {!closeManual && <span className="pm-auto-badge">tự động</span>}
              </div>
              <input type="datetime-local"
                className={`pm-datetime ${closeManual ? 'pm-datetime--manual' : ''}`}
                value={closeTime} min={openTime}
                onChange={e => { setCloseTime(e.target.value); setCloseManual(true) }} />
              {closeManual && (
                <button className="pm-reset-close"
                  onClick={() => { setCloseManual(false); setCloseTime(addMinutes(openTime, durationMins)) }}>
                  ↺ Đặt lại tự động
                </button>
              )}
            </div>

            {/* Mật khẩu */}
            <div className="pm-row">
              <div className="pm-label">🔑 Mật khẩu <span className="pm-optional">(tuỳ chọn)</span></div>
              <div className="pm-pwd-wrap">
                <input type={showPwd ? 'text' : 'password'} className="pm-input"
                  placeholder="Để trống nếu không cần mật khẩu"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Ẩn kết quả */}
            <div className="pm-row pm-row--toggle">
              <div className="pm-label">
                🔏 Ẩn kết quả
                <span className="pm-optional"> (học sinh không biết đúng/sai sau khi nộp)</span>
              </div>
              <label className="pm-toggle-switch">
                <input type="checkbox" checked={hideResults}
                  onChange={e => setHideResults(e.target.checked)} />
                <span className="pm-toggle-slider" />
              </label>
            </div>
            {hideResults && (
              <div className="pm-hide-note">
                Học sinh sẽ thấy "Bài đã nộp" nhưng không thấy điểm cho đến khi bạn công bố kết quả.
              </div>
            )}

            {/* Khóa màn hình */}
            <div className="pm-row pm-row--toggle">
              <div className="pm-label">
                🔒 Khóa màn hình
                <span className="pm-optional"> (chống gian lận: toàn màn hình, chặn rời tab & copy)</span>
              </div>
              <label className="pm-toggle-switch">
                <input type="checkbox" checked={lockScreen}
                  onChange={e => setLockScreen(e.target.checked)} />
                <span className="pm-toggle-slider" />
              </label>
            </div>
            {lockScreen && (
              <div className="pm-hide-note">
                Học sinh phải làm bài ở chế độ toàn màn hình. Rời tab, thoát toàn màn hình hoặc dùng phím tắt sẽ bị ghi nhận vi phạm và báo cho bạn.
              </div>
            )}

            {/* Lớp học */}
            <div className="pm-row pm-row--col">
              <div className="pm-label">🏫 Phát theo lớp <span className="pm-optional">(tuỳ chọn)</span></div>
              <div className="pm-classes-list">
                {classes.map((cls, i) => (
                  <div key={cls.id} className="pm-class-item">
                    <input
                      type="text"
                      className="pm-input pm-class-input"
                      placeholder={`Tên lớp (vd: 10A${i + 1})`}
                      value={cls.name}
                      onChange={e => updateClassName(cls.id, e.target.value)}
                    />
                    <button className="pm-class-del" onClick={() => removeClass(cls.id)} title="Xoá lớp">✕</button>
                  </div>
                ))}
                <button className="pm-add-class-btn" onClick={addClass}>+ Thêm lớp</button>
              </div>
            </div>

            {error && <div className="pm-error">⚠️ {error}</div>}

            <div className="pm-summary">
              {openTime && closeTime && (
                <>
                  <div className="pm-sum-row"><span>Mở:</span><strong>{new Date(openTime).toLocaleString('vi-VN')}</strong></div>
                  <div className="pm-sum-row"><span>Đóng:</span><strong>{new Date(closeTime).toLocaleString('vi-VN')}</strong></div>
                  <div className="pm-sum-row"><span>Thời gian thi:</span><strong>{durationMins} phút</strong></div>
                  {password && <div className="pm-sum-row"><span>Mật khẩu:</span><strong>Có</strong></div>}
                  <div className="pm-sum-row">
                    <span>Kết quả:</span>
                    <strong>{hideResults ? '🔏 Ẩn đến khi GV công bố' : '👁 Hiện ngay sau khi nộp'}</strong>
                  </div>
                </>
              )}
            </div>

            <div className="pm-footer">
              <button className="pm-cancel" onClick={onClose}>Huỷ</button>
              <button className="pm-submit" disabled={durationMins < 5} onClick={handlePublish}>
                ✅ Tạo link phát đề
              </button>
            </div>
          </>
        ) : (
          <div className="pm-link-panel">
            <div className="pm-link-success">
              <div className="pls-check">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className="pls-title">Đề thi đã được phát!</div>
                <div className="pls-sub">Sao chép link bên dưới và chia sẻ cho học sinh</div>
              </div>
            </div>

            {/* Link đề thi — chung (hoặc duy nhất nếu không có lớp) */}
            <div className="pm-links-section">
              <div className="pm-links-group-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Đề thi
              </div>

              <LinkCard
                category="Đề thi"
                categoryColor="#2563eb"
                label={publishedClasses.length > 0 ? 'Tất cả lớp' : exam.title}
                url={link}
                onCopy={() => copyUrl('general', link)}
                copied={copiedKey === 'general'}
              />

              {publishedClasses.map(cls => (
                <LinkCard
                  key={cls.id}
                  category="Đề thi"
                  categoryColor="#2563eb"
                  label={`Lớp ${cls.name}`}
                  url={classShareUrl(exam.id, cls.id)}
                  onCopy={() => copyUrl(cls.id, classShareUrl(exam.id, cls.id))}
                  copied={copiedKey === cls.id}
                />
              ))}

              <LinkCard
                category="Sảnh chờ"
                categoryColor="#7c3aed"
                label="Link sảnh chờ (nhập mã đề)"
                url={lobbyUrl(exam.id)}
                onCopy={() => copyUrl('lobby', lobbyUrl(exam.id))}
                copied={copiedKey === 'lobby'}
              />
            </div>

            {/* Thông tin đề */}
            <div className="pm-link-info">
              <div>📅 Mở: <strong>{new Date(openTime).toLocaleString('vi-VN')}</strong></div>
              <div>🔒 Đóng: <strong>{new Date(closeTime).toLocaleString('vi-VN')}</strong></div>
              <div>⏱ Thời gian: <strong>{durationMins} phút</strong></div>
              {password && <div>🔑 Mật khẩu: <strong>Có</strong></div>}
              <div>{hideResults ? '🔏 Kết quả ẩn' : '👁 Kết quả hiện ngay'}</div>
            </div>

            <div className="pm-footer">
              <button className="pm-cancel" onClick={onClose}>Đóng</button>
              <button className="pm-submit" onClick={onPublished}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
                Xem danh sách đề →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

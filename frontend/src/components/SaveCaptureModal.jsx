import React, { useEffect, useMemo, useState } from 'react'
import { cauLabelsInFolder, nextDapAnOrder } from '../utils/exerciseDocs.js'

/* ─── Popup lưu ảnh (chụp từ bảng trắng, hoặc upload trong 1 Buổi) vào cấu trúc
   Buổi → Câu → Đề / Đáp án giải. Truyền lockedFolder khi đã biết sẵn Buổi (vd đang mở
   Buổi đó và upload thêm) — ẩn hẳn phần chọn Buổi, chỉ hỏi Câu + Đề/Đáp án. ─── */
export default function SaveCaptureModal({ blob, existingFolders, folderDocs = [], lockedFolder = null, onCancel, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [name, setName] = useState('')
  const [folderMode, setFolderMode] = useState(existingFolders.length ? 'existing' : 'new')
  const [selectedFolder, setSelectedFolder] = useState(existingFolders[0] || '')
  const [newFolderName, setNewFolderName] = useState('')
  const [section, setSection] = useState('de')   // 'de' | 'dap_an'
  const [cauMode, setCauMode] = useState('new')
  const [selectedCau, setSelectedCau] = useState('')
  const [newCauLabel, setNewCauLabel] = useState('')
  const [order, setOrder] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  const folder = lockedFolder ?? (folderMode === 'existing' ? selectedFolder : newFolderName.trim())
  const cauOptions = useMemo(() => cauLabelsInFolder(folderDocs, folder), [folderDocs, folder])

  // Buổi đổi → nếu buổi đó chưa có câu nào thì về chế độ "câu mới"; nếu có thì chọn câu đầu tiên.
  // Không đụng vào newCauLabel đang gõ dở, tránh xóa mất tên câu người dùng vừa nhập.
  useEffect(() => {
    if (!cauOptions.length) {
      setCauMode('new')
    } else {
      setCauMode('existing')
      setSelectedCau(c => (cauOptions.includes(c) ? c : cauOptions[0]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder])

  const cauLabel = cauMode === 'existing' ? selectedCau : newCauLabel.trim()

  // Đổi câu/loại → gợi ý lại thứ tự bước đáp án tiếp theo
  useEffect(() => {
    if (section === 'dap_an' && cauLabel) setOrder(nextDapAnOrder(folderDocs, folder, cauLabel))
  }, [section, cauLabel, folder, folderDocs])

  const handleSubmit = async () => {
    if (!folder) { alert('Vui lòng chọn hoặc đặt tên Buổi để lưu.'); return }
    if (!cauLabel) { alert('Vui lòng chọn hoặc đặt tên Câu để lưu.'); return }
    const autoName = section === 'de' ? `${cauLabel} · Đề` : `${cauLabel} · Đáp án bước ${order}`
    setSaving(true)
    try {
      await onConfirm({
        name: name.trim() || autoName,
        folder, cauLabel, section,
        order: section === 'dap_an' ? (Number(order) || 1) : 0,
      })
    } catch (err) {
      alert('Lưu ảnh thất bại: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header"><h2>💾 Lưu ảnh đã chụp</h2><button className="modal-close" onClick={onCancel}>✕</button></div>
        <div style={{ padding: '0 24px 24px' }}>
          {previewUrl && <img src={previewUrl} alt="Xem trước" className="wb-capture-preview" />}

          <label className="cm-label">Tên ảnh (tùy chọn)</label>
          <input className="cm-input" placeholder="Để trống sẽ tự đặt tên theo Câu" value={name}
            onChange={e => setName(e.target.value)} autoFocus />

          <label className="cm-label" style={{ marginTop: 14 }}>Buổi</label>
          {lockedFolder ? (
            <div className="wb-locked-field">📂 {lockedFolder}</div>
          ) : (
            <>
              {existingFolders.length > 0 && (
                <div className="wb-folder-mode-row">
                  <button type="button" className={`wb-folder-mode-btn ${folderMode === 'existing' ? 'is-active' : ''}`}
                    onClick={() => setFolderMode('existing')}>Buổi có sẵn</button>
                  <button type="button" className={`wb-folder-mode-btn ${folderMode === 'new' ? 'is-active' : ''}`}
                    onClick={() => setFolderMode('new')}>+ Buổi mới</button>
                </div>
              )}
              {folderMode === 'existing' && existingFolders.length > 0 ? (
                <select className="cm-input cm-select" value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}>
                  {existingFolders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <input className="cm-input" placeholder="VD: Buổi 1, Buổi 2…" value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)} />
              )}
            </>
          )}

          <label className="cm-label" style={{ marginTop: 14 }}>Câu</label>
          {cauOptions.length > 0 && (
            <div className="wb-folder-mode-row">
              <button type="button" className={`wb-folder-mode-btn ${cauMode === 'existing' ? 'is-active' : ''}`}
                onClick={() => setCauMode('existing')}>Câu có sẵn</button>
              <button type="button" className={`wb-folder-mode-btn ${cauMode === 'new' ? 'is-active' : ''}`}
                onClick={() => setCauMode('new')}>+ Câu mới</button>
            </div>
          )}
          {cauMode === 'existing' && cauOptions.length > 0 ? (
            <select className="cm-input cm-select" value={selectedCau} onChange={e => setSelectedCau(e.target.value)}>
              {cauOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="cm-input" placeholder={`Gợi ý: Câu ${cauOptions.length + 1}`} value={newCauLabel}
              onChange={e => setNewCauLabel(e.target.value)} />
          )}

          <label className="cm-label" style={{ marginTop: 14 }}>Đây là</label>
          <div className="wb-folder-mode-row">
            <button type="button" className={`wb-folder-mode-btn ${section === 'de' ? 'is-active' : ''}`}
              onClick={() => setSection('de')}>📄 Đề bài</button>
            <button type="button" className={`wb-folder-mode-btn ${section === 'dap_an' ? 'is-active' : ''}`}
              onClick={() => setSection('dap_an')}>✅ Đáp án · lời giải</button>
          </div>

          {section === 'dap_an' && (
            <>
              <label className="cm-label" style={{ marginTop: 14 }}>Thứ tự bước giải</label>
              <input className="cm-input" type="number" min={1} value={order}
                onChange={e => setOrder(e.target.value)} style={{ maxWidth: 100 }} />
            </>
          )}

          <div className="cm-footer">
            <button className="pm-cancel" onClick={onCancel}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

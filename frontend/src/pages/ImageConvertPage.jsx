import React, { useCallback, useEffect, useRef, useState } from 'react'
import { deletePage, deleteSession, exportDocument, getSession, listSessions } from '../store/imageConvertStore.js'
import {
  SAVE_LABEL, byName, itemFromFile, newId, releasePreview, useImageConvertSession,
} from '../store/useImageConvertSession.js'
import ImageConvertEditor from '../components/ImageConvertEditor.jsx'
import { FormatPicker, PageList } from '../components/ImageConvertParts.jsx'

const MAX_FILES = 50
const ACCEPT = 'image/jpeg,image/png,image/webp'

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

function timeLeft(iso) {
  const minutes = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60_000))
  return minutes >= 60 ? `còn ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `còn ${minutes} phút`
}

export default function ImageConvertPage({ onBack }) {
  const [sessions, setSessions] = useState([])
  const [format, setFormat] = useState('docx')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const inputRef = useRef(null)

  const reloadSessions = useCallback(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])

  const {
    items, setItems, itemsRef, sessionId, converting, saveState,
    flushSaves, prepareToLeave, showSession: loadSession, updateMarkdown, forgetPage, convert: runConvert,
  } = useImageConvertSession({ onPageSaved: reloadSessions })

  useEffect(() => { reloadSessions() }, [reloadSessions])

  const leave = async () => {
    if (await prepareToLeave()) onBack()
  }

  const showSession = (id, nextItems) => {
    loadSession(id, nextItems)
    setEditingId(null)
    setError('')
  }

  const startNewSession = async () => {
    if (await prepareToLeave()) showSession(newId(), [])
    reloadSessions()
  }

  const openSession = async (id) => {
    if (id === sessionId || !(await prepareToLeave())) return
    try {
      const session = await getSession(id)
      showSession(id, session.pages.map(p => ({
        id: p.id, name: p.fileName, file: null, preview: p.original, status: 'done', error: '',
        result: { markdown: p.markdown, figures: p.figures, warnings: p.warnings },
      })).sort(byName))
    } catch (err) {
      setError(err.message)
      reloadSessions()
    }
  }

  const removeSession = async (id) => {
    if (!confirm('Xoá phiên này? Nội dung đã sửa sẽ mất hẳn.')) return
    try {
      await deleteSession(id)
      if (id === sessionId) {
        itemsRef.current.forEach(it => forgetPage(it.id))
        showSession(newId(), [])
      }
    } catch (err) {
      setError(err.message)
    }
    reloadSessions()
  }

  const addFiles = (fileList) => {
    setError('')
    const images = [...fileList].filter(f => ACCEPT.split(',').includes(f.type))
    if (images.length < fileList.length) setError('Chỉ nhận ảnh JPG, PNG hoặc WEBP, các file khác đã được bỏ qua.')
    const added = images.map(itemFromFile)
    setItems(prev => {
      const next = [...prev, ...added].sort(byName)
      const kept = next.slice(0, MAX_FILES)
      if (next.length > MAX_FILES) {
        next.slice(MAX_FILES).forEach(releasePreview)
        setError(`Mỗi lần tối đa ${MAX_FILES} ảnh.`)
      }
      return kept
    })
  }

  const removeItem = async (item) => {
    if (item.status === 'done') {
      if (!confirm('Bỏ trang này? Nội dung đã sửa sẽ mất hẳn.')) return
      await flushSaves()
      try {
        await deletePage(sessionId, item.id)
      } catch (err) {
        setError(err.message)
        return
      }
      forgetPage(item.id)
      reloadSessions()
    }
    releasePreview(item)
    setItems(prev => prev.filter(it => it.id !== item.id))
  }

  const convert = () => {
    setError('')
    return runConvert()
  }

  const download = async () => {
    setExporting(true)
    setError('')
    try {
      const pages = items.filter(it => it.status === 'done')
        .map(({ result }) => ({ markdown: result.markdown, figures: result.figures }))
      await exportDocument(format, pages)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const doneCount = items.filter(it => it.status === 'done').length
  const remaining = items.length - doneCount
  const busy = converting || exporting

  return (
    <div className="es-page" style={{ overflowY: 'auto' }}>
      <div className="es-header">
        <button className="tool-page-back" onClick={leave} disabled={converting}>
          <ArrowLeftIcon /> Quay lại
        </button>
        <span className="es-header-title"><FileIcon /> Chuyển ảnh sang Word / LaTeX</span>
      </div>

      <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Phiên làm việc</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Tự động lưu, giữ 24 giờ kể từ lần sửa gần nhất.</div>
            </div>
            <button type="button" className="cm-tab" style={{ color: '#0369a1' }} disabled={converting} onClick={startNewSession}>Phiên mới</button>
          </div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Chưa có phiên nào được lưu.</div>
          ) : (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: s.id === sessionId ? '#e0f2fe' : '#f8fafc' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      {s.pageCount} trang · {timeLeft(s.expiresAt)}{s.id === sessionId && ' · đang mở'}
                    </div>
                  </div>
                  {s.id !== sessionId && (
                    <button type="button" className="cm-tab" style={{ color: '#0369a1' }} disabled={converting} onClick={() => openSession(s.id)}>Mở</button>
                  )}
                  <button type="button" className="cm-remove-btn" disabled={converting} onClick={() => removeSession(s.id)}>Xoá</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          style={{
            border: `2px dashed ${dragging ? '#0369a1' : '#cbd5e1'}`, borderRadius: 12, padding: '28px 16px',
            textAlign: 'center', cursor: 'pointer', background: dragging ? '#e0f2fe' : '#f8fafc',
          }}
        >
          <div style={{ fontWeight: 600 }}>Bấm để chọn hoặc kéo thả ảnh vào đây</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            JPG, PNG, WEBP, tối đa 15 MB mỗi ảnh. Các trang được xếp theo tên file.
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        <PageList items={items} onEdit={setEditingId} onRemove={removeItem} removeDisabled={converting} />

        <FormatPicker value={format} onChange={setFormat} name="image-convert-format" />

        {error && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 14 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={convert} disabled={busy || remaining === 0}>
            {converting ? `Đang nhận dạng ${doneCount}/${items.length}…`
              : doneCount > 0 && remaining > 0 ? `Nhận dạng ${remaining} ảnh còn lại` : 'Bắt đầu nhận dạng'}
          </button>
          <button className="btn-primary" onClick={download} disabled={busy || doneCount === 0}>
            {exporting ? 'Đang tạo file…' : `Tải ${format === 'latex' ? 'file LaTeX' : 'file Word'}`}
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
          Nội dung do AI đọc từ ảnh nên có thể sai sót, hãy bấm Chỉnh sửa để đối chiếu với ảnh gốc trước khi tải.
          {SAVE_LABEL[saveState] && ` ${SAVE_LABEL[saveState]}.`}
        </p>
      </div>

      {editingId && items.some(it => it.id === editingId && it.status === 'done') && (
        <ImageConvertEditor
          pages={items.filter(it => it.status === 'done')}
          currentId={editingId}
          saveLabel={SAVE_LABEL[saveState]}
          onSelect={setEditingId}
          onChange={updateMarkdown}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

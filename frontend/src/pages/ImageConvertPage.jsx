import React, { useCallback, useEffect, useRef, useState } from 'react'
import { blockReload } from '../realtime/reloadGuard.js'
import {
  deletePage, deleteSession, exportDocument, getSession, listSessions, recognizeImage, savePage,
} from '../store/imageConvertStore.js'
import ImageConvertEditor from '../components/ImageConvertEditor.jsx'

const MAX_FILES = 50
const ACCEPT = 'image/jpeg,image/png,image/webp'

const FORMATS = [
  { value: 'docx', title: 'Word (.docx)', desc: 'Công thức là công thức Word, sửa trực tiếp được' },
  { value: 'mathtype', title: 'Word + MathType (.docx)', desc: 'Công thức là đối tượng MathType, cần có MathType để sửa' },
  { value: 'latex', title: 'LaTeX (.zip)', desc: 'Gồm main.tex và thư mục hình, mở được trên Overleaf' },
]

const STATUS_LABEL = {
  pending: { text: 'Chờ xử lý', color: '#64748b' },
  working: { text: 'Đang nhận dạng…', color: '#0369a1' },
  done: { text: 'Xong', color: '#15803d' },
  error: { text: 'Lỗi', color: '#b91c1c' },
}

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

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })

const newId = () => crypto.randomUUID()
const releasePreview = (item) => { if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview) }

const SAVE_DELAY = 800
const SAVE_LABEL = { saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Chưa lưu được, sẽ thử lại khi bạn sửa tiếp' }

function timeLeft(iso) {
  const minutes = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60_000))
  return minutes >= 60 ? `còn ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `còn ${minutes} phút`
}

export default function ImageConvertPage({ onBack }) {
  const [items, setItems] = useState([])
  const [sessionId, setSessionId] = useState(newId)
  const [sessions, setSessions] = useState([])
  const [format, setFormat] = useState('docx')
  const [converting, setConverting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const inputRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const dirtyRef = useRef(new Map())          // id trang → có phải gửi lại hình không
  const saveTimerRef = useRef(null)
  const saveChainRef = useRef(Promise.resolve())   // giữ thứ tự: bản cũ không được ghi đè bản mới

  const reloadSessions = useCallback(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])

  const flushSaves = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    const batch = [...dirtyRef.current]
    dirtyRef.current.clear()
    const sid = sessionIdRef.current
    saveChainRef.current = saveChainRef.current.then(async () => {
      if (!batch.length) return
      try {
        for (const [pageId, withFigures] of batch) {
          const result = itemsRef.current.find(it => it.id === pageId)?.result
          if (!result) continue
          await savePage(sid, pageId, {
            markdown: result.markdown,
            ...(withFigures ? { figures: result.figures } : {}),
          })
        }
        if (!dirtyRef.current.size && !saveTimerRef.current) setSaveState('saved')
      } catch {
        batch.forEach(([id, figures]) => dirtyRef.current.set(id, dirtyRef.current.get(id) || figures))
        setSaveState('error')
      }
    })
    return saveChainRef.current
  }, [])

  useEffect(() => {
    reloadSessions()
    return () => {
      flushSaves()
      itemsRef.current.forEach(releasePreview)
    }
  }, [reloadSessions, flushSaves])

  // Trong lúc chờ lưu mà trang tự tải lại thì mất đoạn vừa gõ.
  const unsaved = saveState === 'saving' || saveState === 'error'
  useEffect(() => (unsaved ? blockReload('chuyen-anh-chua-luu') : undefined), [unsaved])

  /* Lưu nốt rồi mới rời phiên hiện tại; false nếu người dùng chọn ở lại. */
  const prepareToLeaveSession = async () => {
    await flushSaves()
    if (dirtyRef.current.size && !confirm('Có nội dung chưa lưu được và sẽ bị mất. Tiếp tục?')) return false
    if (itemsRef.current.some(it => it.status !== 'done') && !confirm('Các ảnh chưa nhận dạng sẽ bị bỏ. Tiếp tục?')) return false
    dirtyRef.current.clear()
    return true
  }

  const leave = async () => {
    if (await prepareToLeaveSession()) onBack()
  }

  const showSession = (id, nextItems) => {
    itemsRef.current.forEach(releasePreview)
    sessionIdRef.current = id
    setSessionId(id)
    setItems(nextItems)
    setEditingId(null)
    setSaveState('idle')
    setError('')
  }

  const startNewSession = async () => {
    if (await prepareToLeaveSession()) showSession(newId(), [])
    reloadSessions()
  }

  const openSession = async (id) => {
    if (id === sessionId || !(await prepareToLeaveSession())) return
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
        dirtyRef.current.clear()
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
    const added = images.map(file => ({
      id: newId(), name: file.name,
      file, preview: URL.createObjectURL(file), status: 'pending', result: null, error: '',
    }))
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

  const updateMarkdown = (id, markdown, newFigure) => {
    setItems(prev => prev.map(it => (it.id === id ? {
      ...it,
      result: { ...it.result, markdown, figures: newFigure ? [...it.result.figures, newFigure] : it.result.figures },
    } : it)))
    dirtyRef.current.set(id, dirtyRef.current.get(id) || !!newFigure)
    setSaveState('saving')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flushSaves, SAVE_DELAY)
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
      dirtyRef.current.delete(item.id)
      reloadSessions()
    }
    releasePreview(item)
    setItems(prev => prev.filter(it => it.id !== item.id))
  }

  const patchItem = (id, patch) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))

  // Làm lần lượt từng ảnh để không chạm giới hạn tốc độ của Groq; ảnh lỗi bấm lại là chạy lại.
  const convert = async () => {
    setConverting(true)
    setError('')
    const release = blockReload('chuyen-anh')
    try {
      for (const item of itemsRef.current.filter(it => it.status !== 'done')) {
        patchItem(item.id, { status: 'working', error: '' })
        try {
          patchItem(item.id, { status: 'done', result: await recognizeImage(item.file, sessionId, item.id) })
          reloadSessions()
        } catch (err) {
          patchItem(item.id, { status: 'error', error: err.message })
        }
      }
    } finally {
      release()
      setConverting(false)
    }
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

        {items.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, index) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                <img src={it.preview} alt={`Trang ${index + 1}`} style={{ width: 48, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {it.name}</div>
                  <div style={{ fontSize: 13, color: STATUS_LABEL[it.status].color }}>
                    {STATUS_LABEL[it.status].text}
                    {it.status === 'done' && it.result.figures.length > 0 && ` · ${it.result.figures.length} hình`}
                    {it.error && `: ${it.error}`}
                  </div>
                  {it.result?.warnings?.map(w => (
                    <div key={w} style={{ fontSize: 13, color: '#b45309' }}>{w}</div>
                  ))}
                </div>
                {it.status === 'done' && (
                  <button type="button" className="cm-tab" style={{ color: '#0369a1' }} onClick={() => setEditingId(it.id)}>Chỉnh sửa</button>
                )}
                <button type="button" className="cm-remove-btn" title="Bỏ ảnh này" disabled={converting}
                  onClick={() => removeItem(it)}>Bỏ</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {FORMATS.map(f => (
            <label key={f.value} style={{
              display: 'flex', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${format === f.value ? '#0369a1' : '#e2e8f0'}`,
              background: format === f.value ? '#e0f2fe' : '#fff',
            }}>
              <input type="radio" name="image-convert-format" value={f.value} checked={format === f.value}
                onChange={() => setFormat(f.value)} />
              <span>
                <span style={{ fontWeight: 600 }}>{f.title}</span>
                <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{f.desc}</span>
              </span>
            </label>
          ))}
        </div>

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

import { useCallback, useEffect, useRef, useState } from 'react'
import { blockReload } from '../realtime/reloadGuard.js'
import { recognizeImage, savePage } from './imageConvertStore.js'

export const newId = () => crypto.randomUUID()
export const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })
export const releasePreview = (item) => { if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview) }
export const itemFromFile = (file) => ({
  id: newId(), name: file.name,
  file, preview: URL.createObjectURL(file), status: 'pending', result: null, error: '',
})

export const SAVE_LABEL = { saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Chưa lưu được, sẽ thử lại khi bạn sửa tiếp' }
const SAVE_DELAY = 800

/* Trạng thái một phiên chuyển ảnh: các trang, nhận dạng lần lượt, tự lưu khi sửa.
   Dùng chung cho công cụ chuyển ảnh và bước "File Word" khi tạo đề từ ảnh. */
export function useImageConvertSession({ initialItems = [], onPageSaved } = {}) {
  const [items, setItems] = useState(initialItems)
  const [sessionId, setSessionId] = useState(newId)
  const [converting, setConverting] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const itemsRef = useRef(items)
  itemsRef.current = items
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const onPageSavedRef = useRef(onPageSaved)
  onPageSavedRef.current = onPageSaved
  const dirtyRef = useRef(new Map())          // id trang → có phải gửi lại hình không
  const saveTimerRef = useRef(null)
  const saveChainRef = useRef(Promise.resolve())   // giữ thứ tự: bản cũ không được ghi đè bản mới

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

  // StrictMode (dev) gỡ rồi gắn lại effect ngay lập tức: chỉ thu hồi ảnh xem trước khi thật sự rời đi.
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      flushSaves()
      queueMicrotask(() => { if (!mountedRef.current) itemsRef.current.forEach(releasePreview) })
    }
  }, [flushSaves])

  // Trong lúc chờ lưu mà trang tự tải lại thì mất đoạn vừa gõ.
  const unsaved = saveState === 'saving' || saveState === 'error'
  useEffect(() => (unsaved ? blockReload('chuyen-anh-chua-luu') : undefined), [unsaved])

  /* Lưu nốt rồi mới rời phiên hiện tại; false nếu người dùng chọn ở lại. */
  const prepareToLeave = useCallback(async () => {
    await flushSaves()
    if (dirtyRef.current.size && !confirm('Có nội dung chưa lưu được và sẽ bị mất. Tiếp tục?')) return false
    if (itemsRef.current.some(it => it.status !== 'done') && !confirm('Các ảnh chưa nhận dạng sẽ bị bỏ. Tiếp tục?')) return false
    dirtyRef.current.clear()
    return true
  }, [flushSaves])

  const showSession = useCallback((id, nextItems) => {
    itemsRef.current.forEach(releasePreview)
    sessionIdRef.current = id
    setSessionId(id)
    setItems(nextItems)
    setSaveState('idle')
  }, [])

  const updateMarkdown = useCallback((id, markdown, newFigure) => {
    setItems(prev => prev.map(it => (it.id === id ? {
      ...it,
      result: { ...it.result, markdown, figures: newFigure ? [...it.result.figures, newFigure] : it.result.figures },
    } : it)))
    dirtyRef.current.set(id, dirtyRef.current.get(id) || !!newFigure)
    setSaveState('saving')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flushSaves, SAVE_DELAY)
  }, [flushSaves])

  const forgetPage = useCallback((id) => { dirtyRef.current.delete(id) }, [])

  const patchItem = (id, patch) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))

  // Làm lần lượt từng ảnh để không chạm giới hạn tốc độ của Groq; ảnh lỗi bấm lại là chạy lại.
  const convert = useCallback(async () => {
    setConverting(true)
    const release = blockReload('chuyen-anh')
    try {
      for (const item of itemsRef.current.filter(it => it.status !== 'done')) {
        patchItem(item.id, { status: 'working', error: '' })
        try {
          patchItem(item.id, { status: 'done', result: await recognizeImage(item.file, sessionIdRef.current, item.id) })
          onPageSavedRef.current?.()
        } catch (err) {
          patchItem(item.id, { status: 'error', error: err.message })
        }
      }
    } finally {
      release()
      setConverting(false)
    }
  }, [])

  return {
    items, setItems, itemsRef, sessionId, converting, saveState,
    flushSaves, prepareToLeave, showSession, updateMarkdown, forgetPage, convert,
  }
}

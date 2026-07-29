import React, { useEffect, useRef, useState } from 'react'
import { updateDocument } from '../store/classStore.js'

const DefaultGripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
)

/* Danh sách tài liệu (.cm-doc-list) hỗ trợ kéo-thả sắp xếp lại bằng Pointer Events (chuột
   lẫn cảm ứng) — khác với ExerciseFolderView (dùng HTML5 draggable cho ảnh bài tập).
   Cầm tay nắm → nhấn giữ thu nhỏ hàng đó lại, kéo lên/xuống → các hàng khác tự trượt
   nhường chỗ. Thứ tự cuối cùng lưu vào field `order` của từng document qua PATCH, chỉ
   ghi những doc thực sự đổi order (giống pattern ExerciseFolderView.handleDrop). */
export default function SortableDocList({
  docs, classId, onChanged, editable = false, dragDisabled = false,
  renderRow, onRowClick, handleIcon,
}) {
  const [docIds, setDocIds] = useState(() => docs.map(d => d.id))
  const [dragId, setDragId] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [saving, setSaving] = useState(false)
  const rowNodes = useRef(new Map())
  const listRef = useRef(null)
  const dragMeta = useRef(null)

  const idsKey = docs.map(d => d.id).join(',')
  useEffect(() => {
    if (dragId != null) return   // không đồng bộ lại giữa lúc đang kéo, tránh giật hình
    setDocIds(docs.map(d => d.id))
  }, [idsKey, dragId])

  const locked = !editable || dragDisabled || saving
  const docsById = new Map(docs.map(d => [d.id, d]))

  const registerNode = (id) => (node) => {
    if (node) rowNodes.current.set(id, node)
    else rowNodes.current.delete(id)
  }

  const clearDrag = () => {
    const node = dragId != null ? rowNodes.current.get(dragId) : null
    if (node) node.style.transform = ''
    setDragId(null)
    setOverIndex(null)
    dragMeta.current = null
  }

  const handlePointerDown = (id) => (e) => {
    if (locked || dragId != null) return
    const node = rowNodes.current.get(id)
    const listEl = listRef.current
    if (!node || !listEl) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const rect = node.getBoundingClientRect()
    const cs = getComputedStyle(listEl)
    const gap = parseFloat(cs.rowGap || cs.gap || '0') || 0
    const slotHeight = rect.height + gap
    const startIndex = docIds.indexOf(id)
    dragMeta.current = { startClientY: e.clientY, slotHeight, startIndex }
    node.style.transform = 'scale(0.96)'
    setDragId(id)
    setOverIndex(startIndex)
  }

  const handlePointerMove = (id) => (e) => {
    if (dragId !== id || !dragMeta.current) return
    const { startClientY, slotHeight, startIndex } = dragMeta.current
    const rawDelta = e.clientY - startClientY
    const minDelta = -startIndex * slotHeight
    const maxDelta = (docIds.length - 1 - startIndex) * slotHeight
    const clampedDelta = Math.min(Math.max(rawDelta, minDelta), maxDelta)
    const node = rowNodes.current.get(id)
    if (node) node.style.transform = `translateY(${clampedDelta}px) scale(0.96)`
    const targetIndex = Math.min(Math.max(startIndex + Math.round(clampedDelta / slotHeight), 0), docIds.length - 1)
    setOverIndex(prev => (prev === targetIndex ? prev : targetIndex))
  }

  const commitDrag = async (id) => {
    const meta = dragMeta.current
    if (!meta || dragId !== id) { clearDrag(); return }
    const { startIndex } = meta
    const finalOverIndex = overIndex
    if (finalOverIndex == null || finalOverIndex === startIndex) { clearDrag(); return }
    const nextIds = [...docIds]
    const [movedId] = nextIds.splice(startIndex, 1)
    nextIds.splice(finalOverIndex, 0, movedId)
    clearDrag()
    setDocIds(nextIds)
    const updates = nextIds
      .map((docId, i) => ({ doc: docsById.get(docId), order: i + 1 }))
      .filter(({ doc, order }) => doc && doc.order !== order)
    if (!updates.length) return
    setSaving(true)
    try {
      await Promise.all(updates.map(({ doc, order }) => updateDocument(classId, doc.id, { order })))
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const handlePointerUp = (id) => () => {
    if (dragId !== id) return
    commitDrag(id)
  }

  return (
    <div className="cm-doc-list" ref={listRef}>
      {docIds.map((id, index) => {
        const doc = docsById.get(id)
        if (!doc) return null
        const isDragging = dragId === id
        let shift = 0
        if (dragId != null && overIndex != null && !isDragging && dragMeta.current) {
          const { startIndex } = dragMeta.current
          if (startIndex < overIndex && index > startIndex && index <= overIndex) shift = -1
          else if (startIndex > overIndex && index < startIndex && index >= overIndex) shift = 1
        }
        const style = isDragging
          ? undefined
          : (shift ? { transform: `translateY(${shift * dragMeta.current.slotHeight}px)` } : undefined)
        return (
          <div key={id} ref={registerNode(id)}
            className={`cm-doc-row${isDragging ? ' is-dragging' : ''}`}
            style={style}
            onClick={() => onRowClick?.(doc)}>
            {editable && (
              <button type="button" className="cm-doc-drag-handle" title="Kéo để sắp xếp" disabled={locked}
                onClick={e => e.stopPropagation()}
                onPointerDown={handlePointerDown(id)}
                onPointerMove={handlePointerMove(id)}
                onPointerUp={handlePointerUp(id)}
                onPointerCancel={handlePointerUp(id)}>
                {handleIcon || <DefaultGripIcon />}
              </button>
            )}
            {renderRow(doc)}
          </div>
        )
      })}
    </div>
  )
}

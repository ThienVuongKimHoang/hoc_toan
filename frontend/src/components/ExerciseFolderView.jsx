import React, { useMemo, useState } from 'react'
import { groupByCau, flattenCau } from '../utils/exerciseDocs.js'
import { removeDocument, updateDocument } from '../store/classStore.js'
import ExerciseLightbox from './ExerciseLightbox.jsx'

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/* Hiển thị các Câu (Đề + Đáp án giải) của 1 Buổi. editable=true (giáo viên): xóa ảnh, kéo-thả
   sắp xếp lại các bước đáp án giải. editable=false (học sinh): chỉ xem, bấm ảnh mở lightbox.
   Trả về null nếu docs không có ảnh nào thuộc cấu trúc Câu — nơi gọi tự quyết định hiển thị gì. */
export default function ExerciseFolderView({ docs, editable = false, classId, onChanged }) {
  const cauGroups = useMemo(() => groupByCau(docs), [docs])
  const [lightbox, setLightbox] = useState(null)   // { cauGroup, startIndex }
  const [dragCau, setDragCau] = useState(null)      // cauLabel đang kéo trong đó
  const [dragFromIndex, setDragFromIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!cauGroups.length) return null

  const openLightbox = (cauGroup, doc) => {
    const items = flattenCau(cauGroup)
    const startIndex = Math.max(items.findIndex(d => d.id === doc.id), 0)
    setLightbox({ cauGroup, startIndex })
  }

  const clearDrag = () => { setDragCau(null); setDragFromIndex(null); setDragOverIndex(null) }

  const handleDelete = async (doc) => {
    if (!editable || busy) return
    if (!confirm(`Xóa ảnh "${doc.name}"?`)) return
    setBusy(true)
    try {
      await fetch(`/api/class-documents/${encodeURIComponent(doc.filename)}`, { method: 'DELETE' }).catch(() => {})
      await removeDocument(classId, doc.id)
      onChanged?.()
    } finally { setBusy(false) }
  }

  const handleDrop = async (cauGroup, targetIndex) => {
    const fromIndex = dragFromIndex
    const cauLabel = dragCau
    clearDrag()
    if (!editable || fromIndex == null || cauLabel !== cauGroup.cauLabel || fromIndex === targetIndex) return
    const steps = [...cauGroup.dapAn]
    const [moved] = steps.splice(fromIndex, 1)
    steps.splice(targetIndex, 0, moved)
    setBusy(true)
    try {
      const updates = steps
        .map((d, i) => ({ d, newOrder: i + 1 }))
        .filter(({ d, newOrder }) => d.order !== newOrder)
        .map(({ d, newOrder }) => updateDocument(classId, d.id, { order: newOrder }))
      await Promise.all(updates)
      onChanged?.()
    } finally { setBusy(false) }
  }

  return (
    <div className="exfv-root">
      {cauGroups.map(cauGroup => (
        <div key={cauGroup.cauLabel} className="exfv-cau-card">
          <div className="exfv-cau-header">
            <span className="exfv-cau-title">{cauGroup.cauLabel}</span>
            <span className="exfv-cau-meta">
              {cauGroup.de.length} ảnh đề · {cauGroup.dapAn.length} bước giải
            </span>
          </div>

          {cauGroup.de.length > 0 && (
            <div className="exfv-section">
              <div className="exfv-section-label">📄 Đề bài</div>
              <div className="exfv-thumb-row">
                {cauGroup.de.map(doc => (
                  <div key={doc.id} className="exfv-thumb">
                    <img src={doc.url} alt={doc.name} onClick={() => openLightbox(cauGroup, doc)} />
                    {editable && (
                      <button className="exfv-thumb-del" onClick={() => handleDelete(doc)} title="Xóa">
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cauGroup.dapAn.length > 0 && (
            <div className="exfv-section">
              <div className="exfv-section-label">
                ✅ Đáp án · lời giải{editable && <span className="exfv-drag-hint"> — kéo để đổi thứ tự</span>}
              </div>
              <div className="exfv-thumb-row">
                {cauGroup.dapAn.map((doc, i) => (
                  <div key={doc.id}
                    className={[
                      'exfv-thumb', 'exfv-thumb--step',
                      dragCau === cauGroup.cauLabel && dragFromIndex === i ? 'is-dragging' : '',
                      dragCau === cauGroup.cauLabel && dragOverIndex === i && dragFromIndex !== i ? 'is-drop-target' : '',
                    ].filter(Boolean).join(' ')}
                    draggable={editable}
                    onDragStart={() => { setDragCau(cauGroup.cauLabel); setDragFromIndex(i) }}
                    onDragOver={(e) => { if (editable) { e.preventDefault(); setDragOverIndex(i) } }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(cauGroup, i) }}
                    onDragEnd={clearDrag}>
                    <span className="exfv-step-badge">{i + 1}</span>
                    <img src={doc.url} alt={doc.name} onClick={() => openLightbox(cauGroup, doc)} />
                    {editable && (
                      <button className="exfv-thumb-del" onClick={() => handleDelete(doc)} title="Xóa">
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {lightbox && (
        <ExerciseLightbox cauGroup={lightbox.cauGroup} startIndex={lightbox.startIndex} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  straightenIfLine, strokeBBox, bboxIntersectsRect, distanceToStroke, clusterStrokes,
} from '../utils/whiteboardGeometry.js'
import { addDocument, uploadFile } from '../store/classStore.js'
import SaveCaptureModal from './SaveCaptureModal.jsx'

const BG_COLOR = '#f4f5f7'
const GRID_DOT_COLOR = '#d7dbe3'
const PEN_COLORS = [
  { key: 'black', value: '#0f172a' },
  { key: 'red', value: '#dc2626' },
  { key: 'blue', value: '#2563eb' },
  { key: 'green', value: '#16a34a' },
]
const PEN_WIDTHS = [2, 4, 7]
const MIN_SCALE = 0.05
const MAX_SCALE = 8
const CLUSTER_GAP = 22        // px logic (world) — khoảng cách để 2 nét được coi là "cùng 1 chữ/từ"
const HIT_PAD_PX = 8          // px màn hình — dung sai khi click chọn 1 nét
const ERASER_RADIUS_PX = 15   // px màn hình — bán kính đầu tẩy
const MIN_MARQUEE_PX = 4      // px màn hình — bỏ qua vùng chọn quá nhỏ (chạm nhầm)
const MIN_CAPTURE_PX = 8      // px màn hình — bỏ qua vùng chụp quá nhỏ (chạm nhầm)
const MAX_HISTORY = 60
const ZOOM_WHEEL_SENSITIVITY = 0.012

const makeId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
)

const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
const normalizeRect = (a, b) => ({
  minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y),
})
const cloneStrokes = (strokes) => strokes.map(s => ({
  ...s, points: s.points.map(p => ({ x: p.x, y: p.y })), bbox: { ...s.bbox },
}))
const cloneImages = (images) => images.map(im => ({ ...im, bbox: { ...im.bbox } }))
const imageBBox = (x, y, w, h) => ({ minX: x, minY: y, maxX: x + w, maxY: y + h })
const IMAGE_MAX_SCREEN_DIM = 320   // px màn hình — kích thước hiển thị ban đầu tối đa của ảnh chèn vào

/* Bước lưới "đẹp" (1/2/5 × 10^k) sao cho khoảng cách trên màn hình luôn ~46px dù zoom mức nào. */
function niceGridStep(scale) {
  const raw = 46 / scale
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / pow10
  const nice = norm < 2 ? 1 : norm < 5 ? 2 : 5
  return nice * pow10
}

function drawGrid(ctx, cssW, cssH, view) {
  const step = niceGridStep(view.scale)
  const worldMinX = -view.x / view.scale
  const worldMinY = -view.y / view.scale
  const worldMaxX = (cssW - view.x) / view.scale
  const worldMaxY = (cssH - view.y) / view.scale
  const startX = Math.floor(worldMinX / step) * step
  const startY = Math.floor(worldMinY / step) * step
  const cols = Math.ceil((worldMaxX - startX) / step)
  const rows = Math.ceil((worldMaxY - startY) / step)
  if (cols < 0 || rows < 0 || cols * rows > 20000) return
  ctx.save()
  ctx.fillStyle = GRID_DOT_COLOR
  for (let i = 0; i <= cols; i++) {
    const sx = (startX + i * step) * view.scale + view.x
    for (let j = 0; j <= rows; j++) {
      const sy = (startY + j * step) * view.scale + view.y
      ctx.beginPath()
      ctx.arc(sx, sy, 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawStroke(ctx, stroke) {
  const pts = stroke.points
  if (!pts || pts.length === 0) return
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.fillStyle = stroke.color
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

/* ─── SVG icons (self-contained) ─── */
function Svg({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {children}
    </svg>
  )
}
const IC = {
  select: (s = 16) => <Svg size={s}><path d="M4 3l6.5 17 2-7 7-2z" fill="currentColor" stroke="none" /></Svg>,
  pen: (s = 16) => <Svg size={s}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Svg>,
  eraser: (s = 16) => <Svg size={s}><path d="M20 20H9L4 15a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-8 8" /></Svg>,
  hand: (s = 16) => <Svg size={s}><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M6 14l-1.3-1.3a2 2 0 0 0-2.8 2.9L6 20a6 6 0 0 0 4.5 2h1.5a7 7 0 0 0 7-7v-3" /></Svg>,
  camera: (s = 16) => <Svg size={s}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></Svg>,
  undo: (s = 16) => <Svg size={s}><path d="M3 10h10a5 5 0 0 1 0 10H9" /><polyline points="7 5 3 10 7 15" /></Svg>,
  redo: (s = 16) => <Svg size={s}><path d="M21 10H11a5 5 0 0 0 0 10h4" /><polyline points="17 5 21 10 17 15" /></Svg>,
  trash: (s = 16) => <Svg size={s}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Svg>,
  trashSel: (s = 16) => <Svg size={s}><rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="3 3" /><path d="M9 9l6 6M15 9l-6 6" /></Svg>,
  zoomIn: (s = 16) => <Svg size={s}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></Svg>,
  zoomOut: (s = 16) => <Svg size={s}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></Svg>,
  fit: (s = 16) => <Svg size={s}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></Svg>,
}

export default function InfiniteWhiteboard({ classId = null, subject = null, existingFolders = [], folderDocs = [], onSaved } = {}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  const viewRef = useRef({ scale: 1, x: 0, y: 0 })
  const strokesRef = useRef([])            // {id, points:[{x,y}], color, width, bbox}
  const imagesRef = useRef([])             // {id, img:HTMLImageElement, x, y, w, h, bbox}
  const currentStrokeRef = useRef(null)
  const selectionRef = useRef(new Set())   // id của nét vẽ hoặc ảnh đang được chọn
  const dragRef = useRef(null)
  const pointersRef = useRef(new Map())    // pointerId -> {x,y,type}
  const historyRef = useRef([])
  const redoRef = useRef([])
  const rafRef = useRef(null)

  const [tool, setTool] = useState('select')   // 'select' | 'pen' | 'eraser' | 'pan'
  const [color, setColor] = useState(PEN_COLORS[0].value)
  const [width, setWidth] = useState(PEN_WIDTHS[1])
  const [zoomPct, setZoomPct] = useState(100)
  const [hasSelection, setHasSelection] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [captureBlob, setCaptureBlob] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const bumpHistoryButtons = () => {
    setCanUndo(historyRef.current.length > 0)
    setCanRedo(redoRef.current.length > 0)
  }
  const pushHistory = () => {
    historyRef.current.push({ strokes: cloneStrokes(strokesRef.current), images: cloneImages(imagesRef.current) })
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
    redoRef.current = []
    bumpHistoryButtons()
  }
  const popHistory = () => { historyRef.current.pop(); bumpHistoryButtons() }

  /* Bbox thế giới (world) bao quanh toàn bộ vùng đang chọn, có đệm — dùng để vẽ khung chọn
     và để nhận biết cú kéo bắt đầu "trong vùng đã chọn" (di chuyển) hay "ngoài" (kéo cả bảng). */
  const getSelectionBBox = () => {
    if (!selectionRef.current.size) return null
    const selStrokes = strokesRef.current.filter(s => selectionRef.current.has(s.id))
    const selImages = imagesRef.current.filter(im => selectionRef.current.has(im.id))
    if (!selStrokes.length && !selImages.length) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of selStrokes) {
      minX = Math.min(minX, s.bbox.minX); minY = Math.min(minY, s.bbox.minY)
      maxX = Math.max(maxX, s.bbox.maxX); maxY = Math.max(maxY, s.bbox.maxY)
    }
    for (const im of selImages) {
      minX = Math.min(minX, im.bbox.minX); minY = Math.min(minY, im.bbox.minY)
      maxX = Math.max(maxX, im.bbox.maxX); maxY = Math.max(maxY, im.bbox.maxY)
    }
    const pad = 10 / viewRef.current.scale
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
  }

  /* ─── vẽ lại nội dung (canvas chính) ─── */
  const redraw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const v = viewRef.current
    const cssW = c.width / dpr, cssH = c.height / dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, cssW, cssH)
    drawGrid(ctx, cssW, cssH, v)
    ctx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.x * dpr, v.y * dpr)
    const erasing = dragRef.current?.type === 'erase' ? dragRef.current.erasedIds : null
    for (const im of imagesRef.current) {
      if (erasing && erasing.has(im.id)) continue
      ctx.drawImage(im.img, im.x, im.y, im.w, im.h)
    }
    for (const s of strokesRef.current) {
      if (erasing && erasing.has(s.id)) continue
      drawStroke(ctx, s)
    }
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  /* ─── vẽ lớp phủ: khung marquee + khung vùng chọn (toạ độ màn hình) ─── */
  const redrawOverlay = useCallback(() => {
    const o = overlayRef.current
    if (!o) return
    const octx = o.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    octx.clearRect(0, 0, o.width / dpr, o.height / dpr)
    const drag = dragRef.current
    const v = viewRef.current

    if (drag && (drag.type === 'marquee' || drag.type === 'capture')) {
      const r = normalizeRect(drag.startScreen, drag.curScreen)
      const isCapture = drag.type === 'capture'
      octx.save()
      octx.setLineDash([6, 4])
      octx.strokeStyle = isCapture ? '#c2410c' : '#2563eb'
      octx.fillStyle = isCapture ? 'rgba(194,65,12,0.08)' : 'rgba(37,99,235,0.08)'
      octx.lineWidth = 1.5
      octx.fillRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY)
      octx.strokeRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY)
      octx.restore()
    }

    const selBBox = getSelectionBBox()
    if (selBBox) {
      const sx0 = selBBox.minX * v.scale + v.x, sy0 = selBBox.minY * v.scale + v.y
      const sx1 = selBBox.maxX * v.scale + v.x, sy1 = selBBox.maxY * v.scale + v.y
      octx.save()
      octx.setLineDash([5, 3])
      octx.strokeStyle = '#2563eb'
      octx.lineWidth = 1.5
      octx.strokeRect(sx0, sy0, sx1 - sx0, sy1 - sy0)
      octx.restore()
    }
  }, [])

  const scheduleFrame = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      redraw()
      redrawOverlay()
    })
  }, [redraw, redrawOverlay])

  const updateZoomDisplay = () => setZoomPct(Math.round(viewRef.current.scale * 100))

  /* ─── resize canvas theo khung chứa (hi-DPI) ─── */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let first = true
    const resize = () => {
      const c = canvasRef.current, o = overlayRef.current
      if (!c || !o) return
      const dpr = window.devicePixelRatio || 1
      const w = el.clientWidth, h = el.clientHeight
      c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr))
      o.width = c.width; o.height = c.height
      if (first) {
        viewRef.current = { scale: 1, x: w / 2, y: h / 2 }
        first = false
        updateZoomDisplay()
      }
      scheduleFrame()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()
    return () => ro.disconnect()
  }, [scheduleFrame])

  /* ─── toạ độ ─── */
  const screenPosFromEvent = (e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const screenToWorld = (sx, sy) => {
    const v = viewRef.current
    return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale }
  }

  /* ─── zoom quanh 1 điểm màn hình cố định ─── */
  const zoomAt = useCallback((sx, sy, factor) => {
    const v = viewRef.current
    const newScale = clampScale(v.scale * factor)
    if (newScale === v.scale) return
    const world = { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale }
    viewRef.current = { scale: newScale, x: sx - world.x * newScale, y: sy - world.y * newScale }
    updateZoomDisplay()
    scheduleFrame()
  }, [scheduleFrame])

  const handleZoomIn = () => { const el = wrapRef.current; if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.25) }
  const handleZoomOut = () => { const el = wrapRef.current; if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / 1.25) }

  const handleFitView = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const strokes = strokesRef.current
    const images = imagesRef.current
    if (!strokes.length && !images.length) {
      viewRef.current = { scale: 1, x: el.clientWidth / 2, y: el.clientHeight / 2 }
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const s of strokes) {
        minX = Math.min(minX, s.bbox.minX); minY = Math.min(minY, s.bbox.minY)
        maxX = Math.max(maxX, s.bbox.maxX); maxY = Math.max(maxY, s.bbox.maxY)
      }
      for (const im of images) {
        minX = Math.min(minX, im.bbox.minX); minY = Math.min(minY, im.bbox.minY)
        maxX = Math.max(maxX, im.bbox.maxX); maxY = Math.max(maxY, im.bbox.maxY)
      }
      const pad = 80
      const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1)
      const scale = clampScale(Math.min((el.clientWidth - pad * 2) / w, (el.clientHeight - pad * 2) / h))
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      viewRef.current = { scale, x: el.clientWidth / 2 - cx * scale, y: el.clientHeight / 2 - cy * scale }
    }
    updateZoomDisplay()
    scheduleFrame()
  }, [scheduleFrame])

  /* ─── wheel: cuộn để pan, Ctrl/Cmd + cuộn (hoặc pinch trackpad) để zoom ─── */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e) => {
      // Popup lưu ảnh đang mở (nằm lồng trong .iwb-root nên wheel vẫn bubble tới đây) →
      // "đóng băng" bảng, để cuộn lên/xuống thuộc về popup chứ không kéo bảng phía sau.
      if (captureBlob) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top
      if (e.ctrlKey || e.metaKey) {
        zoomAt(sx, sy, Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY))
      } else {
        viewRef.current = { ...viewRef.current, x: viewRef.current.x - e.deltaX, y: viewRef.current.y - e.deltaY }
        scheduleFrame()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, scheduleFrame, captureBlob])

  /* ─── hit-test & tẩy ─── */
  const hitTestImage = (world) => {
    const images = imagesRef.current
    for (let i = images.length - 1; i >= 0; i--) {
      const im = images[i]
      if (world.x >= im.bbox.minX && world.x <= im.bbox.maxX && world.y >= im.bbox.minY && world.y <= im.bbox.maxY) return im.id
    }
    return null
  }
  const hitTestStroke = (world) => {
    const v = viewRef.current
    const strokes = strokesRef.current
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]
      const pad = HIT_PAD_PX / v.scale + s.width / 2
      const b = s.bbox
      if (world.x < b.minX - pad || world.x > b.maxX + pad || world.y < b.minY - pad || world.y > b.maxY + pad) continue
      if (distanceToStroke(world, s.points) <= pad) return s.id
    }
    return null
  }
  const clusterContaining = (id) => {
    const { groups, idToGroupIndex } = clusterStrokes(strokesRef.current, CLUSTER_GAP)
    const gi = idToGroupIndex.get(id)
    return new Set(gi !== undefined ? groups[gi] : [id])
  }
  const eraseAt = (world) => {
    const drag = dragRef.current
    if (!drag || drag.type !== 'erase') return
    const v = viewRef.current
    const eraserPad = ERASER_RADIUS_PX / v.scale
    let changed = false
    for (const s of strokesRef.current) {
      if (drag.erasedIds.has(s.id)) continue
      const pad = eraserPad + s.width / 2
      const b = s.bbox
      if (world.x < b.minX - pad || world.x > b.maxX + pad || world.y < b.minY - pad || world.y > b.maxY + pad) continue
      if (distanceToStroke(world, s.points) <= pad) { drag.erasedIds.add(s.id); changed = true }
    }
    for (const im of imagesRef.current) {
      if (drag.erasedIds.has(im.id)) continue
      const b = im.bbox
      if (world.x < b.minX - eraserPad || world.x > b.maxX + eraserPad || world.y < b.minY - eraserPad || world.y > b.maxY + eraserPad) continue
      drag.erasedIds.add(im.id); changed = true
    }
    if (changed) scheduleFrame()
  }

  /* Chụp đúng vùng đã kéo chọn (toạ độ màn hình) thành ảnh PNG nền trắng — chỉ vẽ lại các nét
     nằm trong vùng đó, bỏ qua lưới chấm, để ảnh lưu vào tài liệu lớp trông sạch như bảng giấy. */
  const finishCapture = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    const screenRect = normalizeRect(drag.startScreen, drag.curScreen)
    const wPx = screenRect.maxX - screenRect.minX
    const hPx = screenRect.maxY - screenRect.minY
    scheduleFrame()
    if (wPx < MIN_CAPTURE_PX || hPx < MIN_CAPTURE_PX) return
    const v = viewRef.current
    const wA = screenToWorld(screenRect.minX, screenRect.minY)
    const wB = screenToWorld(screenRect.maxX, screenRect.maxY)
    const dpr = window.devicePixelRatio || 1
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.round(wPx * dpr))
    off.height = Math.max(1, Math.round(hPx * dpr))
    const octx = off.getContext('2d')
    octx.fillStyle = '#ffffff'
    octx.fillRect(0, 0, off.width, off.height)
    octx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, -wA.x * v.scale * dpr, -wA.y * v.scale * dpr)
    const worldRect = { minX: wA.x, minY: wA.y, maxX: wB.x, maxY: wB.y }
    for (const im of imagesRef.current) {
      if (!bboxIntersectsRect(im.bbox, worldRect)) continue
      octx.drawImage(im.img, im.x, im.y, im.w, im.h)
    }
    for (const s of strokesRef.current) {
      if (!bboxIntersectsRect(s.bbox, worldRect)) continue
      drawStroke(octx, s)
    }
    off.toBlob(blob => { if (blob) setCaptureBlob(blob) }, 'image/png')
  }

  const handleSaveCapture = async ({ name, folder, cauLabel, section, order }) => {
    const blob = captureBlob
    const file = new File([blob], `${name}.png`, { type: 'image/png' })
    const doc = await uploadFile(file)
    await addDocument(classId, { ...doc, name, subject, folder, kind: 'exercise', cauLabel, section, order })
    setCaptureBlob(null)
    onSaved?.()
  }

  const cancelActiveDrag = () => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.type === 'draw') { currentStrokeRef.current = null; popHistory() }
    else if (drag.type === 'erase') { if (!drag.erasedIds.size) popHistory() }
    dragRef.current = null
    scheduleFrame()
  }

  /* Chèn 1 ảnh (dán từ clipboard hoặc kéo-thả file) vào bảng, canh giữa tại vị trí màn hình
     đã cho (mặc định giữa khung nhìn) — kích thước hiển thị ban đầu giới hạn ~320px màn hình. */
  const insertImageAtScreen = useCallback((file, screenPos) => {
    if (!file || !file.type?.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const el = wrapRef.current
        const v = viewRef.current
        const pos = screenPos || (el ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : { x: 0, y: 0 })
        const center = screenToWorld(pos.x, pos.y)
        const naturalMax = Math.max(img.naturalWidth, img.naturalHeight, 1)
        const dispScale = Math.min(1, IMAGE_MAX_SCREEN_DIM / naturalMax)
        const w = (img.naturalWidth * dispScale) / v.scale
        const h = (img.naturalHeight * dispScale) / v.scale
        const x = center.x - w / 2, y = center.y - h / 2
        pushHistory()
        const id = makeId()
        imagesRef.current = [...imagesRef.current, { id, img, x, y, w, h, bbox: imageBBox(x, y, w, h) }]
        selectionRef.current = new Set([id])
        setHasSelection(true)
        setTool('select')
        bumpHistoryButtons()
        scheduleFrame()
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }, [scheduleFrame])

  /* ─── dán ảnh từ clipboard (Ctrl/⌘+V) ─── */
  useEffect(() => {
    const onPaste = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const items = e.clipboardData?.items
      if (!items) return
      const imageItem = [...items].find(it => it.type?.startsWith('image/'))
      if (!imageItem) return
      e.preventDefault()
      insertImageAtScreen(imageItem.getAsFile(), null)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [insertImageAtScreen])

  /* ─── kéo-thả file ảnh vào bảng ─── */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const hasImageFile = (e) => [...(e.dataTransfer?.items || [])].some(it => it.kind === 'file' && it.type?.startsWith('image/'))
    const onDragOver = (e) => {
      if (!hasImageFile(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
    const onDragLeave = (e) => {
      if (e.target === el) setIsDragOver(false)
    }
    const onDrop = (e) => {
      setIsDragOver(false)
      const files = [...(e.dataTransfer?.files || [])].filter(f => f.type?.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      const screenPos = screenPosFromEvent(e)
      files.forEach((f, i) => insertImageAtScreen(f, i === 0 ? screenPos : null))
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [insertImageAtScreen])

  /* ─── con trỏ ─── */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const screenPos = screenPosFromEvent(e)
    pointersRef.current.set(e.pointerId, { x: screenPos.x, y: screenPos.y, type: e.pointerType })

    if (e.pointerType === 'touch' && pointersRef.current.size === 2) {
      cancelActiveDrag()
      const pts = [...pointersRef.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      dragRef.current = { type: 'pinch', startDist: Math.max(dist, 1), startScale: viewRef.current.scale, startMid: mid, startView: { ...viewRef.current } }
      return
    }
    if (pointersRef.current.size > 2) return
    if (dragRef.current) return

    const currentTool = tool
    // Space / chuột giữa: luôn kéo cả bảng bất kể đang trỏ vào đâu (phím tắt kéo nhanh, không phụ thuộc vùng chọn)
    if (spaceDown || e.button === 1) {
      if (e.button === 1) e.preventDefault()
      dragRef.current = { type: 'pan', pointerId: e.pointerId, lastX: screenPos.x, lastY: screenPos.y }
      setIsPanning(true)
      return
    }
    if (e.button === 2) return

    const world = screenToWorld(screenPos.x, screenPos.y)

    if (currentTool === 'pan') {
      // Bấm & kéo bên trong vùng đã chọn → chỉ di chuyển vùng đó; bấm ra ngoài → kéo cả bảng.
      const selBBox = getSelectionBBox()
      const insideSelection = selBBox && world.x >= selBBox.minX && world.x <= selBBox.maxX
        && world.y >= selBBox.minY && world.y <= selBBox.maxY
      if (insideSelection) {
        dragRef.current = { type: 'move', pointerId: e.pointerId, lastWorld: world, historyPushed: false }
        scheduleFrame()
        return
      }
      dragRef.current = { type: 'pan', pointerId: e.pointerId, lastX: screenPos.x, lastY: screenPos.y }
      setIsPanning(true)
      return
    }

    if (currentTool === 'pen') {
      pushHistory()
      currentStrokeRef.current = { id: makeId(), points: [world], color, width, bbox: null }
      dragRef.current = { type: 'draw', pointerId: e.pointerId }
      return
    }
    if (currentTool === 'eraser') {
      pushHistory()
      dragRef.current = { type: 'erase', pointerId: e.pointerId, erasedIds: new Set() }
      eraseAt(world)
      return
    }
    if (currentTool === 'capture' && classId) {
      dragRef.current = { type: 'capture', pointerId: e.pointerId, startScreen: screenPos, curScreen: screenPos }
      scheduleFrame()
      return
    }
    if (currentTool === 'select') {
      const hitImageId = hitTestImage(world)
      if (hitImageId !== null) {
        if (!selectionRef.current.has(hitImageId)) {
          selectionRef.current = new Set([hitImageId])
          setHasSelection(true)
        }
        dragRef.current = { type: 'move', pointerId: e.pointerId, lastWorld: world, historyPushed: false }
        scheduleFrame()
        return
      }
      const hitId = hitTestStroke(world)
      if (hitId !== null) {
        if (!selectionRef.current.has(hitId)) {
          selectionRef.current = clusterContaining(hitId)
          setHasSelection(selectionRef.current.size > 0)
        }
        dragRef.current = { type: 'move', pointerId: e.pointerId, lastWorld: world, historyPushed: false }
        scheduleFrame()
        return
      }
      if (selectionRef.current.size) { selectionRef.current = new Set(); setHasSelection(false) }
      dragRef.current = { type: 'marquee', pointerId: e.pointerId, startScreen: screenPos, curScreen: screenPos }
      scheduleFrame()
    }
  }

  const onPointerMove = (e) => {
    const screenPos = screenPosFromEvent(e)
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: screenPos.x, y: screenPos.y, type: e.pointerType })
    }
    const drag = dragRef.current
    if (!drag) return

    if (drag.type === 'pinch') {
      if (pointersRef.current.size < 2) return
      const pts = [...pointersRef.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const newScale = clampScale(drag.startScale * (dist / drag.startDist))
      const worldFixed = {
        x: (drag.startMid.x - drag.startView.x) / drag.startView.scale,
        y: (drag.startMid.y - drag.startView.y) / drag.startView.scale,
      }
      viewRef.current = { scale: newScale, x: mid.x - worldFixed.x * newScale, y: mid.y - worldFixed.y * newScale }
      updateZoomDisplay()
      scheduleFrame()
      return
    }

    if (drag.pointerId !== e.pointerId) return

    if (drag.type === 'pan') {
      const dx = screenPos.x - drag.lastX, dy = screenPos.y - drag.lastY
      drag.lastX = screenPos.x; drag.lastY = screenPos.y
      viewRef.current = { ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy }
      scheduleFrame()
      return
    }

    const world = screenToWorld(screenPos.x, screenPos.y)

    if (drag.type === 'draw') {
      currentStrokeRef.current.points.push(world)
      scheduleFrame()
      return
    }
    if (drag.type === 'erase') {
      eraseAt(world)
      return
    }
    if (drag.type === 'marquee' || drag.type === 'capture') {
      drag.curScreen = screenPos
      scheduleFrame()
      return
    }
    if (drag.type === 'move') {
      if (!drag.historyPushed) { pushHistory(); drag.historyPushed = true }
      const dx = world.x - drag.lastWorld.x, dy = world.y - drag.lastWorld.y
      drag.lastWorld = world
      for (const s of strokesRef.current) {
        if (!selectionRef.current.has(s.id)) continue
        for (const p of s.points) { p.x += dx; p.y += dy }
        s.bbox = strokeBBox(s.points)
      }
      for (const im of imagesRef.current) {
        if (!selectionRef.current.has(im.id)) continue
        im.x += dx; im.y += dy
        im.bbox = imageBBox(im.x, im.y, im.w, im.h)
      }
      scheduleFrame()
    }
  }

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId)
    const drag = dragRef.current
    if (!drag) return

    if (drag.type === 'pinch') {
      if (pointersRef.current.size < 2) dragRef.current = null
      return
    }
    if (drag.pointerId !== e.pointerId) return

    if (drag.type === 'pan') { dragRef.current = null; setIsPanning(false); return }

    if (drag.type === 'draw') {
      const stroke = currentStrokeRef.current
      currentStrokeRef.current = null
      dragRef.current = null
      if (stroke && stroke.points.length) {
        stroke.points = straightenIfLine(stroke.points)
        stroke.bbox = strokeBBox(stroke.points)
        strokesRef.current.push(stroke)
      } else {
        popHistory()
      }
      bumpHistoryButtons()
      scheduleFrame()
      return
    }

    if (drag.type === 'erase') {
      dragRef.current = null
      if (drag.erasedIds.size) {
        strokesRef.current = strokesRef.current.filter(s => !drag.erasedIds.has(s.id))
        imagesRef.current = imagesRef.current.filter(im => !drag.erasedIds.has(im.id))
        if (selectionRef.current.size) {
          for (const id of drag.erasedIds) selectionRef.current.delete(id)
          setHasSelection(selectionRef.current.size > 0)
        }
      } else {
        popHistory()
      }
      bumpHistoryButtons()
      scheduleFrame()
      return
    }

    if (drag.type === 'capture') {
      finishCapture()
      return
    }

    if (drag.type === 'marquee') {
      const screenRect = normalizeRect(drag.startScreen, drag.curScreen)
      dragRef.current = null
      const wide = screenRect.maxX - screenRect.minX >= MIN_MARQUEE_PX
      const tall = screenRect.maxY - screenRect.minY >= MIN_MARQUEE_PX
      if (wide || tall) {
        const wA = screenToWorld(screenRect.minX, screenRect.minY)
        const wB = screenToWorld(screenRect.maxX, screenRect.maxY)
        const worldRect = { minX: wA.x, minY: wA.y, maxX: wB.x, maxY: wB.y }
        const hitIds = strokesRef.current.filter(s => bboxIntersectsRect(s.bbox, worldRect)).map(s => s.id)
        const hitImageIds = imagesRef.current.filter(im => bboxIntersectsRect(im.bbox, worldRect)).map(im => im.id)
        if (hitIds.length || hitImageIds.length) {
          const { groups, idToGroupIndex } = clusterStrokes(strokesRef.current, CLUSTER_GAP)
          const selected = new Set(hitImageIds)
          for (const id of hitIds) {
            const gi = idToGroupIndex.get(id)
            if (gi !== undefined) for (const gid of groups[gi]) selected.add(gid)
          }
          selectionRef.current = selected
          setHasSelection(selected.size > 0)
        }
      }
      scheduleFrame()
      return
    }

    if (drag.type === 'move') {
      dragRef.current = null
      if (drag.historyPushed) bumpHistoryButtons()
      scheduleFrame()
    }
  }

  /* ─── undo / redo / xoá ─── */
  const handleUndo = useCallback(() => {
    if (!historyRef.current.length) return
    redoRef.current.push({ strokes: cloneStrokes(strokesRef.current), images: cloneImages(imagesRef.current) })
    const snap = historyRef.current.pop()
    strokesRef.current = snap.strokes
    imagesRef.current = snap.images
    const valid = new Set([...strokesRef.current.map(s => s.id), ...imagesRef.current.map(im => im.id)])
    selectionRef.current = new Set([...selectionRef.current].filter(id => valid.has(id)))
    setHasSelection(selectionRef.current.size > 0)
    bumpHistoryButtons()
    scheduleFrame()
  }, [scheduleFrame])

  const handleRedo = useCallback(() => {
    if (!redoRef.current.length) return
    historyRef.current.push({ strokes: cloneStrokes(strokesRef.current), images: cloneImages(imagesRef.current) })
    const snap = redoRef.current.pop()
    strokesRef.current = snap.strokes
    imagesRef.current = snap.images
    const valid = new Set([...strokesRef.current.map(s => s.id), ...imagesRef.current.map(im => im.id)])
    selectionRef.current = new Set([...selectionRef.current].filter(id => valid.has(id)))
    setHasSelection(selectionRef.current.size > 0)
    bumpHistoryButtons()
    scheduleFrame()
  }, [scheduleFrame])

  const handleDeleteSelection = useCallback(() => {
    if (!selectionRef.current.size) return
    pushHistory()
    strokesRef.current = strokesRef.current.filter(s => !selectionRef.current.has(s.id))
    imagesRef.current = imagesRef.current.filter(im => !selectionRef.current.has(im.id))
    selectionRef.current = new Set()
    setHasSelection(false)
    bumpHistoryButtons()
    scheduleFrame()
  }, [scheduleFrame])

  const handleClear = () => {
    if (!strokesRef.current.length && !imagesRef.current.length) return
    if (!confirm('Xóa toàn bộ bảng trắng? Các nét vẽ chưa lưu sẽ mất.')) return
    pushHistory()
    strokesRef.current = []
    imagesRef.current = []
    selectionRef.current = new Set()
    setHasSelection(false)
    scheduleFrame()
  }

  /* ─── phím tắt ─── */
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); setSpaceDown(true) }
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current.size) { e.preventDefault(); handleDeleteSelection(); return }
      if (e.key === 'Escape' && selectionRef.current.size) { selectionRef.current = new Set(); setHasSelection(false); scheduleFrame(); return }
      if (!mod) {
        if (e.key === 'v' || e.key === 'V') setTool('select')
        else if (e.key === 'p' || e.key === 'P' || e.key === 'b' || e.key === 'B') setTool('pen')
        else if (e.key === 'e' || e.key === 'E') setTool('eraser')
        else if (e.key === 'h' || e.key === 'H') setTool('pan')
        else if ((e.key === 'c' || e.key === 'C') && classId) setTool('capture')
      }
    }
    const onKeyUp = (e) => { if (e.code === 'Space') setSpaceDown(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [handleUndo, handleRedo, handleDeleteSelection, scheduleFrame, classId])

  const cursor = isPanning ? 'grabbing'
    : (tool === 'pan' || spaceDown) ? 'grab'
    : tool === 'pen' || tool === 'eraser' || tool === 'capture' ? 'crosshair'
    : 'default'

  return (
    <div ref={wrapRef} className={`iwb-root ${isDragOver ? 'iwb-root--drag-over' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="iwb-canvas"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ cursor }} />
      <canvas ref={overlayRef} className="iwb-overlay" />

      <div className="iwb-toolbar">
        <div className="iwb-tool-group">
          <button className={`iwb-tool-btn ${tool === 'select' ? 'is-active' : ''}`} title="Chọn (V)" onClick={() => setTool('select')}>{IC.select(16)}</button>
          <button className={`iwb-tool-btn ${tool === 'pen' ? 'is-active' : ''}`} title="Bút (P)" onClick={() => setTool('pen')}>{IC.pen(16)}</button>
          <button className={`iwb-tool-btn ${tool === 'eraser' ? 'is-active' : ''}`} title="Tẩy (E)" onClick={() => setTool('eraser')}>{IC.eraser(16)}</button>
          <button className={`iwb-tool-btn ${tool === 'pan' ? 'is-active' : ''}`} title="Di chuyển (H / giữ Space)" onClick={() => setTool('pan')}>{IC.hand(16)}</button>
          {classId && (
            <button className={`iwb-tool-btn ${tool === 'capture' ? 'is-active' : ''}`} title="Chụp vùng & lưu vào lớp" onClick={() => setTool('capture')}>{IC.camera(16)}</button>
          )}
        </div>

        {tool === 'pen' && (
          <div className="iwb-tool-group">
            {PEN_COLORS.map(c => (
              <button key={c.key} className={`iwb-color-swatch ${color === c.value ? 'is-active' : ''}`}
                style={{ background: c.value }} onClick={() => setColor(c.value)} title={c.key} />
            ))}
            {PEN_WIDTHS.map(w => (
              <button key={w} className={`iwb-width-btn ${width === w ? 'is-active' : ''}`} onClick={() => setWidth(w)} title={`Nét ${w}px`}>
                <span className="iwb-width-dot" style={{ width: w + 3, height: w + 3 }} />
              </button>
            ))}
          </div>
        )}

        <div className="iwb-tool-group">
          <button className="iwb-tool-btn" title="Hoàn tác (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo}>{IC.undo(16)}</button>
          <button className="iwb-tool-btn" title="Làm lại (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo}>{IC.redo(16)}</button>
          <button className="iwb-tool-btn" title="Xóa vùng chọn (Delete)" onClick={handleDeleteSelection} disabled={!hasSelection}>{IC.trashSel(16)}</button>
          <button className="iwb-tool-btn iwb-tool-btn--danger" title="Xóa toàn bộ bảng" onClick={handleClear}>{IC.trash(16)}</button>
        </div>
      </div>

      <div className="iwb-zoom-bar">
        <button className="iwb-zoom-btn" title="Vừa khung hình" onClick={handleFitView}>{IC.fit(15)}</button>
        <button className="iwb-zoom-btn" title="Thu nhỏ" onClick={handleZoomOut}>{IC.zoomOut(15)}</button>
        <span className="iwb-zoom-pct">{zoomPct}%</span>
        <button className="iwb-zoom-btn" title="Phóng to" onClick={handleZoomIn}>{IC.zoomIn(15)}</button>
      </div>

      <div className="iwb-hint">Cuộn để di chuyển · Ctrl/⌘ + cuộn để zoom · Giữ Space để kéo bảng · Ctrl/⌘+V hoặc kéo-thả để chèn ảnh</div>

      {isDragOver && <div className="iwb-drop-overlay"><span>Thả để chèn ảnh vào bảng</span></div>}

      {captureBlob && (
        <SaveCaptureModal blob={captureBlob} existingFolders={existingFolders} folderDocs={folderDocs}
          onCancel={() => setCaptureBlob(null)} onConfirm={handleSaveCapture} />
      )}
    </div>
  )
}

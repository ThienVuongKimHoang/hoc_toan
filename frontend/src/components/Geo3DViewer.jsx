import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ─────────────────── 3D Math ─────────────────── */
function rotXY(px, py, pz, rx, ry) {
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const x  =  px * cy + pz * sy
  const z  = -px * sy + pz * cy
  const cx = Math.cos(rx), sx = Math.sin(rx)
  return { x, y: py * cx - z * sx, z: py * sx + z * cx }
}

function proj(px, py, pz, rx, ry, CX, CY, S) {
  const r = rotXY(px, py, pz, rx, ry)
  const d = 10 / (10 + r.z * 0.14)
  return { sx: CX + r.x * S * d, sy: CY - r.y * S * d, depth: r.z }
}

const INIT_RX = -0.45
const INIT_RY =  0.62
/* Biên góc ngẩng. Trước đây là 1.2 (~69°) nên không nhìn thẳng từ trên xuống được;
   nới tới sát π/2 để có góc nhìn "Từ trên xuống", nhưng KHÔNG chạm đúng π/2 vì ở đó
   trục y co về một điểm và mũi tên Y của gizmo trùng gốc toạ độ. */
const RX_LIMIT = Math.PI / 2 - 0.02
const ZOOM_MIN = 0.2
const ZOOM_MAX = 6

/* ─────────────────── Renderer ─────────────────── */
function renderScene(ctx, W, H, scene, ptMap, bb, rx, ry, zoom) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  const S  = Math.min(W, H) * 0.36 / bb.range * zoom
  const CX = W / 2, CY = H / 2

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Project all points
  const p2 = {}
  Object.entries(ptMap).forEach(([id, p]) => {
    p2[id] = proj(p.x - bb.cx, p.y - bb.cy, p.z - bb.cz, rx, ry, CX, CY, S)
  })

  // Label map — support both {id} and {point} formats
  const lblMap = {}
  ;(scene.labels || []).forEach(l => { lblMap[l.id ?? l.point] = l })

  // ── Collect renderables (exclude highlight segments) ──
  const items = []
  const highlights = []

  // Faces (filled polygons) — sorted slightly behind same-depth edges
  ;(scene.faces || []).forEach(face => {
    const pts = (face.points || []).map(id => p2[id]).filter(Boolean)
    if (pts.length < 3) return
    const z = pts.reduce((s, p) => s + p.depth, 0) / pts.length - 0.5
    items.push({ k: 'face', face, pts, z })
  })

  // Segments (non-highlight)
  ;(scene.segments || []).forEach(seg => {
    const a = p2[seg.from], b = p2[seg.to]
    if (!a || !b) return
    if (seg.highlight) {
      highlights.push({ a, b, seg })
    } else {
      items.push({ k: 'seg', a, b, seg, z: (a.depth + b.depth) / 2 })
    }
  })

  // Vectors
  ;(scene.vectors || []).forEach(vec => {
    const a = p2[vec.from], b = p2[vec.to]
    if (a && b) items.push({ k: 'vec', a, b, vec, z: (a.depth + b.depth) / 2 })
  })

  // Points
  Object.entries(ptMap).forEach(([id, p]) => {
    const pt = p2[id]
    if (pt) items.push({ k: 'pt', id, p, pt, z: pt.depth })
  })

  // Depth sort back → front
  items.sort((a, b) => a.z - b.z)

  // ── Draw phase 1: depth-sorted items ──
  items.forEach(it => {
    if (it.k === 'face') {
      const { face, pts } = it
      const st = face.style || {}
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      ctx.beginPath()
      ctx.moveTo(pts[0].sx, pts[0].sy)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy)
      ctx.closePath()

      // Fill
      ctx.globalAlpha = st.opacity ?? 0.3
      ctx.fillStyle   = st.fill || '#74c0fc'
      ctx.fill()

      // Outline
      if (st.stroke) {
        ctx.globalAlpha = Math.min(1, (st.opacity ?? 0.3) * 1.5 + 0.2)
        ctx.strokeStyle = st.stroke
        ctx.lineWidth   = st.strokeWidth || 1.5
        ctx.stroke()
      }
      ctx.globalAlpha = 1

    } else if (it.k === 'seg') {
      const { a, b, seg } = it
      ctx.strokeStyle = seg.color || '#1e293b'
      ctx.lineWidth   = seg.width || 1.8
      ctx.setLineDash(seg.dashed ? [7, 5] : [])
      ctx.globalAlpha = seg.dashed ? 0.6 : 1
      ctx.shadowBlur  = 0
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
      ctx.globalAlpha = 1

    } else if (it.k === 'vec') {
      const { a, b, vec } = it
      const col = vec.color || '#2563eb'
      ctx.strokeStyle = col; ctx.lineWidth = 2.2
      ctx.setLineDash([]); ctx.shadowBlur = 0
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
      const dx = b.sx - a.sx, dy = b.sy - a.sy
      const L = Math.sqrt(dx * dx + dy * dy)
      if (L > 2) {
        const ux = dx/L, uy = dy/L, s = 10
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(b.sx, b.sy)
        ctx.lineTo(b.sx - ux*s + uy*s*0.35, b.sy - uy*s - ux*s*0.35)
        ctx.lineTo(b.sx - ux*s - uy*s*0.35, b.sy - uy*s + ux*s*0.35)
        ctx.closePath(); ctx.fill()
      }

    } else if (it.k === 'pt') {
      const { p, pt } = it
      const r   = p.size   || (p.isMidpoint ? 3.5 : 3.5)
      const col = p.color  || (p.isMidpoint ? '#7c3aed' : '#1e293b')
      ctx.setLineDash([]); ctx.shadowBlur = 0
      ctx.fillStyle   = col
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 1.5
      ctx.beginPath(); ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    }
  })

  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // ── Draw phase 2: highlight segments (always on top) ──
  highlights.forEach(({ a, b, seg }) => {
    const col = seg.color || '#1971c2'
    ctx.setLineDash([])
    ctx.shadowColor = col
    ctx.shadowBlur  = 7
    ctx.strokeStyle = col
    ctx.lineWidth   = seg.width || 2.5
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
  })
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'

  // ── Draw phase 3: labels (always on top) ──
  ctx.save()
  Object.entries(ptMap).forEach(([id, p]) => {
    const pt  = p2[id]; if (!pt) return
    const ov  = lblMap[id]
    const txt = ov?.text  ?? id
    const dx  = ov?.dx    ?? 10
    const dy  = ov?.dy    ?? -13
    const fs  = ov?.size  ?? 13
    const col = ov?.color ?? (p.isMidpoint ? '#6d28d9' : '#0f172a')

    ctx.font = `600 ${fs}px "Inter", system-ui, sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    const tw = ctx.measureText(txt).width
    const bx = pt.sx + dx - tw / 2 - 3
    const by = pt.sy + dy - fs * 0.65
    const bw = tw + 6, bh = fs * 1.3, br = 3

    ctx.fillStyle = 'rgba(248,250,252,0.92)'
    ctx.beginPath()
    ctx.moveTo(bx + br, by)
    ctx.arcTo(bx + bw, by,    bx + bw, by + bh, br)
    ctx.arcTo(bx + bw, by+bh, bx,      by + bh, br)
    ctx.arcTo(bx,      by+bh, bx,      by,      br)
    ctx.arcTo(bx,      by,    bx + bw, by,      br)
    ctx.closePath(); ctx.fill()

    ctx.fillStyle = col
    ctx.fillText(txt, pt.sx + dx, pt.sy + dy)
  })

  // Vector labels
  ;(scene.vectors || []).forEach(vec => {
    if (!vec.label) return
    const a = p2[vec.from], b = p2[vec.to]; if (!a || !b) return
    ctx.font      = `italic 600 12px "Inter", system-ui, sans-serif`
    ctx.fillStyle = vec.color || '#2563eb'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(vec.label, (a.sx+b.sx)/2 + 10, (a.sy+b.sy)/2 - 10)
  })
  ctx.restore()

  // ── Axis indicator (bottom-left) ──
  const AX = 46, AY = H - 46, AL = 26
  ;[['X',1,0,0,'#ef4444'],['Y',0,1,0,'#22c55e'],['Z',0,0,1,'#3b82f6']].forEach(([n,ax,ay,az,col]) => {
    const r = rotXY(ax*AL, ay*AL, az*AL, rx, ry)
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([])
    ctx.shadowBlur = 0
    ctx.beginPath(); ctx.moveTo(AX, AY); ctx.lineTo(AX+r.x, AY-r.y); ctx.stroke()
    ctx.fillStyle = col
    ctx.beginPath(); ctx.arc(AX+r.x, AY-r.y, 2.5, 0, Math.PI*2); ctx.fill()
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(n, AX+r.x*1.45, AY-r.y*1.45)
  })
}

export const EMPTY_SCENE = {
  points: [], segments: [], midpoints: [], faces: [], vectors: [], labels: [],
}

/* Góc nhìn dựng sẵn. rx là góc ngẩng, ry là góc quay quanh trục đứng. */
const CAMERAS = [
  { id: 'default', name: 'Mặc định',      rx: INIT_RX,       ry: INIT_RY },
  { id: 'front',   name: 'Trước',         rx: 0,             ry: 0 },
  { id: 'right',   name: 'Bên phải',      rx: 0,             ry: Math.PI / 2 },
  { id: 'left',    name: 'Chéo trái',     rx: INIT_RX,       ry: -INIT_RY },
  { id: 'top',     name: 'Từ trên xuống', rx: -RX_LIMIT,     ry: 0 },
]

/* ─────────────────── Component ─────────────────── */
/**
 * Bộ vẽ thuần — KHÔNG còn ô soạn JSON, ô đó nay nằm ở Geo3DWorkbench và chỉ giáo
 * viên thấy.
 *
 * `scene`            — dùng có kiểm soát (Geo3DWorkbench truyền xuống).
 * `initialSceneData` — dùng kiểu cũ, giữ cho ExerciseSolver.
 */
export default function Geo3DViewer({
  scene,
  initialSceneData,
  showTools = true,
  fileName = 'hinh-khong-gian',
} = {}) {
  const cvs    = useRef(null)
  const wrap   = useRef(null)
  const panel  = useRef(null)
  const drawFn = useRef(null)

  const [uncontrolled, setUncontrolled] = useState(() => initialSceneData ?? EMPTY_SCENE)
  const [rx,      setRx]      = useState(INIT_RX)
  const [ry,      setRy]      = useState(INIT_RY)
  const [zoom,    setZoom]    = useState(1.0)
  const [isFull,  setIsFull]  = useState(false)
  const [isDrag,  setIsDrag]  = useState(false)
  const drag  = useRef({ on: false, x: 0, y: 0 })
  const touch = useRef({ on: false, x: 0, y: 0 })

  const resetView = useCallback(() => { setRx(INIT_RX); setRy(INIT_RY); setZoom(1) }, [])

  // Đồng bộ khi cha truyền hình MỚI xuống. Lỗi cũ: initialSceneData chỉ được đọc trong
  // useState nên React bỏ qua từ lần render thứ hai — dựng hình lần thứ hai là hình cũ
  // vẫn nằm nguyên trên canvas. Không vá bằng key={} ở nơi gắn vì làm vậy sẽ dựng lại
  // canvas và gây nháy.
  useEffect(() => {
    if (initialSceneData) { setUncontrolled(initialSceneData); resetView() }
  }, [initialSceneData, resetView])
  // Hình mới do AI dựng thì trả góc nhìn về mặc định, học sinh mong thấy hình ngay ngắn.
  useEffect(() => { if (scene) resetView() }, [scene, resetView])

  const activeScene = scene ?? uncontrolled
  const isEmpty = !(activeScene?.points || []).length

  /* ── Derived ── */
  const ptMap = useMemo(() => {
    const m = {}
    ;(activeScene.points || []).forEach(p => { m[p.id] = { ...p } })
    ;(activeScene.midpoints || []).forEach(mp => {
      const a = m[mp.of?.[0]], b = m[mp.of?.[1]]
      if (a && b) m[mp.id] = {
        id: mp.id,
        x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2,
        isMidpoint: true,
      }
    })
    return m
  }, [activeScene])

  const bb = useMemo(() => {
    const pts = Object.values(ptMap)
    if (!pts.length) return { cx:0, cy:0, cz:0, range:1 }
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity
    pts.forEach(p => {
      x0=Math.min(x0,p.x); x1=Math.max(x1,p.x)
      y0=Math.min(y0,p.y); y1=Math.max(y1,p.y)
      z0=Math.min(z0,p.z); z1=Math.max(z1,p.z)
    })
    return {
      cx:(x0+x1)/2, cy:(y0+y1)/2, cz:(z0+z1)/2,
      range: Math.max(x1-x0, y1-y0, z1-z0, 0.1),
    }
  }, [ptMap])

  /* ── Draw ── */
  const draw = useCallback(() => {
    const c = cvs.current; if (!c) return
    renderScene(c.getContext('2d'), c.width, c.height, activeScene, ptMap, bb, rx, ry, zoom)
  }, [activeScene, ptMap, bb, rx, ry, zoom])

  drawFn.current = draw

  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => {
      const c = cvs.current; if (!c) return
      c.width  = el.clientWidth
      c.height = el.clientHeight
      drawFn.current?.()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { draw() }, [draw])

  /* ── Mouse ── */
  const onDown = (e) => { drag.current = { on:true, x:e.clientX, y:e.clientY }; setIsDrag(true) }
  const onMove = useCallback((e) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current.x = e.clientX; drag.current.y = e.clientY
    setRy(v => v + dx * 0.007)
    setRx(v => Math.max(-RX_LIMIT, Math.min(RX_LIMIT, v + dy * 0.007)))
  }, [])
  const onUp = () => { drag.current.on = false; setIsDrag(false) }
  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(v => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v * (e.deltaY < 0 ? 1.1 : 0.91))))
  }, [])

  /* ── Touch ── */
  const onTDown = (e) => {
    if (e.touches.length===1) touch.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY}
  }
  const onTMove = (e) => {
    if (!touch.current.on||e.touches.length!==1) return
    e.preventDefault()
    const dx=e.touches[0].clientX-touch.current.x, dy=e.touches[0].clientY-touch.current.y
    touch.current.x=e.touches[0].clientX; touch.current.y=e.touches[0].clientY
    setRy(v => v+dx*0.007)
    setRx(v => Math.max(-RX_LIMIT, Math.min(RX_LIMIT, v+dy*0.007)))
  }
  const onTEnd = () => { touch.current.on=false }

  /* ── Actions ── */
  const stepZoom = (f) =>
    setZoom(v => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v * f)))

  const setCamera = (cam) => { setRx(cam.rx); setRy(cam.ry) }

  /* Xuất PNG: vẽ LẠI ra canvas ngoài màn hình ở 3x rồi mới xuất. Canvas trên trang
     lấy kích thước theo CSS pixel, không nhân devicePixelRatio, nên xuất thẳng sẽ mờ.
     renderScene nhận W/H tường minh và suy mọi thứ từ đó, nên chỉ cần ctx.scale rồi
     truyền W/H LOGIC là xong, không phải sửa gì trong bộ vẽ. */
  const savePNG = () => {
    const src = cvs.current; if (!src || isEmpty) return
    const W = src.width, H = src.height, k = 3
    const off = document.createElement('canvas')
    off.width = W * k; off.height = H * k
    const ctx = off.getContext('2d')
    ctx.scale(k, k)
    renderScene(ctx, W, H, activeScene, ptMap, bb, rx, ry, zoom)
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
                + `-${pad(d.getHours())}${pad(d.getMinutes())}`
    const a = document.createElement('a')
    a.href = off.toDataURL('image/png')
    a.download = `${fileName}-${stamp}.png`
    a.click()
  }

  /* Toàn màn hình đặt trên cả panel (không phải riêng canvas) để thanh công cụ còn
     thấy được. ResizeObserver sẵn có tự chỉnh lại canvas khi vào/ra. */
  const toggleFull = () => {
    const el = panel.current; if (!el) return
    const doc = document
    const cur = doc.fullscreenElement || doc.webkitFullscreenElement
    if (cur) (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
  }

  useEffect(() => {
    const sync = () =>
      setIsFull(!!(document.fullscreenElement || document.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  return (
    <div className={`g3d-root${showTools ? '' : ' g3d-root--bare'}`}>
      <div ref={panel} className="g3d-canvas-panel g3d-canvas-panel--full">

        {showTools && (
          <div className="g3d-toolbar">
            <div className="g3d-tool-group">
              <button className="g3d-btn-sm" onClick={resetView} title="Về góc nhìn mặc định">
                ↺ Reset
              </button>
            </div>

            <div className="g3d-tool-group">
              <button className="g3d-btn-sm" onClick={() => stepZoom(0.8)} title="Thu nhỏ">−</button>
              <button className="g3d-zoom-badge" onClick={() => setZoom(1)} title="Bấm để về 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button className="g3d-btn-sm" onClick={() => stepZoom(1.25)} title="Phóng to">+</button>
            </div>

            <div className="g3d-tool-group g3d-cams">
              {CAMERAS.map(c => (
                <button key={c.id} className="g3d-cam-chip" onClick={() => setCamera(c)}>
                  {c.name}
                </button>
              ))}
            </div>

            <div className="g3d-tool-group g3d-tool-group--end">
              <button className="g3d-btn-sm" onClick={savePNG} disabled={isEmpty} title="Tải hình về máy">
                ⬇ Tải PNG
              </button>
              <button className="g3d-btn-sm" onClick={toggleFull}>
                {isFull ? '⤡ Thoát' : '⤢ Toàn màn hình'}
              </button>
            </div>
          </div>
        )}

        <div
          ref={wrap}
          className="g3d-wrap"
          style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onWheel={onWheel}
          onTouchStart={onTDown}
          onTouchMove={onTMove}
          onTouchEnd={onTEnd}
        >
          <canvas ref={cvs} style={{ display:'block', touchAction:'none' }} />
          {isEmpty && (
            <div className="g3d-empty">
              Chưa có hình — nhập đề bài hoặc tải ảnh lên để AI vẽ.
            </div>
          )}
          {!isEmpty && showTools && (
            <span className="g3d-hint g3d-hint--float">Kéo để xoay · Lăn chuột để phóng to</span>
          )}
        </div>
      </div>
    </div>
  )
}

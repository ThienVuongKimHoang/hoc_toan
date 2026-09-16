import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ─────────────────── 3D Math & Lighting ─────────────────── */
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

/* Tính màu với độ sáng (dùng cho đổ bóng 3D tự nhiên khi xoay) */
function shadeColor(color, factor) {
  if (!color || typeof color !== 'string') return '#74c0fc'
  if (color.startsWith('rgba') || color.startsWith('hsla')) return color
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const num = parseInt(hex, 16)
    if (isNaN(num)) return color
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)))
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)))
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)))
    return `rgb(${r},${g},${b})`
  }
  return color
}

const INIT_RX = -0.42
const INIT_RY =  0.64
const RX_LIMIT = Math.PI / 2 - 0.02
const ZOOM_MIN = 0.3
const ZOOM_MAX = 6

/* ─────────────────── Renderer ─────────────────── */
function renderScene(ctx, W, H, scene, ptMap, bb, rx, ry, zoom, options = {}) {
  const { animTime = 0, entranceScale = 1 } = options

  ctx.clearRect(0, 0, W, H)

  // 1. Studio Lighting Background (Vignette mềm tạo chiều sâu cô lập hình)
  const CX = W / 2, CY = H / 2
  const maxDim = Math.max(W, H)
  const bgGrad = ctx.createRadialGradient(CX, CY * 0.95, maxDim * 0.1, CX, CY, maxDim * 0.8)
  bgGrad.addColorStop(0, '#ffffff')
  bgGrad.addColorStop(0.55, '#f8fafc')
  bgGrad.addColorStop(1, '#edf2f7')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // 2. Tỉ lệ hiển thị phóng to (0.62 thay vì 0.36 cũ giúp hình to, rõ, chiếm lĩnh trung tâm)
  const currentZoom = zoom * entranceScale
  const S  = Math.min(W, H) * 0.62 / (bb.range || 1) * currentZoom

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Chiếu toạ độ các điểm sang 2D
  const p2 = {}
  Object.entries(ptMap).forEach(([id, p]) => {
    p2[id] = proj(p.x - bb.cx, p.y - bb.cy, p.z - bb.cz, rx, ry, CX, CY, S)
  })

  // 3. Đổ bóng tiếp xúc mặt sàn (Floor shadow disc) giúp vật thể đứng vững trong không gian
  const ptsArr = Object.values(ptMap)
  if (ptsArr.length > 0) {
    let yMin = Infinity
    ptsArr.forEach(p => { if (p.y < yMin) yMin = p.y })
    const groundP = proj(0, yMin - bb.cy, 0, rx, ry, CX, CY, S)
    const shadowRx = Math.max(20, bb.range * S * 0.42)
    const shadowRy = Math.max(7, shadowRx * Math.abs(Math.sin(rx) * 0.38 + 0.18))
    
    ctx.save()
    const shadowGrad = ctx.createRadialGradient(groundP.sx, groundP.sy + 10, 0, groundP.sx, groundP.sy + 10, shadowRx)
    shadowGrad.addColorStop(0, 'rgba(30, 41, 59, 0.09)')
    shadowGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.03)')
    shadowGrad.addColorStop(1, 'rgba(30, 41, 59, 0)')
    ctx.fillStyle = shadowGrad
    ctx.beginPath()
    ctx.ellipse(groundP.sx, groundP.sy + 10, shadowRx, shadowRy, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Label map — hỗ trợ cả id và point
  const lblMap = {}
  ;(scene.labels || []).forEach(l => { lblMap[l.id ?? l.point] = l })

  // Thu thập đối tượng vẽ
  const items = []
  const highlights = []

  // Directional Light Vector chuẩn trong camera space (chếch từ trên-trước-phải)
  const lx = 0.38, ly = 0.76, lz = -0.52
  const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz)
  const nlx = lx/lLen, nly = ly/lLen, nlz = lz/lLen

  // Mặt phẳng (faces) — tính pháp tuyến và đổ bóng 3D
  ;(scene.faces || []).forEach(face => {
    const pts = (face.points || []).map(id => p2[id]).filter(Boolean)
    if (pts.length < 3) return

    // Tính vector pháp tuyến từ 3 điểm đầu trong toạ độ thế giới
    const pA = ptMap[face.points[0]]
    const pB = ptMap[face.points[1]]
    const pC = ptMap[face.points[2]]
    let lightFactor = 1.0

    if (pA && pB && pC) {
      const u = { x: pB.x - pA.x, y: pB.y - pA.y, z: pB.z - pA.z }
      const v = { x: pC.x - pA.x, y: pC.y - pA.y, z: pC.z - pA.z }
      const nx = u.y * v.z - u.z * v.y
      const ny = u.z * v.x - u.x * v.z
      const nz = u.x * v.y - u.y * v.x
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
      if (len > 1e-6) {
        // Xoay pháp tuyến sang camera space
        const rNorm = rotXY(nx/len, ny/len, nz/len, rx, ry)
        const dot = Math.abs(rNorm.x * nlx + rNorm.y * nly + rNorm.z * nlz)
        lightFactor = 0.70 + 0.35 * dot // Độ sáng linh động từ 70% đến 105%
      }
    }

    const z = pts.reduce((s, p) => s + p.depth, 0) / pts.length - 0.5
    items.push({ k: 'face', face, pts, z, lightFactor })
  })

  // Đoạn thẳng (segments)
  ;(scene.segments || []).forEach(seg => {
    const a = p2[seg.from], b = p2[seg.to]
    if (!a || !b) return
    if (seg.highlight) {
      highlights.push({ a, b, seg })
    } else {
      items.push({ k: 'seg', a, b, seg, z: (a.depth + b.depth) / 2 })
    }
  })

  // Vectơ
  ;(scene.vectors || []).forEach(vec => {
    const a = p2[vec.from], b = p2[vec.to]
    if (a && b) items.push({ k: 'vec', a, b, vec, z: (a.depth + b.depth) / 2 })
  })

  // Điểm
  Object.entries(ptMap).forEach(([id, p]) => {
    const pt = p2[id]
    if (pt) items.push({ k: 'pt', id, p, pt, z: pt.depth })
  })

  // Sắp xếp chiều sâu (Back to Front)
  items.sort((a, b) => a.z - b.z)

  // ── Giai đoạn 1: Vẽ đối tượng theo chiều sâu ──
  items.forEach(it => {
    if (it.k === 'face') {
      const { face, pts, lightFactor } = it
      const st = face.style || {}
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      ctx.beginPath()
      ctx.moveTo(pts[0].sx, pts[0].sy)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy)
      ctx.closePath()

      // Đổ bóng 3D mặt phẳng
      ctx.globalAlpha = st.opacity ?? 0.32
      const baseFill = st.fill || '#74c0fc'
      ctx.fillStyle = shadeColor(baseFill, lightFactor)
      ctx.fill()

      // Viền mặt phẳng
      if (st.stroke) {
        ctx.globalAlpha = Math.min(1, (st.opacity ?? 0.32) * 1.4 + 0.2)
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
      ctx.globalAlpha = seg.dashed ? 0.55 : 1
      ctx.shadowBlur  = 0
      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.stroke()
      ctx.globalAlpha = 1

    } else if (it.k === 'vec') {
      const { a, b, vec } = it
      const col = vec.color || '#2563eb'
      ctx.strokeStyle = col
      ctx.lineWidth = 2.4
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.stroke()

      const dx = b.sx - a.sx, dy = b.sy - a.sy
      const L = Math.sqrt(dx * dx + dy * dy)
      if (L > 2) {
        const ux = dx/L, uy = dy/L, s = 11
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(b.sx, b.sy)
        ctx.lineTo(b.sx - ux*s + uy*s*0.35, b.sy - uy*s - ux*s*0.35)
        ctx.lineTo(b.sx - ux*s - uy*s*0.35, b.sy - uy*s + ux*s*0.35)
        ctx.closePath()
        ctx.fill()
      }

    } else if (it.k === 'pt') {
      const { p, pt } = it
      const r   = p.size   || (p.isMidpoint ? 3.8 : 4.0)
      const col = p.color  || (p.isMidpoint ? '#7c3aed' : '#1e293b')
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      ctx.fillStyle   = col
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth   = 1.8
      ctx.beginPath()
      ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  })

  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // ── Giai đoạn 2: Đoạn thẳng highlight (vẽ với hiệu ứng thở pulsing sống động) ──
  const pulse = Math.sin(animTime * 3.5)
  highlights.forEach(({ a, b, seg }) => {
    const col = seg.color || '#2563eb'
    ctx.setLineDash([])
    ctx.shadowColor = col
    ctx.shadowBlur  = 7 + pulse * 2.5
    ctx.strokeStyle = col
    ctx.lineWidth   = (seg.width || 2.5) + pulse * 0.35
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()
  })
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'

  // ── Giai đoạn 3: Nhãn điểm (luôn trên cùng, nền tương phản sắc nét) ──
  ctx.save()
  Object.entries(ptMap).forEach(([id, p]) => {
    const pt  = p2[id]; if (!pt) return
    const ov  = lblMap[id]
    const txt = ov?.text  ?? id
    const dx  = ov?.dx    ?? 11
    const dy  = ov?.dy    ?? -14
    const fs  = ov?.size  ?? 13.5
    const col = ov?.color ?? (p.isMidpoint ? '#6d28d9' : '#0f172a')

    ctx.font = `600 ${fs}px "Inter", system-ui, -apple-system, sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    const tw = ctx.measureText(txt).width
    const bx = pt.sx + dx - tw / 2 - 4
    const by = pt.sy + dy - fs * 0.65
    const bw = tw + 8, bh = fs * 1.35, br = 4

    // Khung nền nhãn kính mờ nhẹ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.moveTo(bx + br, by)
    ctx.arcTo(bx + bw, by,    bx + bw, by + bh, br)
    ctx.arcTo(bx + bw, by+bh, bx,      by + bh, br)
    ctx.arcTo(bx,      by+bh, bx,      by,      br)
    ctx.arcTo(bx,      by,    bx + bw, by,      br)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = col
    ctx.fillText(txt, pt.sx + dx, pt.sy + dy)
  })

  // Nhãn vectơ
  ;(scene.vectors || []).forEach(vec => {
    if (!vec.label) return
    const a = p2[vec.from], b = p2[vec.to]; if (!a || !b) return
    ctx.font      = `italic 600 12.5px "Inter", system-ui, sans-serif`
    ctx.fillStyle = vec.color || '#2563eb'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(vec.label, (a.sx+b.sx)/2 + 10, (a.sy+b.sy)/2 - 10)
  })
  ctx.restore()

  // ── Giai đoạn 4: La bàn trục toạ độ (Gizmo góc dưới trái) ──
  const AX = 52, AY = H - 52, AL = 28
  ;[['X',1,0,0,'#ef4444'],['Y',0,1,0,'#16a34a'],['Z',0,0,1,'#2563eb']].forEach(([n,ax,ay,az,col]) => {
    const r = rotXY(ax*AL, ay*AL, az*AL, rx, ry)
    ctx.strokeStyle = col
    ctx.lineWidth = 2.2
    ctx.setLineDash([])
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.moveTo(AX, AY)
    ctx.lineTo(AX+r.x, AY-r.y)
    ctx.stroke()
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(AX+r.x, AY-r.y, 2.8, 0, Math.PI*2)
    ctx.fill()
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n, AX+r.x*1.42, AY-r.y*1.42)
  })
}

export const EMPTY_SCENE = {
  points: [], segments: [], midpoints: [], faces: [], vectors: [], labels: [],
}

/* Góc nhìn tiêu chuẩn dựng sẵn */
const CAMERAS = [
  { id: 'default', name: 'Mặc định',      rx: INIT_RX,       ry: INIT_RY },
  { id: 'front',   name: 'Chính diện',    rx: 0,             ry: 0 },
  { id: 'right',   name: 'Bên phải',      rx: 0,             ry: Math.PI / 2 },
  { id: 'left',    name: 'Chéo trái',     rx: INIT_RX,       ry: -INIT_RY },
  { id: 'top',     name: 'Từ trên xuống', rx: -RX_LIMIT,     ry: 0 },
]

/* ─────────────────── Component ─────────────────── */
export default function Geo3DViewer({
  scene,
  initialSceneData,
  showTools = true,
  fileName = 'hinh-khong-gian',
  isFocusMode = false,
  onToggleFocus,
  onOpenPrompt,
  onOpenScript,
  canSeeCode = false,
} = {}) {
  const cvs    = useRef(null)
  const wrap   = useRef(null)
  const panel  = useRef(null)

  const [uncontrolled, setUncontrolled] = useState(() => initialSceneData ?? EMPTY_SCENE)
  const [zoom, setZoom]                 = useState(1.0)
  const [isFull, setIsFull]             = useState(false)
  const [isDrag, setIsDrag]             = useState(false)
  const [isAutoRotating, setIsAutoRotating] = useState(false)
  const [activeCam, setActiveCam]       = useState('default')

  /* Animation & Physics Refs (chạy mượt 60fps qua requestAnimationFrame) */
  const rxRef          = useRef(INIT_RX)
  const ryRef          = useRef(INIT_RY)
  const targetRxRef    = useRef(INIT_RX)
  const targetRyRef    = useRef(INIT_RY)
  const velXRef        = useRef(0)
  const velYRef        = useRef(0)
  const autoRotateRef  = useRef(false)
  const isTransitionRef = useRef(false)
  const entranceRef    = useRef(1.0)
  const animTimeRef    = useRef(0)
  const rafRef         = useRef(null)

  const drag  = useRef({ on: false, x: 0, y: 0, lastX: 0, lastY: 0, time: 0 })
  const touch = useRef({ on: false, x: 0, y: 0, lastX: 0, lastY: 0, time: 0 })

  const activeScene = scene ?? uncontrolled
  const isEmpty = !(activeScene?.points || []).length

  const triggerEntrance = useCallback(() => {
    targetRxRef.current = INIT_RX
    targetRyRef.current = INIT_RY
    rxRef.current = INIT_RX - 0.12
    ryRef.current = INIT_RY + 0.35
    entranceRef.current = 0.82
    isTransitionRef.current = true
    setActiveCam('default')
  }, [])

  // Đồng bộ props
  useEffect(() => {
    if (initialSceneData) {
      setUncontrolled(initialSceneData)
      triggerEntrance()
    }
  }, [initialSceneData, triggerEntrance])

  useEffect(() => {
    if (scene) {
      triggerEntrance()
    }
  }, [scene, triggerEntrance])

  /* ── Derived Data ── */
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

  /* ── Render Function với Retina Display Support ── */
  const drawCanvas = useCallback(() => {
    const c = cvs.current; if (!c) return
    const el = wrap.current; if (!el) return
    const W = el.clientWidth, H = el.clientHeight
    if (W <= 0 || H <= 0) return

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    const targetW = Math.round(W * dpr)
    const targetH = Math.round(H * dpr)

    if (c.width !== targetW || c.height !== targetH) {
      c.width  = targetW
      c.height = targetH
    }

    const ctx = c.getContext('2d')
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderScene(
      ctx, W, H, activeScene, ptMap, bb,
      rxRef.current, ryRef.current, zoom,
      { animTime: animTimeRef.current, entranceScale: entranceRef.current }
    )
    ctx.restore()
  }, [activeScene, ptMap, bb, zoom])

  /* ── Vòng lặp Animation mượt mà 60fps (quán tính, xoay tự động, chuyển góc) ── */
  useEffect(() => {
    let active = true

    const loop = () => {
      if (!active) return

      animTimeRef.current += 0.016

      // 1. Entrance animation
      if (entranceRef.current < 1.0) {
        entranceRef.current += (1.0 - entranceRef.current) * 0.08
        if (1.0 - entranceRef.current < 0.002) entranceRef.current = 1.0
      }

      // 2. Chuyển góc nhìn camera mượt mà (Easing transitions)
      if (isTransitionRef.current) {
        const dRx = targetRxRef.current - rxRef.current
        const dRy = targetRyRef.current - ryRef.current
        rxRef.current += dRx * 0.12
        ryRef.current += dRy * 0.12
        if (Math.abs(dRx) < 0.001 && Math.abs(dRy) < 0.001) {
          rxRef.current = targetRxRef.current
          ryRef.current = targetRyRef.current
          isTransitionRef.current = false
        }
      }

      // 3. Tự động xoay quanh trục Y (Turntable Animation)
      if (autoRotateRef.current && !drag.current.on && !touch.current.on && !isTransitionRef.current) {
        ryRef.current += 0.0055
        targetRyRef.current = ryRef.current
      }

      // 4. Quán tính kéo xoay (Inertia momentum) khi nhả tay
      if (!drag.current.on && !touch.current.on && !isTransitionRef.current) {
        if (Math.abs(velXRef.current) > 0.0001 || Math.abs(velYRef.current) > 0.0001) {
          ryRef.current += velXRef.current
          rxRef.current = Math.max(-RX_LIMIT, Math.min(RX_LIMIT, rxRef.current + velYRef.current))
          velXRef.current *= 0.92
          velYRef.current *= 0.92
          targetRyRef.current = ryRef.current
          targetRxRef.current = rxRef.current
        }
      }

      drawCanvas()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [drawCanvas])

  // Quan sát kích thước khung để resize canvas
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => drawCanvas())
    ro.observe(el)
    return () => ro.disconnect()
  }, [drawCanvas])

  /* ── Điều khiển chuột với quán tính vật lý ── */
  const onDown = (e) => {
    drag.current = { on: true, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, time: performance.now() }
    velXRef.current = 0
    velYRef.current = 0
    isTransitionRef.current = false
    setIsDrag(true)
  }

  const onMove = useCallback((e) => {
    if (!drag.current.on) return
    const now = performance.now()
    const dx = e.clientX - drag.current.lastX
    const dy = e.clientY - drag.current.lastY

    drag.current.lastX = e.clientX
    drag.current.lastY = e.clientY

    const dt = Math.max(1, now - drag.current.time)
    drag.current.time = now

    // Vận tốc tức thời cho quán tính
    velXRef.current = (dx / dt) * 0.09
    velYRef.current = (dy / dt) * 0.09

    ryRef.current += dx * 0.007
    rxRef.current = Math.max(-RX_LIMIT, Math.min(RX_LIMIT, rxRef.current + dy * 0.007))
    targetRxRef.current = rxRef.current
    targetRyRef.current = ryRef.current
    setActiveCam('custom')
  }, [])

  const onUp = () => {
    drag.current.on = false
    setIsDrag(false)
  }

  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(v => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v * (e.deltaY < 0 ? 1.1 : 0.91))))
  }, [])

  /* ── Cảm ứng Touch với quán tính ── */
  const onTDown = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      touch.current = { on: true, x: t.clientX, y: t.clientY, lastX: t.clientX, lastY: t.clientY, time: performance.now() }
      velXRef.current = 0
      velYRef.current = 0
      isTransitionRef.current = false
    }
  }

  const onTMove = (e) => {
    if (!touch.current.on || e.touches.length !== 1) return
    e.preventDefault()
    const now = performance.now()
    const t = e.touches[0]
    const dx = t.clientX - touch.current.lastX
    const dy = t.clientY - touch.current.lastY

    touch.current.lastX = t.clientX
    touch.current.lastY = t.clientY

    const dt = Math.max(1, now - touch.current.time)
    touch.current.time = now

    velXRef.current = (dx / dt) * 0.09
    velYRef.current = (dy / dt) * 0.09

    ryRef.current += dx * 0.007
    rxRef.current = Math.max(-RX_LIMIT, Math.min(RX_LIMIT, rxRef.current + dy * 0.007))
    targetRxRef.current = rxRef.current
    targetRyRef.current = ryRef.current
    setActiveCam('custom')
  }

  const onTEnd = () => { touch.current.on = false }

  /* ── Thao tác người dùng ── */
  const resetView = useCallback(() => {
    targetRxRef.current = INIT_RX
    targetRyRef.current = INIT_RY
    isTransitionRef.current = true
    setZoom(1.0)
    setActiveCam('default')
  }, [])

  const setCamera = (cam) => {
    targetRxRef.current = cam.rx
    targetRyRef.current = cam.ry
    isTransitionRef.current = true
    setActiveCam(cam.id)
  }

  const toggleAutoRotate = () => {
    const next = !isAutoRotating
    setIsAutoRotating(next)
    autoRotateRef.current = next
    if (next) isTransitionRef.current = false
  }

  const stepZoom = (f) =>
    setZoom(v => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v * f)))

  /* Xuất PNG sắc nét ở độ phân giải cao 3x */
  const savePNG = () => {
    const el = wrap.current; if (!el || isEmpty) return
    const W = el.clientWidth, H = el.clientHeight, k = 3
    const off = document.createElement('canvas')
    off.width = W * k; off.height = H * k
    const ctx = off.getContext('2d')
    ctx.scale(k, k)
    renderScene(ctx, W, H, activeScene, ptMap, bb, rxRef.current, ryRef.current, zoom)
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
                + `-${pad(d.getHours())}${pad(d.getMinutes())}`
    const a = document.createElement('a')
    a.href = off.toDataURL('image/png')
    a.download = `${fileName}-${stamp}.png`
    a.click()
  }

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
    <div className={`g3d-root ${isFocusMode ? 'g3d-root--focus' : ''}`}>
      <div ref={panel} className="g3d-canvas-panel g3d-canvas-panel--full">

        {/* Floating Glassmorphism Toolbar HUD — Nổi trên hình giúp cô lập và mở rộng 100% diện tích canvas */}
        {showTools && (
          <div className="g3d-floating-hud">
            {/* Nhóm tương tác & hoạt hoạ */}
            <div className="g3d-hud-group">
              <button
                className={`g3d-hud-btn ${isAutoRotating ? 'g3d-hud-btn--active' : ''}`}
                onClick={toggleAutoRotate}
                title={isAutoRotating ? 'Tạm dừng xoay tự động' : 'Bật xoay 3D tự động (Turntable)'}
              >
                <span className={`g3d-spin-icon ${isAutoRotating ? 'g3d-spin-icon--anim' : ''}`}>🔄</span>
                <span className="g3d-hud-btn-txt">{isAutoRotating ? 'Dừng xoay' : 'Xoay tự động'}</span>
              </button>

              <button className="g3d-hud-btn" onClick={resetView} title="Về góc nhìn chuẩn">
                ↺ Đặt lại
              </button>
            </div>

            {/* Nhóm góc nhìn máy quay */}
            <div className="g3d-hud-group g3d-hud-cams">
              {CAMERAS.map(c => (
                <button
                  key={c.id}
                  className={`g3d-hud-chip ${activeCam === c.id ? 'g3d-hud-chip--active' : ''}`}
                  onClick={() => setCamera(c)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Nhóm thu phóng */}
            <div className="g3d-hud-group">
              <button className="g3d-hud-btn g3d-hud-btn--icon" onClick={() => stepZoom(0.85)} title="Thu nhỏ">−</button>
              <button className="g3d-hud-badge" onClick={() => setZoom(1.0)} title="Về tỉ lệ 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button className="g3d-hud-btn g3d-hud-btn--icon" onClick={() => stepZoom(1.2)} title="Phóng to">+</button>
            </div>

            {/* Nhóm thao tác & Chế độ cô lập */}
            <div className="g3d-hud-group g3d-hud-group--end">
              {onToggleFocus && (
                <button
                  className={`g3d-hud-btn ${isFocusMode ? 'g3d-hud-btn--active' : ''}`}
                  onClick={onToggleFocus}
                  title={isFocusMode ? 'Thoát chế độ cô lập' : 'Cô lập hình (ẩn các thành phần thừa)'}
                >
                  👁️ {isFocusMode ? 'Đang cô lập' : 'Cô lập hình'}
                </button>
              )}
              {canSeeCode && onOpenScript && (
                <button
                  className="g3d-hud-btn"
                  onClick={onOpenScript}
                  title="Mở bảng mã JSON hình"
                >
                  {'{ }'} Script
                </button>
              )}
              <button className="g3d-hud-btn" onClick={savePNG} disabled={isEmpty} title="Tải ảnh PNG độ nét cao">
                ⬇ PNG
              </button>
              <button className="g3d-hud-btn g3d-hud-btn--icon" onClick={toggleFull} title="Toàn màn hình">
                {isFull ? '⤡' : '⤢'}
              </button>
            </div>
          </div>
        )}

        {/* Vùng Canvas hiển thị hình không gian */}
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
          <canvas ref={cvs} style={{ display: 'block', touchAction: 'none' }} />

          {isEmpty && (
            <div className="g3d-empty">
              <div className="g3d-empty-box">
                <span className="g3d-empty-icon">📐</span>
                <p className="g3d-empty-title">Chưa có hình không gian</p>
                <p className="g3d-empty-sub">Nhập đề bài hoặc tải ảnh đề bài lên để AI dựng hình 3D tự động.</p>
                {onOpenPrompt && (
                  <button className="g3d-btn-primary" onClick={onOpenPrompt}>
                    ✨ Nhập đề bài
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEmpty && showTools && (
            <div className="g3d-hint-island">
              <span>✦ Kéo để xoay · Lăn chuột để phóng to</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

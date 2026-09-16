import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeBuildSteps, layoutBuild, revealAt } from '../utils/geo3dBuild.js'

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

/* Khoảng cách từ điểm tới đoạn thẳng trên màn hình 2D */
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1)**2 + (y2 - y1)**2
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
}

/* Khoảng cách Euclidean trong không gian 3D */
function dist3D(pA, pB) {
  if (!pA || !pB) return 0
  return Math.hypot(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z)
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

/* Màu nhấn cho phần đang được vẽ khi dựng hình từng bước */
const BUILD_ACCENT = '#7c3aed'
const BUILD_SPEEDS = [0.5, 1, 1.5, 2]
const BUILD_SPEED_KEY = 'g3d-build-speed'   // nhớ tốc độ học sinh đã chọn (tiện ích riêng máy)
const readBuildSpeed = () => {
  try {
    const v = parseFloat(localStorage.getItem(BUILD_SPEED_KEY))
    return BUILD_SPEEDS.includes(v) ? v : 1
  } catch { return 1 }
}
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2 }

/* Bảng màu và ký hiệu cho các nhóm đoạn thẳng bằng nhau */
export const EQUAL_PALETTE = [
  { id: 'eq1', name: 'Nhóm 1 (Xanh lá)',  color: '#059669', symbol: 'single', mark: '1 gạch (/)' },
  { id: 'eq2', name: 'Nhóm 2 (Hổ phách)', color: '#d97706', symbol: 'double', mark: '2 gạch (//)' },
  { id: 'eq3', name: 'Nhóm 3 (Tím)',      color: '#7c3aed', symbol: 'triple', mark: '3 gạch (///)' },
  { id: 'eq4', name: 'Nhóm 4 (Hồng đỏ)',  color: '#e11d48', symbol: 'cross',  mark: 'Dấu nhân (×)' },
  { id: 'eq5', name: 'Nhóm 5 (Xanh dương)', color: '#0284c7', symbol: 'circle', mark: 'Vòng tròn (○)' },
]

/* ─────────────────── Renderer ─────────────────── */
function renderScene(ctx, W, H, scene, ptMap, bb, rx, ry, zoom, options = {}) {
  const {
    animTime = 0,
    entranceScale = 1,
    hoveredPtId = null,
    connectingFromId = null,
    rubberBandPos = null,
    hoveredSegKey = null,
    selectedSegKey = null,
    rightAngleDraft = [],
    reveal = null,   // dựng hình từng bước (utils/geo3dBuild.js); null = vẽ đủ cả hình
  } = options

  // Mức hiện [0..1] của một phần tử; không ở chế độ dựng hình thì mọi thứ hiện đủ
  const rv  = (kind, ref) => (reveal ? (reveal[kind][ref] || 0) : 1)
  const hot = (kind, ref) => !!(reveal && reveal.hot[kind][ref])
  const penTips = []   // đầu ngòi bút của các đoạn đang vẽ dở — vẽ sau cùng để không bị che

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

  // 2. Tỉ lệ hiển thị phóng to (0.62)
  const currentZoom = zoom * entranceScale
  const S  = Math.min(W, H) * 0.62 / (bb.range || 1) * currentZoom

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Chiếu toạ độ các điểm sang 2D
  const p2 = {}
  Object.entries(ptMap).forEach(([id, p]) => {
    p2[id] = proj(p.x - bb.cx, p.y - bb.cy, p.z - bb.cz, rx, ry, CX, CY, S)
  })

  // 3. Đổ bóng tiếp xúc mặt sàn (Floor shadow disc)
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

  // Label map
  const lblMap = {}
  ;(scene.labels || []).forEach(l => { lblMap[l.id ?? l.point] = l })

  // Tra cứu nhóm bằng nhau
  const eqGroupMap = {}
  EQUAL_PALETTE.forEach(g => { eqGroupMap[g.id] = g })
  ;(scene.equalGroups || []).forEach(g => { eqGroupMap[g.id] = { ...eqGroupMap[g.id], ...g } })

  // Thu thập đối tượng vẽ
  const items = []
  const highlights = []

  // Vector ánh sáng
  const lx = 0.38, ly = 0.76, lz = -0.52
  const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz)
  const nlx = lx/lLen, nly = ly/lLen, nlz = lz/lLen

  // Mặt phẳng (faces)
  ;(scene.faces || []).forEach((face, fi) => {
    const fa = rv('face', fi)
    if (fa <= 0) return
    const pts = (face.points || []).map(id => p2[id]).filter(Boolean)
    if (pts.length < 3) return

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
        const rNorm = rotXY(nx/len, ny/len, nz/len, rx, ry)
        const dot = Math.abs(rNorm.x * nlx + rNorm.y * nly + rNorm.z * nlz)
        lightFactor = 0.70 + 0.35 * dot
      }
    }

    const z = pts.reduce((s, p) => s + p.depth, 0) / pts.length - 0.5
    items.push({ k: 'face', face, pts, z, lightFactor, fa })
  })

  // Đoạn thẳng (segments)
  ;(scene.segments || []).forEach((seg, idx) => {
    const t = rv('seg', idx)
    if (t <= 0) return
    let a = p2[seg.from], b = p2[seg.to]
    if (!a || !b) return
    const z = (a.depth + b.depth) / 2
    // Đang vẽ dở: chỉ vẽ tới vị trí ngòi bút (ngòi bút xuất phát từ điểm đã có trên hình)
    const partial = t < 1
    if (partial) {
      if (reveal.segRev[idx]) [a, b] = [b, a]
      b = { sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t, depth: b.depth }
      penTips.push(b)
    }
    const segKey = `${seg.from}-${seg.to}`
    const revKey = `${seg.to}-${seg.from}`
    const isHovered = hoveredSegKey === segKey || hoveredSegKey === revKey
    const isSelected = selectedSegKey === segKey || selectedSegKey === revKey
    const isHot = hot('seg', idx)
    const eqGroup = seg.equalGroup ? eqGroupMap[seg.equalGroup] : null

    if (seg.highlight) {
      highlights.push({ a, b, seg, segKey, isHovered, isSelected, isHot, partial, eqGroup })
    } else {
      items.push({ k: 'seg', a, b, seg, segKey, isHovered, isSelected, isHot, partial, eqGroup, z })
    }
  })

  // Vectơ
  ;(scene.vectors || []).forEach((vec, vi) => {
    const t = rv('vec', vi)
    if (t <= 0) return
    const a = p2[vec.from]
    let b = p2[vec.to]
    if (!a || !b) return
    const z = (a.depth + b.depth) / 2
    const partial = t < 1
    if (partial) {
      b = { sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t, depth: b.depth }
      penTips.push(b)
    }
    items.push({ k: 'vec', a, b, vec, partial, isHot: hot('vec', vi), z })
  })

  // Điểm
  Object.entries(ptMap).forEach(([id, p]) => {
    const pv = rv('pt', id)
    if (pv <= 0) return
    const pt = p2[id]
    if (pt) {
      const isHovered = hoveredPtId === id
      const isConnecting = connectingFromId === id
      const isDraftRightAngle = rightAngleDraft.includes(id)
      items.push({ k: 'pt', id, p, pt, z: pt.depth, isHovered, isConnecting, isDraftRightAngle, pv, isHot: hot('pt', id) })
    }
  })

  // Sắp xếp chiều sâu (Back to Front)
  items.sort((a, b) => a.z - b.z)

  // ── Giai đoạn 1: Vẽ đối tượng theo chiều sâu ──
  items.forEach(it => {
    if (it.k === 'face') {
      const { face, pts, lightFactor, fa } = it
      const st = face.style || {}
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      ctx.beginPath()
      ctx.moveTo(pts[0].sx, pts[0].sy)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy)
      ctx.closePath()

      // Đổ bóng 3D mặt phẳng (fa < 1 khi mặt đang hiện dần lúc dựng hình)
      ctx.globalAlpha = (st.opacity ?? 0.32) * fa
      const baseFill = st.fill || '#74c0fc'
      ctx.fillStyle = shadeColor(baseFill, lightFactor)
      ctx.fill()

      if (st.stroke) {
        ctx.globalAlpha = Math.min(1, (st.opacity ?? 0.32) * 1.4 + 0.2) * fa
        ctx.strokeStyle = st.stroke
        ctx.lineWidth   = st.strokeWidth || 1.5
        ctx.stroke()
      }
      ctx.globalAlpha = 1

    } else if (it.k === 'seg') {
      const { a, b, seg, isHovered, isSelected, isHot, partial, eqGroup } = it
      let strokeColor = seg.color || '#1e293b'
      let strokeWidth = seg.width || 1.8

      // Nếu thuộc nhóm bằng nhau, đổi màu theo nhóm
      if (eqGroup) {
        strokeColor = eqGroup.color
        strokeWidth = Math.max(strokeWidth, 2.4)
      }

      if (isSelected) {
        strokeColor = '#f59e0b'
        strokeWidth = 3.2
      } else if (isHovered) {
        strokeColor = '#3b82f6'
        strokeWidth = 2.8
      } else if (isHot) {
        strokeColor = BUILD_ACCENT   // thuộc bước đang dựng
        strokeWidth = Math.max(strokeWidth, 2.8)
      }

      ctx.strokeStyle = strokeColor
      ctx.lineWidth   = strokeWidth
      ctx.setLineDash(seg.dashed ? [7, 5] : [])
      ctx.globalAlpha = seg.dashed ? (isHot ? 0.85 : 0.6) : 1
      ctx.shadowBlur  = isSelected ? 8 : (isHovered ? 5 : (isHot ? 6 : 0))
      ctx.shadowColor = isSelected ? '#f59e0b' : (isHovered ? '#3b82f6' : (isHot ? BUILD_ACCENT : 'transparent'))

      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'
      ctx.globalAlpha = 1

      // Vẽ vạch chia bằng nhau (Tick Marks) tại trung điểm đoạn thẳng — chỉ khi đoạn đã vẽ xong
      if (eqGroup && !partial) {
        drawTickMarks(ctx, a, b, eqGroup.symbol, eqGroup.color)
      }

    } else if (it.k === 'vec') {
      const { a, b, vec, partial, isHot } = it
      const col = isHot ? BUILD_ACCENT : (vec.color || '#2563eb')
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
      if (L > 2 && !partial) {
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
      const { p, pt, isHovered, isConnecting, isDraftRightAngle, pv, isHot } = it
      let r = p.size || (p.isMidpoint ? 3.8 : 4.2)
      let col = p.color || (p.isMidpoint ? '#7c3aed' : '#1e293b')

      if (isConnecting || isDraftRightAngle) {
        r = 6.5
        col = '#ef4444'
      } else if (isHovered) {
        r = 6.0
        col = '#3b82f6'
      } else if (isHot) {
        r = 5.5
        col = BUILD_ACCENT
      }
      // Lúc dựng hình: điểm "nở" ra (hơi vượt rồi thu về) thay vì hiện bụp một cái
      if (pv < 1) r *= Math.max(0, easeOutBack(pv))
      const ring = isHovered || isConnecting || isDraftRightAngle || isHot

      ctx.setLineDash([])
      ctx.shadowBlur = ring ? 8 : 0
      ctx.shadowColor = col

      // Vòng hào quang nếu đang hover, chọn, hoặc thuộc bước đang dựng
      if (ring) {
        ctx.strokeStyle = col
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pt.sx, pt.sy, r + 4, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.fillStyle   = col
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth   = 2.0
      ctx.beginPath()
      ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  })

  // ── Giai đoạn 2: Vẽ góc vuông 3D chuẩn phối cảnh ──
  ;(scene.rightAngles || []).forEach((ra, ri) => {
    const ta = rv('ra', ri)
    if (ta <= 0) return
    ctx.save()
    ctx.globalAlpha = ta
    draw3DRightAngle(ctx, ra, ptMap, rx, ry, CX, CY, S, bb)
    ctx.restore()
  })

  // ── Giai đoạn 3: Đoạn thẳng highlight (vẽ với hiệu ứng thở pulsing sống động) ──
  const pulse = Math.sin(animTime * 3.5)
  highlights.forEach(({ a, b, seg, isHovered, isSelected, isHot, partial, eqGroup }) => {
    let col = seg.color || (eqGroup ? eqGroup.color : '#2563eb')
    if (isSelected) col = '#f59e0b'
    else if (isHovered) col = '#3b82f6'
    else if (isHot) col = BUILD_ACCENT

    // Đoạn highlight vẫn phải theo kiểu nét — trước đây luôn vẽ liền nên đổi sang nét đứt không có tác dụng
    ctx.setLineDash(seg.dashed ? [7, 5] : [])
    ctx.shadowColor = col
    ctx.shadowBlur  = 7 + pulse * 2.5
    ctx.strokeStyle = col
    ctx.lineWidth   = (seg.width || 2.5) + pulse * 0.35
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()

    if (eqGroup && !partial) {
      drawTickMarks(ctx, a, b, eqGroup.symbol, eqGroup.color)
    }
  })
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'

  // ── Giai đoạn 3b: Ngòi bút ở đầu các đoạn đang vẽ dở (dựng hình từng bước) ──
  penTips.forEach(tip => {
    ctx.save()
    ctx.setLineDash([])
    ctx.shadowColor = BUILD_ACCENT
    ctx.shadowBlur = 12
    ctx.fillStyle = BUILD_ACCENT
    ctx.beginPath()
    ctx.arc(tip.sx, tip.sy, 4.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(tip.sx, tip.sy, 1.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })

  // ── Giai đoạn 4: Đường nối Preview (Rubber-band line) khi kéo nối điểm ──
  if (connectingFromId && rubberBandPos && p2[connectingFromId]) {
    const fromPt = p2[connectingFromId]
    ctx.save()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2.2
    ctx.setLineDash([6, 4])
    ctx.shadowColor = '#3b82f6'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.moveTo(fromPt.sx, fromPt.sy)
    ctx.lineTo(rubberBandPos.x, rubberBandPos.y)
    ctx.stroke()
    ctx.restore()
  }

  // ── Giai đoạn 5: Nhãn điểm (luôn trên cùng, nền tương phản sắc nét) ──
  ctx.save()
  Object.entries(ptMap).forEach(([id, p]) => {
    const pt  = p2[id]; if (!pt) return
    const pv  = rv('pt', id)
    if (pv <= 0) return
    ctx.globalAlpha = Math.min(1, pv)   // nhãn hiện dần cùng điểm khi dựng hình
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
  ctx.globalAlpha = 1

  // Nhãn vectơ
  ;(scene.vectors || []).forEach((vec, vi) => {
    if (!vec.label || rv('vec', vi) < 1) return
    const a = p2[vec.from], b = p2[vec.to]; if (!a || !b) return
    ctx.font      = `italic 600 12.5px "Inter", system-ui, sans-serif`
    ctx.fillStyle = vec.color || '#2563eb'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(vec.label, (a.sx+b.sx)/2 + 10, (a.sy+b.sy)/2 - 10)
  })
  ctx.restore()

  // ── Giai đoạn 6: La bàn trục toạ độ (Gizmo góc dưới trái) ──
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

/* Vẽ vạch chia (Tick Marks) tại trung điểm đoạn thẳng */
function drawTickMarks(ctx, a, b, symbol, color) {
  const mx = (a.sx + b.sx) / 2
  const my = (a.sy + b.sy) / 2
  const dx = b.sx - a.sx
  const dy = b.sy - a.sy
  const L = Math.hypot(dx, dy)
  if (L < 10) return

  const tx = dx / L, ty = dy / L
  const nx = -ty,    ny = tx
  const tickLen = 6.5

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2.0
  ctx.setLineDash([])

  if (symbol === 'single') {
    ctx.beginPath()
    ctx.moveTo(mx - nx * tickLen, my - ny * tickLen)
    ctx.lineTo(mx + nx * tickLen, my + ny * tickLen)
    ctx.stroke()
  } else if (symbol === 'double') {
    const d = 3.0
    ctx.beginPath()
    ctx.moveTo(mx - tx*d - nx*tickLen, my - ty*d - ny*tickLen)
    ctx.lineTo(mx - tx*d + nx*tickLen, my - ty*d + ny*tickLen)
    ctx.moveTo(mx + tx*d - nx*tickLen, my + ty*d - ny*tickLen)
    ctx.lineTo(mx + tx*d + nx*tickLen, my + ty*d + ny*tickLen)
    ctx.stroke()
  } else if (symbol === 'triple') {
    const d = 4.5
    ctx.beginPath()
    ctx.moveTo(mx - tx*d - nx*tickLen, my - ty*d - ny*tickLen)
    ctx.lineTo(mx - tx*d + nx*tickLen, my - ty*d + ny*tickLen)
    ctx.moveTo(mx - nx*tickLen,        my - ny*tickLen)
    ctx.lineTo(mx + nx*tickLen,        my + ny*tickLen)
    ctx.moveTo(mx + tx*d - nx*tickLen, my + ty*d - ny*tickLen)
    ctx.lineTo(mx + tx*d + nx*tickLen, my + ty*d + ny*tickLen)
    ctx.stroke()
  } else if (symbol === 'cross') {
    const s = 4.5
    ctx.beginPath()
    ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s)
    ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s)
    ctx.stroke()
  } else if (symbol === 'circle') {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(mx, my, 3.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/* Vẽ ký hiệu góc vuông chuẩn phối cảnh 3D */
function draw3DRightAngle(ctx, ra, ptMap, rx, ry, CX, CY, S, bb) {
  const pV = ptMap[ra.vertex]
  const pR1 = ptMap[ra.ray1]
  const pR2 = ptMap[ra.ray2]
  if (!pV || !pR1 || !pR2) return

  const d1 = dist3D(pV, pR1)
  const d2 = dist3D(pV, pR2)
  if (d1 < 1e-6 || d2 < 1e-6) return

  // Vector đơn vị của 2 tia
  const u1x = (pR1.x - pV.x) / d1, u1y = (pR1.y - pV.y) / d1, u1z = (pR1.z - pV.z) / d1
  const u2x = (pR2.x - pV.x) / d2, u2y = (pR2.y - pV.y) / d2, u2z = (pR2.z - pV.z) / d2

  // Kích thước cạnh góc vuông
  const size = Math.min(d1, d2) * 0.22

  // 3 điểm trong không gian 3D
  const p1_3d = { x: pV.x + u1x * size, y: pV.y + u1y * size, z: pV.z + u1z * size }
  const p2_3d = { x: pV.x + (u1x + u2x) * size, y: pV.y + (u1y + u2y) * size, z: pV.z + (u1z + u2z) * size }
  const p3_3d = { x: pV.x + u2x * size, y: pV.y + u2y * size, z: pV.z + u2z * size }

  // Chiếu toạ độ sang màn hình
  const v_proj  = proj(pV.x - bb.cx,    pV.y - bb.cy,    pV.z - bb.cz,    rx, ry, CX, CY, S)
  const p1_proj = proj(p1_3d.x - bb.cx, p1_3d.y - bb.cy, p1_3d.z - bb.cz, rx, ry, CX, CY, S)
  const p2_proj = proj(p2_3d.x - bb.cx, p2_3d.y - bb.cy, p2_3d.z - bb.cz, rx, ry, CX, CY, S)
  const p3_proj = proj(p3_3d.x - bb.cx, p3_3d.y - bb.cy, p3_3d.z - bb.cz, rx, ry, CX, CY, S)

  const color = ra.color || '#ef4444'

  ctx.save()
  ctx.setLineDash([])
  // Nền góc vuông mờ nhẹ
  ctx.fillStyle = 'rgba(239, 68, 68, 0.18)'
  ctx.beginPath()
  ctx.moveTo(v_proj.sx, v_proj.sy)
  ctx.lineTo(p1_proj.sx, p1_proj.sy)
  ctx.lineTo(p2_proj.sx, p2_proj.sy)
  ctx.lineTo(p3_proj.sx, p3_proj.sy)
  ctx.closePath()
  ctx.fill()

  // Viền ký hiệu góc vuông
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(p1_proj.sx, p1_proj.sy)
  ctx.lineTo(p2_proj.sx, p2_proj.sy)
  ctx.lineTo(p3_proj.sx, p3_proj.sy)
  ctx.stroke()
  ctx.restore()
}

export const EMPTY_SCENE = {
  points: [], segments: [], midpoints: [], faces: [], vectors: [], labels: [],
  rightAngles: [], equalGroups: [],
}

/* Góc nhìn tiêu chuẩn dựng sẵn */
const CAMERAS = [
  { id: 'default', name: 'Mặc định',      rx: INIT_RX,       ry: INIT_RY },
  { id: 'front',   name: 'Chính diện',    rx: 0,             ry: 0 },
  { id: 'right',   name: 'Bên phải',      rx: 0,             ry: Math.PI / 2 },
  { id: 'left',    name: 'Chéo trái',     rx: INIT_RX,       ry: -INIT_RY },
  { id: 'top',     name: 'Từ trên xuống', rx: -RX_LIMIT,     ry: 0 },
]

/* Hai đoạn thẳng là một (không phân biệt chiều from/to) */
const sameSeg = (a, b) =>
  !!a && !!b && ((a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from))

/* Kích thước ước lượng của popover đoạn thẳng — để kẹp nó nằm gọn trong khung canvas */
const POPOVER_W = 250
const POPOVER_H = 300

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
  onSceneChange,
  animateNextScene = false,   // hình mới nhận qua `scene` sẽ được dựng từng bước
  onBuildDone,                // gọi khi dựng xong hoặc người dùng bấm Bỏ qua
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

  /* Chế độ công cụ tương tác: 'rotate' | 'connect' | 'rightAngle' | 'equalMark' */
  const [activeTool, setActiveTool]     = useState('rotate')
  const [activeEqGroup, setActiveEqGroup] = useState('eq1')
  const [hoveredPtId, setHoveredPtId]   = useState(null)
  const [hoveredSegKey, setHoveredSegKey] = useState(null)
  const [connectingFrom, setConnectingFrom] = useState(null)
  const [rubberBandPos, setRubberBandPos] = useState(null)
  const [rightAngleDraft, setRightAngleDraft] = useState([])
  /* Chỉ giữ {from, to} của đoạn đang chọn; dữ liệu đoạn luôn đọc lại từ cảnh (selectedSeg)
     để popover cập nhật ngay khi đổi nét/nhóm và tự đóng khi đoạn bị xoá. */
  const [selKey, setSelKey]             = useState(null)
  const [popoverPos, setPopoverPos]     = useState(null) // { x, y }
  /* Dựng hình từng bước: danh sách bước (null = không dựng) và bước đang vẽ */
  const [buildSteps, setBuildSteps]     = useState(null)
  const [buildIdx, setBuildIdx]         = useState(0)
  const [buildPaused, setBuildPaused]   = useState(false)
  const [buildSpeed, setBuildSpeed]     = useState(readBuildSpeed)
  const isBuilding = !!buildSteps

  /* Animation & Physics Refs */
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
  /* Cảnh mà chính viewer vừa sửa rồi đẩy lên cha qua onSceneChange */
  const emittedRef     = useRef(null)
  const buildRef       = useRef(null)   // { layout, elapsed, lastTs, idx, paused, speed } khi đang dựng hình
  const speedRef       = useRef(buildSpeed)
  const revealRef      = useRef(null)   // trạng thái hiện hình của khung hình hiện tại
  const logListRef     = useRef(null)
  /* Đọc prop qua ref: Workbench tắt animateNextScene lúc dựng xong không được làm dựng lại */
  const animateRef     = useRef(animateNextScene)
  animateRef.current   = animateNextScene
  const onBuildDoneRef = useRef(onBuildDone)
  onBuildDoneRef.current = onBuildDone

  const drag  = useRef({ on: false, x: 0, y: 0, lastX: 0, lastY: 0, time: 0, moved: false, consumed: false, cancelConnect: false })
  const touch = useRef({ on: false, x: 0, y: 0, lastX: 0, lastY: 0, time: 0, moved: false })

  const activeScene = scene ?? uncontrolled
  const isEmpty = !(activeScene?.points || []).length

  const closePopover = useCallback(() => { setSelKey(null); setPopoverPos(null) }, [])
  const clearConnect = useCallback(() => { setConnectingFrom(null); setRubberBandPos(null) }, [])

  /* Hình MỚI (AI dựng / giáo viên áp script): về góc nhìn chuẩn, tỉ lệ 100%, bỏ lựa chọn cũ */
  const triggerEntrance = useCallback(() => {
    targetRxRef.current = INIT_RX
    targetRyRef.current = INIT_RY
    rxRef.current = INIT_RX - 0.12
    ryRef.current = INIT_RY + 0.35
    entranceRef.current = 0.82
    isTransitionRef.current = true
    setActiveCam('default')
    setZoom(1.0)
    closePopover()
    clearConnect()
    setRightAngleDraft([])
  }, [closePopover, clearConnect])

  /* Kết thúc dựng hình (vẽ xong hoặc bấm Bỏ qua) → hiện đủ hình, trả lại giao diện xoay */
  const finishBuild = useCallback(() => {
    buildRef.current = null
    revealRef.current = null
    setBuildSteps(null)
    onBuildDoneRef.current?.()
  }, [])

  /* Dựng hình từng bước từ góc nhìn chuẩn, tỉ lệ 100% */
  const startBuild = useCallback((sc) => {
    rxRef.current = targetRxRef.current = INIT_RX
    ryRef.current = targetRyRef.current = INIT_RY
    velXRef.current = velYRef.current = 0
    isTransitionRef.current = false
    entranceRef.current = 1.0
    autoRotateRef.current = false
    drag.current.on = false
    setIsAutoRotating(false)
    setIsDrag(false)
    setActiveCam('default')
    setActiveTool('rotate')
    setZoom(1.0)
    closePopover()
    clearConnect()
    setRightAngleDraft([])

    const steps = makeBuildSteps(sc)
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !steps.length) { finishBuild(); return }

    const layout = layoutBuild(steps)
    buildRef.current = {
      layout, elapsed: 0, lastTs: performance.now(), idx: 0, paused: false, speed: speedRef.current,
    }
    revealRef.current = revealAt(layout, 0).reveal
    setBuildSteps(steps)
    setBuildIdx(0)
    setBuildPaused(false)
  }, [closePopover, clearConnect, finishBuild])

  const toggleBuildPause = useCallback(() => {
    const b = buildRef.current
    if (!b) return
    b.paused = !b.paused
    setBuildPaused(b.paused)
  }, [])

  const changeBuildSpeed = useCallback((v) => {
    speedRef.current = v
    if (buildRef.current) buildRef.current.speed = v
    setBuildSpeed(v)
    try { localStorage.setItem(BUILD_SPEED_KEY, String(v)) } catch { /* bỏ qua: chỉ là tiện ích */ }
  }, [])

  useEffect(() => {
    if (initialSceneData) {
      setUncontrolled(initialSceneData)
      triggerEntrance()
    }
  }, [initialSceneData, triggerEntrance])

  useEffect(() => {
    // Cảnh do chính viewer sửa (nối điểm, đổi nét, xoá đoạn…) quay về qua prop `scene` thì
    // KHÔNG chạy hiệu ứng vào — nếu không mỗi lần sửa camera lại nhảy về góc mặc định.
    if (scene && scene !== emittedRef.current) {
      if (animateRef.current) {
        startBuild(scene)
      } else {
        if (buildRef.current) finishBuild()
        triggerEntrance()
      }
    }
  }, [scene, triggerEntrance, startBuild, finishBuild])

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

  const selectedSeg = useMemo(
    () => (selKey ? (activeScene.segments || []).find(s => sameSeg(s, selKey)) || null : null),
    [activeScene.segments, selKey],
  )

  /* Cập nhật scene và gọi callback */
  const updateScene = useCallback((newScene) => {
    if (onSceneChange) {
      emittedRef.current = newScene
      onSceneChange(newScene)
    } else {
      setUncontrolled(newScene)
    }
  }, [onSceneChange])

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
      {
        animTime: animTimeRef.current,
        entranceScale: entranceRef.current,
        hoveredPtId,
        connectingFromId: connectingFrom,
        rubberBandPos,
        hoveredSegKey,
        selectedSegKey: selKey ? `${selKey.from}-${selKey.to}` : null,
        rightAngleDraft,
        reveal: revealRef.current,
      }
    )
    ctx.restore()
  }, [activeScene, ptMap, bb, zoom, hoveredPtId, connectingFrom, rubberBandPos, hoveredSegKey, selKey, rightAngleDraft])

  /* ── Vòng lặp Animation 60fps ── */
  useEffect(() => {
    let active = true

    const loop = () => {
      if (!active) return

      animTimeRef.current += 0.016

      // Dựng hình từng bước: tính phần nào đã hiện ở thời điểm này
      const b = buildRef.current
      if (b) {
        // Cộng dồn thời gian theo tốc độ; đang dừng thì đứng yên. Chặn bước nhảy >100ms để
        // chuyển tab rồi quay lại không bị vẽ vọt tới cuối.
        const now = performance.now()
        if (!b.paused) b.elapsed += Math.min(now - b.lastTs, 100) * b.speed
        b.lastTs = now
        const { reveal, stepIdx, done } = revealAt(b.layout, b.elapsed)
        if (done) {
          finishBuild()
        } else {
          revealRef.current = reveal
          if (stepIdx !== b.idx) { b.idx = stepIdx; setBuildIdx(stepIdx) }
        }
      }

      if (entranceRef.current < 1.0) {
        entranceRef.current += (1.0 - entranceRef.current) * 0.08
        if (1.0 - entranceRef.current < 0.002) entranceRef.current = 1.0
      }

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

      if (autoRotateRef.current && !drag.current.on && !touch.current.on && !isTransitionRef.current && !connectingFrom) {
        ryRef.current += 0.0055
        targetRyRef.current = ryRef.current
      }

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
  }, [drawCanvas, connectingFrom, finishBuild])

  /* Ô quá trình vẽ: luôn cuộn tới dòng mới nhất (không dùng scrollIntoView — nó cuộn cả trang) */
  useEffect(() => {
    const el = logListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [buildIdx, buildSteps])

  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => drawCanvas())
    ro.observe(el)
    return () => ro.disconnect()
  }, [drawCanvas])

  /* ── Tìm điểm và đoạn thẳng tại toạ độ màn hình (Hit-testing) ── */
  const hitTestPoint = useCallback((mx, my) => {
    const el = wrap.current; if (!el) return null
    const W = el.clientWidth, H = el.clientHeight
    const CX = W / 2, CY = H / 2
    const S  = Math.min(W, H) * 0.62 / (bb.range || 1) * zoom

    let bestId = null
    let bestDist = 16 // Bán kính bấm tối đa 16px

    Object.entries(ptMap).forEach(([id, p]) => {
      const pr = proj(p.x - bb.cx, p.y - bb.cy, p.z - bb.cz, rxRef.current, ryRef.current, CX, CY, S)
      const d = Math.hypot(mx - pr.sx, my - pr.sy)
      if (d < bestDist) {
        bestDist = d
        bestId = id
      }
    })
    return bestId
  }, [bb, ptMap, zoom])

  const hitTestSegment = useCallback((mx, my) => {
    const el = wrap.current; if (!el) return null
    const W = el.clientWidth, H = el.clientHeight
    const CX = W / 2, CY = H / 2
    const S  = Math.min(W, H) * 0.62 / (bb.range || 1) * zoom

    let bestSeg = null
    let bestDist = 10 // Khoảng cách bấm tối đa 10px tới đường thẳng

    ;(activeScene.segments || []).forEach(seg => {
      const pA = ptMap[seg.from], pB = ptMap[seg.to]
      if (!pA || !pB) return
      const a = proj(pA.x - bb.cx, pA.y - bb.cy, pA.z - bb.cz, rxRef.current, ryRef.current, CX, CY, S)
      const b = proj(pB.x - bb.cx, pB.y - bb.cy, pB.z - bb.cz, rxRef.current, ryRef.current, CX, CY, S)
      const d = distToSegment(mx, my, a.sx, a.sy, b.sx, b.sy)
      if (d < bestDist) {
        bestDist = d
        bestSeg = seg
      }
    })
    return bestSeg
  }, [activeScene.segments, bb, ptMap, zoom])

  /* ── Thao tác Chuột & Tương tác Điểm/Đoạn ── */
  const onDown = (e) => {
    // Chỉ nhận thao tác BẮT ĐẦU trên canvas. Trước đây bấm nút trong popover cũng bị tính
    // là click canvas: mouseup đóng popover trước khi sự kiện click tới nút, nên "Nét đứt"
    // và "Xoá đoạn" không bao giờ ăn.
    if (e.button !== 0 || e.target !== cvs.current) return
    // Đang dựng hình: chỉ cho kéo xoay khi đã tạm dừng
    if (buildRef.current && !buildRef.current.paused) return
    const rect = cvs.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    drag.current = {
      on: true, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY,
      time: performance.now(), moved: false, consumed: false, cancelConnect: false,
    }
    velXRef.current = 0
    velYRef.current = 0
    isTransitionRef.current = false
    setIsDrag(true)

    if (activeTool !== 'connect') return
    const hitPt = hitTestPoint(mx, my)
    if (!hitPt) return
    if (connectingFrom && connectingFrom !== hitPt) {
      // Cách click lần lượt 2 điểm: đây là điểm thứ hai
      createSegment(connectingFrom, hitPt)
      clearConnect()
      drag.current.consumed = true
    } else if (connectingFrom === hitPt) {
      drag.current.cancelConnect = true   // click lại đúng điểm đầu → huỷ (xử lý ở mouseup)
    } else {
      setConnectingFrom(hitPt)
      setRubberBandPos({ x: mx, y: my })
    }
  }

  const onMove = useCallback((e) => {
    const building = buildRef.current
    if (building && !building.paused) return   // đang dựng hình: chỉ xem, không tương tác
    const rect = cvs.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const d = drag.current

    if (d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true

    // Chuột đang ở trên popover / khung trống (không kéo) → không hover xuyên xuống hình
    if (!d.on && e.target !== cvs.current) {
      setHoveredPtId(null)
      setHoveredSegKey(null)
      return
    }

    // Tạm dừng dựng hình chỉ để xoay xem — không hover (điểm/đoạn chưa vẽ vẫn có trong ptMap)
    if (!building) {
      setHoveredPtId(hitTestPoint(mx, my))
      const hitSeg = hitTestSegment(mx, my)
      setHoveredSegKey(hitSeg ? `${hitSeg.from}-${hitSeg.to}` : null)
    }

    // Đang nối điểm: đường cao su theo chuột, không xoay hình
    if (connectingFrom) {
      setRubberBandPos({ x: mx, y: my })
      return
    }

    if (!d.on) return

    const now = performance.now()
    const dx = e.clientX - d.lastX
    const dy = e.clientY - d.lastY

    d.lastX = e.clientX
    d.lastY = e.clientY

    const dt = Math.max(1, now - d.time)
    d.time = now

    velXRef.current = (dx / dt) * 0.09
    velYRef.current = (dy / dt) * 0.09

    ryRef.current += dx * 0.007
    rxRef.current = Math.max(-RX_LIMIT, Math.min(RX_LIMIT, rxRef.current + dy * 0.007))
    targetRxRef.current = rxRef.current
    targetRyRef.current = ryRef.current
    setActiveCam('custom')
  }, [connectingFrom, hitTestPoint, hitTestSegment])

  const onUp = (e) => {
    const d = drag.current
    if (!d.on) return            // mouseup không bắt đầu từ canvas (VD bấm nút popover) → bỏ qua
    d.on = false
    setIsDrag(false)
    if (d.consumed || buildRef.current) return   // lúc tạm dừng dựng hình: kéo xoay thôi, không mở popover

    const rect = cvs.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (activeTool === 'connect') {
      if (d.cancelConnect && !d.moved) { clearConnect(); return }
      if (!connectingFrom) return
      const hitPt = hitTestPoint(mx, my)
      if (d.moved) {
        // Kéo-thả: thả trúng điểm khác thì nối, thả ra chỗ khác thì huỷ
        if (hitPt && hitPt !== connectingFrom) createSegment(connectingFrom, hitPt)
        clearConnect()
      } else if (!hitPt) {
        clearConnect()             // click ra chỗ trống → huỷ
      }
      // Click trúng điểm đầu (không kéo): giữ lại, chờ click điểm thứ hai
      return
    }

    if (!d.moved) handleClickCanvas(mx, my)
  }

  const onLeave = () => {
    setHoveredPtId(null)
    setHoveredSegKey(null)
    const d = drag.current
    if (!d.on) return
    d.on = false
    setIsDrag(false)
    if (connectingFrom && d.moved) clearConnect()
  }

  /* ── Xử lý Click tương tác theo từng công cụ (nối điểm xử lý riêng ở onDown/onUp) ── */
  const handleClickCanvas = (mx, my) => {
    // 1. Chế độ Đánh dấu góc vuông (Right Angle)
    if (activeTool === 'rightAngle') {
      const hitPt = hitTestPoint(mx, my)
      if (hitPt) {
        const nextDraft = [...rightAngleDraft, hitPt]
        if (nextDraft.length === 3) {
          // nextDraft: [vertex, ray1, ray2]
          createRightAngle(nextDraft[0], nextDraft[1], nextDraft[2])
          setRightAngleDraft([])
        } else {
          setRightAngleDraft(nextDraft)
        }
      } else {
        setRightAngleDraft([])
      }
      return
    }

    // 2. Chế độ Đánh dấu đoạn bằng nhau (Equal Mark)
    if (activeTool === 'equalMark') {
      const hitSeg = hitTestSegment(mx, my)
      if (hitSeg) {
        toggleSegmentEqualGroup(hitSeg, activeEqGroup)
      }
      return
    }

    // 3. Chế độ Xoay (Rotate) mặc định: Click vào đoạn thẳng để mở bảng chỉnh đoạn
    if (activeTool === 'rotate') {
      const hitSeg = hitTestSegment(mx, my)
      if (hitSeg) {
        const W = wrap.current?.clientWidth || 300
        const H = wrap.current?.clientHeight || 300
        setSelKey({ from: hitSeg.from, to: hitSeg.to })
        setPopoverPos({
          x: Math.max(8, Math.min(mx + 12, W - POPOVER_W - 8)),
          y: Math.max(8, Math.min(my - 60, H - POPOVER_H - 8)),
        })
      } else {
        closePopover()
      }
    }
  }

  /* ── Thao tác tạo/sửa đối tượng hình học ── */
  const createSegment = (from, to) => {
    const segs = [...(activeScene.segments || [])]
    if (!segs.some(s => sameSeg(s, { from, to }))) {
      segs.push({ from, to, color: '#2563eb', width: 2.0 })
      updateScene({ ...activeScene, segments: segs })
    }
  }

  const createRightAngle = (vertex, ray1, ray2) => {
    const list = [...(activeScene.rightAngles || [])]
    // Kiểm tra đã có chưa
    const idx = list.findIndex(r => r.vertex === vertex && ((r.ray1 === ray1 && r.ray2 === ray2) || (r.ray1 === ray2 && r.ray2 === ray1)))
    if (idx >= 0) {
      list.splice(idx, 1) // Bấm lại thì xoá
    } else {
      list.push({ vertex, ray1, ray2, color: '#ef4444' })
    }
    updateScene({ ...activeScene, rightAngles: list })
  }

  const toggleSegmentEqualGroup = (seg, groupId) => {
    const segs = (activeScene.segments || []).map(s =>
      sameSeg(s, seg) ? { ...s, equalGroup: s.equalGroup === groupId ? null : groupId } : s
    )
    updateScene({ ...activeScene, segments: segs })
  }

  const setSegmentDashed = (seg, dashed) => {
    const segs = (activeScene.segments || []).map(s => {
      if (!sameSeg(s, seg)) return s
      const next = { ...s }
      if (dashed) next.dashed = true
      else delete next.dashed          // giữ JSON gọn: nét liền là mặc định
      return next
    })
    updateScene({ ...activeScene, segments: segs })
  }

  const deleteSegment = (seg) => {
    const segs = (activeScene.segments || []).filter(s => !sameSeg(s, seg))
    updateScene({ ...activeScene, segments: segs })
    closePopover()
  }

  /* Cuộn chuột để zoom. Gắn tay với passive:false vì onWheel của React là passive —
     preventDefault vô tác dụng, trang vẫn cuộn và hình bị zoom ngoài ý muốn khi lướt qua. */
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const onWheel = (e) => {
      if (e.target !== cvs.current) return
      e.preventDefault()
      if (buildRef.current && !buildRef.current.paused) return
      setZoom(v => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v * (e.deltaY < 0 ? 1.1 : 0.91))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* Phím tắt: Esc bỏ qua hoạt ảnh dựng hình / huỷ thao tác dở / đóng bảng;
     Space dừng / tiếp tục dựng hình; Delete (Backspace trên Mac) xoá đoạn đang chọn */
  useEffect(() => {
    if (!isBuilding && !selectedSeg && !connectingFrom && !rightAngleDraft.length) return
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (isBuilding) {
        if (e.key === 'Escape') finishBuild()
        // Nút đang được focus thì Space đã tự "bấm" nút đó — không bật/tắt dừng thêm lần nữa
        else if (e.key === ' ' && t?.tagName !== 'BUTTON') {
          e.preventDefault()
          toggleBuildPause()
        }
        return
      }
      if (e.key === 'Escape') {
        closePopover()
        clearConnect()
        setRightAngleDraft([])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSeg) {
        e.preventDefault()
        deleteSegment(selectedSeg)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Thao tác cơ bản ── */
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

  const savePNG = () => {
    const el = wrap.current; if (!el || isEmpty) return
    const W = el.clientWidth, H = el.clientHeight, k = 3
    const off = document.createElement('canvas')
    off.width = W * k; off.height = H * k
    const ctx = off.getContext('2d')
    ctx.scale(k, k)
    // Ảnh xuất luôn ở tỉ lệ 100% (giữ góc xoay hiện tại), không phụ thuộc mức zoom đang xem
    renderScene(ctx, W, H, activeScene, ptMap, bb, rxRef.current, ryRef.current, 1.0)
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

  /* Bảng soạn đề / Script nằm NGOÀI khung toàn màn hình → thoát fullscreen trước, không thì
     bảng mở ra mà không nhìn thấy. */
  const openOutside = (fn) => {
    const doc = document
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)
    }
    fn()
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

  // Tìm các đoạn cùng nhóm bằng nhau với đoạn đang chọn
  const equalCounterparts = useMemo(() => {
    if (!selectedSeg?.equalGroup) return []
    return (activeScene.segments || []).filter(s =>
      s.equalGroup === selectedSeg.equalGroup && !sameSeg(s, selectedSeg)
    )
  }, [activeScene.segments, selectedSeg])

  const selectedSegLength = useMemo(() => {
    if (!selectedSeg) return 0
    const pA = ptMap[selectedSeg.from], pB = ptMap[selectedSeg.to]
    return dist3D(pA, pB).toFixed(2)
  }, [ptMap, selectedSeg])

  const pickTool = (tool) => {
    setActiveTool(tool)
    clearConnect()
    setRightAngleDraft([])
    closePopover()
  }

  return (
    <div className={`g3d-root ${isFocusMode ? 'g3d-root--focus' : ''}`}>
      <div ref={panel} className="g3d-canvas-panel g3d-canvas-panel--full">

        {/* Lớp phủ phía trên: thanh công cụ + dải hướng dẫn xếp chồng theo luồng (không chồng
            lên nhau), thanh công cụ tự xuống dòng khi khung hẹp thay vì giấu nút đi. */}
        <div className="g3d-overlay-top">
          {showTools && !isBuilding && (
            <div className="g3d-floating-hud">

              {/* Bộ chọn Chế độ tương tác (Tool Palette) */}
              <div className="g3d-hud-group g3d-hud-tools">
                <button
                  className={`g3d-hud-btn ${activeTool === 'rotate' ? 'g3d-hud-btn--active' : ''}`}
                  onClick={() => pickTool('rotate')}
                  title="Chế độ xoay & quan sát (Click vào đoạn thẳng để đổi nét / xoá)"
                >
                  🔄 Xoay
                </button>

                <button
                  className={`g3d-hud-btn ${activeTool === 'connect' ? 'g3d-hud-btn--active' : ''}`}
                  onClick={() => pickTool('connect')}
                  title="Kéo từ điểm này sang điểm khác để vẽ đoạn thẳng mới"
                >
                  ✏️ Nối điểm
                </button>

                <button
                  className={`g3d-hud-btn ${activeTool === 'rightAngle' ? 'g3d-hud-btn--active' : ''}`}
                  onClick={() => pickTool('rightAngle')}
                  title="Bấm chọn 3 điểm để đánh dấu góc vuông"
                >
                  📐 Góc vuông
                </button>

                <button
                  className={`g3d-hud-btn ${activeTool === 'equalMark' ? 'g3d-hud-btn--active' : ''}`}
                  onClick={() => pickTool('equalMark')}
                  title="Bấm vào các đoạn thẳng để gán vào nhóm bằng nhau"
                >
                  🏷️ Bằng nhau
                </button>
              </div>

              {/* Nhóm hoạt hoạ xoay tự động & đặt lại */}
              <div className="g3d-hud-group">
                <button
                  className={`g3d-hud-btn ${isAutoRotating ? 'g3d-hud-btn--active' : ''}`}
                  onClick={toggleAutoRotate}
                  title={isAutoRotating ? 'Tạm dừng xoay tự động' : 'Bật xoay 3D tự động (Turntable)'}
                >
                  <span className={`g3d-spin-icon ${isAutoRotating ? 'g3d-spin-icon--anim' : ''}`}>🔄</span>
                  <span className="g3d-hud-btn-txt">{isAutoRotating ? 'Dừng' : 'Xoay auto'}</span>
                </button>

                <button className="g3d-hud-btn" onClick={resetView} title="Về góc nhìn chuẩn">
                  ↺ Đặt lại
                </button>

                <button
                  className="g3d-hud-btn"
                  onClick={() => startBuild(activeScene)}
                  disabled={isEmpty}
                  title="Phát lại từng bước dựng hình"
                >
                  ▶ Xem lại cách vẽ
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

              {/* Nhóm thao tác: soạn đề, script, cô lập, xuất ảnh */}
              <div className="g3d-hud-group g3d-hud-group--end">
                {isFocusMode && onOpenPrompt && (
                  <button
                    className="g3d-hud-btn"
                    onClick={() => openOutside(onOpenPrompt)}
                    title="Mở bảng nhập / sửa đề bài AI"
                  >
                    ✨ Soạn đề bài
                  </button>
                )}
                {isFocusMode && canSeeCode && onOpenScript && (
                  <button
                    className="g3d-hud-btn"
                    onClick={() => openOutside(onOpenScript)}
                    title="Mở bảng mã JSON hình"
                  >
                    {'{ }'} Script JSON
                  </button>
                )}
                {onToggleFocus && (
                  <button
                    className={`g3d-hud-btn ${isFocusMode ? 'g3d-hud-btn--exit' : ''}`}
                    onClick={onToggleFocus}
                    title={isFocusMode ? 'Thoát chế độ cô lập để xem giao diện mở rộng' : 'Cô lập hình (ẩn các thành phần thừa)'}
                  >
                    {isFocusMode ? '✕ Thoát cô lập' : '👁️ Cô lập'}
                  </button>
                )}
                <button className="g3d-hud-btn" onClick={savePNG} disabled={isEmpty} title="Tải ảnh PNG độ nét cao (tỉ lệ 100%)">
                  ⬇ PNG
                </button>
                <button className="g3d-hud-btn g3d-hud-btn--icon" onClick={toggleFull} title="Toàn màn hình">
                  {isFull ? '⤡' : '⤢'}
                </button>
              </div>
            </div>
          )}

          {/* Thanh hướng dẫn ngữ cảnh theo chế độ thao tác */}
          {activeTool !== 'rotate' && (
            <div className="g3d-mode-banner">
              {activeTool === 'connect' && (
                <span>
                  ✏️ <strong>Nối điểm</strong>: {connectingFrom ? `Đã chọn điểm ${connectingFrom} — click hoặc thả vào điểm thứ 2 để nối (Esc để huỷ).` : 'Kéo từ điểm này sang điểm khác hoặc click lần lượt 2 điểm để vẽ đoạn thẳng.'}
                </span>
              )}
              {activeTool === 'rightAngle' && (
                <span>
                  📐 <strong>Đánh dấu góc vuông</strong>: {rightAngleDraft.length === 0 ? 'Click đỉnh góc vuông (VD: điểm A).' : rightAngleDraft.length === 1 ? `Đỉnh [${rightAngleDraft[0]}] — click điểm tiếp theo trên cạnh thứ nhất.` : `Đã chọn [${rightAngleDraft[0]}, ${rightAngleDraft[1]}] — click điểm trên cạnh thứ hai.`}
                </span>
              )}
              {activeTool === 'equalMark' && (
                <div className="g3d-eq-selector">
                  <span>🏷️ <strong>Gán đoạn bằng nhau</strong>: Chọn nhóm:</span>
                  {EQUAL_PALETTE.map(g => (
                    <button
                      key={g.id}
                      className={`g3d-eq-chip ${activeEqGroup === g.id ? 'g3d-eq-chip--active' : ''}`}
                      style={{ '--eq-col': g.color }}
                      onClick={() => setActiveEqGroup(g.id)}
                    >
                      <span className="g3d-eq-dot" style={{ background: g.color }} />
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ô "Quá trình vẽ hình": ghi từng bước đang dựng, khớp với phần đang vẽ trên hình */}
        {isBuilding && (
          <div className="g3d-build-log" role="status" aria-live="polite">
            <div className="g3d-build-log-head">
              <span className="g3d-build-log-title">✏️ Quá trình vẽ hình</span>
              <span className="g3d-build-log-count">
                {buildIdx >= buildSteps.length ? 'Hoàn thành' : `Bước ${buildIdx + 1}/${buildSteps.length}`}
              </span>
            </div>
            <div className="g3d-build-progress">
              <div
                className="g3d-build-progress-bar"
                style={{ width: `${Math.min(100, ((buildIdx + 1) / buildSteps.length) * 100)}%` }}
              />
            </div>
            <ol ref={logListRef} className="g3d-build-steps">
              {buildSteps.slice(0, buildIdx + 1).map((s, i) => (
                i < buildIdx ? (
                  <li key={i} className="is-done">
                    <span className="g3d-build-mark">✓</span>
                    <span>{s.text.charAt(0).toUpperCase() + s.text.slice(1)}</span>
                  </li>
                ) : buildPaused ? (
                  <li key={i} className="is-current is-paused">
                    <span className="g3d-build-mark">⏸</span>
                    <span>Đã dừng ở bước: {s.text}</span>
                  </li>
                ) : (
                  <li key={i} className="is-current">
                    <span className="g3d-build-mark g3d-build-pen">✎</span>
                    <span>Đang {s.text}…</span>
                  </li>
                )
              ))}
              {buildIdx >= buildSteps.length && (
                <li className="is-finish">
                  <span className="g3d-build-mark">✓</span>
                  <span>Hình đã hoàn thiện</span>
                </li>
              )}
            </ol>
            {buildPaused && (
              <div className="g3d-build-paused-hint">Đang dừng — có thể kéo để xoay, cuộn để phóng to hình.</div>
            )}
            <div className="g3d-build-log-foot">
              <div className="g3d-build-speed" role="group" aria-label="Tốc độ vẽ">
                <span className="g3d-build-speed-label">Tốc độ</span>
                {BUILD_SPEEDS.map(v => (
                  <button
                    key={v}
                    className={`g3d-build-speed-btn ${buildSpeed === v ? 'g3d-build-speed-btn--active' : ''}`}
                    onClick={() => changeBuildSpeed(v)}
                    aria-pressed={buildSpeed === v}
                    title={v < 1 ? 'Vẽ chậm lại' : v > 1 ? 'Vẽ nhanh hơn' : 'Tốc độ bình thường'}
                  >
                    {v}×
                  </button>
                ))}
              </div>
              <div className="g3d-build-actions">
                <button
                  className={`g3d-build-btn ${buildPaused ? 'g3d-build-btn--primary' : ''}`}
                  onClick={toggleBuildPause}
                  title={buildPaused ? 'Vẽ tiếp (Space)' : 'Tạm dừng (Space)'}
                >
                  {buildPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
                </button>
                <button className="g3d-build-btn" onClick={finishBuild} title="Hiện ngay toàn bộ hình (Esc)">
                  Bỏ qua ⏭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vùng Canvas hiển thị hình không gian */}
        <div
          ref={wrap}
          className="g3d-wrap"
          style={{
            cursor: isBuilding && !buildPaused
              ? 'default'
              : activeTool === 'connect'
              ? 'crosshair'
              : activeTool === 'rightAngle' || activeTool === 'equalMark'
              ? 'pointer'
              : (isDrag ? 'grabbing' : 'grab')
          }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onLeave}
        >
          <canvas ref={cvs} style={{ display: 'block', touchAction: 'none' }} />

          {/* Popover chỉnh đoạn thẳng (mở khi click vào đoạn ở chế độ Xoay) */}
          {selectedSeg && popoverPos && (
            <div
              className="g3d-seg-popover"
              style={{ left: popoverPos.x, top: popoverPos.y }}
            >
              <div className="g3d-seg-popover-header">
                <div className="g3d-seg-popover-title">
                  Đoạn thẳng <strong>{selectedSeg.from}{selectedSeg.to}</strong>
                </div>
                <button className="g3d-seg-popover-close" onClick={closePopover} title="Đóng (Esc)">✕</button>
              </div>

              <div className="g3d-seg-popover-body">
                <div className="g3d-seg-info-row">
                  <span className="g3d-seg-info-label">Độ dài 3D:</span>
                  <span className="g3d-seg-info-val">≈ {selectedSegLength}</span>
                </div>

                <div className="g3d-seg-info-row">
                  <span className="g3d-seg-info-label">Kiểu nét:</span>
                  <div className="g3d-seg-style">
                    <button
                      className={`g3d-seg-style-btn ${!selectedSeg.dashed ? 'g3d-seg-style-btn--active' : ''}`}
                      onClick={() => setSegmentDashed(selectedSeg, false)}
                      title="Cạnh nhìn thấy"
                    >
                      ━ Nét liền
                    </button>
                    <button
                      className={`g3d-seg-style-btn ${selectedSeg.dashed ? 'g3d-seg-style-btn--active' : ''}`}
                      onClick={() => setSegmentDashed(selectedSeg, true)}
                      title="Cạnh bị che khuất"
                    >
                      ┅ Nét đứt
                    </button>
                  </div>
                </div>

                <div className="g3d-seg-info-row g3d-seg-info-row--col">
                  <span className="g3d-seg-info-label">Nhóm bằng nhau:</span>
                  <div className="g3d-seg-eq-groups">
                    {EQUAL_PALETTE.map(g => (
                      <button
                        key={g.id}
                        className={`g3d-eq-mini-btn ${selectedSeg.equalGroup === g.id ? 'g3d-eq-mini-btn--active' : ''}`}
                        style={{ '--eq-col': g.color }}
                        onClick={() => toggleSegmentEqualGroup(selectedSeg, g.id)}
                        title={`Gán vào ${g.name} (${g.mark})`}
                      >
                        <span className="g3d-eq-dot" style={{ background: g.color }} />
                        {g.mark}
                      </button>
                    ))}
                    {selectedSeg.equalGroup && (
                      <button className="g3d-btn-xs g3d-btn-xs--danger" onClick={() => toggleSegmentEqualGroup(selectedSeg, selectedSeg.equalGroup)}>
                        Bỏ nhóm
                      </button>
                    )}
                  </div>
                </div>

                {equalCounterparts.length > 0 && (
                  <div className="g3d-seg-counterparts">
                    Bằng với:{' '}
                    {equalCounterparts.map(c => (
                      <strong key={`${c.from}-${c.to}`} className="g3d-counterpart-tag">
                        {c.from}{c.to}
                      </strong>
                    ))}
                  </div>
                )}

                <div className="g3d-seg-actions">
                  <button className="g3d-btn-xs g3d-btn-xs--del" onClick={() => deleteSegment(selectedSeg)} title="Phím Delete">
                    🗑 Xoá đoạn này
                  </button>
                </div>
              </div>
            </div>
          )}

          {isEmpty && (
            <div className="g3d-empty">
              <div className="g3d-empty-box">
                <span className="g3d-empty-icon">📐</span>
                <p className="g3d-empty-title">Chưa có hình không gian</p>
                <p className="g3d-empty-sub">Nhập đề bài hoặc tải ảnh đề bài lên để AI dựng hình 3D tự động.</p>
                {onOpenPrompt && (
                  <button className="g3d-btn-primary" onClick={() => openOutside(onOpenPrompt)}>
                    ✨ Nhập đề bài
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEmpty && showTools && !isBuilding && (
            <div className="g3d-hint-island">
              <span>✦ Kéo để xoay · Click vào đoạn thẳng để đổi nét hoặc xoá</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

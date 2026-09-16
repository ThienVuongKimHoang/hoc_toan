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
  } = options

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
  ;(scene.faces || []).forEach(face => {
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
    items.push({ k: 'face', face, pts, z, lightFactor })
  })

  // Đoạn thẳng (segments)
  ;(scene.segments || []).forEach((seg, idx) => {
    const a = p2[seg.from], b = p2[seg.to]
    if (!a || !b) return
    const segKey = `${seg.from}-${seg.to}`
    const revKey = `${seg.to}-${seg.from}`
    const isHovered = hoveredSegKey === segKey || hoveredSegKey === revKey
    const isSelected = selectedSegKey === segKey || selectedSegKey === revKey
    const eqGroup = seg.equalGroup ? eqGroupMap[seg.equalGroup] : null

    if (seg.highlight) {
      highlights.push({ a, b, seg, segKey, isHovered, isSelected, eqGroup })
    } else {
      items.push({ k: 'seg', a, b, seg, segKey, isHovered, isSelected, eqGroup, z: (a.depth + b.depth) / 2 })
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
    if (pt) {
      const isHovered = hoveredPtId === id
      const isConnecting = connectingFromId === id
      const isDraftRightAngle = rightAngleDraft.includes(id)
      items.push({ k: 'pt', id, p, pt, z: pt.depth, isHovered, isConnecting, isDraftRightAngle })
    }
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

      if (st.stroke) {
        ctx.globalAlpha = Math.min(1, (st.opacity ?? 0.32) * 1.4 + 0.2)
        ctx.strokeStyle = st.stroke
        ctx.lineWidth   = st.strokeWidth || 1.5
        ctx.stroke()
      }
      ctx.globalAlpha = 1

    } else if (it.k === 'seg') {
      const { a, b, seg, isHovered, isSelected, eqGroup } = it
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
      }

      ctx.strokeStyle = strokeColor
      ctx.lineWidth   = strokeWidth
      ctx.setLineDash(seg.dashed ? [7, 5] : [])
      ctx.globalAlpha = seg.dashed ? 0.6 : 1
      ctx.shadowBlur  = isSelected ? 8 : (isHovered ? 5 : 0)
      ctx.shadowColor = isSelected ? '#f59e0b' : (isHovered ? '#3b82f6' : 'transparent')

      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'
      ctx.globalAlpha = 1

      // Vẽ vạch chia bằng nhau (Tick Marks) tại trung điểm đoạn thẳng
      if (eqGroup) {
        drawTickMarks(ctx, a, b, eqGroup.symbol, eqGroup.color)
      }

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
      const { p, pt, isHovered, isConnecting, isDraftRightAngle } = it
      let r = p.size || (p.isMidpoint ? 3.8 : 4.2)
      let col = p.color || (p.isMidpoint ? '#7c3aed' : '#1e293b')

      if (isConnecting || isDraftRightAngle) {
        r = 6.5
        col = '#ef4444'
      } else if (isHovered) {
        r = 6.0
        col = '#3b82f6'
      }

      ctx.setLineDash([])
      ctx.shadowBlur = (isHovered || isConnecting || isDraftRightAngle) ? 8 : 0
      ctx.shadowColor = col

      // Vòng hào quang nếu đang hover hoặc chọn
      if (isHovered || isConnecting || isDraftRightAngle) {
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
  ;(scene.rightAngles || []).forEach(ra => {
    draw3DRightAngle(ctx, ra, ptMap, rx, ry, CX, CY, S, bb)
  })

  // ── Giai đoạn 3: Đoạn thẳng highlight (vẽ với hiệu ứng thở pulsing sống động) ──
  const pulse = Math.sin(animTime * 3.5)
  highlights.forEach(({ a, b, seg, isHovered, isSelected, eqGroup }) => {
    let col = seg.color || (eqGroup ? eqGroup.color : '#2563eb')
    if (isSelected) col = '#f59e0b'
    else if (isHovered) col = '#3b82f6'

    ctx.setLineDash([])
    ctx.shadowColor = col
    ctx.shadowBlur  = 7 + pulse * 2.5
    ctx.strokeStyle = col
    ctx.lineWidth   = (seg.width || 2.5) + pulse * 0.35
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()

    if (eqGroup) {
      drawTickMarks(ctx, a, b, eqGroup.symbol, eqGroup.color)
    }
  })
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'

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
  const [selectedSeg, setSelectedSeg]   = useState(null) // Object thông tin đoạn thẳng được click
  const [popoverPos, setPopoverPos]     = useState(null) // { x, y }

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

  const drag  = useRef({ on: false, x: 0, y: 0, lastX: 0, lastY: 0, time: 0, moved: false })
  const touch = useRef({ on: false, x: 0, y: 0, lastX: 0, lastY: 0, time: 0, moved: false })

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

  /* Cập nhật scene và gọi callback */
  const updateScene = useCallback((newScene) => {
    if (onSceneChange) {
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
        selectedSegKey: selectedSeg ? `${selectedSeg.from}-${selectedSeg.to}` : null,
        rightAngleDraft,
      }
    )
    ctx.restore()
  }, [activeScene, ptMap, bb, zoom, hoveredPtId, connectingFrom, rubberBandPos, hoveredSegKey, selectedSeg, rightAngleDraft])

  /* ── Vòng lặp Animation 60fps ── */
  useEffect(() => {
    let active = true

    const loop = () => {
      if (!active) return

      animTimeRef.current += 0.016

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
  }, [drawCanvas, connectingFrom])

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
    const rect = cvs.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    drag.current = { on: true, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, time: performance.now(), moved: false }
    velXRef.current = 0
    velYRef.current = 0
    isTransitionRef.current = false
    setIsDrag(true)

    const hitPt = hitTestPoint(mx, my)

    // Nếu đang ở chế độ Nối điểm và nhấn vào 1 điểm
    if (activeTool === 'connect' && hitPt) {
      setConnectingFrom(hitPt)
      setRubberBandPos({ x: mx, y: my })
      return
    }
  }

  const onMove = useCallback((e) => {
    const rect = cvs.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // Cập nhật điểm hover
    const hitPt = hitTestPoint(mx, my)
    setHoveredPtId(hitPt)

    // Cập nhật đoạn thẳng hover
    const hitSeg = hitTestSegment(mx, my)
    setHoveredSegKey(hitSeg ? `${hitSeg.from}-${hitSeg.to}` : null)

    // Nếu đang kéo nối điểm (rubber-band)
    if (connectingFrom) {
      setRubberBandPos({ x: mx, y: my })
      return
    }

    if (!drag.current.on) return

    const now = performance.now()
    const dx = e.clientX - drag.current.lastX
    const dy = e.clientY - drag.current.lastY

    if (Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 4) {
      drag.current.moved = true
    }

    drag.current.lastX = e.clientX
    drag.current.lastY = e.clientY

    const dt = Math.max(1, now - drag.current.time)
    drag.current.time = now

    velXRef.current = (dx / dt) * 0.09
    velYRef.current = (dy / dt) * 0.09

    ryRef.current += dx * 0.007
    rxRef.current = Math.max(-RX_LIMIT, Math.min(RX_LIMIT, rxRef.current + dy * 0.007))
    targetRxRef.current = rxRef.current
    targetRyRef.current = ryRef.current
    setActiveCam('custom')
  }, [connectingFrom, hitTestPoint, hitTestSegment])

  const onUp = (e) => {
    const rect = cvs.current?.getBoundingClientRect()
    const mx = rect ? e.clientX - rect.left : 0
    const my = rect ? e.clientY - rect.top : 0

    // Kết thúc nối điểm bằng kéo thả
    if (connectingFrom) {
      const hitPt = hitTestPoint(mx, my)
      if (hitPt && hitPt !== connectingFrom) {
        // Tạo đoạn thẳng mới
        createSegment(connectingFrom, hitPt)
      }
      setConnectingFrom(null)
      setRubberBandPos(null)
    }

    // Xử lý click (khi không kéo xoay)
    if (!drag.current.moved && rect) {
      handleClickCanvas(mx, my)
    }

    drag.current.on = false
    setIsDrag(false)
  }

  /* ── Xử lý Click tương tác theo từng công cụ ── */
  const handleClickCanvas = (mx, my) => {
    const hitPt = hitTestPoint(mx, my)
    const hitSeg = hitTestSegment(mx, my)

    // 1. Chế độ Nối điểm (Connect)
    if (activeTool === 'connect') {
      if (hitPt) {
        if (!connectingFrom) {
          setConnectingFrom(hitPt)
          setRubberBandPos({ x: mx, y: my })
        } else if (connectingFrom !== hitPt) {
          createSegment(connectingFrom, hitPt)
          setConnectingFrom(null)
          setRubberBandPos(null)
        } else {
          setConnectingFrom(null)
          setRubberBandPos(null)
        }
      } else {
        setConnectingFrom(null)
        setRubberBandPos(null)
      }
      return
    }

    // 2. Chế độ Đánh dấu góc vuông (Right Angle)
    if (activeTool === 'rightAngle') {
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

    // 3. Chế độ Đánh dấu đoạn bằng nhau (Equal Mark)
    if (activeTool === 'equalMark') {
      if (hitSeg) {
        toggleSegmentEqualGroup(hitSeg, activeEqGroup)
      }
      return
    }

    // 4. Chế độ Xoay (Rotate) mặc định: Click vào đoạn thẳng để xem thông tin
    if (activeTool === 'rotate') {
      if (hitSeg) {
        setSelectedSeg(hitSeg)
        setPopoverPos({ x: Math.min(mx + 10, (wrap.current?.clientWidth || 300) - 240), y: Math.max(10, my - 60) })
      } else {
        setSelectedSeg(null)
        setPopoverPos(null)
      }
    }
  }

  /* ── Thao tác tạo/sửa đối tượng hình học ── */
  const createSegment = (from, to) => {
    const segs = [...(activeScene.segments || [])]
    const exists = segs.find(s => (s.from === from && s.to === to) || (s.from === to && s.to === from))
    if (!exists) {
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
    const segs = (activeScene.segments || []).map(s => {
      if ((s.from === seg.from && s.to === seg.to) || (s.from === seg.to && s.to === seg.from)) {
        return { ...s, equalGroup: s.equalGroup === groupId ? null : groupId }
      }
      return s
    })
    updateScene({ ...activeScene, segments: segs })
  }

  const toggleSegmentDashed = (seg) => {
    const segs = (activeScene.segments || []).map(s => {
      if ((s.from === seg.from && s.to === seg.to) || (s.from === seg.to && s.to === seg.from)) {
        return { ...s, dashed: !s.dashed }
      }
      return s
    })
    updateScene({ ...activeScene, segments: segs })
    if (selectedSeg) setSelectedSeg({ ...selectedSeg, dashed: !selectedSeg.dashed })
  }

  const deleteSegment = (seg) => {
    const segs = (activeScene.segments || []).filter(s =>
      !((s.from === seg.from && s.to === seg.to) || (s.from === seg.to && s.to === seg.from))
    )
    updateScene({ ...activeScene, segments: segs })
    setSelectedSeg(null)
    setPopoverPos(null)
  }

  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(v => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v * (e.deltaY < 0 ? 1.1 : 0.91))))
  }, [])

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

  // Tìm các đoạn cùng nhóm bằng nhau với đoạn đang chọn
  const equalCounterparts = useMemo(() => {
    if (!selectedSeg?.equalGroup) return []
    return (activeScene.segments || []).filter(s =>
      s.equalGroup === selectedSeg.equalGroup &&
      !((s.from === selectedSeg.from && s.to === selectedSeg.to) || (s.from === selectedSeg.to && s.to === selectedSeg.from))
    )
  }, [activeScene.segments, selectedSeg])

  const selectedSegLength = useMemo(() => {
    if (!selectedSeg) return 0
    const pA = ptMap[selectedSeg.from], pB = ptMap[selectedSeg.to]
    return dist3D(pA, pB).toFixed(2)
  }, [ptMap, selectedSeg])

  return (
    <div className={`g3d-root ${isFocusMode ? 'g3d-root--focus' : ''}`}>
      <div ref={panel} className="g3d-canvas-panel g3d-canvas-panel--full">

        {/* Floating Glassmorphism Toolbar HUD */}
        {showTools && (
          <div className="g3d-floating-hud">

            {/* Bộ chọn Chế độ tương tác (Tool Palette) */}
            <div className="g3d-hud-group g3d-hud-tools">
              <button
                className={`g3d-hud-btn ${activeTool === 'rotate' ? 'g3d-hud-btn--active' : ''}`}
                onClick={() => { setActiveTool('rotate'); setConnectingFrom(null); setRightAngleDraft([]) }}
                title="Chế độ xoay & quan sát (Click vào đoạn thẳng để xem thông tin)"
              >
                🔄 Xoay
              </button>

              <button
                className={`g3d-hud-btn ${activeTool === 'connect' ? 'g3d-hud-btn--active' : ''}`}
                onClick={() => { setActiveTool('connect'); setRightAngleDraft([]); setSelectedSeg(null) }}
                title="Kéo từ điểm này sang điểm khác để vẽ đoạn thẳng mới"
              >
                ✏️ Nối điểm
              </button>

              <button
                className={`g3d-hud-btn ${activeTool === 'rightAngle' ? 'g3d-hud-btn--active' : ''}`}
                onClick={() => { setActiveTool('rightAngle'); setConnectingFrom(null); setSelectedSeg(null) }}
                title="Bấm chọn 3 điểm để đánh dấu góc vuông"
              >
                📐 Góc vuông
              </button>

              <button
                className={`g3d-hud-btn ${activeTool === 'equalMark' ? 'g3d-hud-btn--active' : ''}`}
                onClick={() => { setActiveTool('equalMark'); setConnectingFrom(null); setRightAngleDraft([]); setSelectedSeg(null) }}
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
                  👁️ {isFocusMode ? 'Đang cô lập' : 'Cô lập'}
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

        {/* Thanh hướng dẫn ngữ cảnh theo chế độ thao tác */}
        {activeTool !== 'rotate' && (
          <div className="g3d-mode-banner">
            {activeTool === 'connect' && (
              <span>
                ✏️ <strong>Nối điểm</strong>: {connectingFrom ? `Đã chọn điểm ${connectingFrom} — click hoặc thả vào điểm thứ 2 để nối.` : 'Kéo từ điểm này sang điểm khác hoặc click lần lượt 2 điểm để vẽ đoạn thẳng.'}
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

        {/* Vùng Canvas hiển thị hình không gian */}
        <div
          ref={wrap}
          className="g3d-wrap"
          style={{
            cursor: activeTool === 'connect'
              ? 'crosshair'
              : activeTool === 'rightAngle' || activeTool === 'equalMark'
              ? 'pointer'
              : (isDrag ? 'grabbing' : 'grab')
          }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onWheel={onWheel}
        >
          <canvas ref={cvs} style={{ display: 'block', touchAction: 'none' }} />

          {/* Popover thông tin chi tiết khi click vào đoạn thẳng */}
          {selectedSeg && popoverPos && (
            <div
              className="g3d-seg-popover"
              style={{ left: popoverPos.x, top: popoverPos.y }}
              onClick={e => e.stopPropagation()}
            >
              <div className="g3d-seg-popover-header">
                <div className="g3d-seg-popover-title">
                  Đoạn thẳng <strong>{selectedSeg.from}{selectedSeg.to}</strong>
                </div>
                <button className="g3d-seg-popover-close" onClick={() => { setSelectedSeg(null); setPopoverPos(null) }}>✕</button>
              </div>

              <div className="g3d-seg-popover-body">
                <div className="g3d-seg-info-row">
                  <span className="g3d-seg-info-label">Độ dài 3D:</span>
                  <span className="g3d-seg-info-val">≈ {selectedSegLength}</span>
                </div>

                <div className="g3d-seg-info-row">
                  <span className="g3d-seg-info-label">Kiểu nét:</span>
                  <button className="g3d-btn-xs" onClick={() => toggleSegmentDashed(selectedSeg)}>
                    {selectedSeg.dashed ? 'Nét đứt (---)' : 'Nét liền (—)'}
                  </button>
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
                  <button className="g3d-btn-xs g3d-btn-xs--del" onClick={() => deleteSegment(selectedSeg)}>
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
                  <button className="g3d-btn-primary" onClick={onOpenPrompt}>
                    ✨ Nhập đề bài
                  </button>
                )}
              </div>
            </div>
          )}

          {!isEmpty && showTools && (
            <div className="g3d-hint-island">
              <span>✦ Kéo để xoay · Click vào điểm hoặc đoạn thẳng để tương tác</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

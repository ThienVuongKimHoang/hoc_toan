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

/* ─────────────────── Presets ─────────────────── */
const PRESETS = [
  {
    id: 'cube',
    name: "Lập phương ABCD.A'B'C'D'",
    data: {
      points: [
        {id:'A',x:0,y:0,z:0},{id:'B',x:1,y:0,z:0},{id:'C',x:1,y:0,z:1},{id:'D',x:0,y:0,z:1},
        {id:"A'",x:0,y:1,z:0},{id:"B'",x:1,y:1,z:0},{id:"C'",x:1,y:1,z:1},{id:"D'",x:0,y:1,z:1},
      ],
      segments: [
        {from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'D',dashed:true},{from:'D',to:'A',dashed:true},
        {from:"A'",to:"B'"},{from:"B'",to:"C'"},{from:"C'",to:"D'"},{from:"D'",to:"A'"},
        {from:'A',to:"A'"},{from:'B',to:"B'"},{from:'C',to:"C'"},
        {from:'D',to:"D'",dashed:true},
      ],
      faces:[], midpoints:[], vectors:[], labels:[],
    },
  },
  {
    id: 'pyramid4',
    name: 'Hình chóp S.ABCD',
    data: {
      points: [
        {id:'A',x:-1,y:0,z:-1},{id:'B',x:1,y:0,z:-1},
        {id:'C',x:1,y:0,z:1},{id:'D',x:-1,y:0,z:1},
        {id:'S',x:0,y:2.5,z:0},
      ],
      segments: [
        {from:'A',to:'B'},{from:'B',to:'C'},
        {from:'C',to:'D',dashed:true},{from:'D',to:'A',dashed:true},
        {from:'S',to:'A'},{from:'S',to:'B'},{from:'S',to:'C'},
        {from:'S',to:'D',dashed:true},
      ],
      faces:[], midpoints:[], vectors:[], labels:[],
    },
  },
  {
    id: 'section',
    name: 'Thiết diện S-G-B (chóp)',
    data: {
      points: [
        {id:'A',x:-1,y:0,z:-1},{id:'B',x:1,y:0,z:-1},
        {id:'C',x:1,y:0,z:1}, {id:'D',x:-1,y:0,z:1},
        {id:'S',x:0,y:2.5,z:0},
      ],
      segments: [
        {from:'A',to:'B'},{from:'B',to:'C'},
        {from:'C',to:'D',dashed:true},{from:'D',to:'A',dashed:true},
        {from:'S',to:'A'},{from:'S',to:'B'},{from:'S',to:'C'},
        {from:'S',to:'D',dashed:true},
        {from:'S',to:'G', highlight:true},
        {from:'G',to:'B', highlight:true},
        {from:'B',to:'S', highlight:true},
      ],
      midpoints: [{id:'G', of:['A','D']}],
      faces: [{
        id: 'section_SGB',
        points: ['S','G','B'],
        style: {fill:'#4dabf7', opacity:0.35, stroke:'#1971c2'},
      }],
      vectors: [],
      labels: [{point:'G', text:'G'}],
    },
  },
  {
    id: 'cube_section',
    name: 'Thiết diện hình hộp',
    data: {
      points: [
        {id:'A',x:0,y:0,z:0},{id:'B',x:2,y:0,z:0},{id:'C',x:2,y:0,z:2},{id:'D',x:0,y:0,z:2},
        {id:"A'",x:0,y:2,z:0},{id:"B'",x:2,y:2,z:0},{id:"C'",x:2,y:2,z:2},{id:"D'",x:0,y:2,z:2},
      ],
      segments: [
        {from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'D',dashed:true},{from:'D',to:'A',dashed:true},
        {from:"A'",to:"B'"},{from:"B'",to:"C'"},{from:"C'",to:"D'"},{from:"D'",to:"A'"},
        {from:'A',to:"A'"},{from:'B',to:"B'"},{from:'C',to:"C'"},{from:'D',to:"D'",dashed:true},
        {from:'B',to:"D'", highlight:true},
        {from:"D'",to:'A', highlight:true},
        {from:'A',to:"C'", highlight:true},
        {from:"C'",to:'B', highlight:true},
      ],
      midpoints: [],
      faces: [{
        id: 'section_rect',
        points: ['B',"D'",'A',"C'"],
        style: {fill:'#69db7c', opacity:0.3, stroke:'#2f9e44'},
      }],
      vectors:[],
      labels:[],
    },
  },
  {
    id: 'pyramid3',
    name: 'Hình chóp S.ABC',
    data: {
      points: [
        {id:'A',x:-1,y:0,z:0.58},{id:'B',x:1,y:0,z:0.58},{id:'C',x:0,y:0,z:-1.15},
        {id:'S',x:0,y:2,z:0},
      ],
      segments: [
        {from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'A',dashed:true},
        {from:'S',to:'A'},{from:'S',to:'B'},{from:'S',to:'C'},
      ],
      faces:[], midpoints:[], vectors:[], labels:[],
    },
  },
  {
    id: 'prism',
    name: "Lăng trụ ABC.A'B'C'",
    data: {
      points: [
        {id:'A',x:-1,y:0,z:0},{id:'B',x:1,y:0,z:0},{id:'C',x:0,y:0,z:1.73},
        {id:"A'",x:-1,y:2,z:0},{id:"B'",x:1,y:2,z:0},{id:"C'",x:0,y:2,z:1.73},
      ],
      segments: [
        {from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'A',dashed:true},
        {from:"A'",to:"B'"},{from:"B'",to:"C'"},{from:"C'",to:"A'"},
        {from:'A',to:"A'"},{from:'B',to:"B'"},{from:'C',to:"C'",dashed:true},
      ],
      faces:[], midpoints:[], vectors:[], labels:[],
    },
  },
]

const INIT_RX = -0.45
const INIT_RY =  0.62

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

/* ─────────────────── Component ─────────────────── */
export default function Geo3DViewer({ defaultPresetId, initialSceneData } = {}) {
  const cvs    = useRef(null)
  const wrap   = useRef(null)
  const drawFn = useRef(null)

  const initData = initialSceneData
    ?? (PRESETS.find(p => p.id === defaultPresetId) ?? PRESETS[2]).data
  const [script,  setScript]  = useState(() => JSON.stringify(initData, null, 2))
  const [scene,   setScene]   = useState(initData)
  const [err,     setErr]     = useState(null)
  const [rx,      setRx]      = useState(INIT_RX)
  const [ry,      setRy]      = useState(INIT_RY)
  const [zoom,    setZoom]    = useState(1.0)
  const [isDrag,  setIsDrag]  = useState(false)
  const drag  = useRef({ on: false, x: 0, y: 0 })
  const touch = useRef({ on: false, x: 0, y: 0 })

  /* ── Derived ── */
  const ptMap = useMemo(() => {
    const m = {}
    ;(scene.points || []).forEach(p => { m[p.id] = { ...p } })
    ;(scene.midpoints || []).forEach(mp => {
      const a = m[mp.of?.[0]], b = m[mp.of?.[1]]
      if (a && b) m[mp.id] = {
        id: mp.id,
        x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2,
        isMidpoint: true,
      }
    })
    return m
  }, [scene])

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
    renderScene(c.getContext('2d'), c.width, c.height, scene, ptMap, bb, rx, ry, zoom)
  }, [scene, ptMap, bb, rx, ry, zoom])

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
    setRx(v => Math.max(-1.2, Math.min(1.2, v + dy * 0.007)))
  }, [])
  const onUp = () => { drag.current.on = false; setIsDrag(false) }
  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(v => Math.max(0.2, Math.min(6, v * (e.deltaY < 0 ? 1.1 : 0.91))))
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
    setRx(v => Math.max(-1.2, Math.min(1.2, v+dy*0.007)))
  }
  const onTEnd = () => { touch.current.on=false }

  /* ── Actions ── */
  const apply = () => {
    try { setScene(JSON.parse(script)); setErr(null) } catch (e) { setErr(e.message) }
  }
  const loadPreset = (p) => {
    setScript(JSON.stringify(p.data, null, 2))
    setScene(p.data); setErr(null)
    setRx(INIT_RX); setRy(INIT_RY); setZoom(1)
  }
  const resetView = () => { setRx(INIT_RX); setRy(INIT_RY); setZoom(1) }

  return (
    <div className="g3d-root">

      {/* ── Canvas panel ── */}
      <div className="g3d-canvas-panel">
        <div className="g3d-topbar">
          <button className="g3d-btn-sm" onClick={resetView}>↺ Reset góc nhìn</button>
          <span className="g3d-hint">Kéo để xoay &nbsp;·&nbsp; Scroll để zoom</span>
          <span className="g3d-zoom-badge">{Math.round(zoom * 100)}%</span>
        </div>

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
        </div>
      </div>

      {/* ── Editor panel ── */}
      <div className="g3d-editor">
        <div className="g3d-editor-section">
          <div className="g3d-editor-label">Hình mẫu</div>
          <div className="g3d-presets">
            {PRESETS.map(p => (
              <button key={p.id} className="g3d-preset" onClick={() => loadPreset(p)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="g3d-editor-section g3d-editor-section--grow">
          <div className="g3d-editor-label">Script JSON</div>
          <textarea
            className="g3d-textarea"
            value={script}
            onChange={e => setScript(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {err && <div className="g3d-err">⚠ {err}</div>}
          <button className="g3d-apply-btn" onClick={apply}>▶ Vẽ hình</button>
        </div>

        <details className="g3d-guide">
          <summary>Hướng dẫn cú pháp</summary>
          <div className="g3d-guide-body">
            <div className="g3d-guide-row"><code>points</code> — id, x, y, z, color?, size?</div>
            <div className="g3d-guide-row"><code>segments</code> — from, to, dashed?, highlight?, color?, width?</div>
            <div className="g3d-guide-row"><code>midpoints</code> — id, of: ["A","B"]</div>
            <div className="g3d-guide-row"><code>faces</code> — id, points: ["A","B","C"], style: &#123;fill, opacity, stroke&#125;</div>
            <div className="g3d-guide-row"><code>vectors</code> — from, to, color?, label?</div>
            <div className="g3d-guide-row"><code>labels</code> — id/point, text?, dx?, dy?, color?, size?</div>
          </div>
        </details>
      </div>

    </div>
  )
}

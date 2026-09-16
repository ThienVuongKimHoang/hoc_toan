/**
 * Kiểm tra "cảnh" hình không gian trước khi đưa vào Geo3DViewer.
 *
 * Bản song song của validate_geo3d_scene trong geo3d.py — SỬA BÊN NÀY THÌ SỬA CẢ BÊN
 * KIA. Hai bản ở hai ngôn ngữ chắc chắn sẽ trôi lệch theo thời gian; chấp nhận điều đó,
 * bản JS này cố tình "ngu" hơn một chút vì server đã lọc kỹ rồi. Việc của nó là:
 *   1. bắt lỗi khi GIÁO VIÊN sửa tay ô JSON (trước đây gõ sai một id thì cạnh biến mất
 *      im lặng, không báo gì),
 *   2. làm lớp chặn thứ hai cho phản hồi AI.
 *
 * Ba cách hỏng thật của renderScene mà nó chặn: toạ độ NaN làm canvas TRẮNG TRƠN,
 * id không tồn tại làm cạnh biến mất im lặng, và mọi điểm trùng nhau làm hình văng
 * khỏi khung.
 */

export const EMPTY_SCENE = {
  points: [], segments: [], midpoints: [], faces: [], vectors: [], labels: [],
  rightAngles: [], equalGroups: [],
}

const MAX_COORD  = 1000
const MIN_EXTENT = 1e-6

const num = (v) => {
  // Chặn boolean: Number(true) ra 1, lọt vào thành toạ độ thật.
  if (typeof v === 'boolean') return null
  const f = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN)
  return Number.isFinite(f) && Math.abs(f) <= MAX_COORD ? f : null
}

const id = (v) => (typeof v === 'string' && v.trim() && v.trim().length <= 8 ? v.trim() : null)

const arr = (v) => (Array.isArray(v) ? v : [])

/**
 * @returns {{scene: object|null, warnings: string[], error: string|null}}
 *   `error` khác null nghĩa là không vẽ được — hiện cho người dùng, đừng đưa vào viewer.
 */
export function validateScene(input) {
  const warnings = []
  let raw = input
  if (raw && typeof raw === 'object' && raw.scene && typeof raw.scene === 'object') raw = raw.scene
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { scene: null, warnings, error: 'Dữ liệu hình không hợp lệ.' }
  }

  const out = {
    points: [], segments: [], midpoints: [], faces: [], vectors: [], labels: [],
    rightAngles: [], equalGroups: [],
  }
  const known = new Set()

  for (const p of arr(raw.points)) {
    if (!p || typeof p !== 'object') continue
    const pid = id(p.id)
    if (!pid || known.has(pid)) continue
    const x = num(p.x), y = num(p.y), z = num(p.z)
    if (x === null || y === null || z === null) {
      warnings.push(`Điểm "${pid}" có toạ độ không hợp lệ — đã bỏ.`)
      continue
    }
    out.points.push({ ...p, id: pid, x, y, z })
    known.add(pid)
  }

  // Giải theo đúng thứ tự khai báo, bỏ tham chiếu tiến — khớp cách ptMap duyệt mảng.
  for (const m of arr(raw.midpoints)) {
    if (!m || typeof m !== 'object') continue
    const mid = id(m.id)
    const of = arr(m.of)
    if (!mid || known.has(mid) || of.length !== 2) continue
    const a = id(of[0]), b = id(of[1])
    if (!a || !b || !known.has(a) || !known.has(b)) {
      warnings.push(`Trung điểm "${mid}" trỏ tới điểm chưa có — đã bỏ.`)
      continue
    }
    out.midpoints.push({ id: mid, of: [a, b] })
    known.add(mid)
  }

  for (const key of ['segments', 'vectors']) {
    for (const it of arr(raw[key])) {
      if (!it || typeof it !== 'object') continue
      const a = id(it.from), b = id(it.to)
      const miss = [[it.from, a], [it.to, b]].filter(([, v]) => !v || !known.has(v)).map(([o]) => String(o))
      if (miss.length) {
        warnings.push(`Bỏ 1 ${key === 'segments' ? 'đoạn thẳng' : 'vectơ'} trỏ tới điểm không tồn tại: ${miss.join(', ')}.`)
        continue
      }
      if (a === b) continue
      out[key].push({ ...it, from: a, to: b })
    }
  }

  for (const f of arr(raw.faces)) {
    if (!f || typeof f !== 'object') continue
    const pts = []
    const miss = []
    for (const v of arr(f.points)) {
      const cid = id(v)
      if (!cid || !known.has(cid)) { miss.push(String(v)); continue }
      if (!pts.length || pts[pts.length - 1] !== cid) pts.push(cid)
    }
    if (miss.length) {
      // Bỏ hẳn mặt thay vì âm thầm hạ tứ giác xuống tam giác.
      warnings.push(`Bỏ 1 mặt vì trỏ tới điểm không tồn tại: ${miss.join(', ')}.`)
      continue
    }
    if (pts.length < 3) { warnings.push('Bỏ 1 mặt vì có dưới 3 điểm.'); continue }
    out.faces.push({ ...f, points: pts })
  }

  for (const l of arr(raw.labels)) {
    if (!l || typeof l !== 'object') continue
    const target = id(l.point) || id(l.id)     // renderScene nhận cả hai khoá
    if (!target || !known.has(target)) {
      warnings.push(`Bỏ 1 nhãn trỏ tới điểm không tồn tại: ${l.point ?? l.id}.`)
      continue
    }
    const item = { ...l, point: target }
    delete item.id
    // Cắt $ để LaTeX không lọt ra canvas (canvas vẽ chữ bằng fillText).
    if (item.text != null) item.text = String(item.text).replace(/\$/g, '').slice(0, 40)
    out.labels.push(item)
  }

  for (const ra of arr(raw.rightAngles)) {
    if (!ra || typeof ra !== 'object') continue
    const v = id(ra.vertex)
    const r1 = id(ra.ray1)
    const r2 = id(ra.ray2)
    if (!v || !r1 || !r2 || !known.has(v) || !known.has(r1) || !known.has(r2)) continue
    if (r1 === v || r2 === v || r1 === r2) continue
    out.rightAngles.push({ ...ra, vertex: v, ray1: r1, ray2: r2 })
  }

  for (const eg of arr(raw.equalGroups)) {
    if (!eg || typeof eg !== 'object' || !eg.id) continue
    out.equalGroups.push({ ...eg })
  }

  if (out.points.length < 2) {
    return { scene: null, warnings, error: 'Hình không có đủ điểm để vẽ.' }
  }
  if (!out.segments.length && !out.faces.length) {
    return { scene: null, warnings, error: 'Hình không có cạnh hoặc mặt nào để vẽ.' }
  }
  const ext = (k) => {
    const vs = out.points.map(p => p[k])
    return Math.max(...vs) - Math.min(...vs)
  }
  if (Math.max(ext('x'), ext('y'), ext('z')) < MIN_EXTENT) {
    return { scene: null, warnings, error: 'Các điểm của hình trùng nhau nên không vẽ được.' }
  }

  return { scene: out, warnings, error: null }
}

/** Ô JSON của giáo viên: chuỗi → cảnh đã kiểm tra. */
export function parseSceneScript(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    return { scene: null, warnings: [], error: `JSON sai cú pháp: ${e.message}` }
  }
  return validateScene(obj)
}

/* Heuristic "beautify": nếu một nét vẽ bằng bút trông như người dùng ĐỊNH kẻ
   một đường thẳng nhưng tay run/xéo, tự động nắn lại thành đường thẳng tuyệt đối
   giữa 2 điểm đầu/cuối. Nét vẽ chữ viết tay / đường cong thật sẽ không bị đụng tới. */

const MIN_CHORD = 24        // px — nét quá ngắn (chấm, gạch nhỏ) thì bỏ qua
const MAX_PATH_RATIO = 1.12 // độ dài nét / khoảng cách đầu-cuối, ~1 là đường thẳng tuyệt đối
const MAX_WOBBLE_RATIO = 0.10 // độ lệch vuông góc lớn nhất / khoảng cách đầu-cuối

export function straightenIfLine(points) {
  if (!points || points.length < 2) return points

  const p0 = points[0]
  const pN = points[points.length - 1]
  const dx = pN.x - p0.x
  const dy = pN.y - p0.y
  const chord = Math.hypot(dx, dy)
  if (chord < MIN_CHORD) return points

  let pathLength = 0
  let maxDeviation = 0
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    }
    const p = points[i]
    const t = ((p.x - p0.x) * dx + (p.y - p0.y) * dy) / (chord * chord)
    const projX = p0.x + t * dx
    const projY = p0.y + t * dy
    const deviation = Math.hypot(p.x - projX, p.y - projY)
    if (deviation > maxDeviation) maxDeviation = deviation
  }

  const pathRatio = pathLength / chord
  const wobbleRatio = maxDeviation / chord
  if (pathRatio <= MAX_PATH_RATIO && wobbleRatio <= MAX_WOBBLE_RATIO) {
    return [p0, pN]
  }
  return points
}

/* ─── Hình học dùng cho canvas vô hạn: hit-test nét vẽ, bbox, gom cụm ─── */

export function strokeBBox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function bboxesOverlap(a, b, gap = 0) {
  return a.minX - gap <= b.maxX && b.minX - gap <= a.maxX &&
         a.minY - gap <= b.maxY && b.minY - gap <= a.maxY
}

export function bboxIntersectsRect(bbox, rect) {
  return bbox.minX <= rect.maxX && rect.minX <= bbox.maxX &&
         bbox.minY <= rect.maxY && rect.minY <= bbox.maxY
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/* Khoảng cách ngắn nhất từ 1 điểm đến 1 nét vẽ (polyline) — dùng để bắt trúng nét khi click/tẩy. */
export function distanceToStroke(point, points) {
  if (!points || points.length === 0) return Infinity
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y)
  let min = Infinity
  for (let i = 1; i < points.length; i++) {
    const d = distanceToSegment(point, points[i - 1], points[i])
    if (d < min) min = d
  }
  return min
}

/* Gom các nét vẽ đứng gần nhau (bbox cách nhau < gap) thành từng "cụm" — mô phỏng việc
   click vào 1 chữ số/chữ cái viết tay (có thể gồm nhiều nét) sẽ chọn được trọn vẹn cả chữ đó,
   trong khi các chữ khác đứng xa hơn thì không bị gộp vào. */
export function clusterStrokes(strokes, gap) {
  const n = strokes.length
  const parent = new Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] }
    return i
  }
  const union = (a, b) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bboxesOverlap(strokes[i].bbox, strokes[j].bbox, gap)) union(i, j)
    }
  }
  const groups = []
  const rootToGroup = new Map()
  const idToGroupIndex = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    let gi = rootToGroup.get(r)
    if (gi === undefined) { gi = groups.length; groups.push([]); rootToGroup.set(r, gi) }
    groups[gi].push(strokes[i].id)
    idToGroupIndex.set(strokes[i].id, gi)
  }
  return { groups, idToGroupIndex }
}

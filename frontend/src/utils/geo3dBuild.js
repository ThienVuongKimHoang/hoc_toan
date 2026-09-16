/**
 * Dựng hình không gian "từng bước" cho Geo3DViewer: chia một cảnh (đã qua validateScene)
 * thành các bước giống cách vẽ tay trên giấy, kèm câu mô tả cho ô "Quá trình vẽ hình".
 *
 *   makeBuildSteps(scene)      → [{ text, items }]      thứ tự vẽ + câu mô tả
 *   layoutBuild(steps)         → { entries, stepStarts, drawEnd, total }   dòng thời gian (ms)
 *   revealAt(layout, elapsed)  → { reveal, stepIdx, done }  trạng thái hiện hình tại một thời điểm
 *
 * Hàm thuần, không đụng React/canvas. Các bước tự suy ra từ hình (không hỏi AI): prompt
 * trong geo3d.py đã bắt mặt đáy nằm ngang ở cùng một y và đỉnh ở phía trên, nên "đáy"
 * là vòng cạnh ở mặt phẳng y thấp nhất.
 *
 * item = { kind: 'pt'|'seg'|'face'|'vec'|'ra', ref, rev? }
 *   ref: id điểm (pt) hoặc chỉ số trong segments / faces / vectors / rightAngles.
 *   rev: đoạn vẽ từ `to` về `from` — để ngòi bút luôn xuất phát từ điểm đã có trên hình.
 * text viết thường ở đầu ("vẽ tứ giác ABCD") để ghép thành "Đang vẽ tứ giác ABCD…".
 */

const POLY_NAMES = { 3: 'tam giác', 4: 'tứ giác', 5: 'ngũ giác', 6: 'lục giác' }
const polyName = (n) => POLY_NAMES[n] || 'đa giác'

/* Thời lượng mỗi mục (ms) */
const DUR = { pt: 160, seg: 320, face: 400, vec: 280, ra: 280 }
const STEP_MIN_MS   = 750     // mỗi bước hiện đủ lâu để kịp đọc dòng chữ
const STEP_GAP_MS   = 250
const FINAL_HOLD_MS = 700     // giữ dòng "Hình đã hoàn thiện" trước khi vào giao diện xoay
const MAX_TOTAL_MS  = 12000   // hình nhiều chi tiết thì co cả dòng thời gian lại

const MAX_CYCLE_POINTS = 12      // tìm vòng đáy bằng DFS — giới hạn để không treo trình duyệt
const MAX_DFS_VISITS   = 20000

/** "SA, SB, SC" — quá 5 tên thì cắt còn 4 tên + "…" */
export const joinNames = (list) =>
  (list.length > 5 ? `${list.slice(0, 4).join(', ')}, …` : list.join(', '))

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/**
 * Vòng dài nhất (≥ 3 điểm) đi qua các cạnh nối giữa `ids`. Chuẩn hoá: bắt đầu ở điểm khai
 * báo sớm nhất, đi về phía hàng xóm khai báo sớm hơn — nên đáy A,B,C,D cho ra "ABCD".
 * Không có vòng thì trả về null.
 */
function longestCycle(ids, segments, rank) {
  if (ids.length < 3 || ids.length > MAX_CYCLE_POINTS) return null
  const set = new Set(ids)
  const adj = new Map(ids.map(id => [id, new Set()]))
  segments.forEach(s => {
    if (set.has(s.from) && set.has(s.to) && s.from !== s.to) {
      adj.get(s.from).add(s.to)
      adj.get(s.to).add(s.from)
    }
  })
  const byRank = (a, b) => rank.get(a) - rank.get(b)
  let best = null
  let visits = 0

  // Chỉ tìm vòng có điểm đầu là điểm khai báo sớm nhất trong vòng → mỗi vòng duyệt một lần
  for (const start of [...ids].sort(byRank)) {
    const path = [start]
    const seen = new Set(path)
    const dfs = () => {
      if (++visits > MAX_DFS_VISITS) return
      const last = path[path.length - 1]
      if (path.length >= 3 && adj.get(last).has(start) && (!best || path.length > best.length)) {
        best = [...path]
      }
      for (const nb of [...adj.get(last)].sort(byRank)) {
        if (seen.has(nb) || rank.get(nb) < rank.get(start)) continue
        path.push(nb); seen.add(nb)
        dfs()
        path.pop(); seen.delete(nb)
      }
    }
    dfs()
    if (best && best.length === ids.length) break
  }
  if (!best) return null
  // Đi theo chiều có hàng xóm khai báo sớm hơn
  if (rank.get(best[best.length - 1]) < rank.get(best[1])) best = [best[0], ...best.slice(1).reverse()]
  return best
}

/** Chỉ số các đoạn tạo thành vòng `cycle` (theo thứ tự vòng) và cờ rev tương ứng. */
function cycleSegments(cycle, segments, usedSeg) {
  const out = []
  cycle.forEach((a, i) => {
    const b = cycle[(i + 1) % cycle.length]
    const idx = segments.findIndex((s, j) => !usedSeg.has(j) &&
      ((s.from === a && s.to === b) || (s.from === b && s.to === a)))
    if (idx >= 0) {
      usedSeg.add(idx)
      out.push({ kind: 'seg', ref: idx, rev: segments[idx].from !== a })
    }
  })
  return out
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))

export function makeBuildSteps(scene) {
  const points      = scene?.points || []
  const segments    = scene?.segments || []
  const faces       = scene?.faces || []
  const vectors     = scene?.vectors || []
  const rightAngles = scene?.rightAngles || []
  const midpoints   = scene?.midpoints || []
  if (!points.length) return []

  const steps   = []
  const drawn   = new Set()   // id điểm đã có trên hình
  const usedSeg = new Set()
  const usedFace = new Set()
  const placedPts = new Set() // id điểm đã được xếp vào một bước
  const rank = new Map(points.map((p, i) => [p.id, i]))
  midpoints.forEach((m, i) => { if (!rank.has(m.id)) rank.set(m.id, points.length + i) })

  const push = (text, items) => { if (items.length) steps.push({ text, items }) }
  const ptItem = (id) => { placedPts.add(id); return { kind: 'pt', ref: id } }
  /* Nối ngay các đoạn đã đủ hai đầu mút (VD đường chéo AC, BD sau khi vẽ đáy) */
  const flushAvailable = () => {
    const js = []
    segments.forEach((s, j) => {
      if (!usedSeg.has(j) && drawn.has(s.from) && drawn.has(s.to)) { usedSeg.add(j); js.push(j) }
    })
    push(
      `nối ${joinNames(js.map(j => `${segments[j].from}${segments[j].to}`))}`,
      js.map(j => ({ kind: 'seg', ref: j })),
    )
  }
  const takeFace = (ids) => {
    const fi = faces.findIndex((f, i) => !usedFace.has(i) && sameSet(f.points || [], ids))
    if (fi < 0) return []
    usedFace.add(fi)
    return [{ kind: 'face', ref: fi }]
  }

  const val = (k) => points.map(p => p[k])
  const ext = (k) => Math.max(...val(k)) - Math.min(...val(k))
  const eps = Math.max(Math.max(ext('x'), ext('y'), ext('z')) * 0.02, 1e-6)
  const yMin = Math.min(...val('y'))
  const yMax = Math.max(...val('y'))

  /* 1. Đáy: vòng cạnh ở mặt phẳng y thấp nhất */
  const bottomIds = points.filter(p => Math.abs(p.y - yMin) <= eps).map(p => p.id)
  let base = longestCycle(bottomIds, segments, rank)
  if (!base) {
    // Không có vòng cạnh nhưng có mặt nằm ở đáy → lấy thứ tự điểm của mặt đó
    const f = faces.find(f => (f.points || []).length >= 3 && f.points.every(id => bottomIds.includes(id)))
    if (f) base = [...f.points]
  }
  if (base) {
    const items = base.map(ptItem)
    items.push(...cycleSegments(base, segments, usedSeg))
    items.push(...takeFace(base))
    base.forEach(id => drawn.add(id))
    push(`vẽ ${polyName(base.length)} ${base.join('')}`, items)
    flushAvailable()
  }

  /* 2. Mặt trên của lăng trụ / hộp / chóp cụt: vòng cùng số điểm ở y cao nhất, mỗi điểm
        nối xuống một điểm đáy khác nhau */
  if (base && yMax - yMin > eps) {
    const topIds = points.filter(p => Math.abs(p.y - yMax) <= eps && !drawn.has(p.id)).map(p => p.id)
    const top = topIds.length === base.length ? longestCycle(topIds, segments, rank) : null
    if (top && top.length === base.length) {
      const lateral = []
      const usedBase = new Set()
      top.forEach(t => {
        const idx = segments.findIndex((s, j) => !usedSeg.has(j) &&
          ((s.from === t && base.includes(s.to) && !usedBase.has(s.to)) ||
           (s.to === t && base.includes(s.from) && !usedBase.has(s.from))))
        if (idx < 0) return
        const b = segments[idx].from === t ? segments[idx].to : segments[idx].from
        usedBase.add(b)
        lateral.push({ idx, b, t })
      })
      if (lateral.length === top.length) {
        lateral.sort((u, v) => base.indexOf(u.b) - base.indexOf(v.b))
        const items = []
        lateral.forEach(({ idx, b, t }) => {
          usedSeg.add(idx)
          // Ngòi bút đi từ điểm đáy lên, tới nơi mới chấm điểm trên
          items.push({ kind: 'seg', ref: idx, rev: segments[idx].from !== b }, ptItem(t))
          drawn.add(t)
        })
        push(`dựng các cạnh bên ${joinNames(lateral.map(({ b, t }) => `${b}${t}`))}`, items)

        const topItems = cycleSegments(top, segments, usedSeg)
        topItems.push(...takeFace(top))
        push(`vẽ ${polyName(top.length)} ${top.join('')}`, topItems)
        flushAvailable()
      }
    }
  }

  /* 3. Các điểm còn lại theo thứ tự khai báo, kèm các đoạn nối về điểm đã có */
  points.forEach(p => {
    if (drawn.has(p.id)) return
    const P = p.id
    const segs = []
    segments.forEach((s, j) => {
      if (usedSeg.has(j)) return
      if ((s.from === P && drawn.has(s.to)) || (s.to === P && drawn.has(s.from))) segs.push(j)
    })
    const other = (j) => (segments[j].from === P ? segments[j].to : segments[j].from)
    // "Cạnh bên" chỉ là đoạn nối xuống đỉnh đáy; đoạn khác (VD đường cao SO) vẽ sau
    const lateral = base ? segs.filter(j => base.includes(other(j))) : []
    const extra = segs.filter(j => !lateral.includes(j))
    const isApex = base && p.y > yMin + eps && lateral.length >= 3
    const ordered = isApex ? [...lateral, ...extra] : segs
    const items = [ptItem(P)]
    ordered.forEach(j => {
      usedSeg.add(j)
      items.push({ kind: 'seg', ref: j, rev: segments[j].from !== P })
    })
    drawn.add(P)
    const nm = (js) => joinNames(js.map(j => `${P}${other(j)}`))
    if (isApex) {
      push(`dựng đỉnh ${P} và các cạnh bên ${nm(lateral)}${extra.length ? `, nối ${nm(extra)}` : ''}`, items)
    } else if (segs.length) {
      push(`dựng điểm ${P}, nối ${nm(segs)}`, items)
    } else {
      push(`lấy điểm ${P}`, items)
    }
  })

  /* 4. Trung điểm (gộp tối đa 3 trong một bước) */
  const mids = midpoints.filter(m => !drawn.has(m.id) && m.of?.length === 2)
  chunk(mids, 3).forEach(group => {
    group.forEach(m => drawn.add(m.id))
    push(
      `lấy trung điểm ${group.map(m => `${m.id} của ${m.of[0]}${m.of[1]}`).join(', ')}`,
      group.map(m => ptItem(m.id)),
    )
  })

  /* 5. Các đoạn còn lại đã đủ hai đầu mút */
  flushAvailable()

  /* 6. Các mặt còn lại (thiết diện, mặt phẳng phụ…) */
  const restFaces = faces.map((_, i) => i).filter(i => !usedFace.has(i))
  restFaces.forEach(i => usedFace.add(i))
  const faceName = (i) => `(${(faces[i].points || []).join('')})`
  if (restFaces.length > 3) {
    push(`tô các mặt phẳng ${joinNames(restFaces.map(faceName))}`, restFaces.map(i => ({ kind: 'face', ref: i })))
  } else {
    restFaces.forEach(i => push(`tô mặt phẳng ${faceName(i)}`, [{ kind: 'face', ref: i }]))
  }

  /* 7. Vectơ và góc vuông */
  push(
    `vẽ ${vectors.length > 1 ? 'các vectơ' : 'vectơ'} ${joinNames(vectors.map(v => `${v.from}${v.to}`))}`,
    vectors.map((_, i) => ({ kind: 'vec', ref: i })),
  )
  push(
    `đánh dấu góc vuông tại ${joinNames([...new Set(rightAngles.map(r => r.vertex))])}`,
    rightAngles.map((_, i) => ({ kind: 'ra', ref: i })),
  )

  /* 8. Dự phòng: thứ gì chưa được xếp (VD hình chưa qua validateScene) thì dồn vào cuối,
        để không phần tử nào biến mất khỏi hình */
  const leftovers = []
  points.forEach(p => { if (!placedPts.has(p.id)) leftovers.push(ptItem(p.id)) })
  midpoints.forEach(m => { if (m?.id && !placedPts.has(m.id)) leftovers.push(ptItem(m.id)) })
  segments.forEach((_, j) => { if (!usedSeg.has(j)) { usedSeg.add(j); leftovers.push({ kind: 'seg', ref: j }) } })
  push('hoàn thiện hình', leftovers)

  return steps
}

export function layoutBuild(steps) {
  const entries = []
  let stepStarts = []
  let t = 0
  let drawEnd = 0
  steps.forEach((st, si) => {
    stepStarts.push(t)
    let local = 0
    st.items.forEach(it => {
      const dur = DUR[it.kind] || 300
      entries.push({ ...it, step: si, start: t + local, dur })
      local += dur
    })
    drawEnd = t + Math.max(local, STEP_MIN_MS)
    t = drawEnd + STEP_GAP_MS
  })
  let total = drawEnd + FINAL_HOLD_MS
  if (total > MAX_TOTAL_MS) {
    const k = MAX_TOTAL_MS / total
    entries.forEach(e => { e.start *= k; e.dur *= k })
    stepStarts = stepStarts.map(s => s * k)
    drawEnd *= k
    total = MAX_TOTAL_MS
  }
  return { entries, stepStarts, drawEnd, total, stepCount: steps.length }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)

/**
 * reveal[kind][ref] ∈ (0, 1]: mức hiện của từng phần tử (không có khoá = chưa hiện).
 * reveal.segRev[i]: vẽ đoạn i ngược chiều. reveal.hot[kind][ref]: thuộc bước đang vẽ.
 * stepIdx = stepCount nghĩa là đã vẽ xong, đang giữ dòng "hoàn thiện".
 */
export function revealAt(layout, elapsed) {
  let stepIdx = 0
  layout.stepStarts.forEach((s, i) => { if (elapsed >= s) stepIdx = i })
  if (elapsed >= layout.drawEnd) stepIdx = layout.stepCount

  const reveal = {
    pt: {}, seg: {}, face: {}, vec: {}, ra: {}, segRev: {},
    hot: { pt: {}, seg: {}, face: {}, vec: {}, ra: {} },
  }
  layout.entries.forEach(e => {
    const raw = clamp01((elapsed - e.start) / (e.dur || 1))
    if (raw <= 0) return
    reveal[e.kind][e.ref] = e.kind === 'seg' || e.kind === 'vec' ? easeInOut(raw) : raw
    if (e.kind === 'seg' && e.rev) reveal.segRev[e.ref] = true
    if (e.step === stepIdx) reveal.hot[e.kind][e.ref] = true
  })
  return { reveal, stepIdx, done: elapsed >= layout.total }
}

/* ─────────────────────────────────────────────────────────────
   Vật lý mặt phẳng nghiêng (lớp 10) — hàm thuần, không phụ thuộc React.

   Quy ước: trục Ox dọc mặt dốc, gốc ở ĐỈNH dốc, chiều dương HƯỚNG XUỐNG dốc.
   x ∈ [0, L]. Vận tốc v > 0 là đang đi xuống, v < 0 là đang đi lên.

   Điều kiện đầu:
   - x0 : vị trí xuất phát (m, tính từ đỉnh dốc), 0 ≤ x0 ≤ L
   - v0 : vận tốc ban đầu CÓ DẤU — âm: ném lên dốc, dương: ném xuống dốc

   Lời giải tính theo từng pha bằng công thức đóng (chuyển động biến đổi đều),
   không tích phân số — để số liệu khớp đúng lời giải tay của học sinh.
───────────────────────────────────────────────────────────── */

export const G = 9.8
const EPS = 1e-9

export const DEFAULT_PARAMS = { alphaDeg: 30, m: 2, mu: 0.2, x0: 0, v0: 0, L: 5 }

const rad = deg => (deg * Math.PI) / 180

/* Các lực KHÔNG phụ thuộc trạng thái chuyển động */
export function baseForces({ alphaDeg, m, mu }) {
  const a = rad(alphaDeg)
  const P = m * G
  const Ppar = P * Math.sin(a)        // thành phần song song mặt dốc (kéo vật xuống)
  const Pperp = P * Math.cos(a)       // thành phần vuông góc mặt dốc
  const N = Pperp
  const FmsMax = mu * N               // ma sát nghỉ cực đại ≈ ma sát trượt
  return { P, Ppar, Pperp, N, FmsMax, sin: Math.sin(a), cos: Math.cos(a), tan: Math.tan(a) }
}

/* Vật có tự trượt được không khi đang đứng yên? (tanα > μ) */
export function canSlide({ alphaDeg, mu }) {
  return Math.tan(rad(alphaDeg)) > mu + EPS
}

/*
 * Mỗi pha: { kind, t0, t1, x0, v0, a, s0 }
 *   kind: 'up' (đi lên, chậm dần) | 'down' (đi xuống; a có thể âm) | 'rest' (đứng yên)
 *   s0  : quãng đường ĐÃ ĐI (cộng dồn, ≥ 0) tại đầu pha — để tính nhiệt ma sát.
 * end : 'foot' (tới chân dốc) | 'top' (tới đỉnh dốc) | 'rest' (đứng yên mãi)
 */
export function simulate(params) {
  const { mu, L } = params
  const f = baseForces(params)
  const phases = []
  let t = 0
  let x = Math.min(L, Math.max(0, params.x0 ?? 0))
  let v = params.v0 ?? 0
  let s = 0

  // Đã ở chân dốc mà không ném lên → không có chuyển động
  if (x >= L - EPS && v >= -EPS) {
    phases.push({ kind: 'rest', t0: 0, t1: Infinity, x0: L, v0: 0, a: 0, s0: 0 })
    return finish(phases, 'foot', params, f)
  }
  // Ở đỉnh dốc mà ném lên → rời dốc ngay
  if (x <= EPS && v < -EPS) {
    phases.push({ kind: 'up', t0: 0, t1: 0, x0: 0, v0: v, a: G * (f.sin + mu * f.cos), s0: 0 })
    return finish(phases, 'top', params, f)
  }

  /* Pha đi lên: trọng lực và ma sát đều hướng xuống dốc */
  if (v < -EPS) {
    const a = G * (f.sin + mu * f.cos)
    if (a < EPS) {                                   // α = 0, μ = 0: thẳng đều về phía đỉnh
      phases.push({ kind: 'up', t0: t, t1: t + x / -v, x0: x, v0: v, a: 0, s0: s })
      return finish(phases, 'top', params, f)
    }
    const dUp = (v * v) / (2 * a)
    if (dUp >= x - EPS) {                            // lên tới đỉnh trước khi dừng
      const dt = (-v - Math.sqrt(Math.max(0, v * v - 2 * a * x))) / a
      phases.push({ kind: 'up', t0: t, t1: t + dt, x0: x, v0: v, a, s0: s })
      return finish(phases, 'top', params, f)
    }
    const tStop = -v / a
    phases.push({ kind: 'up', t0: t, t1: t + tStop, x0: x, v0: v, a, s0: s })
    t += tStop; x -= dUp; s += dUp; v = 0
  }

  /* Pha đi xuống có vận tốc đầu (ném xuống) */
  if (v > EPS) {
    const a = G * (f.sin - mu * f.cos)
    const d = L - x
    if (a < -EPS) {
      // Chậm dần: dừng sau d_stop = v²/(2|a|) nếu chưa tới chân dốc
      const dStop = (v * v) / (2 * -a)
      if (dStop < d - EPS) {
        const tStop = v / -a
        phases.push({ kind: 'down', t0: t, t1: t + tStop, x0: x, v0: v, a, s0: s })
        t += tStop; x += dStop; s += dStop
        phases.push({ kind: 'rest', t0: t, t1: Infinity, x0: x, v0: 0, a: 0, s0: s })
        return finish(phases, 'rest', params, f)
      }
    }
    // Tới chân dốc: d = v·t + ½a·t²
    const dt = Math.abs(a) < EPS ? d / v : (-v + Math.sqrt(Math.max(0, v * v + 2 * a * d))) / a
    phases.push({ kind: 'down', t0: t, t1: t + dt, x0: x, v0: v, a, s0: s })
    return finish(phases, 'foot', params, f)
  }

  /* Tại v = 0: đứng yên hay trượt xuống? */
  if (!canSlide(params)) {
    phases.push({ kind: 'rest', t0: t, t1: Infinity, x0: x, v0: 0, a: 0, s0: s })
    return finish(phases, 'rest', params, f)
  }
  const a = G * (f.sin - mu * f.cos)
  const d = L - x
  const dt = d > EPS ? Math.sqrt((2 * d) / a) : 0
  phases.push({ kind: 'down', t0: t, t1: t + dt, x0: x, v0: 0, a, s0: s })
  return finish(phases, 'foot', params, f)
}

function finish(phases, end, params, forces) {
  const last = phases[phases.length - 1]
  // Thời điểm kết thúc hoạt ảnh. Nếu đứng yên mãi thì dừng ngay lúc bắt đầu đứng yên.
  const tEnd = last.kind === 'rest' ? last.t0 : last.t1
  const sim = { params, forces, phases, end, tEnd }
  sim.stateAt = t => stateAt(sim, t)
  return sim
}

/* Trạng thái tại thời điểm t (kẹp vào [0, tEnd]) */
export function stateAt(sim, tRaw) {
  const { phases, params, forces } = sim
  const t = Math.max(0, Math.min(tRaw, sim.tEnd))
  let ph = phases[phases.length - 1]
  for (const p of phases) {
    if (t <= p.t1 + EPS) { ph = p; break }
  }
  const dt = Math.max(0, t - ph.t0)
  const x = ph.x0 + ph.v0 * dt + 0.5 * ph.a * dt * dt
  const v = ph.v0 + ph.a * dt
  const travelled = ph.s0 + Math.abs(x - ph.x0)

  const { m, mu, L, alphaDeg } = params
  // Ma sát (giá trị đại số theo trục Ox hướng xuống dốc)
  let Fms
  let frictionKind
  if (ph.kind === 'rest' || (Math.abs(v) < 1e-6 && ph.kind !== 'up' && !canSlide(params))) {
    Fms = -forces.Ppar          // ma sát nghỉ cân bằng P∥, hướng lên dốc
    frictionKind = 'static'
  } else if (ph.kind === 'up') {
    Fms = forces.FmsMax         // đi lên → ma sát hướng xuống
    frictionKind = 'kinetic'
  } else {
    Fms = -forces.FmsMax        // đi xuống → ma sát hướng lên
    frictionKind = 'kinetic'
  }
  if (mu === 0) { Fms = 0; frictionKind = 'none' }
  if (ph.kind === 'rest' && alphaDeg === 0) { Fms = 0; frictionKind = 'none' }

  const h = (L - x) * forces.sin            // độ cao so với sàn (chân dốc)
  const Wd = 0.5 * m * v * v
  const Wt = m * G * h
  const Q = forces.FmsMax * travelled       // nhiệt toả ra do ma sát trượt
  return {
    t, x, v, a: ph.a, phase: ph.kind, Fms, frictionKind,
    h, Wd, Wt, Q, E: Wd + Wt + Q, travelled,
  }
}

/* Lấy mẫu để vẽ đồ thị */
export function sample(sim, n = 160) {
  const T = sim.tEnd > EPS ? sim.tEnd : 1
  const out = []
  for (let i = 0; i <= n; i++) out.push(stateAt(sim, (T * i) / n))
  return out
}

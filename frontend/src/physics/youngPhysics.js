/* ─────────────────────────────────────────────────────────────
   Giao thoa ánh sáng — thí nghiệm khe Young (Vật lý 11). Hàm thuần, không phụ thuộc React.

   Đơn vị dùng trong code (đúng thói quen giải bài của học sinh):
   - λ : nm (bước sóng trong chân không / không khí)
   - a : mm (khoảng cách hai khe S₁S₂)
   - D : m  (khoảng cách từ hai khe tới màn)
   - x, i, L : mm (toạ độ trên màn, khoảng vân, bề rộng vùng giao thoa)
   - n : chiết suất môi trường giữa khe và màn (λ' = λ/n ⇒ i' = i/n)

   i (mm) = λ(nm)·10⁻⁶ · D(m)·10³ / a(mm) / n = λ·D / (1000·a·n)
   Ví dụ λ = 600 nm, a = 1 mm, D = 2 m ⇒ i = 1,2 mm.

   Cường độ trên màn lấy theo mô hình lý tưởng hai nguồn điểm kết hợp:
   I(x) = cos²(π x / i)  (chuẩn hoá về 1 ở vân sáng), bỏ qua nhiễu xạ qua từng khe —
   khớp với cách SGK trình bày.
───────────────────────────────────────────────────────────── */

export const VIOLET_NM = 380
export const RED_NM = 760

export const DEFAULT_PARAMS = {
  mode: 'mono',      // 'mono' (đơn sắc) | 'white' (ánh sáng trắng) | 'two' (hai bức xạ)
  lambdaNm: 600,
  lambda2Nm: 450,
  aMm: 1,
  Dm: 2,
  n: 1,
  Lmm: 13,
  oneSlit: false,    // che khe S₂: chỉ còn một nguồn ⇒ không có giao thoa, màn sáng đều
}

/* Cường độ khi chỉ còn một khe (nguồn điểm lý tưởng): biên độ một sóng ⇒ ¼ cường độ vân sáng */
export const ONE_SLIT_I = 0.25

export const LIMITS = {
  lambdaNm: [VIOLET_NM, RED_NM],
  aMm: [0.2, 2],
  Dm: [0.5, 3],
  n: [1, 2],
  Lmm: [2, 40],
}

/* Khoảng vân (mm) */
export const fringeSpacing = (lambdaNm, { aMm, Dm, n = 1 }) => (lambdaNm * Dm) / (1000 * aMm * n)

/* Cường độ chuẩn hoá tại toạ độ x (mm) với khoảng vân i */
export const intensity = (x, i) => {
  const c = Math.cos((Math.PI * x) / i)
  return c * c
}

/* Các bức xạ tạo nên hình giao thoa theo chế độ đang chọn */
export function components(params) {
  if (params.mode === 'white') {
    const out = []
    for (let l = VIOLET_NM; l <= RED_NM; l += 10) out.push(l)
    return out
  }
  if (params.mode === 'two') return [params.lambdaNm, params.lambda2Nm]
  return [params.lambdaNm]
}

/* ── Màu của bước sóng (380–760 nm) → [r, g, b] trong [0, 1] ──
   Thuật toán Dan Bruton, có giảm sáng ở hai đầu phổ (mắt kém nhạy). */
export function wavelengthToRGB(nm) {
  let r = 0, g = 0, b = 0
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1 }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1 }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20 }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1 }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65 }
  else if (nm <= 780) { r = 1 }
  let f = 1
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40
  else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80
  const gm = v => (v <= 0 ? 0 : Math.pow(v * f, 0.8))
  return [gm(r), gm(g), gm(b)]
}

export const rgbCss = ([r, g, b], alpha = 1) =>
  `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`

/* Tô màu một điểm trên màn: cộng màu các bức xạ theo cường độ.
   Ánh sáng trắng chuẩn hoá theo tổng màu ⇒ vân trung tâm trắng, hai bên viền tím trong – đỏ ngoài. */
export function makeColorAt(params) {
  const lams = components(params)
  const cols = lams.map(wavelengthToRGB)
  const is = lams.map(l => fringeSpacing(l, params))
  let norm = [1, 1, 1]
  if (params.mode === 'white') {
    norm = [0, 0, 0]
    cols.forEach(c => { norm[0] += c[0]; norm[1] += c[1]; norm[2] += c[2] })
  }
  return x => {
    let r = 0, g = 0, b = 0
    for (let j = 0; j < lams.length; j++) {
      const I = params.oneSlit ? ONE_SLIT_I : intensity(x, is[j])
      r += cols[j][0] * I; g += cols[j][1] * I; b += cols[j][2] * I
    }
    return [Math.min(1, r / norm[0]), Math.min(1, g / norm[1]), Math.min(1, b / norm[2])]
  }
}

/* Tên màu thường gọi của một bước sóng */
export function colorName(nm) {
  if (nm < 425) return 'tím'
  if (nm < 450) return 'chàm'
  if (nm < 495) return 'lam'
  if (nm < 570) return 'lục'
  if (nm < 590) return 'vàng'
  if (nm < 625) return 'cam'
  return 'đỏ'
}

/* Độ lệch giữa hai sóng tới M, tính theo số bước sóng: n·δ/λ (δ = a·x/D) */
export const cyclesAt = (x, lambdaNm, params) => ((params.n || 1) * pathDiffNm(x, params)) / lambdaNm

/* Loại vân tại x (mm): sáng bậc k, tối thứ m, hay nằm giữa */
export function fringeAt(x, i, tol = 0.06) {
  const u = Math.abs(x) / i
  const kb = Math.round(u)
  if (Math.abs(u - kb) <= tol) return { type: 'bright', k: kb, u }
  const md = Math.floor(u) + 1               // vân tối thứ m nằm ở (m − ½)·i
  if (Math.abs(u - (md - 0.5)) <= tol) return { type: 'dark', k: md, u }
  return { type: 'between', k: Math.floor(u), u }
}

/* Số vân sáng / tối quan sát được trên vùng giao thoa rộng L (mm), đối xứng qua vân trung tâm */
export function countInField(Lmm, i) {
  const h = Lmm / 2 / i
  const e = 1e-9
  return { bright: 2 * Math.floor(h + e) + 1, dark: 2 * Math.floor(h + 0.5 + e) }
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a)

/* Vân trùng của hai bức xạ: k₁λ₁ = k₂λ₂ (λ làm tròn tới nm).
   Trả về bậc nhỏ nhất (k₁, k₂), vị trí vân trùng đầu tiên và số vân sáng đơn sắc giữa hai vân trùng liên tiếp. */
export function coincidence(params) {
  const l1 = Math.round(params.lambdaNm)
  const l2 = Math.round(params.lambda2Nm)
  if (l1 === l2) return { same: true }
  const g = gcd(l1, l2)
  const k1 = l2 / g
  const k2 = l1 / g
  const i1 = fringeSpacing(l1, params)
  const i2 = fringeSpacing(l2, params)
  return { same: false, k1, k2, i1, i2, x: k1 * i1, between: (k1 - 1) + (k2 - 1), between1: k1 - 1, between2: k2 - 1 }
}

/* Bề rộng quang phổ bậc k của ánh sáng trắng (mm) */
export const spectrumWidth = (k, params) =>
  k * (fringeSpacing(RED_NM, params) - fringeSpacing(VIOLET_NM, params))

/* Các bức xạ trong phổ khả kiến cho vân sáng / vân tối tại x (mm):
   sáng: λ = a·x·n·1000 / (k·D) ; tối: λ = a·x·n·1000 / ((k − ½)·D) */
export function radiationsAt(x, params, kind = 'bright') {
  const X = Math.abs(x)
  if (X < 1e-9) return []
  const base = (params.aMm * X * (params.n || 1) * 1000) / params.Dm
  const out = []
  for (let k = 1; k < 400; k++) {
    const div = kind === 'bright' ? k : k - 0.5
    const l = base / div
    if (l < VIOLET_NM - 1e-9) break
    if (l <= RED_NM + 1e-9) out.push({ k, lambdaNm: l })
  }
  return out
}

/* Hiệu đường đi tại x (mm): δ = a·x/D, đổi ra nm. Hiệu quang trình trong môi trường n là n·δ. */
export const pathDiffNm = (x, { aMm, Dm }) => (aMm * x * 1000) / Dm

/* Định dạng số kiểu Việt Nam */
export const vn = (v, d = 2) => (Math.abs(v) < 5 * 10 ** -(d + 2) ? 0 : v).toFixed(d).replace('.', ',')
/* Số trong công thức KaTeX (dấu phẩy thập phân không bị giãn cách) */
export const tx = (v, d = 2) => vn(v, d).replace(',', '{,}')
/* Gọn: bỏ số 0 thừa ở cuối */
export const vnShort = (v, d = 3) => {
  const s = v.toFixed(d).replace(/\.?0+$/, '')
  return (s === '-0' ? '0' : s).replace('.', ',')
}

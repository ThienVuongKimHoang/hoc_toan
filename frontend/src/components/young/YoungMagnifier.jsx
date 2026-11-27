import React, { useEffect, useState } from 'react'
import {
  cyclesAt, pathDiffNm, wavelengthToRGB, rgbCss, colorName, radiationsAt, vn,
} from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   "Kính lúp tại điểm M": giải thích VÌ SAO có vân sáng / tối.
   Hai sóng từ S₁ và S₂ tới M đi quãng đường chênh nhau δ = a·x/D.
   Chênh nguyên lần bước sóng → đỉnh gặp đỉnh → tăng cường (sáng);
   chênh nửa bước sóng → đỉnh gặp hõm → triệt tiêu (tối).
   Màu nét: S₁ vàng, S₂ xanh — trùng màu hai đường d₁, d₂ trên sơ đồ.
───────────────────────────────────────────────────────────── */

export const PATH_COLORS = { s1: '#fbbf24', s2: '#38bdf8', sum: '#f8fafc' }

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* Pha chạy chậm cho sóng "sống" — dừng khi người dùng muốn giảm chuyển động */
function usePhase(active) {
  const [ph, setPh] = useState(0)
  useEffect(() => {
    if (!active || reduced()) return undefined
    let raf = 0
    let last = performance.now()
    const tick = now => {
      setPh(p => (p + ((now - last) / 1000) * 2.2) % (Math.PI * 2))
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return ph
}

function wavePath(w, yMid, amp, shift, periods = 2.5, step = 3) {
  let d = ''
  for (let x = 0; x <= w; x += step) {
    const y = yMid - amp * Math.sin((2 * Math.PI * periods * x) / w - shift)
    d += `${x ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

/* Phân loại theo độ lệch (đơn vị bước sóng) */
function judge(c) {
  const frac = c - Math.round(c)            // ∈ [−½, ½]
  const I = Math.cos(Math.PI * c) ** 2
  if (Math.abs(frac) < 0.08) return { kind: 'bright', I, frac, word: 'sáng' }
  if (Math.abs(frac) > 0.42) return { kind: 'dark', I, frac, word: 'tối' }
  return { kind: 'mid', I, frac, word: 'mờ' }
}

/* Ánh sáng trắng: 3 màu đại diện + các bức xạ cho vân sáng đúng tại M (để thấy màu nào "thắng" ở đó) */
function lambdasOf(params, x) {
  if (params.mode === 'two') return [params.lambdaNm, params.lambda2Nm]
  if (params.mode !== 'white') return [params.lambdaNm]
  const out = [450, 550, 650]
  if (!params.oneSlit) {
    radiationsAt(x, params, 'bright').forEach(r => {
      const l = Math.round(r.lambdaNm)
      const k = out.findIndex(o => Math.abs(o - l) < 20)
      if (k >= 0) out[k] = l; else out.push(l)
    })
  }
  return out.sort((a, b) => a - b)
}

export default function YoungMagnifier({ params, x, hint = 'Bấm (hoặc rê chuột) vào một điểm trên màn để soi.', guided = false }) {
  const g = guided ? ' is-guided' : ''
  const ph = usePhase(x != null)
  if (x == null) {
    return (
      <section className={`young-mag is-empty${g}`} aria-label="Kính lúp tại điểm M">
        <h3 className="mp-sec-title">Kính lúp tại điểm M</h3>
        <p className="young-note">{hint}</p>
      </section>
    )
  }
  const one = !!params.oneSlit
  const lams = lambdasOf(params, x)
  const delta = Math.abs(pathDiffNm(x, params))     // nm
  const W = 280

  /* Một bức xạ: vẽ chi tiết 3 dải — sóng S₁, sóng S₂, sóng tổng */
  if (lams.length === 1) {
    const c = cyclesAt(Math.abs(x), lams[0], params)
    const j = judge(c)
    const shift = 2 * Math.PI * c
    // sin(θ) + sin(θ − 2πc) = 2cos(πc)·sin(θ − πc): giữ dấu để sóng tổng đúng pha
    const sumAmp = one ? 1.1 : 2 * Math.cos(Math.PI * c)
    const sumDraw = Math.sign(sumAmp || 1) * Math.max(0.6, Math.abs(sumAmp) * 10)
    const sumShift = ph + Math.PI * c
    const title = one
      ? 'Chỉ có một sóng tới M — không có sóng thứ hai để chồng lên'
      : j.kind === 'bright' ? 'Đỉnh gặp đỉnh → hai sóng tăng cường → VÂN SÁNG'
        : j.kind === 'dark' ? 'Đỉnh gặp hõm → hai sóng triệt tiêu → VÂN TỐI'
          : `Lệch một phần → cộng chưa trọn → sáng mờ (${Math.round(j.I * 100)}% độ sáng)`
    return (
      <section className={`young-mag young-mag--${one ? 'one' : j.kind}${g}`} aria-label="Kính lúp tại điểm M">
        <h3 className="mp-sec-title">Kính lúp tại điểm M <small>x = {vn(x, 2)} mm</small></h3>
        <svg viewBox={`0 0 ${W} 150`} className="young-mag-svg" role="img" aria-label={title}>
          <g>
            <text x="0" y="12" className="young-mag-lbl" fill={PATH_COLORS.s1}>Sóng từ S₁ (đi đường d₁)</text>
            <path d={wavePath(W, 30, 11, ph)} stroke={PATH_COLORS.s1} />
          </g>
          {!one && (
            <g>
              <text x="0" y="57" className="young-mag-lbl" fill={PATH_COLORS.s2}>Sóng từ S₂ (đi đường d₂ dài hơn)</text>
              <path d={wavePath(W, 75, 11, ph + shift)} stroke={PATH_COLORS.s2} />
            </g>
          )}
          <g>
            <text x="0" y={one ? 57 : 102} className="young-mag-lbl" fill={PATH_COLORS.sum}>Tổng hai sóng tại M</text>
            <line x1="0" x2={W} y1={one ? 75 : 128} y2={one ? 75 : 128} className="young-mag-zero" />
            <path d={wavePath(W, one ? 75 : 128, sumDraw, one ? ph : sumShift)} stroke={PATH_COLORS.sum} strokeWidth="2.6" />
          </g>
        </svg>
        <div className="young-mag-verdict">{title}</div>
        {!one && (
          <p className="young-note">
            Đường d₂ dài hơn d₁ một đoạn <b>δ = {vn(delta / 1000, 3)} µm</b> = <b>{vn(c, 2)} bước sóng</b>
            {Math.abs((params.n || 1) - 1) > 1e-9 ? ' (tính theo bước sóng trong môi trường λ/n)' : ''}.
            {' '}Chênh đúng số nguyên lần bước sóng thì sáng, chênh thêm nửa bước sóng thì tối.
          </p>
        )}
      </section>
    )
  }

  /* Nhiều bức xạ: mỗi màu một dòng — sóng tổng + độ sáng */
  const rows = lams.map(l => {
    const c = cyclesAt(Math.abs(x), l, params)
    const j = judge(c)
    return { l, c, j, amp: one ? 0.5 : Math.cos(Math.PI * c) }
  })
  return (
    <section className={`young-mag${g}`} aria-label="Kính lúp tại điểm M">
      <h3 className="mp-sec-title">Kính lúp tại điểm M <small>x = {vn(x, 2)} mm</small></h3>
      <div className="young-mag-rows">
        {rows.map(r => {
          const col = rgbCss(wavelengthToRGB(r.l))
          return (
            <div key={r.l} className="young-mag-row">
              <span className="young-mag-name"><i className="young-swatch" style={{ background: col }} />{colorName(r.l)} <small>{vn(r.l / 1000, 2)} µm</small></span>
              <svg viewBox="0 0 120 28" className="young-mag-mini" aria-hidden="true">
                <line x1="0" x2="120" y1="14" y2="14" className="young-mag-zero" />
                <path d={wavePath(120, 14, Math.sign(r.amp || 1) * Math.max(0.5, Math.abs(r.amp) * 11), ph + Math.PI * r.c, 2, 2)} stroke={col} strokeWidth="2" />
              </svg>
              <span className={`young-mag-word is-${one ? 'mid' : r.j.kind}`}>{one ? 'đều' : r.j.word}</span>
            </div>
          )
        })}
      </div>
      <p className="young-note">
        {one
          ? 'Chỉ còn một khe nên mọi màu đều sáng đều, không có vân.'
          : `Cùng một điểm M nhưng mỗi màu có bước sóng khác nhau, nên độ chênh δ = ${vn(delta / 1000, 3)} µm ứng với số bước sóng khác nhau: màu này sáng, màu kia tối — vì vậy vân có viền màu.`}
      </p>
    </section>
  )
}

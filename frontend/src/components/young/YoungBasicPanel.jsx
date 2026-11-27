import React from 'react'
import MathText from '../MathText.jsx'
import YoungMagnifier from './YoungMagnifier.jsx'
import { fringeSpacing, colorName, spectrumWidth, vn } from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   Bảng bên phải ở chế độ Cơ bản: nói bằng lời thường thay vì bảng số.
   - "Em quan sát được gì?" — vài câu nhận xét theo thông số hiện tại
   - So sánh khoảng vân với bề dày tờ giấy (~0,1 mm) cho dễ hình dung
   - Kính lúp tại điểm M — giải thích vì sao sáng / tối
───────────────────────────────────────────────────────────── */

const IcoCollapse = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6l6 6-6 6M5 6l6 6-6 6" /></svg>
)

const PAPER_MM = 0.1
const paper = mm => {
  const n = mm / PAPER_MM
  return n < 1.5 ? 'cỡ bề dày một tờ giấy' : `cỡ ${Math.round(n)} tờ giấy chồng lên nhau`
}

function observations(params) {
  if (params.oneSlit) {
    return [
      { tone: 'warn', text: 'Chỉ còn một khe sáng: KHÔNG còn vạch sáng – tối, màn chỉ sáng đều và mờ hơn.' },
      { text: 'Giao thoa cần hai nguồn sóng chồng lên nhau. Bỏ chọn "Che khe S₂" để thấy lại các vân.' },
    ]
  }
  if (params.mode === 'white') {
    return [
      { text: 'Vạch chính giữa màu TRẮNG: tại đó mọi màu đều sáng.' },
      { text: 'Hai bên là các dải cầu vồng: màu tím ở phía trong, màu đỏ ở phía ngoài.' },
      { text: `Dải màu đầu tiên rộng khoảng ${vn(spectrumWidth(1, params), 2)} mm. Ra xa hơn các dải chồng lên nhau nên nhòe dần.` },
    ]
  }
  const i = fringeSpacing(params.lambdaNm, params)
  return [
    { text: 'Trên màn có các vạch sáng – tối xen kẽ và cách đều nhau.' },
    { strong: true, text: `Hai vạch sáng liền nhau cách nhau ${vn(i, 2)} mm — ${paper(i)}. Khoảng cách này gọi là khoảng vân i.` },
    { text: `Ánh sáng màu ${colorName(params.lambdaNm)} (λ = ${vn(params.lambdaNm / 1000, 2)} µm). Càng về phía đỏ, bước sóng càng dài, vân càng thưa.` },
  ]
}

export default function YoungBasicPanel({ params, markX, onCollapse, guideHi = [] }) {
  const obs = observations(params)
  return (
    <aside className="mp young-mp young-basic" aria-label="Em quan sát được gì">
      <header className="mp-head">
        <div className="mp-head-row">
          <h2 className="mp-title">Em quan sát được gì?</h2>
          {onCollapse && <button className="mp-icon-btn" onClick={onCollapse} title="Thu gọn" aria-label="Thu gọn"><IcoCollapse /></button>}
        </div>
      </header>
      <div className="mp-body">
        <ul className="young-obs">
          {obs.map((o, k) => <li key={k} className={`${o.strong ? 'is-strong' : ''}${o.tone ? ` is-${o.tone}` : ''}`}>{o.text}</li>)}
        </ul>

        {!params.oneSlit && (
          <section className="young-rule">
            <div className="young-rule-f"><MathText text="$i = \dfrac{\lambda \cdot D}{a}$" /></div>
            <div className="young-rule-words">khoảng vân = bước sóng × khoảng cách tới màn ÷ khoảng cách hai khe</div>
          </section>
        )}

        <YoungMagnifier params={params} x={markX} guided={guideHi.includes('magnifier')} />
      </div>
    </aside>
  )
}

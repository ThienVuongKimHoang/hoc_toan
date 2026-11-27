import React, { useEffect, useState } from 'react'
import MathText from '../MathText.jsx'
import { fringeSpacing } from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   "Khám phá từng bước": mỗi bước dựng sẵn thí nghiệm (setup), hỏi học sinh
   dự đoán trước, rồi mới cho chạy thay đổi (action) để tự thấy kết quả.
   setup / action là phần thông số cần đổi; page tự chuyển dần cho mắt kịp theo.
───────────────────────────────────────────────────────────── */

const BASE = { mode: 'mono', lambdaNm: 650, aMm: 1, Dm: 2, n: 1, oneSlit: false }
const iOf = p => fringeSpacing(p.mode === 'white' ? 550 : p.lambdaNm, p)

export const TOUR = [
  {
    title: 'Chiếu laser qua hai khe hẹp',
    body: 'Một tia laser đỏ chiếu vào tấm bìa có hai khe rất hẹp, cách nhau 1 mm. Sau tấm bìa 2 m là màn ảnh.',
    question: 'Theo em, trên màn sẽ thấy gì?',
    choices: ['Hai chấm sáng, ứng với hai khe', 'Nhiều vạch sáng – tối xen kẽ', 'Một vệt sáng đều'],
    answer: 1,
    setup: { ...BASE },
    view: 'lab',
    explain: 'Ánh sáng đi qua hai khe chồng lên nhau trên màn: có chỗ chúng tăng cường nhau (vạch sáng), có chỗ triệt tiêu nhau (vạch tối). Hiện tượng này gọi là giao thoa ánh sáng.',
    guide: [
      { set: { ...BASE }, view: 'lab', hi: ['source'], caption: 'Ánh sáng laser đi tới tấm bìa…' },
      { hi: ['slits'], caption: '…và lọt qua HAI khe hẹp S₁, S₂. Mỗi khe trở thành một nguồn sáng nhỏ.' },
      { hi: ['cone'], caption: 'Ánh sáng từ hai khe toả rộng ra và CHỒNG LÊN NHAU trên màn — không đi thẳng thành hai chấm.' },
      { hi: ['board', 'spacing'], caption: 'Chỗ hai sóng tăng cường → vạch sáng; chỗ triệt tiêu → vạch tối. Kết quả: nhiều vạch xen kẽ, cách đều nhau.', wait: 3400 },
    ],
  },
  {
    title: 'Nếu che bớt một khe?',
    body: 'Dán băng dính che khe S₂, chỉ để ánh sáng đi qua khe S₁.',
    question: 'Các vạch sáng – tối sẽ thế nào?',
    choices: ['Vẫn y như cũ', 'Biến mất, màn chỉ sáng đều', 'Màn tối hẳn'],
    answer: 1,
    setup: { ...BASE },
    action: { oneSlit: true },
    view: 'lab',
    explain: 'Chỉ còn một nguồn sáng thì không có sóng thứ hai để chồng lên, nên không còn vân. Muốn có giao thoa phải có HAI nguồn sóng kết hợp.',
    guide: [
      { set: { ...BASE }, view: 'lab', hi: ['board'], caption: 'Mở cả hai khe: trên màn có các vạch sáng – tối.' },
      { set: { oneSlit: true }, hi: ['slits'], caption: 'Che khe S₂ — chỉ còn MỘT nguồn sáng…' },
      { hi: ['board'], caption: '…các vạch biến mất, màn chỉ sáng đều và mờ hơn.' },
      { set: { oneSlit: false }, hi: ['slits', 'board'], caption: 'Mở lại S₂: vân xuất hiện trở lại.', wait: 1900 },
      { set: { oneSlit: true }, hi: ['slits', 'board'], caption: 'Che lại: vân mất. Giao thoa cần HAI nguồn sóng chồng lên nhau.', wait: 3200 },
    ],
  },
  {
    title: 'Vì sao chỗ sáng, chỗ tối?',
    body: 'Nhìn vào bên trong: từ hai khe tới cùng một điểm M trên màn, hai sóng đi hai quãng đường d₁, d₂ khác nhau. Kính lúp bên phải đang soi một vạch SÁNG.',
    question: 'Tại một vạch TỐI, hai sóng gặp nhau thế nào?',
    choices: ['Đỉnh sóng gặp đỉnh sóng', 'Đỉnh sóng gặp hõm sóng', 'Hai sóng không gặp nhau'],
    answer: 1,
    setup: { ...BASE },
    pin: p => iOf(p),
    actionPin: p => iOf(p) / 2,
    view: 'inside',
    explain: 'Ở vạch tối, d₂ dài hơn d₁ đúng nửa bước sóng: đỉnh của sóng này gặp hõm của sóng kia nên chúng xoá nhau. Ở vạch sáng, chênh lệch là số nguyên lần bước sóng nên đỉnh gặp đỉnh.',
    guide: [
      { set: { ...BASE }, view: 'inside', pin: p => iOf(p), hi: ['paths', 'magnifier'], caption: 'M đang ở một vạch SÁNG: d₂ dài hơn d₁ đúng 1 bước sóng → đỉnh gặp đỉnh (xem Kính lúp bên phải).', wait: 3400 },
      { pinTo: p => iOf(p) / 2, ms: 3800, hi: ['paths', 'magnifier'], caption: 'Dời M dần sang vạch TỐI bên cạnh: độ chênh d₂ − d₁ giảm, sóng S₂ trượt dần so với sóng S₁…' },
      { hi: ['magnifier'], caption: 'Chênh đúng nửa bước sóng: đỉnh của sóng này gặp hõm của sóng kia → tổng bằng 0 → vạch TỐI.', wait: 3400 },
    ],
  },
  {
    title: 'Đổi màu ánh sáng',
    body: 'Ánh sáng màu khác nhau có bước sóng khác nhau: đỏ khoảng 0,65 µm, tím chỉ khoảng 0,41 µm.',
    question: 'Đổi laser đỏ sang laser tím, các vạch sẽ…',
    choices: ['Sít lại gần nhau', 'Thưa ra', 'Không đổi'],
    answer: 0,
    setup: { ...BASE },
    action: { lambdaNm: 410 },
    view: 'lab',
    explain: 'Bước sóng ngắn hơn thì khoảng cách giữa hai vạch sáng (khoảng vân) nhỏ hơn: khoảng vân tỉ lệ thuận với bước sóng λ.',
    guide: [
      { set: { ...BASE }, view: 'lab', hi: ['spacing'], caption: 'Laser đỏ (λ = 0,65 µm): khoảng cách giữa hai vạch sáng liền nhau là khoảng vân i.' },
      { tween: { lambdaNm: 410 }, ms: 3400, hi: ['spacing'], arrows: 'in', caption: 'Đổi dần sang tím: bước sóng ngắn lại → các vạch dồn về giữa…' },
      { hi: ['spacing'], caption: '…khoảng vân nhỏ hẳn: λ nhỏ → i nhỏ → vân SÍT lại (i tỉ lệ thuận với λ).', wait: 3200 },
    ],
  },
  {
    title: 'Hai khe xa nhau hơn',
    body: 'Thay tấm bìa có hai khe cách nhau 0,6 mm bằng tấm có hai khe cách nhau 1,5 mm.',
    question: 'Khi hai khe xa nhau hơn, các vạch sẽ…',
    choices: ['Sít lại gần nhau', 'Thưa ra', 'Không đổi'],
    answer: 0,
    setup: { ...BASE, lambdaNm: 600, aMm: 0.6 },
    action: { aMm: 1.5 },
    view: 'lab',
    explain: 'Khoảng vân tỉ lệ NGHỊCH với khoảng cách hai khe a: hai khe càng xa nhau, vân càng sít.',
    guide: [
      { set: { ...BASE, lambdaNm: 600, aMm: 0.6 }, view: 'lab', hi: ['slits', 'spacing'], caption: 'Hai khe cách nhau 0,6 mm. Để ý khoảng vân i trên màn.' },
      { tween: { aMm: 1.5 }, ms: 3400, hi: ['slits', 'spacing'], arrows: 'in', caption: 'Tăng dần khoảng cách hai khe a…' },
      { hi: ['spacing'], caption: '…các vạch dồn lại: a lớn → i nhỏ (i tỉ lệ NGHỊCH với a).', wait: 3200 },
    ],
  },
  {
    title: 'Đặt màn xa hơn',
    body: 'Giữ nguyên laser và hai khe, dời màn từ 1 m ra 3 m.',
    question: 'Khi màn ở xa hơn, các vạch sẽ…',
    choices: ['Sít lại gần nhau', 'Thưa ra', 'Không đổi'],
    answer: 1,
    setup: { ...BASE, lambdaNm: 600, Dm: 1 },
    action: { Dm: 3 },
    view: 'lab',
    explain: 'Ánh sáng từ hai khe toả ra như chiếc quạt: màn càng xa thì các vạch càng giãn ra. Khoảng vân tỉ lệ thuận với D.',
    guide: [
      { set: { ...BASE, lambdaNm: 600, Dm: 1 }, view: 'lab', hi: ['card', 'spacing'], caption: 'Màn cách hai khe 1 m. Để ý khoảng vân i.' },
      { tween: { Dm: 3 }, ms: 3400, hi: ['card', 'spacing'], arrows: 'out', caption: 'Dời màn ra xa dần: ánh sáng toả như chiếc quạt, càng xa càng rộng…' },
      { hi: ['spacing'], caption: '…các vạch giãn ra: D lớn → i lớn (i tỉ lệ thuận với D).', wait: 3200 },
    ],
  },
  {
    title: 'Ánh sáng trắng',
    body: 'Ánh sáng trắng (ánh sáng Mặt Trời, đèn sợi đốt) là hỗn hợp của mọi màu từ tím đến đỏ.',
    question: 'Thay laser bằng đèn ánh sáng trắng. Vạch chính giữa màn có màu gì?',
    choices: ['Màu trắng', 'Màu đỏ', 'Màu tím'],
    answer: 0,
    setup: { ...BASE, lambdaNm: 600, aMm: 0.5 },
    action: { mode: 'white' },
    view: 'lab',
    explain: 'Ở chính giữa, hai đường đi bằng nhau với MỌI màu, nên màu nào cũng sáng ở đó → cộng lại thành trắng. Ra xa hơn, mỗi màu sáng ở một chỗ khác nhau nên thấy các dải cầu vồng: tím ở trong, đỏ ở ngoài.',
    guide: [
      { set: { ...BASE, lambdaNm: 650, aMm: 0.5 }, view: 'lab', hi: ['center'], caption: 'Chỉ ánh sáng đỏ: vạch sáng chính giữa nằm ở x = 0.' },
      { tween: { lambdaNm: 530 }, ms: 1800, hi: ['center'], caption: 'Ánh sáng lục: vạch giữa VẪN ở x = 0, các vạch khác dời chỗ.' },
      { tween: { lambdaNm: 440 }, ms: 1800, hi: ['center'], caption: 'Ánh sáng lam: vạch giữa cũng ở x = 0.' },
      { set: { mode: 'white' }, hi: ['center', 'board'], caption: 'Mọi màu đều sáng ở giữa → chồng lại thành vạch TRẮNG. Ra ngoài, mỗi màu sáng một chỗ → dải cầu vồng.', wait: 3600 },
    ],
  },
  {
    title: 'Tổng kết',
    body: 'Khoảng cách giữa hai vạch sáng liền nhau gọi là khoảng vân i:',
    formula: '$i = \\dfrac{\\lambda D}{a}$',
    bullets: [
      'λ lớn (về phía đỏ) → vân thưa',
      'D lớn (màn xa) → vân thưa',
      'a lớn (hai khe xa nhau) → vân sít',
      'Vân sáng: x = k·i ; vân tối: x = (k − ½)·i',
    ],
    setup: { ...BASE, lambdaNm: 600 },
    view: 'lab',
  },
]

export default function YoungTour({ step, onStep, onSetup, onAction, onGuide, onClose, params }) {
  const s = TOUR[step]
  const [picked, setPicked] = useState(null)

  /* Vào bước mới: dựng thí nghiệm theo setup */
  useEffect(() => {
    setPicked(null)
    onSetup(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const answered = picked != null
  const choose = i => {
    if (answered) return
    setPicked(i)
    // Đúng: chạy thay đổi luôn. Sai / bỏ qua: chạy hoạt họa chỉ từng chỗ trên hình
    if (i === s.answer || !s.guide) onAction(s)
    else onGuide(s)
  }
  const last = step === TOUR.length - 1

  return (
    <div className="young-tour" role="dialog" aria-label="Khám phá từng bước">
      <div className="young-tour-head">
        <span className="young-tour-step">Bước {step + 1}/{TOUR.length}</span>
        <div className="young-tour-dots" aria-hidden="true">
          {TOUR.map((_, i) => <i key={i} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} />)}
        </div>
        <button className="young-tour-x" onClick={onClose} aria-label="Thoát khám phá">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <h3 className="young-tour-title">{s.title}</h3>
      <p className="young-tour-body">{s.body}</p>
      {s.formula && <div className="young-tour-formula"><MathText text={s.formula} /></div>}
      {s.bullets && <ul className="young-tour-bullets">{s.bullets.map(b => <li key={b}>{b}</li>)}</ul>}

      {s.question && (
        <>
          <div className="young-tour-q">{s.question}</div>
          <div className="young-tour-choices">
            {s.choices.map((c, i) => {
              const cls = !answered ? '' : i === s.answer ? ' is-right' : i === picked ? ' is-wrong' : ' is-dim'
              return (
                <button key={c} className={`young-tour-choice${cls}`} onClick={() => choose(i)} disabled={answered}>
                  <span>{String.fromCharCode(65 + i)}</span>{c}
                </button>
              )
            })}
          </div>
          {!answered && <p className="young-tour-hint">Chọn dự đoán của em — thí nghiệm sẽ chạy ngay sau đó.</p>}
          {answered && (
            <div className={`young-tour-explain${picked === s.answer ? ' is-right' : picked < 0 ? ' is-neutral' : ''}`}>
              <b>{picked === s.answer ? 'Chính xác! ' : picked < 0 ? `Đáp án: ${s.choices[s.answer]}. ` : `Chưa đúng — đáp án là "${s.choices[s.answer]}". Xem hoạt họa trên hình nhé. `}</b>{s.explain}
            </div>
          )}
        </>
      )}

      {answered && s.guide && (
        <button className="young-tour-replay" onClick={() => onGuide(s)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 001.5.86l12-7.5a1 1 0 000-1.72l-12-7.5A1 1 0 007 4.5z" /></svg>
          {picked === s.answer ? 'Xem hoạt họa giải thích' : 'Xem lại hoạt họa'}
        </button>
      )}

      <div className="young-tour-nav">
        <button onClick={() => onStep(step - 1)} disabled={step === 0}>← Trước</button>
        {s.question && !answered && <button className="is-ghost" onClick={() => choose(-1)}>Xem luôn đáp án</button>}
        {last
          ? <button className="is-primary" onClick={onClose}>Tự khám phá tiếp</button>
          : <button className="is-primary" onClick={() => onStep(step + 1)} disabled={s.question && !answered}>Tiếp →</button>}
      </div>
      {params.mode === 'mono' && !params.oneSlit && <div className="young-tour-foot">Khoảng vân hiện tại: i = {fringeSpacing(params.lambdaNm, params).toFixed(2).replace('.', ',')} mm</div>}
    </div>
  )
}

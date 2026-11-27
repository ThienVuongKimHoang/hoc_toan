import React from 'react'

/* ─────────────────────────────────────────────────────────────
   Nhân vật sóc hoạt hình (chibi: đầu to, mắt to, viền đậm) — vẽ bằng SVG
   để cử động được từng bộ phận.
   Toạ độ cục bộ: gốc ở giữa hai bàn chân trên mặt dốc, trục -y hướng ra khỏi mặt dốc,
   sóc quay mặt sang TRÁI (-x) — phía có vật. Bàn tay chạm mặt vật tại x = -HAND_REACH.
───────────────────────────────────────────────────────────── */

export const HAND_REACH = 20          // khoảng cách (đơn vị cục bộ) từ chân sóc tới mặt vật
export const BALL_R = 12              // bán kính khi cuộn tròn

const FUR = '#e08a3c'
const FUR_DARK = '#b8642a'
const BELLY = '#fde3b8'
const TAIL = '#cf7330'
const TAIL_LIGHT = '#f2a65e'
const INK = '#3b2414'
const LINE = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' }

/* Mắt + miệng (mắt to ở (-10,-33), miệng quanh (-16,-23)) */
function Face({ mood }) {
  switch (mood) {
    case 'strain':       // nhắm nghiền "> <", nghiến răng
      return (
        <g {...LINE} fill="none">
          <path d="M-13.5 -36 l4 2.4 l-4 2.4" strokeWidth="1.8" />
          <rect x="-19" y="-24.5" width="6" height="3.2" rx="1" fill="#fff" />
          <path d="M-17 -24.5 v3.2 M-15 -24.5 v3.2" strokeWidth="0.9" />
        </g>
      )
    case 'tired':        // mắt xoắn, miệng há, lưỡi thè
      return (
        <g>
          <ellipse cx="-10" cy="-33" rx="4" ry="4.6" fill="#fff" {...LINE} />
          <path d="M-10 -33 m-0.5 0 a0.5 0.5 0 1 1 1 0 a1.4 1.4 0 1 1 -2.5 0 a2.3 2.3 0 1 1 4.2 0" fill="none" stroke={INK} strokeWidth="1.1" />
          <ellipse cx="-16" cy="-22.5" rx="2.6" ry="3" fill={INK} />
          <ellipse cx="-16.3" cy="-21" rx="1.6" ry="1.2" fill="#f27b8a" />
        </g>
      )
    case 'happy':        // mắt cười híp, miệng cười
      return (
        <g {...LINE} fill="none" strokeWidth="1.8">
          <path d="M-13.5 -32.5 q3 -3.6 6 0" />
          <path d="M-19 -24 q3 3 6 0" />
        </g>
      )
    case 'dizzy':
      return (
        <g {...LINE} strokeWidth="1.6">
          <path d="M-13 -36 l5 5 M-8 -36 l-5 5" />
        </g>
      )
    default:             // mắt tròn to có chấm sáng
      return (
        <g>
          <ellipse cx="-10" cy="-33" rx="4" ry="4.8" fill="#fff" {...LINE} />
          <circle cx="-11.2" cy="-32.4" r="2.6" fill={INK} />
          <circle cx="-12.1" cy="-33.8" r="0.9" fill="#fff" />
        </g>
      )
  }
}

/* Đuôi xù cuộn tròn kiểu hoạt hình */
const Tail = ({ wag = 0 }) => (
  <g transform={`rotate(${wag} 6 -8)`}>
    <path d="M5 -7 C 22 -6, 30 -26, 24 -38 C 19 -48, 6 -48, 5 -39 C 4 -32, 13 -31, 14 -25 C 15 -18, 9 -15, 5 -7 Z"
      fill={TAIL} {...LINE} />
    <path d="M10 -12 C 19 -15, 24 -27, 20 -35" fill="none" stroke={TAIL_LIGHT} strokeWidth="3" strokeLinecap="round" />
  </g>
)

const Paw = ({ x, y }) => <circle cx={x} cy={y} r="2.6" fill={FUR_DARK} {...LINE} strokeWidth="1.2" />

/* Tư thế: 'push' (gồng đẩy) | 'relax' (đứng nghỉ) | 'carry' (giơ tay bê đồ trên đầu) */
export function Squirrel({ pose = 'push', mood = 'strain', className = '' }) {
  const push = pose === 'push'
  const lean = push ? -18 : 3
  return (
    <g className={className}>
      {/* chân */}
      <g stroke={INK} strokeWidth="5.2" strokeLinecap="round" fill="none">
        <path d={push ? 'M3 -7 L 11 -1' : 'M3 -7 L 4 -1'} />
        <path d={push ? 'M-3 -7 L -5 -1' : 'M-3 -7 L -4 -1'} />
      </g>
      <g stroke={FUR_DARK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d={push ? 'M3 -7 L 11 -1' : 'M3 -7 L 4 -1'} />
        <path d={push ? 'M-3 -7 L -5 -1' : 'M-3 -7 L -4 -1'} />
      </g>
      <ellipse cx={push ? 12.5 : 5} cy="-0.6" rx="4" ry="2" fill={FUR_DARK} {...LINE} strokeWidth="1.2" />
      <ellipse cx={push ? -6.5 : -5.5} cy="-0.6" rx="4" ry="2" fill={FUR_DARK} {...LINE} strokeWidth="1.2" />

      <g transform={`rotate(${lean} 0 -6)`}>
        <Tail wag={push ? -6 : 8} />
        {/* thân */}
        <ellipse cx="0" cy="-14" rx="9" ry="10" fill={FUR} {...LINE} />
        <ellipse cx="-3" cy="-13" rx="5" ry="7" fill={BELLY} />
        {/* tai sau, đầu, tai trước */}
        <path d="M0 -41 L 4 -50 L 6.5 -39 Z" fill={FUR_DARK} {...LINE} />
        <circle cx="-6" cy="-31" r="12.5" fill={FUR} {...LINE} />
        <path d="M-12 -40 L -9.5 -50 L -3.5 -42 Z" fill={FUR} {...LINE} />
        <path d="M-10.3 -42 L -9.2 -47 L -6 -42.6 Z" fill="#f4a3a3" />
        {/* mõm, mũi, má */}
        <ellipse cx="-14" cy="-26.5" rx="6.2" ry="4.8" fill={BELLY} {...LINE} strokeWidth="1.2" />
        <ellipse cx="-19.6" cy="-28.4" rx="2.1" ry="1.7" fill={INK} />
        <circle cx="-5.5" cy="-25.5" r="2.4" fill="#f59aa0" opacity="0.7" />
        <Face mood={mood} />
      </g>

      {/* tay — vẽ trong hệ không nghiêng để bàn tay chạm đúng mặt vật */}
      {push ? (
        <>
          <g stroke={INK} strokeWidth="4.6" strokeLinecap="round" fill="none">
            <path d={`M-4 -19 L ${-HAND_REACH + 2} -21`} />
            <path d={`M-3 -15 L ${-HAND_REACH + 2} -15.5`} />
          </g>
          <g stroke={FUR_DARK} strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d={`M-4 -19 L ${-HAND_REACH + 2} -21`} />
            <path d={`M-3 -15 L ${-HAND_REACH + 2} -15.5`} />
          </g>
          <Paw x={-HAND_REACH + 1.5} y={-21} />
          <Paw x={-HAND_REACH + 1.5} y={-15.5} />
        </>
      ) : pose === 'carry' ? (
        /* Giơ hai tay lên quá đầu (bê đồ) — bàn tay ở (−8,−55) và (2,−56) */
        <>
          <g stroke={INK} strokeWidth="4.6" strokeLinecap="round" fill="none">
            <path d="M-5 -19 L -8 -54" /><path d="M2 -19 L 2 -55" />
          </g>
          <g stroke={FUR_DARK} strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M-5 -19 L -8 -54" /><path d="M2 -19 L 2 -55" />
          </g>
          <Paw x={-8} y={-55} />
          <Paw x={2} y={-56} />
        </>
      ) : (
        <>
          <g stroke={INK} strokeWidth="4.6" strokeLinecap="round" fill="none">
            <path d="M-4 -17 L -8 -9" /><path d="M3 -17 L 7 -10" />
          </g>
          <g stroke={FUR_DARK} strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M-4 -17 L -8 -9" /><path d="M3 -17 L 7 -10" />
          </g>
        </>
      )}

      {/* mồ hôi */}
      {push && (
        <g className="sq-sweat" fill="#7cc4f2" stroke="#2b7bb9" strokeWidth="0.8">
          <path d="M3 -47 q 2.2 4 0 6 q -2.2 -2 0 -6 Z" />
          <path d="M8 -41 q 2.2 4 0 6 q -2.2 -2 0 -6 Z" style={{ animationDelay: '0.45s' }} />
          {mood === 'tired' && <path d="M6 -51 q 2.2 4 0 6 q -2.2 -2 0 -6 Z" style={{ animationDelay: '0.2s' }} />}
        </g>
      )}
      {mood === 'tired' && (
        <g className="sq-puff" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" fill="none">
          <path d="M-24 -26 q -4 -1 -6 1" />
          <path d="M-24 -22 q -5 0 -7 3" />
        </g>
      )}
    </g>
  )
}

/* Sóc cuộn tròn lăn đi — xoay cả khối; ngôi sao chóng mặt vẽ riêng, không xoay */
export function SquirrelBall({ spin = 0, t = 0 }) {
  const r = BALL_R
  return (
    <g>
      <g transform={`rotate(${spin})`}>
        <circle r={r} fill={FUR} {...LINE} />
        <path d={`M ${-r * 0.15} ${-r * 0.95} C ${r * 1.35} ${-r * 1.1}, ${r * 1.25} ${r * 0.85}, ${r * 0.1} ${r * 0.5} C ${-r * 0.45} ${r * 0.3}, ${-r * 0.1} ${-r * 0.35}, ${r * 0.4} ${-r * 0.1}`}
          fill="none" stroke={TAIL} strokeWidth="5" strokeLinecap="round" />
        <ellipse cx={-r * 0.35} cy={r * 0.25} rx={r * 0.38} ry={r * 0.3} fill={BELLY} />
        <g {...LINE} strokeWidth="1.4">
          <path d={`M ${-r * 0.6} ${-r * 0.3} l 3 3 m 0 -3 l -3 3`} />
          <path d={`M ${-r * 0.12} ${-r * 0.4} l 3 3 m 0 -3 l -3 3`} />
        </g>
        <path d={`M ${-r * 0.4} ${-r * 0.92} L ${-r * 0.15} ${-r * 1.45} L ${r * 0.12} ${-r * 0.88} Z`} fill={FUR} {...LINE} strokeWidth="1.2" />
      </g>
      {[0, 1, 2].map(i => {
        const ang = t * 6 + (i * 2 * Math.PI) / 3
        return (
          <path key={i} transform={`translate(${Math.cos(ang) * r * 1.1} ${-r * 1.4 + Math.sin(ang) * 3})`}
            d="M0 -3 L0.9 -0.9 L3 -0.9 L1.3 0.5 L1.9 2.7 L0 1.4 L-1.9 2.7 L-1.3 0.5 L-3 -0.9 L-0.9 -0.9 Z"
            fill="#facc15" stroke="#a16207" strokeWidth="0.6" />
        )
      })}
    </g>
  )
}

/* Sóc có xuất hiện không, và ở trạng thái nào.
   - Thả nhẹ (v0 = 0):  'hold' (gồng giữ) → 'tired' (hết hơi) → 'roll' (bị vật cuốn lăn); 'relax' nếu ma sát tự giữ được.
   - Đẩy lên (v0 < 0): 'pushReady' (chuẩn bị) → 'shove' (lấy đà đẩy) → 'pushFall' (hết sức, ngã lăn xuống dốc).
   - Ném xuống (v0 > 0) hoặc người dùng tự vuốt tay ném (flicked): không có sóc. */
export function squirrelMode({ params, t, playing, dragging, tired, show, slides, flicked = false }) {
  if (!show.squirrel || dragging || flicked) return 'none'
  const v0 = params.v0 ?? 0
  const x0 = params.x0 ?? 0
  if (v0 < -1e-9) {
    if (x0 <= 1e-9) return 'none'                 // ở đỉnh dốc mà đẩy lên thì vật rời dốc ngay
    if (tired) return 'shove'
    if (t <= 1e-9 && !playing) return 'pushReady'
    return 'pushFall'
  }
  if (v0 > 1e-9) return 'none'
  if (params.L - x0 < 0.8) return 'none'
  if (!slides) return 'relax'
  if (tired) return 'tired'
  if (t <= 1e-9 && !playing) return 'hold'
  return 'roll'
}

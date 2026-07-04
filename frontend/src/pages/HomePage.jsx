// HomePage.jsx — Trang chủ Trung tâm Ánh Sáng (thiết kế 1a — Nắng vàng)
// Nội dung load từ /api/site-content — super admin chỉnh sửa trong trang Quản trị.
import React, { useEffect, useRef, useState } from 'react'

// ====== Màu sắc & font ======
const C = {
  bg: '#FFFBF0',
  ink: '#2B2416',
  sub: '#6B5C3E',
  accent: '#F2A70C',
  accentDark: '#B8860B',
  badgeBg: '#FCEFD2',
  badgeText: '#8A6410',
  border: '#F0E4C8',
  dark: '#2B2416',
  darkSub: '#D8CCAE',
}
const DISPLAY = "'Baloo 2', 'Be Vietnam Pro', sans-serif"
const BODY = "'Be Vietnam Pro', sans-serif"

// Bấm số điện thoại → mở Zalo của trung tâm
const telHref = phone => 'https://zalo.me/' + String(phone || '').replace(/\D/g, '')

function Hero({ info }) {
  const dot = { width: 8, height: 8, borderRadius: '50%', background: C.accent, flex: 'none', transform: 'translateY(-1px)' }
  return (
    <div id="gioithieu" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 52, padding: '64px 48px 56px', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Toán · Lý · Hóa · Ngữ Văn', 'Tiếng Anh · IELTS'].map(t => (
            <span key={t} style={{ background: C.badgeBg, color: C.badgeText, fontSize: 13, fontWeight: 700, padding: '6px 13px', borderRadius: 999 }}>{t}</span>
          ))}
        </div>
        <h1 style={{ margin: 0, font: `800 52px/1.12 ${DISPLAY}`, textWrap: 'pretty' }}>{info.heroTitle}</h1>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: C.sub, maxWidth: '52ch', textWrap: 'pretty' }}>{info.heroDesc}</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#lienhe" className="hp-btn" style={{ background: C.ink, color: C.bg, fontWeight: 700, fontSize: 15.5, padding: '14px 26px', borderRadius: 999, textDecoration: 'none' }}>Đăng ký học thử miễn phí</a>
          {info.fb && (
            <a href={info.fb} target="_blank" rel="noopener noreferrer" className="hp-link" style={{ color: C.badgeText, fontWeight: 700, fontSize: 15, textDecoration: 'none', borderBottom: `2px solid ${C.accent}`, paddingBottom: 2 }}>Fanpage của trung tâm</a>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8, fontSize: 14.5, color: C.sub }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}><span style={dot} />{info.address}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}><span style={dot} />Mở lớp cả tuần, sáng – chiều – tối</div>
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {info.heroImage ? (
          <img src={info.heroImage} alt={`Lớp học tại ${info.name}`} className="hp-photo"
            style={{ width: '100%', maxWidth: 480, aspectRatio: '4/4.6', objectFit: 'cover', borderRadius: 28, boxShadow: '0 24px 48px -20px rgba(122,88,10,.4)' }} />
        ) : (
          <div style={{ width: '100%', maxWidth: 480, aspectRatio: '4/4.6', borderRadius: 28, transform: 'rotate(2deg)', boxShadow: '0 24px 48px -20px rgba(122,88,10,.4)', background: `linear-gradient(160deg, ${C.badgeBg}, ${C.accent}55)`, display: 'grid', placeItems: 'center', font: `800 72px ${DISPLAY}`, color: C.accentDark }}>
            ☀️
          </div>
        )}
        <div style={{ position: 'absolute', left: -8, bottom: 26, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: '14px 20px', boxShadow: '0 12px 28px -14px rgba(122,88,10,.35)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ font: `800 26px ${DISPLAY}`, color: C.accent }}>{info.heroBadge}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>{info.heroBadgeLabel}</div>
        </div>
      </div>
    </div>
  )
}

function Stats({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 4) || 1},1fr)`, gap: 16, padding: '0 48px 56px' }}>
      {stats.map((s, i) => (
        <div key={i} className="hp-card" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ font: `800 30px ${DISPLAY}`, color: C.accent }}>{s.value}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.sub }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Đội ngũ giáo viên — carousel tự chạy + điều khiển tay ── */
const PER_PAGE = 3
function Teachers({ teachers }) {
  const pages = Math.max(1, Math.ceil(teachers.length / PER_PAGE))
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => { if (page >= pages) setPage(0) }, [pages, page])
  useEffect(() => {
    if (paused || pages <= 1) return
    const t = setInterval(() => setPage(p => (p + 1) % pages), 4500)
    return () => clearInterval(t)
  }, [paused, pages])

  const arrow = {
    width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${C.border}`,
    background: '#fff', color: C.accentDark, fontSize: 18, fontWeight: 800,
    cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none',
    boxShadow: '0 4px 12px -6px rgba(122,88,10,.3)', transition: 'all .15s ease',
  }

  return (
    <div id="giaovien" style={{ padding: '56px 48px', background: '#fff', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 8px', font: `800 34px ${DISPLAY}` }}>Đội ngũ giáo viên</h2>
          <p style={{ margin: '0 0 28px', color: C.sub, fontSize: 15.5 }}>Thầy cô trực tiếp đứng lớp, không qua trợ giảng.</p>
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            <button style={arrow} className="hp-arrow" onClick={() => setPage(p => (p - 1 + pages) % pages)} aria-label="Trang trước">‹</button>
            <button style={arrow} className="hp-arrow" onClick={() => setPage(p => (p + 1) % pages)} aria-label="Trang sau">›</button>
          </div>
        )}
      </div>

      <div style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', width: `${pages * 100}%`, transform: `translateX(-${page * (100 / pages)}%)`, transition: 'transform .55s cubic-bezier(.4,0,.2,1)' }}>
          {Array.from({ length: pages }, (_, pi) => (
            <div key={pi} style={{ width: `${100 / pages}%`, display: 'grid', gridTemplateColumns: `repeat(${PER_PAGE},1fr)`, gap: 20, padding: '0 2px' }}>
              {teachers.slice(pi * PER_PAGE, pi * PER_PAGE + PER_PAGE).map((t, i) => (
                <div key={i} className="hp-card" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 22, padding: 26, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
                  {t.photo ? (
                    <img src={t.photo} alt={t.name} className="hp-teacher-avatar" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.badgeBg}` }} />
                  ) : (
                    <div style={{ width: 96, height: 96, borderRadius: '50%', background: C.badgeBg, display: 'grid', placeItems: 'center', font: `800 24px ${DISPLAY}`, color: C.badgeText }}>
                      {(t.name || '?').split(' ').pop().charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ font: `800 20px ${DISPLAY}` }}>{t.name}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.accentDark, marginTop: 2 }}>{t.subject}</div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.sub }}>{t.bio}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)} aria-label={`Trang ${i + 1}`}
              style={{ width: i === page ? 26 : 10, height: 10, borderRadius: 999, border: 'none', cursor: 'pointer', background: i === page ? C.accent : C.border, transition: 'all .3s ease', padding: 0 }} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Khóa học & học phí — popup tư vấn khi người dùng dừng lại quá 10 giây ── */
function Courses({ courses, info, onIdle10s }) {
  const secRef = useRef(null)
  const timerRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    const el = secRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !firedRef.current) {
        timerRef.current = setTimeout(() => { firedRef.current = true; onIdle10s?.() }, 10000)
      } else {
        clearTimeout(timerRef.current)
      }
    }, { threshold: 0.35 })
    obs.observe(el)
    return () => { obs.disconnect(); clearTimeout(timerRef.current) }
  }, [onIdle10s])

  const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 22, padding: 26, display: 'flex', flexDirection: 'column', gap: 10 }
  const fee = { marginTop: 'auto', font: `800 24px ${DISPLAY}`, color: C.accent }
  const per = { font: `600 13px ${BODY}`, color: C.sub }

  return (
    <div id="khoahoc" ref={secRef} style={{ padding: '56px 48px' }}>
      <h2 style={{ margin: '0 0 8px', font: `800 34px ${DISPLAY}` }}>Khóa học &amp; học phí</h2>
      <p style={{ margin: '0 0 28px', color: C.sub, fontSize: 15.5 }}>Học phí tham khảo, đã gồm tài liệu. Lớp tối đa 20 em.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
        {courses.map((c, i) => c.featured ? (
          <div key={i} className="hp-card hp-card--dark" style={{ ...card, background: C.dark, color: C.bg, border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ font: `800 19px ${DISPLAY}` }}>{c.name}</div>
              <span style={{ background: C.accent, color: C.dark, fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999 }}>NỔI BẬT</span>
            </div>
            <div style={{ fontSize: 14, color: C.darkSub, lineHeight: 1.6 }}>{c.desc}</div>
            <div style={fee}>{c.fee}<span style={{ ...per, color: C.darkSub }}> /tháng</span></div>
          </div>
        ) : (
          <div key={i} className="hp-card" style={card}>
            <div style={{ font: `800 19px ${DISPLAY}` }}>{c.name}</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{c.desc}</div>
            <div style={fee}>{c.fee}<span style={per}> /tháng</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Popup tư vấn (thay cho ô "Chưa biết chọn lớp nào?") ── */
function AdvicePopup({ info, onClose }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(43,36,22,.45)', zIndex: 1000, display: 'grid', placeItems: 'center', backdropFilter: 'blur(3px)', animation: 'hpFadeIn .25s ease' }}>
      <div style={{ background: C.bg, borderRadius: 26, padding: '38px 40px', maxWidth: 420, width: 'calc(100% - 48px)', textAlign: 'center', boxShadow: '0 30px 70px -20px rgba(43,36,22,.5)', border: `1px solid ${C.border}`, position: 'relative', animation: 'hpPopIn .3s cubic-bezier(.34,1.56,.64,1)' }}>
        <button onClick={onClose} aria-label="Đóng"
          style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.sub }}>✕</button>
        <div style={{ fontSize: 44, marginBottom: 10 }}>📞</div>
        <div style={{ font: `800 24px ${DISPLAY}`, color: C.ink, marginBottom: 10 }}>Chưa biết chọn lớp nào?</div>
        <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.65, color: C.sub }}>
          Gọi ngay cho trung tâm để được <strong>kiểm tra đầu vào và tư vấn miễn phí</strong> lộ trình phù hợp nhất.
        </p>
        <a href={telHref(info.phone)} target="_blank" rel="noopener noreferrer" className="hp-btn" style={{ display: 'inline-block', background: C.accent, color: '#fff', font: `800 18px ${BODY}`, padding: '14px 30px', borderRadius: 999, textDecoration: 'none', boxShadow: '0 10px 24px -8px rgba(242,167,12,.6)' }}>
          {info.phone}
        </a>
        <div style={{ marginTop: 14 }}>
          <a href="#lienhe" onClick={onClose} className="hp-link" style={{ color: C.badgeText, fontWeight: 700, fontSize: 14, textDecoration: 'none', borderBottom: `2px solid ${C.accent}`, paddingBottom: 2 }}>
            Hoặc để lại thông tin, trung tâm gọi lại →
          </a>
        </div>
      </div>
    </div>
  )
}

/* ── Lịch học trong tuần ── */
export const SCHEDULE_COLORS = {
  xanhla:    { bg: '#dcfce7', tx: '#15803d', bar: '#22c55e' },
  vang:      { bg: '#fef9c3', tx: '#a16207', bar: '#eab308' },
  cam:       { bg: '#ffedd5', tx: '#c2410c', bar: '#f97316' },
  tim:       { bg: '#f3e8ff', tx: '#7e22ce', bar: '#a855f7' },
  do:        { bg: '#fee2e2', tx: '#b91c1c', bar: '#ef4444' },
  xanhduong: { bg: '#cffafe', tx: '#0e7490', bar: '#06b6d4' },
  hong:      { bg: '#fce7f3', tx: '#be185d', bar: '#ec4899' },
  trang:     { bg: '#f6f2e7', tx: '#4b4230', bar: '#d3c7a5' },
}

/* Phân loại 1 lớp theo nhãn: KIDS | IELTS | TOEIC | 6..12 | null */
function classifyEntry(label) {
  const s = String(label || '').toLowerCase()
  if (s.includes('kids')) return 'KIDS'
  if (s.includes('ielts')) return 'IELTS'
  if (s.includes('toeic')) return 'TOEIC'
  // bỏ phần trong ngoặc + số phòng (P1..P5) + khung giờ để không nhầm với khối lớp
  const clean = s.replace(/\([^)]*\)/g, '').replace(/p\s*\d+/g, '').replace(/\d+h\d*/g, '')
  const m = clean.match(/(?:^|\D)(1[0-2]|[6-9])(?!\d)/)
  return m ? m[1] : null
}

const SCHEDULE_FILTERS = ['Tất cả', 'KIDS', '6', '7', '8', '9', '10', '11', '12', 'IELTS', 'TOEIC']

function Schedule({ schedule }) {
  const days = schedule?.days || []
  const slots = schedule?.slots || []
  const [filter, setFilter] = useState('Tất cả')
  if (!slots.length) return null

  const match = label => filter === 'Tất cả' || classifyEntry(label) === filter
  // đếm số buổi khớp bộ lọc
  const total = filter === 'Tất cả' ? null :
    slots.reduce((n, sl) => n + (sl.cells || []).reduce((m, cell) => m + (cell || []).filter(e => match(Array.isArray(e) ? e[0] : e?.label)).length, 0), 0)

  return (
    <div id="lichhoc" style={{ padding: '56px 48px', background: C.badgeBg }}>
      <h2 style={{ margin: '0 0 8px', font: `800 34px ${DISPLAY}` }}>Lịch học trong tuần</h2>
      {schedule.note && <p style={{ margin: '0 0 20px', color: C.sub, fontSize: 15.5 }}>{schedule.note}</p>}

      {/* Bộ lọc theo lớp */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: C.badgeText, marginRight: 4 }}>🔍 Tìm theo lớp:</span>
        {SCHEDULE_FILTERS.map(f => {
          const active = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)} className="hp-sched-filter"
              style={{
                border: `1.5px solid ${active ? C.accent : C.border}`,
                background: active ? C.accent : '#fff',
                color: active ? '#fff' : C.sub,
                fontWeight: 800, fontSize: 13, padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
                boxShadow: active ? '0 6px 16px -6px rgba(242,167,12,.6)' : 'none',
                transition: 'all .18s ease',
              }}>
              {f === 'KIDS' || f === 'IELTS' || f === 'TOEIC' || f === 'Tất cả' ? f : `Lớp ${f}`}
            </button>
          )
        })}
        {total !== null && (
          <span style={{ fontSize: 13, fontWeight: 700, color: total ? C.accentDark : '#b91c1c', marginLeft: 4 }}>
            {total ? `${total} buổi / tuần` : 'Không có buổi nào'}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 22, boxShadow: '0 18px 40px -22px rgba(122,88,10,.4)', border: `1px solid ${C.border}` }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1080, background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, background: C.ink, color: C.bg, font: `800 14px ${DISPLAY}`, padding: '14px 16px', textAlign: 'left', minWidth: 108, borderTopLeftRadius: 22 }}>🕐 Giờ học</th>
              {days.map((d, i) => (
                <th key={i} style={{ background: C.ink, color: i >= 5 ? C.accent : C.bg, font: `800 14px ${DISPLAY}`, padding: '14px 10px', minWidth: 132, borderTopRightRadius: i === days.length - 1 ? 22 : 0 }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, si) => (
              <tr key={si}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: C.badgeBg, color: C.badgeText, fontWeight: 800, fontSize: 13, padding: '12px 16px', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}`, borderRight: `2px solid ${C.border}`, verticalAlign: 'top' }}>
                  {slot.time}
                </td>
                {days.map((_, di) => {
                  const entries = (slot.cells || [])[di] || []
                  return (
                    <td key={di} style={{ padding: 7, borderBottom: `1px solid ${C.border}`, borderRight: di < days.length - 1 ? `1px dashed ${C.border}` : 'none', verticalAlign: 'top', background: si % 2 ? '#FFFDF6' : '#fff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {entries.map((e, ei) => {
                          const [label, color] = Array.isArray(e) ? e : [e?.label, e?.color]
                          const cl = SCHEDULE_COLORS[color] || SCHEDULE_COLORS.trang
                          const hit = match(label)
                          return (
                            <div key={ei} className="hp-sched-pill" style={{
                              background: cl.bg, color: cl.tx, borderLeft: `3px solid ${cl.bar}`,
                              borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 700, lineHeight: 1.35,
                              opacity: hit ? 1 : 0.14, transition: 'opacity .3s ease, transform .15s ease, box-shadow .15s ease, filter .15s ease',
                              outline: hit && filter !== 'Tất cả' ? `2px solid ${cl.bar}` : 'none',
                            }}>
                              {label}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chú giải màu */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.badgeText }}>Chú giải:</span>
        {[['xanhla', 'Ngoại ngữ / KIDS / IELTS'], ['xanhduong', 'Anh văn - Kim'], ['vang', 'Anh văn - Vy'], ['hong', 'Anh văn - Thùy Anh'], ['cam', 'AV6'], ['tim', 'Ngữ Văn'], ['do', 'Toán (Đức / Quỳnh / Khoa)'], ['trang', 'Các lớp khác']].map(([k, l]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.sub, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 11px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SCHEDULE_COLORS[k].bar }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Thành tích học viên — ảnh + caption ── */
function Achievements({ achievements }) {
  if (!achievements?.length) return null
  return (
    <div id="thanhtich" style={{ padding: '56px 48px', background: '#fff', borderTop: `1px solid ${C.border}` }}>
      <h2 style={{ margin: '0 0 8px', font: `800 34px ${DISPLAY}` }}>Thành tích học viên</h2>
      <p style={{ margin: '0 0 28px', color: C.sub, fontSize: 15.5 }}>Những khoảnh khắc đáng tự hào của học viên trung tâm.</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(achievements.length, 2)},1fr)`, gap: 24 }}>
        {achievements.map((a, i) => (
          <figure key={i} className="hp-card hp-achv" style={{ margin: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 14px 30px -18px rgba(122,88,10,.3)' }}>
            <img src={a.image} alt={a.caption || 'Thành tích học viên'} loading="lazy"
              style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
            {a.caption && (
              <figcaption style={{ padding: '16px 20px', fontSize: 14.5, fontWeight: 600, color: C.ink, lineHeight: 1.55, display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ color: C.accent, fontSize: 17 }}>🏆</span>{a.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  )
}

function Testimonials({ testimonials }) {
  if (!testimonials.length) return null
  return (
    <div style={{ padding: '56px 48px', background: C.badgeBg }}>
      <h2 style={{ margin: '0 0 28px', font: `800 34px ${DISPLAY}` }}>Học viên nói gì?</h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(testimonials.length, 3)},1fr)`, gap: 20 }}>
        {testimonials.map((t, i) => (
          <figure key={i} className="hp-card" style={{ margin: 0, background: '#fff', borderRadius: 22, padding: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ font: `800 28px ${DISPLAY}`, color: C.accent, lineHeight: 1 }}>“</div>
            <blockquote style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: C.ink }}>{t.quote}</blockquote>
            <figcaption style={{ fontSize: 13.5, fontWeight: 700, color: C.badgeText }}>{t.who}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

/* ── Liên hệ + form đăng ký (gửi vào chuông thông báo super admin) ── */
function Contact({ info, courses }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const input = { background: '#3A3220', border: '1px solid #55492E', borderRadius: 14, padding: '14px 16px', fontSize: 14.5, color: C.bg, fontFamily: 'inherit' }
  const mapSrc = 'https://www.google.com/maps?q=' + encodeURIComponent(info.address || '') + '&z=16&output=embed'

  const handleSubmit = async e => {
    e.preventDefault()
    setErr('')
    const form = e.target
    const payload = { name: form.name.value.trim(), phone: form.phone.value.trim(), subject: form.subject.value }
    setSending(true)
    try {
      const r = await fetch('/api/site-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Gửi thất bại')
      setSent(true)
    } catch (e2) { setErr(e2.message || 'Gửi thất bại, vui lòng thử lại.') }
    finally { setSending(false) }
  }

  return (
    <div id="lienhe" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '56px 48px', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, font: `800 34px ${DISPLAY}` }}>Ghé thăm trung tâm</h2>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: C.sub }}>
          {info.address}
          <br />
          Hotline: <a href={telHref(info.phone)} target="_blank" rel="noopener noreferrer" className="hp-link" style={{ color: C.accentDark, fontWeight: 700, textDecoration: 'none' }}>{info.phone}</a>
          {info.fb && <>{' · '}<a href={info.fb} target="_blank" rel="noopener noreferrer" className="hp-link" style={{ color: C.accentDark, fontWeight: 700, textDecoration: 'none' }}>Facebook trung tâm</a></>}
        </div>
        <iframe src={mapSrc} title={`Bản đồ ${info.name}`} loading="lazy" style={{ border: 0, width: '100%', flex: 1, minHeight: 280, borderRadius: 20 }} />
      </div>
      <form onSubmit={handleSubmit} style={{ background: C.dark, borderRadius: 26, padding: 36, display: 'flex', flexDirection: 'column', gap: 16, color: C.bg }}>
        <h3 style={{ margin: 0, font: `800 26px ${DISPLAY}` }}>Đăng ký tư vấn</h3>
        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 46 }}>✅</div>
            <div style={{ font: `800 20px ${DISPLAY}`, color: C.accent }}>Đã nhận đăng ký!</div>
            <p style={{ margin: 0, fontSize: 14.5, color: C.darkSub, lineHeight: 1.6 }}>Trung tâm sẽ liên hệ với bạn trong vòng 24 giờ. Cảm ơn bạn đã tin tưởng!</p>
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 14, color: C.darkSub, lineHeight: 1.6 }}>Để lại thông tin, trung tâm sẽ gọi lại trong 24 giờ.</p>
            <input type="text" name="name" required placeholder="Họ tên phụ huynh / học sinh" style={input} />
            <input type="tel" name="phone" required placeholder="Số điện thoại" style={input} />
            <select name="subject" style={input} defaultValue="">
              <option value="" disabled>Quan tâm môn học…</option>
              {courses.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
              <option value="Khác / chưa rõ">Khác / chưa rõ</option>
            </select>
            {err && <div style={{ color: '#fca5a5', fontSize: 13.5 }}>⚠️ {err}</div>}
            <button type="submit" disabled={sending} className="hp-submit"
              style={{ background: C.accent, color: C.dark, border: 0, borderRadius: 999, padding: 15, font: `800 15.5px ${BODY}`, cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1 }}>
              {sending ? 'Đang gửi…' : 'Gửi đăng ký'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

function Footer({ info }) {
  return (
    <footer style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '22px 48px', borderTop: `1px solid ${C.border}`, fontSize: 13, color: '#8A7A54' }}>
      <div style={{ font: `800 15px ${DISPLAY}`, color: C.ink }}>{info.name}</div>
      <div style={{ marginLeft: 'auto' }}>{info.address} · {info.phone}</div>
    </footer>
  )
}

// ====== Trang chính ======
export default function HomePage() {
  const [content, setContent] = useState(null)
  const [showAdvice, setShowAdvice] = useState(false)

  useEffect(() => {
    fetch('/api/site-content')
      .then(r => r.json())
      .then(setContent)
      .catch(() => setContent({}))
  }, [])

  if (!content) {
    return (
      <div style={{ background: C.bg, minHeight: '60vh', display: 'grid', placeItems: 'center', color: C.sub, fontFamily: BODY }}>
        Đang tải…
      </div>
    )
  }

  const info = content.info || {}
  const stats = content.stats || []
  const teachers = content.teachers || []
  const courses = content.courses || []
  const testimonials = content.testimonials || []
  const achievements = content.achievements || []

  return (
    <div style={{ background: info.bgColor || C.bg, color: C.ink, fontFamily: BODY, minHeight: '100vh' }}>
      <style>{`
        @keyframes hpFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hpPopIn { from { opacity: 0; transform: scale(.88) translateY(14px) } to { opacity: 1; transform: none } }

        /* ── Hiệu ứng hover ── */
        .hp-card { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
        .hp-card:hover { transform: translateY(-5px); box-shadow: 0 18px 36px -16px rgba(122,88,10,.35); border-color: #F2A70C55 !important; }
        .hp-card--dark:hover { box-shadow: 0 18px 36px -14px rgba(43,36,22,.55); }

        .hp-btn { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
        .hp-btn:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 12px 26px -10px rgba(122,88,10,.45); filter: brightness(1.05); }
        .hp-btn:active { transform: translateY(0) scale(.98); }

        .hp-link { transition: color .15s ease, border-color .15s ease; }
        .hp-link:hover { color: #B8860B !important; border-bottom-color: #B8860B !important; }

        .hp-arrow:hover { background: #F2A70C !important; color: #fff !important; border-color: #F2A70C !important; transform: scale(1.08); }

        .hp-photo { transform: rotate(2deg); transition: transform .35s ease, box-shadow .35s ease; }
        .hp-photo:hover { transform: rotate(-1.5deg) scale(1.045); box-shadow: 0 30px 60px -22px rgba(122,88,10,.55) !important; }

        .hp-teacher-avatar { transition: transform .25s ease, box-shadow .25s ease; }
        .hp-card:hover .hp-teacher-avatar { transform: scale(1.07); box-shadow: 0 8px 20px -8px rgba(242,167,12,.6); }

        .hp-achv img { transition: transform .45s ease; }
        .hp-achv:hover img { transform: scale(1.05); }

        .hp-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -10px rgba(242,167,12,.65); filter: brightness(1.06); }
        .hp-submit { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }

        .hp-sched-pill { cursor: default; }
        .hp-sched-pill:hover { transform: translateX(3px) scale(1.04); box-shadow: 0 4px 12px -4px rgba(43,36,22,.25); filter: saturate(1.25); }
        .hp-sched-filter:hover { transform: translateY(-2px); box-shadow: 0 6px 14px -6px rgba(122,88,10,.4); }
      `}</style>
      <Hero info={info} />
      <Stats stats={stats} />
      <Teachers teachers={teachers} />
      <Courses courses={courses} info={info} onIdle10s={() => setShowAdvice(true)} />
      <Schedule schedule={content.schedule} />
      <Achievements achievements={achievements} />
      <Testimonials testimonials={testimonials} />
      <Contact info={info} courses={courses} />
      <Footer info={info} />
      {showAdvice && <AdvicePopup info={info} onClose={() => setShowAdvice(false)} />}
    </div>
  )
}

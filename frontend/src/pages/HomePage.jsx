// HomePage.jsx — Trang chủ Trung tâm Ánh Sáng (thiết kế "Nắng vàng" v2)
// Nội dung load từ /api/site-content — super admin chỉnh sửa trong trang Quản trị.
// Data contract giữ nguyên: info / stats / teachers / courses / schedule / achievements / testimonials.
import React, { useEffect, useRef, useState } from 'react'

// ====== Màu sắc & font (design tokens — "Academic Navy + Gold" theo ui-ux-pro-max) ======
// ====== Màu sắc & font (design tokens — "Academic Midnight + Gold" theo ui-ux-pro-max) ======
const C = {
  bg: '#FAFCFF',         // slate-50 — nền chính ánh xanh sang trọng
  cream2: '#F1F5F9',     // surface xanh nhạt
  ink: '#0F172A',       // slate-900 — chữ chính
  sub: '#475569',       // slate-600 — chữ phụ
  accent: '#FBBF24',    // gold rực rỡ quyến rũ
  accentDark: '#B45309',// gold đậm — tương phản cao
  badgeBg: '#E0EEFF',   // nền badge navy nhạt
  badgeText: '#1E40AF', // chữ navy trên badge
  border: '#E2E8F0',    // border nhạt thanh thoát
  dark: '#0F172A',      // navy tối cho Hero, form, footer
  darkSub: '#94A3B8',   // chữ mờ trên nền navy
  blue: '#3B82F6',      // xanh dương phụ
  teal: '#10B981',      // xanh lục tươi mát
}
const DISPLAY = "'Baloo 2', 'Be Vietnam Pro', sans-serif"
const BODY = "'Be Vietnam Pro', sans-serif"

// Bấm số điện thoại → mở Zalo của trung tâm
const telHref = phone => 'https://zalo.me/' + String(phone || '').replace(/\D/g, '')

/* ── Icon set (inline SVG, nét đồng nhất — thay cho emoji cấu trúc) ── */
const Svg = ({ children, size = 20, sw = 1.8, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ flex: 'none', display: 'block', ...style }}>{children}</svg>
)
const IconPin = p => <Svg {...p}><path d="M12 21s-6-5.4-6-10a6 6 0 1 1 12 0c0 4.6-6 10-6 10Z" /><circle cx="12" cy="11" r="2.3" /></Svg>
const IconPhone = p => <Svg {...p}><path d="M5 4h3l2 5-2.4 1.5a11 11 0 0 0 5 5L14.9 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2Z" /></Svg>
const IconClock = p => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.4V12l3.2 2" /></Svg>
const IconSearch = p => <Svg {...p}><circle cx="11" cy="11" r="6.4" /><path d="m20 20-3.6-3.6" /></Svg>
const IconChevL = p => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
const IconChevR = p => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
const IconArrowR = p => <Svg {...p}><path d="M4 12h15M13 6l6 6-6 6" /></Svg>
const IconCheck = p => <Svg {...p}><path d="M20 6.5 9.5 17 4 11.5" /></Svg>
const IconTrophy = p => <Svg {...p}><path d="M7 4h10v4a5 5 0 0 1-10 0Z" /><path d="M7 5.5H4.5V7A2.5 2.5 0 0 0 7 9.5M17 5.5h2.5V7A2.5 2.5 0 0 1 17 9.5M9.5 14.5h5M8.5 20h7M12 14.5V20" /></Svg>
const IconStar = p => <Svg fill="currentColor" {...p}><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.7 1.1-6L3.4 9.5l6-.8L12 3.2Z" /></Svg>
const IconSun = p => <Svg {...p}><circle cx="12" cy="12" r="4.4" /><path d="M12 2.4v2.2M12 19.4v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></Svg>
const IconSparkle = p => <Svg fill="currentColor" {...p}><path d="M12 2.5l1.7 5.8 5.8 1.7-5.8 1.7L12 17.5l-1.7-5.8L4.5 10l5.8-1.7L12 2.5Z" /></Svg>
const IconArrowUpRight = p => <Svg {...p}><path d="M7 17 17 7M8.5 7H17v8.5" /></Svg>
const IconFacebook = p => <Svg fill="currentColor" {...p}><path d="M14 8.2h2.2V5.3H14A3.3 3.3 0 0 0 10.7 8.6v1.6H8.7v2.9h2v6.6h3v-6.6h2.3l.6-2.9H13.7V8.9c0-.5.3-.7.8-.7Z" /></Svg>
const IconMessenger = p => <Svg fill="currentColor" {...p}><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.3 2 2 6.2 2 11.7c0 3 1.3 5.6 3.4 7.3.2.1.3.4.3.6l.1 1.9c0 .6.6 1 1.2.8l2.1-.9c.2-.1.4-.1.5 0 .9.3 1.9.4 2.9.4 5.7 0 10-4.2 10-9.7C22 6.2 17.7 2 12 2Zm6 7.5-2.9 4.7c-.5.7-1.5.9-2.2.4l-2.3-1.7c-.2-.2-.5-.2-.7 0l-3.1 2.4c-.4.3-1-.2-.7-.6l2.9-4.7c.5-.7 1.5-.9 2.2-.4l2.3 1.7c.2.2.5.2.7 0l3.1-2.4c.4-.3 1 .2.7.6Z" /></Svg>

/* ── Nhãn phần (eyebrow) + tiêu đề phần ── */
function Kicker({ children, light }) {
  return (
    <div className="hp-kicker" style={light ? { color: C.accent } : undefined}>
      <IconSun size={15} sw={2.1} />
      <span>{children}</span>
    </div>
  )
}
function SectionHead({ kicker, title, desc, light, center }) {
  return (
    <div className="hp-reveal" style={{ maxWidth: center ? 640 : 760, margin: center ? '0 auto 34px' : '0 0 34px', textAlign: center ? 'center' : 'left' }}>
      {kicker && <Kicker light={light}>{kicker}</Kicker>}
      <h2 className="hp-h2" style={light ? { color: C.bg } : undefined}>{title}</h2>
      {desc && <p className="hp-lead" style={light ? { color: C.darkSub } : undefined}>{desc}</p>}
    </div>
  )
}

/* ── Floating Math Icons for Hero Background ── */
const FloatingMathIcons = () => (
  <div className="hp-floating-math" aria-hidden="true">
    <div className="hp-math-item hp-math-1">∫</div>
    <div className="hp-math-item hp-math-2">π</div>
    <div className="hp-math-item hp-math-3">Δ</div>
    <div className="hp-math-item hp-math-4">E=mc²</div>
    <div className="hp-math-item hp-math-5">√x</div>
    <div className="hp-math-item hp-math-6">sin θ</div>
    <div className="hp-math-item hp-math-7">∑</div>
    <div className="hp-math-item hp-math-8">∞</div>
  </div>
)

/* ── HERO ── */
function Hero({ info }) {
  return (
    <section id="gioithieu" className="hp-sec hp-hero">
      <div className="hp-aurora hp-aurora--1" aria-hidden="true" />
      <div className="hp-aurora hp-aurora--2" aria-hidden="true" />
      <FloatingMathIcons />
      <div className="hp-wrap hp-hero-grid">
        <div className="hp-hero-copy hp-reveal">
          <div className="hp-chips">
            {['Toán · Lý · Hóa · Ngữ Văn', 'Tiếng Anh · IELTS'].map(t => (
              <span key={t} className="hp-chip"><span className="hp-chip-dot" />{t}</span>
            ))}
          </div>
          <h1 className="hp-h1">{info.heroTitle}</h1>
          <p className="hp-hero-desc">{info.heroDesc}</p>
          <div className="hp-hero-cta">
            <a href="#lienhe" className="hp-btn hp-btn--primary">
              Đăng ký học thử miễn phí <IconArrowR size={18} />
            </a>
            <a href="#lichhoc" className="hp-btn hp-btn--ghost">Xem lịch học</a>
          </div>
          <div className="hp-hero-meta">
            <span className="hp-meta-item"><IconPin size={17} />{info.address}</span>
            <span className="hp-meta-item"><IconClock size={17} />Mở lớp cả tuần · sáng – chiều – tối</span>
            {info.fb && (
              <a href={info.fb} target="_blank" rel="noopener noreferrer" className="hp-meta-item hp-link" style={{ color: C.accentDark, fontWeight: 700 }}>
                <IconFacebook size={17} />Fanpage của trung tâm
              </a>
            )}
          </div>
        </div>

        <div className="hp-hero-media hp-reveal">
          <div className="hp-hero-frame">
            {info.heroImage ? (
              <img src={info.heroImage} alt={`Lớp học tại ${info.name || 'trung tâm'}`} className="hp-hero-photo" loading="eager" />
            ) : (
              <div className="hp-hero-photo hp-hero-placeholder"><IconSun size={92} sw={1.4} /></div>
            )}
          </div>
          {(info.heroBadge || info.heroBadgeLabel) && (
            <div className="hp-hero-badge">
              <div className="hp-hero-badge-num">{info.heroBadge}</div>
              <div className="hp-hero-badge-label">{info.heroBadgeLabel}</div>
            </div>
          )}
          <div className="hp-hero-rating">
            <span className="hp-stars">{[0, 1, 2, 3, 4].map(i => <IconStar key={i} size={15} style={{ color: C.accent }} />)}</span>
            <span>Phụ huynh tin tưởng</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── STATS ── */
function Stats({ stats }) {
  if (!stats.length) return null
  return (
    <section className="hp-sec hp-sec--tight hp-stats-container">
      <div className="hp-wrap">
        <div className="hp-stats hp-reveal">
          {stats.map((s, i) => (
            <div key={i} className="hp-stat hp-card">
              <div className="hp-stat-num">{s.value}</div>
              <div className="hp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
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

  if (!teachers.length) return null

  return (
    <section id="giaovien" className="hp-sec hp-sec--white"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="hp-wrap">
        <div className="hp-head-row">
          <div style={{ flex: 1 }}>
            <SectionHead kicker="Đội ngũ" title="Thầy cô đứng lớp trực tiếp"
              desc="Giáo viên trực tiếp giảng dạy, theo sát từng em — không qua trợ giảng." />
          </div>
          {pages > 1 && (
            <div className="hp-nav-arrows hp-reveal">
              <button className="hp-arrow" onClick={() => setPage(p => (p - 1 + pages) % pages)} aria-label="Trang trước"><IconChevL size={18} sw={2.2} /></button>
              <button className="hp-arrow" onClick={() => setPage(p => (p + 1) % pages)} aria-label="Trang sau"><IconChevR size={18} sw={2.2} /></button>
            </div>
          )}
        </div>

        <div className="hp-carousel hp-reveal">
          <div className="hp-carousel-track" style={{ width: `${pages * 100}%`, transform: `translateX(-${page * (100 / pages)}%)` }}>
            {Array.from({ length: pages }, (_, pi) => (
              <div key={pi} className="hp-carousel-page hp-grid-3" style={{ width: `${100 / pages}%` }}>
                {teachers.slice(pi * PER_PAGE, pi * PER_PAGE + PER_PAGE).map((t, i) => (
                  <article key={i} className="hp-card hp-teacher">
                    {t.photo ? (
                      <img src={t.photo} alt={t.name} className="hp-teacher-avatar" loading="lazy" />
                    ) : (
                      <div className="hp-teacher-avatar hp-teacher-initial">{(t.name || '?').split(' ').pop().charAt(0)}</div>
                    )}
                    <div>
                      <div className="hp-teacher-name">{t.name}</div>
                      <div className="hp-teacher-subject">{t.subject}</div>
                    </div>
                    <p className="hp-teacher-bio">{t.bio}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        {pages > 1 && (
          <div className="hp-dots">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} aria-label={`Trang ${i + 1}`}
                className="hp-dot" data-active={i === page} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Khóa học & học phí — popup tư vấn khi người dùng dừng lại quá 10 giây ── */
function Courses({ courses, onIdle10s }) {
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

  if (!courses.length) return null

  return (
    <section id="khoahoc" ref={secRef} className="hp-sec">
      <div className="hp-wrap">
        <SectionHead kicker="Khóa học" title="Khóa học & học phí"
          desc="Học phí tham khảo, đã gồm tài liệu. Lớp tối đa 20 em để thầy cô kèm sát." />
        <div className="hp-grid-3 hp-reveal">
          {courses.map((c, i) => (
            <article key={i} className={`hp-card hp-course${c.featured ? ' hp-course--featured' : ''}`}>
              <div className="hp-course-top">
                <h3 className="hp-course-name">{c.name}</h3>
                {c.featured && <span className="hp-ribbon"><IconSparkle size={12} />NỔI BẬT</span>}
              </div>
              <p className="hp-course-desc">{c.desc}</p>
              <div className="hp-course-foot">
                <div className="hp-course-fee">{c.fee}<span className="hp-course-per"> /tháng</span></div>
                <a href="#lienhe" className="hp-course-link">Tư vấn <IconArrowUpRight size={15} /></a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Popup tư vấn (khi dừng ở phần khóa học quá 10 giây) ── */
function AdvicePopup({ info, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="hp-modal-scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="hp-modal" role="dialog" aria-modal="true" aria-labelledby="hp-advice-title">
        <button onClick={onClose} aria-label="Đóng" className="hp-modal-close">✕</button>
        <div className="hp-modal-icon"><IconPhone size={26} style={{ color: C.accentDark }} /></div>
        <div id="hp-advice-title" className="hp-modal-title">Chưa biết chọn lớp nào?</div>
        <p className="hp-modal-text">
          Gọi ngay cho trung tâm để được <strong>kiểm tra đầu vào và tư vấn miễn phí</strong> lộ trình phù hợp nhất.
        </p>
        <a href={telHref(info.phone)} target="_blank" rel="noopener noreferrer" className="hp-btn hp-btn--primary hp-modal-cta">
          <IconPhone size={18} />{info.phone}
        </a>
        <div style={{ marginTop: 14 }}>
          <a href="#lienhe" onClick={onClose} className="hp-link" style={{ color: C.badgeText, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
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
    <section id="lichhoc" className="hp-sec hp-sec--cream">
      <div className="hp-wrap">
        <SectionHead kicker="Thời khóa biểu" title="Lịch học trong tuần" desc={schedule.note} />

        {/* Bộ lọc theo lớp */}
        <div className="hp-sched-filters hp-reveal">
          <span className="hp-sched-filter-label"><IconSearch size={16} sw={2} />Tìm theo lớp:</span>
          {SCHEDULE_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} className="hp-sched-filter" data-active={filter === f}>
              {f === 'KIDS' || f === 'IELTS' || f === 'TOEIC' || f === 'Tất cả' ? f : `Lớp ${f}`}
            </button>
          ))}
          {total !== null && (
            <span className="hp-sched-count" style={{ color: total ? C.accentDark : '#b91c1c' }}>
              {total ? `${total} buổi / tuần` : 'Không có buổi nào'}
            </span>
          )}
        </div>

        <div className="hp-sched-scroll hp-reveal">
          <table className="hp-sched-table">
            <thead>
              <tr>
                <th className="hp-sched-th hp-sched-th--time">Giờ học</th>
                {days.map((d, i) => (
                  <th key={i} className="hp-sched-th" style={{ color: i >= 5 ? C.accent : C.bg }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, si) => (
                <tr key={si}>
                  <td className="hp-sched-time">{slot.time}</td>
                  {days.map((_, di) => {
                    const entries = (slot.cells || [])[di] || []
                    return (
                      <td key={di} className="hp-sched-cell" style={{ background: si % 2 ? '#F4F8FC' : '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {entries.map((e, ei) => {
                            const [label, color] = Array.isArray(e) ? e : [e?.label, e?.color]
                            const cl = SCHEDULE_COLORS[color] || SCHEDULE_COLORS.trang
                            const hit = match(label)
                            return (
                              <div key={ei} className="hp-sched-pill" style={{
                                background: cl.bg, color: cl.tx, borderLeft: `3px solid ${cl.bar}`,
                                opacity: hit ? 1 : 0.14,
                                outline: hit && filter !== 'Tất cả' ? `2px solid ${cl.bar}` : 'none',
                              }}>{label}</div>
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
        <div className="hp-legend hp-reveal">
          <span className="hp-legend-label">Chú giải:</span>
          {[['xanhla', 'Ngoại ngữ / KIDS / IELTS'], ['xanhduong', 'Anh văn - Kim'], ['vang', 'Anh văn - Vy'], ['hong', 'Anh văn - Thùy Anh'], ['cam', 'AV6'], ['tim', 'Ngữ Văn'], ['do', 'Toán (Đức / Quỳnh / Khoa)'], ['trang', 'Các lớp khác']].map(([k, l]) => (
            <span key={k} className="hp-legend-item">
              <span className="hp-legend-swatch" style={{ background: SCHEDULE_COLORS[k].bar }} />{l}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Thành tích học viên — ảnh + caption ── */
function Achievements({ achievements }) {
  if (!achievements?.length) return null
  return (
    <section id="thanhtich" className="hp-sec hp-sec--white">
      <div className="hp-wrap">
        <SectionHead kicker="Thành tích" title="Thành tích học viên"
          desc="Những khoảnh khắc đáng tự hào của học viên trung tâm." />
        <div className="hp-grid-2 hp-reveal">
          {achievements.map((a, i) => (
            <figure key={i} className="hp-card hp-achv">
              <div className="hp-achv-imgwrap">
                <img src={a.image} alt={a.caption || 'Thành tích học viên'} loading="lazy" className="hp-achv-img" />
              </div>
              {a.caption && (
                <figcaption className="hp-achv-cap">
                  <IconTrophy size={18} style={{ color: C.accent }} />{a.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Cảm nhận học viên ── */
function Testimonials({ testimonials }) {
  if (!testimonials.length) return null
  return (
    <section className="hp-sec hp-sec--cream">
      <div className="hp-wrap">
        <SectionHead kicker="Cảm nhận" title="Học viên & phụ huynh nói gì?" />
        <div className="hp-grid-3 hp-reveal">
          {testimonials.map((t, i) => (
            <figure key={i} className="hp-card hp-quote">
              <span className="hp-stars">{[0, 1, 2, 3, 4].map(s => <IconStar key={s} size={15} style={{ color: C.accent }} />)}</span>
              <blockquote className="hp-quote-text">{t.quote}</blockquote>
              <figcaption className="hp-quote-who">
                <span className="hp-quote-ava">{(t.who || '?').charAt(0)}</span>{t.who}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Liên hệ + form đăng ký (gửi vào chuông thông báo super admin) ── */
function Contact({ info, courses }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
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
    <section id="lienhe" className="hp-sec">
      <div className="hp-wrap hp-contact hp-reveal">
        <div className="hp-contact-info">
          <SectionHead kicker="Liên hệ" title="Ghé thăm trung tâm" />
          <div className="hp-contact-rows">
            <a href={`https://www.google.com/maps?q=${encodeURIComponent(info.address || '')}`} target="_blank" rel="noopener noreferrer" className="hp-contact-item hp-link">
              <span className="hp-contact-ico"><IconPin size={19} /></span>{info.address}
            </a>
            <a href={telHref(info.phone)} target="_blank" rel="noopener noreferrer" className="hp-contact-item hp-link">
              <span className="hp-contact-ico"><IconPhone size={19} /></span>Hotline: <strong style={{ color: C.accentDark }}>{info.phone}</strong>
            </a>
            {info.fb && (
              <a href={info.fb} target="_blank" rel="noopener noreferrer" className="hp-contact-item hp-link">
                <span className="hp-contact-ico"><IconFacebook size={18} /></span>Facebook trung tâm
              </a>
            )}
          </div>
          <iframe src={mapSrc} title={`Bản đồ ${info.name || 'trung tâm'}`} loading="lazy" className="hp-map" />
        </div>

        <form onSubmit={handleSubmit} className="hp-form">
          <h3 className="hp-form-title">Đăng ký tư vấn</h3>
          {sent ? (
            <div className="hp-form-done">
              <div className="hp-form-done-ico"><IconCheck size={30} sw={2.4} style={{ color: C.dark }} /></div>
              <div className="hp-form-done-title">Đã nhận đăng ký!</div>
              <p className="hp-form-done-text">Trung tâm sẽ liên hệ với bạn trong vòng 24 giờ. Cảm ơn bạn đã tin tưởng!</p>
            </div>
          ) : (
            <>
              <p className="hp-form-sub">Để lại thông tin, trung tâm sẽ gọi lại trong 24 giờ.</p>
              <div className="hp-field">
                <label htmlFor="hp-name" className="hp-label">Họ tên</label>
                <input id="hp-name" type="text" name="name" required autoComplete="name" placeholder="Họ tên phụ huynh / học sinh" className="hp-input" />
              </div>
              <div className="hp-field">
                <label htmlFor="hp-phone" className="hp-label">Số điện thoại</label>
                <input id="hp-phone" type="tel" name="phone" required autoComplete="tel" inputMode="tel" placeholder="VD: 0901 234 567" className="hp-input" />
              </div>
              <div className="hp-field">
                <label htmlFor="hp-subject" className="hp-label">Môn học quan tâm</label>
                <select id="hp-subject" name="subject" className="hp-input" defaultValue="">
                  <option value="" disabled>Chọn môn học…</option>
                  {courses.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                  <option value="Khác / chưa rõ">Khác / chưa rõ</option>
                </select>
              </div>
              {err && <div className="hp-form-err" role="alert">⚠️ {err}</div>}
              <button type="submit" disabled={sending} className="hp-btn hp-btn--accent hp-form-submit">
                {sending ? 'Đang gửi…' : 'Gửi đăng ký'}
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  )
}

/* ── Footer ── */
function Footer({ info }) {
  const links = [
    ['#gioithieu', 'Giới thiệu'], ['#giaovien', 'Giáo viên'], ['#khoahoc', 'Khóa học'],
    ['#lichhoc', 'Lịch học'], ['#thanhtich', 'Thành tích'], ['#lienhe', 'Liên hệ'],
  ]
  return (
    <footer className="hp-footer">
      <div className="hp-wrap hp-footer-grid">
        <div>
          <div className="hp-footer-brand"><IconSun size={20} style={{ color: C.accent }} />{info.name}</div>
          <p className="hp-footer-addr">{info.address}</p>
        </div>
        <nav className="hp-footer-nav" aria-label="Liên kết nhanh">
          {links.map(([href, label]) => <a key={href} href={href} className="hp-link">{label}</a>)}
        </nav>
        <div className="hp-footer-contact">
          <a href={telHref(info.phone)} target="_blank" rel="noopener noreferrer" className="hp-btn hp-btn--primary hp-footer-cta">
            <IconPhone size={17} />{info.phone}
          </a>
          {info.fb && <a href={info.fb} target="_blank" rel="noopener noreferrer" className="hp-link hp-footer-fb"><IconFacebook size={16} />Fanpage</a>}
        </div>
      </div>
      <div className="hp-wrap hp-footer-bottom">© {new Date().getFullYear()} {info.name}. Đã đăng ký bản quyền.</div>
    </footer>
  )
}

/* ── Facebook Messenger — khung chat TRỰC TIẾP trên web (Chat Plugin chính thức) ── */
// ► ĐIỀN Page ID (dạng SỐ) của Facebook TRANG vào đây. Để trống = chưa bật khung chat.
//   Lấy Page ID: vào Trang FB → "Giới thiệu" → "Thông tin minh bạch về Trang" → Mã trang (Page ID).
//   BẮT BUỘC: whitelist domain https://ttanhsang.edu.vn trong Meta Business Suite
//   → Hộp thư → Cài đặt → "Chat Plugin" (thêm miền vào danh sách cho phép), nếu không khung chat sẽ không hiện.
const FB_PAGE_ID = ''

function MessengerChat() {
  useEffect(() => {
    if (!FB_PAGE_ID) return
    if (document.querySelector('.fb-customerchat')) {
      if (window.FB) window.FB.XFBML.parse()
      return
    }
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div')
      root.id = 'fb-root'
      document.body.appendChild(root)
    }
    const chat = document.createElement('div')
    chat.className = 'fb-customerchat'
    chat.setAttribute('attribution', 'biz_inbox')
    chat.setAttribute('page_id', FB_PAGE_ID)
    chat.setAttribute('greeting_dialog_display', 'fade')
    document.body.appendChild(chat)

    window.fbAsyncInit = function () {
      window.FB.init({ xfbml: true, version: 'v19.0' })
    }
    if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script')
      js.id = 'facebook-jssdk'
      js.async = true
      js.defer = true
      js.crossOrigin = 'anonymous'
      js.src = 'https://connect.facebook.net/vi_VN/sdk/xfbml.customerchat.js'
      document.body.appendChild(js)
    } else if (window.FB) {
      window.FB.XFBML.parse()
    }
  }, [])
  return null
}

/* ── Nút liên hệ nổi (Zalo · Gọi) — góc trái, để chừa góc phải cho khung chat Messenger ── */
function ContactDock({ info }) {
  const digits = String(info.phone || '').replace(/\D/g, '')
  const zalo = digits ? 'https://zalo.me/' + digits : null
  const tel = digits ? 'tel:+84' + digits.replace(/^0/, '') : null

  return (
    <div className="cd" role="complementary" aria-label="Liên hệ nhanh với trung tâm">
      {zalo && (
        <a className="cd-btn cd-zalo" href={zalo} target="_blank" rel="noopener noreferrer" aria-label="Chat Zalo với trung tâm">
          <span className="cd-ring" aria-hidden="true" />
          <span className="cd-zalo-word">Zalo</span>
          <span className="cd-label">Chat Zalo</span>
        </a>
      )}
      {tel && (
        <a className="cd-btn cd-call" href={tel} aria-label={`Gọi ${info.phone}`}>
          <span className="cd-ring" aria-hidden="true" />
          <IconPhone size={24} style={{ position: 'relative', zIndex: 1 }} />
          <span className="cd-label">Gọi ngay</span>
        </a>
      )}
    </div>
  )
}

// ====== Trang chính ======
export default function HomePage() {
  const [content, setContent] = useState(null)
  const [showAdvice, setShowAdvice] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    fetch('/api/site-content')
      .then(r => r.json())
      .then(setContent)
      .catch(() => setContent({}))
  }, [])

  // Scroll-reveal (tôn trọng prefers-reduced-motion)
  useEffect(() => {
    if (!content) return
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll('.hp-reveal')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { els.forEach(e => e.classList.add('is-in')); return }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' })
    els.forEach(e => obs.observe(e))
    return () => obs.disconnect()
  }, [content])

  if (!content) {
    return (
      <div style={{ background: C.bg, minHeight: '60vh', display: 'grid', placeItems: 'center', color: C.sub, fontFamily: BODY }}>
        <div className="hp-loading"><span className="hp-loading-sun"><IconSun size={26} style={{ color: C.accent }} /></span>Đang tải…</div>
        <style>{'@keyframes hpSpin{to{transform:rotate(360deg)}}.hp-loading{display:flex;align-items:center;gap:12px;font-weight:600}.hp-loading-sun{display:inline-flex;animation:hpSpin 3s linear infinite}'}</style>
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
    <div ref={rootRef} className="hp" style={{ background: info.bgColor || C.bg }}>
      <style>{HP_CSS}</style>
      <Hero info={info} />
      <Stats stats={stats} />
      <Teachers teachers={teachers} />
      <Courses courses={courses} onIdle10s={() => setShowAdvice(true)} />
      <Schedule schedule={content.schedule} />
      <Achievements achievements={achievements} />
      <Testimonials testimonials={testimonials} />
      <Contact info={info} courses={courses} />
      <Footer info={info} />
      <ContactDock info={info} />
      <MessengerChat />
      {showAdvice && <AdvicePopup info={info} onClose={() => setShowAdvice(false)} />}
    </div>
  )
}

// ====== Stylesheet (scoped dưới .hp) ======
const HP_CSS = `
.hp{
  --bg:${C.bg}; --cream2:${C.cream2}; --ink:${C.ink}; --sub:${C.sub};
  --accent:${C.accent}; --accent-d:${C.accentDark}; --badge-bg:${C.badgeBg};
  --badge-tx:${C.badgeText}; --border:${C.border}; --dark:${C.dark}; --dark-sub:${C.darkSub}; --blue:${C.blue};
  --teal:${C.teal};
  color:var(--ink); font-family:${BODY}; min-height:100vh;
  scroll-behavior:smooth; -webkit-font-smoothing:antialiased;
  background-color: var(--bg);
}
.hp *{ box-sizing:border-box; }
.hp ::selection{ background:${C.accent}44; }

/* Layout */
.hp-wrap{ width:100%; max-width:1180px; margin:0 auto; padding:0 24px; }
.hp-sec{ padding:clamp(60px,10vw,100px) 0; position:relative; scroll-margin-top:76px; }
.hp-sec--tight{ padding-top:0; }
.hp-sec--white{ background:#fff; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
.hp-sec--cream{ background:linear-gradient(180deg, var(--bg) 0%, var(--cream2) 100%); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }

/* Overlap container for Stats */
.hp-stats-container {
  margin-top: clamp(-70px, -9vw, -50px);
  position: relative;
  z-index: 10;
}

/* Eyebrow + titles */
.hp-kicker{ display:inline-flex; align-items:center; gap:8px; color:var(--accent-d);
  font-weight:800; font-size:13px; letter-spacing:.15em; text-transform:uppercase; margin-bottom:16px;
  background: linear-gradient(135deg, var(--accent-d) 0%, var(--blue) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent; }
.hp-kicker svg { color: var(--accent); }
.hp-h1{ margin:0; font-family:${DISPLAY}; font-weight:800; font-size:clamp(36px,6vw,56px); line-height:1.15; letter-spacing:-.02em; text-wrap:balance; }
.hp-h2{ margin:0 0 14px; font-family:${DISPLAY}; font-weight:800; font-size:clamp(30px,4vw,40px); line-height:1.2; letter-spacing:-.02em; text-wrap:balance; }
.hp-lead{ margin:0; color:var(--sub); font-size:clamp(15.5px,1.8vw,17.5px); line-height:1.7; max-width:58ch; }

/* Text Gradient on light headers */
.hp-sec:not(.hp-hero) .hp-h2 {
  background: linear-gradient(135deg, var(--ink) 0%, #1e293b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Buttons */
.hp-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:${BODY};
  font-weight:700; font-size:15px; padding:14px 26px; border-radius:999px; border:1.5px solid transparent;
  text-decoration:none; cursor:pointer; transition:all 0.25s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-btn:focus-visible{ outline:3px solid ${C.accent}88; outline-offset:2px; }
.hp-btn--primary{ background:var(--accent); color:var(--dark); box-shadow:0 10px 25px -10px rgba(251,191,36,.5); }
.hp-btn--primary:hover{ background:#fec836; transform:translateY(-3px); box-shadow:0 16px 30px -10px rgba(251,191,36,.6); }
.hp-btn--accent{ background:var(--blue); color:#fff; box-shadow:0 10px 25px -10px rgba(59,130,246,.4); }
.hp-btn--accent:hover{ background:#2563eb; transform:translateY(-3px); box-shadow:0 16px 30px -10px rgba(59,130,246,.5); }
.hp-btn--ghost{ background:rgba(255,255,255,0.92); color:var(--ink); border-color:rgba(15,23,42,0.12); backdrop-filter:blur(8px);
  box-shadow:0 6px 18px -12px rgba(15,23,42,0.4); }
.hp-btn--ghost:hover{ background:#fff; transform:translateY(-3px); border-color:var(--accent); box-shadow:0 12px 24px -12px rgba(251,191,36,0.55); }
.hp-btn:active{ transform:translateY(0) scale(.98); }

.hp-link{ color:inherit; text-decoration:none; transition:color .18s ease; }
.hp-link:hover{ color:var(--blue); }
.hp-link:focus-visible{ outline:2px solid ${C.accent}88; outline-offset:2px; border-radius:4px; }

/* Cards */
.hp-card{ background:rgba(255,255,255,0.75); border:1px solid rgba(255,255,255,0.6); border-radius:24px;
  backdrop-filter:blur(10px);
  transition:all .35s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-card:hover{ transform:translateY(-8px) scale(1.01); box-shadow:0 24px 48px -20px rgba(30,58,95,.22); border-color:rgba(59,130,246,0.3); }

/* Reveal */
.hp-reveal{ opacity:0; transform:translateY(30px); transition:opacity .8s cubic-bezier(0.25, 1, 0.5, 1), transform .8s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-reveal.is-in{ opacity:1; transform:none; }
@media (prefers-reduced-motion:reduce){ .hp,.hp *{ scroll-behavior:auto !important; } .hp-reveal{ opacity:1 !important; transform:none !important; transition:none !important; } }

/* ── HERO ── */
.hp-hero{
  background:
    radial-gradient(120% 95% at 82% 8%, #FFFFFF 0%, #F4F8FF 42%, #E9F1FD 72%, #E2ECFB 100%);
  color: var(--ink);
  clip-path: polygon(0 0, 100% 0, 100% 90%, 0 100%);
  padding-top: clamp(80px, 12vw, 120px) !important;
  padding-bottom: clamp(140px, 18vw, 190px) !important;
  overflow:hidden;
  border-bottom: 2px solid var(--accent);
}
.hp-hero .hp-h1 {
  background: linear-gradient(135deg, var(--ink) 28%, ${C.blue} 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: none;
}
.hp-hero-glow{ position:absolute; inset:0; pointer-events:none; z-index:0; }
.hp-aurora {
  position: absolute;
  width: clamp(350px, 50vw, 600px);
  height: clamp(350px, 50vw, 600px);
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.28;
  animation: hpPulseGlow 12s ease-in-out infinite alternate;
}
.hp-aurora--1 {
  background: radial-gradient(circle, var(--blue) 0%, transparent 70%);
  top: -10%;
  right: -5%;
}
.hp-aurora--2 {
  background: radial-gradient(circle, var(--teal) 0%, transparent 70%);
  bottom: -5%;
  left: -5%;
  animation-delay: -4s;
}
@keyframes hpPulseGlow {
  0% { transform: scale(1) translate(0, 0); opacity: 0.2; }
  100% { transform: scale(1.15) translate(30px, -30px); opacity: 0.35; }
}

/* Floating Math Symbols */
.hp-floating-math {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}
.hp-math-item {
  position: absolute;
  color: var(--accent);
  font-family: ${DISPLAY};
  font-weight: 800;
  font-size: clamp(24px, 4vw, 48px);
  opacity: 0.14;
  user-select: none;
}
.hp-math-1 { top: 12%; left: 8%; animation: hpFloat 6s ease-in-out infinite; }
.hp-math-2 { top: 25%; left: 45%; animation: hpFloat 8s ease-in-out infinite 1s; font-size: clamp(32px, 5vw, 64px); color: var(--blue); opacity: 0.12; }
.hp-math-3 { top: 70%; left: 15%; animation: hpFloat 7s ease-in-out infinite 2s; }
.hp-math-4 { top: 15%; right: 15%; animation: hpFloat 9s ease-in-out infinite 0.5s; font-size: clamp(20px, 3vw, 36px); color: var(--blue); opacity: 0.1; }
.hp-math-5 { top: 45%; left: 5%; animation: hpFloat 10s ease-in-out infinite 3s; }
.hp-math-6 { top: 80%; right: 40%; animation: hpFloat 8s ease-in-out infinite 1.5s; }
.hp-math-7 { top: 55%; right: 10%; animation: hpFloat 7s ease-in-out infinite 4s; }
.hp-math-8 { top: 40%; left: 35%; animation: hpFloat 9s ease-in-out infinite 2.5s; opacity: 0.05; }

@keyframes hpFloat {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(10deg); }
}

.hp-hero-grid{ position:relative; z-index:2; display:grid; grid-template-columns:1.1fr .9fr; gap:clamp(30px,5vw,56px); align-items:center; }
.hp-hero-copy{ display:flex; flex-direction:column; gap:22px; }
.hp-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.hp-chip{ display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.9); color:var(--badge-tx);
  border: 1px solid rgba(37,99,235,0.16); font-size:13.5px; font-weight:700; padding:8px 16px; border-radius:999px;
  box-shadow:0 4px 14px -8px rgba(15,23,42,0.28); }
.hp-chip-dot{ width:8px; height:8px; border-radius:50%; background:var(--accent); flex:none; box-shadow: 0 0 10px var(--accent); }
.hp-hero-desc{ margin:0; font-size:clamp(16px,1.8vw,18px); line-height:1.7; color:var(--sub); max-width:52ch; text-wrap:pretty; }
.hp-hero-cta{ display:flex; flex-wrap:wrap; gap:16px; margin-top:4px; }
.hp-hero-meta{ display:flex; flex-direction:column; gap:12px; margin-top:10px; }
.hp-meta-item{ display:inline-flex; align-items:center; gap:10px; font-size:14.5px; color:var(--sub); }
.hp-meta-item svg{ color:var(--accent-d); }

.hp-hero-media{ position:relative; display:flex; justify-content:center; z-index: 2; }
.hp-hero-frame{ position:relative; width:100%; max-width:440px; }
.hp-hero-frame::before{ content:""; position:absolute; inset:-12px -12px 12px 12px; border-radius:32px;
  background:linear-gradient(150deg, var(--accent) 30%, transparent); z-index:0; }
.hp-hero-photo{ position:relative; z-index:1; width:100%; aspect-ratio:4/4.5; object-fit:cover; border-radius:28px;
  border: 4px solid #fff;
  box-shadow:0 30px 60px -22px rgba(15,23,42,0.32); transition:transform .4s ease, box-shadow .4s ease; }
.hp-hero-frame:hover .hp-hero-photo{ transform:translateY(-6px) rotate(-1deg); box-shadow:0 40px 70px -24px rgba(15,23,42,0.42); }
.hp-hero-placeholder{ display:grid; place-items:center; color:${C.accentDark};
  background:linear-gradient(160deg, #F4F8FF, #E2ECFB); }
.hp-hero-badge{ position:absolute; left:-12px; bottom:34px; z-index:3; background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.1);
  backdrop-filter:blur(12px); color:#fff;
  border-radius:20px; padding:16px 24px; box-shadow:0 20px 40px -15px rgba(0,0,0,0.5); }
.hp-hero-badge-num{ font-family:${DISPLAY}; font-weight:800; font-size:28px; color:var(--accent); line-height:1; }
.hp-hero-badge-label{ font-size:12.5px; font-weight:600; color:var(--dark-sub); margin-top:4px; }
.hp-hero-rating{ position:absolute; right:-12px; top:22px; z-index:3; display:flex; flex-direction:column; gap:6px;
  background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.1); backdrop-filter:blur(12px);
  border-radius:18px; padding:12px 18px; box-shadow:0 20px 40px -15px rgba(0,0,0,0.5);
  font-size:12px; font-weight:700; color:#fff; }
.hp-stars{ display:inline-flex; gap:3px; }

/* ── STATS ── */
.hp-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:clamp(16px,2vw,24px); }
.hp-stat{ padding:28px clamp(16px,2vw,24px); display:flex; flex-direction:column; gap:8px; align-items:center; text-align:center;
  box-shadow: 0 15px 35px -10px rgba(15,23,42,0.08); }
.hp-stat-num{ font-family:${DISPLAY}; font-weight:800; font-size:clamp(32px,3.8vw,42px); line-height:1; 
  background: linear-gradient(135deg, var(--blue) 0%, var(--accent-d) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent; }
.hp-stat-label{ font-size:14px; font-weight:700; color:var(--sub); letter-spacing:0.02em; }

/* ── Section head row (title + arrows) ── */
.hp-head-row{ display:flex; align-items:flex-end; gap:20px; }
.hp-nav-arrows{ display:flex; gap:12px; margin-bottom:34px; }
.hp-arrow{ width:48px; height:48px; border-radius:50%; border:1.5px solid var(--border); background:#fff;
  color:var(--ink); cursor:pointer; display:grid; place-items:center;
  box-shadow:0 8px 20px -8px rgba(30,58,95,.2); transition:all 0.25s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-arrow:hover{ background:var(--blue); color:#fff; border-color:var(--blue); transform:scale(1.08);
  box-shadow: 0 12px 24px -10px rgba(59,130,246,.5); }
.hp-arrow:focus-visible{ outline:3px solid ${C.accent}88; outline-offset:2px; }

/* ── Carousel + grids ── */
.hp-carousel{ overflow:hidden; padding:8px 0; }
.hp-carousel-track{ display:flex; transition:transform .65s cubic-bezier(.25, 1, 0.5, 1); }
.hp-carousel-page{ padding:8px; }
.hp-grid-3{ display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(20px,2.5vw,28px); }
.hp-grid-2{ display:grid; grid-template-columns:repeat(2,1fr); gap:clamp(20px,3vw,32px); }

.hp-teacher{ padding:32px; display:flex; flex-direction:column; gap:16px; align-items:flex-start; background:rgba(255,255,255,0.7); }
.hp-teacher-avatar{ width:98px; height:98px; border-radius:50%; object-fit:cover; border:4px solid var(--badge-bg);
  transition:transform .3s ease, box-shadow .3s ease; box-shadow: 0 8px 20px -6px rgba(15,23,42,0.15); }
.hp-card:hover .hp-teacher-avatar{ transform:scale(1.08) rotate(2deg); box-shadow:0 12px 24px -8px rgba(59,130,246,.5); }
.hp-teacher-initial{ display:grid; place-items:center; background:var(--badge-bg); color:var(--badge-tx); font-family:${DISPLAY}; font-weight:800; font-size:26px; }
.hp-teacher-name{ font-family:${DISPLAY}; font-weight:800; font-size:22px; line-height:1.2; }
.hp-teacher-subject{ display:inline-block; font-size:12.5px; font-weight:800; color:var(--badge-tx); background:var(--badge-bg);
  padding:4px 10px; border-radius:6px; margin-top:6px; }
.hp-teacher-bio{ margin:0; font-size:14.5px; line-height:1.65; color:var(--sub); }

.hp-dots{ display:flex; gap:8px; justify-content:center; margin-top:28px; }
.hp-dot{ width:12px; height:12px; border-radius:999px; border:none; background:var(--border); cursor:pointer; padding:0; transition:all .3s ease; }
.hp-dot[data-active="true"]{ width:32px; background:var(--blue); box-shadow: 0 4px 12px -4px rgba(59,130,246,.5); }
.hp-dot:focus-visible{ outline:2px solid ${C.accent}88; outline-offset:2px; }

/* ── Courses ── */
.hp-course{ padding:34px 30px; display:flex; flex-direction:column; gap:16px; border: 1px solid rgba(255,255,255,0.7); }
.hp-course--featured{ background: linear-gradient(135deg, #151e33 0%, #0b0f19 100%); border: 1px solid rgba(251,191,36,0.3); color:#fff;
  box-shadow: 0 20px 45px -15px rgba(11,15,25,0.25); }
.hp-course--featured:hover{ box-shadow:0 30px 60px -20px rgba(11,15,25,0.5), 0 0 20px rgba(251,191,36,0.15); border-color:var(--accent); }
.hp-course-top{ display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px; }
.hp-course-name{ margin:0; font-family:${DISPLAY}; font-weight:800; font-size:22px; line-height:1.2; }
.hp-ribbon{ display:inline-flex; align-items:center; gap:5px; background:var(--accent); color:var(--dark);
  font-size:11px; font-weight:800; letter-spacing:.05em; padding:5px 12px; border-radius:999px; box-shadow: 0 4px 10px rgba(251,191,36,0.3); }
.hp-course-desc{ margin:0; font-size:14.5px; line-height:1.65; color:var(--sub); }
.hp-course--featured .hp-course-desc{ color:var(--dark-sub); }
.hp-course-foot{ margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding-top:12px; border-top:1px dashed var(--border); }
.hp-course--featured .hp-course-foot{ border-color: rgba(255,255,255,0.1); }
.hp-course-fee{ font-family:${DISPLAY}; font-weight:800; font-size:26px; color:var(--blue); }
.hp-course--featured .hp-course-fee{ color:var(--accent); }
.hp-course-per{ font-family:${BODY}; font-weight:600; font-size:13.5px; color:var(--sub); }
.hp-course--featured .hp-course-per{ color:var(--dark-sub); }
.hp-course-link{ display:inline-flex; align-items:center; gap:6px; font-size:14.5px; font-weight:800; color:var(--blue); text-decoration:none; white-space:nowrap; transition:all .25s ease; }
.hp-course--featured .hp-course-link{ color:var(--accent); }
.hp-course-link:hover{ gap:10px; opacity:0.9; }

/* ── Modal (advice) ── */
.hp-modal-scrim{ position:fixed; inset:0; background:rgba(11,15,25,0.6); z-index:1000; display:grid; place-items:center;
  backdrop-filter:blur(6px); animation:hpFade .25s ease; padding:24px; }
.hp-modal{ background:rgba(255,255,255,0.9); border:1px solid rgba(255,255,255,0.8); border-radius:28px; padding:44px; max-width:440px; width:100%;
  backdrop-filter:blur(16px); text-align:center; box-shadow:0 40px 80px -20px rgba(11,15,25,.3); position:relative; animation:hpPop .35s cubic-bezier(.34,1.56,.64,1); }
.hp-modal-close{ position:absolute; top:16px; right:16px; background:none; border:none; font-size:20px; cursor:pointer; color:var(--sub); line-height:1; padding:8px; border-radius:50%; transition:all .18s; }
.hp-modal-close:hover{ color:var(--ink); background:var(--border); }
.hp-modal-icon{ width:64px; height:64px; margin:0 auto 16px; border-radius:50%; background:var(--badge-bg); display:grid; place-items:center; box-shadow: 0 8px 20px -8px rgba(59,130,246,.4); }
.hp-modal-title{ font-family:${DISPLAY}; font-weight:800; font-size:26px; margin-bottom:12px; }
.hp-modal-text{ margin:0 0 24px; font-size:15.5px; line-height:1.7; color:var(--sub); }
.hp-modal-cta{ font-size:17.5px; padding:15px 32px; width:100%; box-shadow: 0 10px 25px -10px rgba(59,130,246,.5); }
@keyframes hpFade{ from{opacity:0} to{opacity:1} }
@keyframes hpPop{ from{opacity:0; transform:scale(.9) translateY(20px)} to{opacity:1; transform:none} }
@media (prefers-reduced-motion:reduce){ .hp-modal-scrim,.hp-modal{ animation:none !important; } }

/* ── Schedule ── */
.hp-sched-filters{ display:flex; flex-wrap:wrap; gap:10px; margin-bottom:26px; align-items:center; background:rgba(255,255,255,0.5); padding:12px 18px; border-radius:999px; border:1px solid var(--border); }
.hp-sched-filter-label{ display:inline-flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--ink); margin-right:6px; }
.hp-sched-filter-label svg { color: var(--blue); }
.hp-sched-filter{ border:1.5px solid var(--border); background:#fff; color:var(--sub); font-weight:800; font-size:13px;
  padding:8px 18px; border-radius:999px; cursor:pointer; transition:all .22s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-sched-filter:hover{ transform:translateY(-2px); border-color:var(--blue); color:var(--blue); box-shadow:0 6px 14px -6px rgba(59,130,246,.25); }
.hp-sched-filter[data-active="true"]{ border-color:var(--blue); background:var(--blue); color:#fff; box-shadow:0 8px 18px -6px rgba(59,130,246,.45); }
.hp-sched-filter:focus-visible{ outline:3px solid ${C.accent}88; outline-offset:2px; }
.hp-sched-count{ font-size:13.5px; font-weight:800; margin-left:auto; background:rgba(255,255,255,0.8); padding:6px 12px; border-radius:8px; border:1px solid var(--border); }
.hp-sched-scroll{ overflow-x:auto; border-radius:24px; border:1px solid var(--border); box-shadow:0 25px 50px -25px rgba(30,58,95,.18); }
.hp-sched-scroll::-webkit-scrollbar { height: 8px; }
.hp-sched-scroll::-webkit-scrollbar-track { background: var(--cream2); border-radius: 0 0 24px 24px; }
.hp-sched-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
.hp-sched-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
.hp-sched-table{ border-collapse:separate; border-spacing:0; width:100%; min-width:1080px; background:#fff; }
.hp-sched-th{ background:var(--dark); color:#fff; font-family:${DISPLAY}; font-weight:800; font-size:14.5px; padding:16px 14px; min-width:130px; letter-spacing:0.02em; border-bottom: 2px solid var(--border); }
.hp-sched-th--time{ position:sticky; left:0; z-index:2; text-align:left; min-width:110px; background:#0b0f19; }
.hp-sched-table thead th:first-child{ border-top-left-radius:24px; }
.hp-sched-table thead th:last-child{ border-top-right-radius:24px; }
.hp-sched-time{ position:sticky; left:0; z-index:1; background:var(--cream2); color:var(--badge-tx); font-weight:800; font-size:13.5px;
  padding:14px 18px; white-space:nowrap; border-bottom:1px solid var(--border); border-right:2px solid var(--border); vertical-align:middle; text-align:center; }
.hp-sched-cell{ padding:8px; border-bottom:1px solid var(--border); border-right:1px dashed var(--border); vertical-align:top; }
.hp-sched-cell:last-child{ border-right:none; }
.hp-sched-pill{ border-radius:10px; padding:8px 12px; font-size:12.5px; font-weight:700; line-height:1.4;
  box-shadow: 0 2px 4px rgba(15,23,42,0.03);
  transition:all .22s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-sched-pill:hover{ transform:translateX(4px) scale(1.03); box-shadow:0 6px 16px -4px rgba(15,23,42,.18); filter:brightness(0.98); }
.hp-legend{ display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; align-items:center; }
.hp-legend-label{ font-size:13.5px; font-weight:800; color:var(--ink); }
.hp-legend-item{ display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:var(--sub);
  background:#fff; border:1px solid var(--border); border-radius:999px; padding:6px 14px; box-shadow:0 2px 4px rgba(15,23,42,0.02); }
.hp-legend-swatch{ width:12px; height:12px; border-radius:4px; }

/* ── Achievements ── */
.hp-achv{ margin:0; overflow:hidden; display:flex; flex-direction:column; background:rgba(255,255,255,0.7); box-shadow: 0 15px 35px -10px rgba(15,23,42,0.08); }
.hp-achv-imgwrap{ overflow:hidden; position:relative; }
.hp-achv-img{ width:100%; aspect-ratio:4/3; object-fit:cover; display:block; transition:transform .6s cubic-bezier(0.25, 1, 0.5, 1); }
.hp-achv:hover .hp-achv-img{ transform:scale(1.06); }
.hp-achv-cap{ padding:20px 24px; font-size:15px; font-weight:700; color:var(--ink); line-height:1.6; display:flex; gap:12px; align-items:flex-start; }
.hp-achv-cap svg { color: var(--accent); }

/* ── Testimonials ── */
.hp-quote{ margin:0; padding:32px; display:flex; flex-direction:column; gap:16px; position:relative; background:rgba(255,255,255,0.75); }
.hp-quote::after{ content:"“"; position:absolute; right:24px; top:12px; font-size:90px; font-family:${DISPLAY};
  color:var(--blue); opacity:0.06; line-height:1; pointer-events:none; }
.hp-quote-text{ margin:0; font-size:15.5px; line-height:1.75; color:var(--ink); font-style:italic; position:relative; z-index:1; }
.hp-quote-who{ display:flex; align-items:center; gap:12px; font-size:14px; font-weight:800; color:var(--badge-tx); border-top: 1px solid var(--border); padding-top:14px; margin-top:auto; }
.hp-quote-ava{ width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg, var(--blue) 0%, var(--badge-bg) 100%); color:#fff;
  display:grid; place-items:center; font-family:${DISPLAY}; font-weight:800; font-size:16px; flex:none; box-shadow: 0 4px 10px rgba(59,130,246,0.25); }

/* ── Contact ── */
.hp-contact{ display:grid; grid-template-columns:1fr 1.05fr; gap:clamp(30px,5vw,56px); align-items:stretch; }
.hp-contact-info{ display:flex; flex-direction:column; gap:20px; }
.hp-contact-rows{ display:flex; flex-direction:column; gap:14px; }
.hp-contact-item{ display:inline-flex; align-items:center; gap:14px; font-size:15.5px; color:var(--sub); line-height:1.6; }
.hp-contact-ico{ width:44px; height:44px; border-radius:14px; background:var(--badge-bg); color:var(--blue); display:grid; place-items:center; flex:none;
  box-shadow: 0 6px 14px -6px rgba(59,130,246,0.3); }
.hp-contact-item:hover .hp-contact-ico { background:var(--blue); color:#fff; transform:scale(1.05); transition:all 0.2s; }
.hp-map{ border:0; width:100%; flex:1; min-height:300px; border-radius:24px; margin-top:8px; box-shadow: 0 15px 35px -10px rgba(15,23,42,0.1); border:1px solid var(--border); }
.hp-form{ background: linear-gradient(135deg, #151e33 0%, #0b0f19 100%); border:1px solid rgba(255,255,255,0.06); border-radius:28px; padding:clamp(30px,4vw,44px); display:flex; flex-direction:column; gap:18px; color:#fff;
  box-shadow: 0 30px 60px -25px rgba(0,0,0,0.5); }
.hp-form-title{ margin:0; font-family:${DISPLAY}; font-weight:800; font-size:28px; background: linear-gradient(135deg, #fff 0%, var(--accent) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hp-form-sub{ margin:0 0 4px; font-size:14.5px; color:var(--dark-sub); line-height:1.6; }
.hp-field{ display:flex; flex-direction:column; gap:8px; }
.hp-label{ font-size:13px; font-weight:700; color:var(--dark-sub); letter-spacing:.02em; }
.hp-input{ background:#131B2E; border:1.5px solid rgba(255,255,255,0.1); border-radius:14px; padding:14px 18px; font-size:15px; color:#fff; font-family:inherit; transition:all 0.25s; }
.hp-input::placeholder{ color:#4E5A73; }
.hp-input:focus{ outline:none; border-color:var(--accent); background:#17223b; box-shadow:0 0 0 4px rgba(251,191,36,.25); }
.hp-form-err{ color:#fca5a5; font-size:14px; font-weight:600; }
.hp-form-submit{ margin-top:8px; padding:16px; font-size:16px; }
.hp-form-done{ display:flex; flex-direction:column; gap:16px; align-items:center; justify-content:center; flex:1; text-align:center; padding:30px 0; }
.hp-form-done-ico{ width:64px; height:64px; border-radius:50%; background:var(--accent); display:grid; place-items:center; box-shadow: 0 0 20px rgba(251,191,36,0.4); }
.hp-form-done-title{ font-family:${DISPLAY}; font-weight:800; font-size:22px; color:var(--accent); }
.hp-form-done-text{ margin:0; font-size:15px; color:var(--dark-sub); line-height:1.6; }

/* ── Footer ── */
.hp-footer{ background:#fff; border-top:1px solid var(--border); padding:64px 0 32px; }
.hp-footer-grid{ display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:40px; align-items:start; }
.hp-footer-brand{ display:inline-flex; align-items:center; gap:8px; font-family:${DISPLAY}; font-weight:800; font-size:20px; color:var(--ink); }
.hp-footer-brand svg { color: var(--accent); }
.hp-footer-addr{ margin:14px 0 0; font-size:14px; color:var(--sub); line-height:1.65; max-width:36ch; }
.hp-footer-nav{ display:flex; flex-direction:column; gap:12px; font-size:14.5px; font-weight:700; color:var(--sub); }
.hp-footer-contact{ display:flex; flex-direction:column; gap:16px; align-items:flex-start; }
.hp-footer-cta{ font-size:15px; padding:12px 24px; box-shadow: 0 8px 18px -8px rgba(59,130,246,0.3); }
.hp-footer-fb{ display:inline-flex; align-items:center; gap:8px; font-size:14.5px; font-weight:800; color:var(--blue); }
.hp-footer-bottom{ margin-top:40px; padding-top:24px; border-top:1px solid var(--border); font-size:13px; color:#94A3B8; text-align:center; }

/* ── Responsive ── */
@media (max-width:900px){
  .hp-sec{ padding:60px 0; }
  .hp-hero { clip-path: polygon(0 0, 100% 0, 100% 93%, 0 100%); padding-bottom: clamp(100px, 15vw, 140px) !important; }
  .hp-hero-grid{ grid-template-columns:1fr; gap:44px; }
  .hp-hero-media{ max-width:440px; margin:0 auto; width:100%; }
  .hp-stats{ grid-template-columns:repeat(2,1fr); }
  .hp-grid-3{ grid-template-columns:repeat(2,1fr); }
  .hp-contact{ grid-template-columns:1fr; gap:40px; }
  .hp-form{ order:-1; }
  .hp-footer-grid{ grid-template-columns:1fr 1fr; gap:32px; }
  .hp-head-row{ flex-direction:column; align-items:stretch; gap:10px; }
  .hp-nav-arrows{ margin-bottom:20px; }
}
@media (max-width:600px){
  .hp-grid-3,.hp-grid-2,.hp-stats{ grid-template-columns:1fr; }
  .hp-hero-cta{ flex-direction:column; }
  .hp-hero-cta .hp-btn{ width:100%; }
  .hp-footer-grid{ grid-template-columns:1fr; gap:24px; }
  .hp-hero-badge{ padding:12px 18px; left:-6px; bottom:20px; }
  .hp-hero-badge-num{ font-size:24px; }
  .hp-hero-rating{ padding:10px 14px; right:-6px; top:12px; }
  .hp-sched-filters{ border-radius:24px; padding:14px; flex-direction:column; align-items:flex-start; gap:12px; }
  .hp-sched-count{ margin-left:0; width:100%; text-align:center; }
}

/* ── Nút liên hệ nổi (Zalo · Messenger · Gọi) ── */
.cd{ position:fixed; left:20px; bottom:20px; z-index:900; display:flex; flex-direction:column; gap:14px;
  padding-bottom:env(safe-area-inset-bottom); }
.cd-btn{ position:relative; width:56px; height:56px; border-radius:50%; display:grid; place-items:center;
  color:#fff; text-decoration:none; box-shadow:0 12px 28px -8px rgba(15,23,42,.45);
  transition:all .25s cubic-bezier(0.25, 1, 0.5, 1); -webkit-tap-highlight-color:transparent; }
.cd-btn:hover{ transform:scale(1.1) translateY(-2px); box-shadow:0 18px 32px -8px rgba(15,23,42,.55); }
.cd-btn:focus-visible{ outline:3px solid ${C.accent}; outline-offset:3px; }
.cd-btn:active{ transform:scale(.95); }
.cd-zalo{ background:#0068FF; --rc:rgba(0,104,255,.5); }
.cd-mess{ background:linear-gradient(135deg,#00B2FF 0%,#006AFF 35%,#A033FF 75%,#FF5285 100%); --rc:rgba(0,106,255,.5); }
.cd-call{ background:#16A34A; --rc:rgba(22,163,74,.5); }
.cd-zalo-word{ position:relative; z-index:1; font-family:${DISPLAY}; font-weight:800; font-size:16px; letter-spacing:-.02em; }
.cd-ring{ position:absolute; inset:0; border-radius:50%; z-index:0; animation:cdPulse 2s cubic-bezier(.66,0,0,1) infinite; }
@keyframes cdPulse{ 0%{ box-shadow:0 0 0 0 var(--rc); } 70%{ box-shadow:0 0 0 18px rgba(0,0,0,0); } 100%{ box-shadow:0 0 0 0 rgba(0,0,0,0); } }
.cd-label{ position:absolute; left:68px; top:50%; transform:translateY(-50%) translateX(-6px);
  white-space:nowrap; background:${C.dark}; color:#fff; padding:8px 14px; border-radius:10px;
  font-family:${BODY}; font-size:13px; font-weight:700; opacity:0; pointer-events:none;
  box-shadow:0 8px 20px -8px rgba(15,23,42,.5); transition:opacity .2s ease, transform .2s ease; }
.cd-label::after{ content:""; position:absolute; left:-4px; top:50%; transform:translateY(-50%) rotate(45deg);
  width:9px; height:9px; background:${C.dark}; border-radius:2px; }
.cd-btn:hover .cd-label, .cd-btn:focus-visible .cd-label{ opacity:1; transform:translateY(-50%) translateX(0); }
@media (prefers-reduced-motion:reduce){ .cd-ring{ animation:none; } }
@media (max-width:600px){ .cd{ left:16px; bottom:16px; gap:12px; } .cd-btn{ width:50px; height:50px; } .cd-label{ display:none; } }
`

// HomePage.jsx — Trang chủ Trung tâm Ánh Sáng (thiết kế "Nắng vàng" v2)
// Nội dung load từ /api/site-content — super admin chỉnh sửa trong trang Quản trị.
// Data contract giữ nguyên: info / stats / teachers / courses / schedule / achievements / testimonials.
import React, { useEffect, useRef, useState } from 'react'

// ====== Màu sắc & font (design tokens) ======
const C = {
  bg: '#FFFBF0',
  cream2: '#FFF6E4',
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

/* ── HERO ── */
function Hero({ info }) {
  return (
    <section id="gioithieu" className="hp-sec hp-hero">
      <div className="hp-hero-glow" aria-hidden="true" />
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
              <a href={info.fb} target="_blank" rel="noopener noreferrer" className="hp-meta-item hp-link" style={{ color: C.badgeText, fontWeight: 700 }}>
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
    <section className="hp-sec hp-sec--tight">
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
                      <td key={di} className="hp-sched-cell" style={{ background: si % 2 ? '#FFFDF6' : '#fff' }}>
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
      {showAdvice && <AdvicePopup info={info} onClose={() => setShowAdvice(false)} />}
    </div>
  )
}

// ====== Stylesheet (scoped dưới .hp) ======
const HP_CSS = `
.hp{
  --bg:${C.bg}; --cream2:${C.cream2}; --ink:${C.ink}; --sub:${C.sub};
  --accent:${C.accent}; --accent-d:${C.accentDark}; --badge-bg:${C.badgeBg};
  --badge-tx:${C.badgeText}; --border:${C.border}; --dark:${C.dark}; --dark-sub:${C.darkSub};
  color:var(--ink); font-family:${BODY}; min-height:100vh;
  scroll-behavior:smooth; -webkit-font-smoothing:antialiased;
}
.hp *{ box-sizing:border-box; }
.hp ::selection{ background:${C.accent}44; }

/* Layout */
.hp-wrap{ width:100%; max-width:1180px; margin:0 auto; }
.hp-sec{ padding:clamp(52px,8vw,88px) clamp(18px,5vw,48px); position:relative; scroll-margin-top:76px; }
.hp-sec--tight{ padding-top:0; margin-top:-18px; }
.hp-sec--white{ background:#fff; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
.hp-sec--cream{ background:var(--badge-bg); }

/* Eyebrow + titles */
.hp-kicker{ display:inline-flex; align-items:center; gap:7px; color:var(--accent-d);
  font-weight:800; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; margin-bottom:14px; }
.hp-h1{ margin:0; font-family:${DISPLAY}; font-weight:800; font-size:clamp(33px,5.4vw,54px); line-height:1.1; letter-spacing:-.01em; text-wrap:balance; }
.hp-h2{ margin:0 0 12px; font-family:${DISPLAY}; font-weight:800; font-size:clamp(27px,3.6vw,36px); line-height:1.15; letter-spacing:-.01em; text-wrap:balance; }
.hp-lead{ margin:0; color:var(--sub); font-size:clamp(15px,1.6vw,16.5px); line-height:1.65; max-width:56ch; }

/* Buttons */
.hp-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:${BODY};
  font-weight:700; font-size:15px; padding:13px 22px; border-radius:999px; border:1.5px solid transparent;
  text-decoration:none; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, filter .18s ease; }
.hp-btn:focus-visible{ outline:3px solid ${C.accent}88; outline-offset:2px; }
.hp-btn--primary{ background:var(--ink); color:var(--bg); box-shadow:0 10px 24px -12px rgba(43,36,22,.6); }
.hp-btn--primary:hover{ transform:translateY(-2px); box-shadow:0 16px 30px -12px rgba(43,36,22,.55); filter:brightness(1.08); }
.hp-btn--accent{ background:var(--accent); color:var(--dark); box-shadow:0 10px 24px -10px rgba(242,167,12,.65); }
.hp-btn--accent:hover{ transform:translateY(-2px); box-shadow:0 16px 32px -10px rgba(242,167,12,.7); filter:brightness(1.05); }
.hp-btn--ghost{ background:#fff; color:var(--ink); border-color:var(--border); }
.hp-btn--ghost:hover{ transform:translateY(-2px); border-color:var(--accent); box-shadow:0 10px 22px -12px rgba(122,88,10,.4); }
.hp-btn:active{ transform:translateY(0) scale(.98); }

.hp-link{ color:inherit; text-decoration:none; transition:color .15s ease; }
.hp-link:hover{ color:var(--accent-d); }
.hp-link:focus-visible{ outline:2px solid ${C.accent}88; outline-offset:2px; border-radius:4px; }

/* Cards */
.hp-card{ background:#fff; border:1px solid var(--border); border-radius:22px;
  transition:transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
.hp-card:hover{ transform:translateY(-5px); box-shadow:0 22px 44px -22px rgba(122,88,10,.4); border-color:${C.accent}66; }

/* Reveal */
.hp-reveal{ opacity:0; transform:translateY(26px); transition:opacity .6s ease, transform .7s cubic-bezier(.22,1,.36,1); }
.hp-reveal.is-in{ opacity:1; transform:none; }
@media (prefers-reduced-motion:reduce){ .hp,.hp *{ scroll-behavior:auto !important; } .hp-reveal{ opacity:1 !important; transform:none !important; transition:none !important; } }

/* ── HERO ── */
.hp-hero{ overflow:hidden; }
.hp-hero-glow{ position:absolute; inset:0; pointer-events:none; z-index:0;
  background:
    radial-gradient(680px 460px at 78% 8%, ${C.accent}2e, transparent 62%),
    radial-gradient(560px 420px at 4% 96%, ${C.accent}1c, transparent 60%); }
.hp-hero-grid{ position:relative; z-index:1; display:grid; grid-template-columns:1.05fr .92fr; gap:clamp(30px,5vw,56px); align-items:center; }
.hp-hero-copy{ display:flex; flex-direction:column; gap:20px; }
.hp-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.hp-chip{ display:inline-flex; align-items:center; gap:7px; background:var(--badge-bg); color:var(--badge-tx);
  font-size:13px; font-weight:700; padding:7px 14px; border-radius:999px; }
.hp-chip-dot{ width:7px; height:7px; border-radius:50%; background:var(--accent); flex:none; }
.hp-hero-desc{ margin:0; font-size:clamp(15.5px,1.7vw,17.5px); line-height:1.65; color:var(--sub); max-width:52ch; text-wrap:pretty; }
.hp-hero-cta{ display:flex; flex-wrap:wrap; gap:12px; margin-top:2px; }
.hp-hero-meta{ display:flex; flex-direction:column; gap:11px; margin-top:8px; }
.hp-meta-item{ display:inline-flex; align-items:center; gap:9px; font-size:14.5px; color:var(--sub); }
.hp-meta-item svg{ color:var(--accent-d); }

.hp-hero-media{ position:relative; display:flex; justify-content:center; }
.hp-hero-frame{ position:relative; width:100%; max-width:460px; }
.hp-hero-frame::before{ content:""; position:absolute; inset:-14px -14px 14px 14px; border-radius:32px;
  background:linear-gradient(150deg, ${C.accent}30, ${C.accent}0d); z-index:0; }
.hp-hero-photo{ position:relative; z-index:1; width:100%; aspect-ratio:4/4.5; object-fit:cover; border-radius:28px;
  box-shadow:0 30px 60px -26px rgba(122,88,10,.5); transition:transform .4s ease, box-shadow .4s ease; }
.hp-hero-frame:hover .hp-hero-photo{ transform:translateY(-4px) rotate(-1deg); box-shadow:0 40px 70px -28px rgba(122,88,10,.55); }
.hp-hero-placeholder{ display:grid; place-items:center; color:${C.accentDark};
  background:linear-gradient(160deg, ${C.badgeBg}, ${C.accent}55); }
.hp-hero-badge{ position:absolute; left:-6px; bottom:34px; z-index:2; background:#fff; border:1px solid var(--border);
  border-radius:18px; padding:14px 20px; box-shadow:0 16px 34px -16px rgba(122,88,10,.4); }
.hp-hero-badge-num{ font-family:${DISPLAY}; font-weight:800; font-size:27px; color:var(--accent-d); line-height:1; }
.hp-hero-badge-label{ font-size:12.5px; font-weight:600; color:var(--sub); margin-top:3px; }
.hp-hero-rating{ position:absolute; right:-4px; top:22px; z-index:2; display:flex; flex-direction:column; gap:4px;
  background:#fff; border:1px solid var(--border); border-radius:14px; padding:10px 14px; box-shadow:0 14px 30px -16px rgba(122,88,10,.4);
  font-size:12px; font-weight:700; color:var(--sub); }
.hp-stars{ display:inline-flex; gap:2px; }

/* ── STATS ── */
.hp-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:clamp(14px,2vw,18px); }
.hp-stat{ padding:24px 26px; display:flex; flex-direction:column; gap:5px; }
.hp-stat-num{ font-family:${DISPLAY}; font-weight:800; font-size:clamp(28px,3.2vw,34px); color:var(--accent-d); line-height:1; }
.hp-stat-label{ font-size:13.5px; font-weight:600; color:var(--sub); }

/* ── Section head row (title + arrows) ── */
.hp-head-row{ display:flex; align-items:flex-end; gap:16px; }
.hp-nav-arrows{ display:flex; gap:10px; margin-bottom:34px; }
.hp-arrow{ width:44px; height:44px; border-radius:50%; border:1.5px solid var(--border); background:#fff;
  color:var(--accent-d); cursor:pointer; display:grid; place-items:center;
  box-shadow:0 6px 14px -8px rgba(122,88,10,.35); transition:all .18s ease; }
.hp-arrow:hover{ background:var(--accent); color:#fff; border-color:var(--accent); transform:scale(1.08); }
.hp-arrow:focus-visible{ outline:3px solid ${C.accent}88; outline-offset:2px; }

/* ── Carousel + grids ── */
.hp-carousel{ overflow:hidden; }
.hp-carousel-track{ display:flex; transition:transform .55s cubic-bezier(.4,0,.2,1); }
.hp-carousel-page{ padding:6px 3px; }
.hp-grid-3{ display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(16px,2.4vw,22px); }
.hp-grid-2{ display:grid; grid-template-columns:repeat(2,1fr); gap:clamp(18px,2.6vw,24px); }

.hp-teacher{ padding:26px; display:flex; flex-direction:column; gap:14px; align-items:flex-start; background:var(--bg); }
.hp-teacher-avatar{ width:92px; height:92px; border-radius:50%; object-fit:cover; border:3px solid var(--badge-bg);
  transition:transform .25s ease, box-shadow .25s ease; }
.hp-card:hover .hp-teacher-avatar{ transform:scale(1.06); box-shadow:0 10px 22px -10px rgba(242,167,12,.6); }
.hp-teacher-initial{ display:grid; place-items:center; background:var(--badge-bg); color:var(--badge-tx); font-family:${DISPLAY}; font-weight:800; font-size:24px; }
.hp-teacher-name{ font-family:${DISPLAY}; font-weight:800; font-size:20px; }
.hp-teacher-subject{ font-size:13.5px; font-weight:700; color:var(--accent-d); margin-top:3px; }
.hp-teacher-bio{ margin:0; font-size:14px; line-height:1.6; color:var(--sub); }

.hp-dots{ display:flex; gap:8px; justify-content:center; margin-top:26px; }
.hp-dot{ width:10px; height:10px; border-radius:999px; border:none; background:var(--border); cursor:pointer; padding:0; transition:all .3s ease; }
.hp-dot[data-active="true"]{ width:26px; background:var(--accent); }
.hp-dot:focus-visible{ outline:2px solid ${C.accent}88; outline-offset:2px; }

/* ── Courses ── */
.hp-course{ padding:28px 26px; display:flex; flex-direction:column; gap:12px; }
.hp-course--featured{ background:var(--dark); border:none; color:var(--bg); }
.hp-course--featured:hover{ box-shadow:0 24px 46px -20px rgba(43,36,22,.6); }
.hp-course-top{ display:flex; align-items:center; gap:10px; }
.hp-course-name{ margin:0; font-family:${DISPLAY}; font-weight:800; font-size:20px; }
.hp-ribbon{ display:inline-flex; align-items:center; gap:5px; background:var(--accent); color:var(--dark);
  font-size:11px; font-weight:800; letter-spacing:.04em; padding:5px 10px; border-radius:999px; }
.hp-course-desc{ margin:0; font-size:14px; line-height:1.65; color:var(--sub); }
.hp-course--featured .hp-course-desc{ color:var(--dark-sub); }
.hp-course-foot{ margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding-top:8px; }
.hp-course-fee{ font-family:${DISPLAY}; font-weight:800; font-size:24px; color:var(--accent-d); }
.hp-course--featured .hp-course-fee{ color:var(--accent); }
.hp-course-per{ font-family:${BODY}; font-weight:600; font-size:13px; color:var(--sub); }
.hp-course--featured .hp-course-per{ color:var(--dark-sub); }
.hp-course-link{ display:inline-flex; align-items:center; gap:4px; font-size:13.5px; font-weight:800; color:var(--badge-tx); text-decoration:none; white-space:nowrap; transition:gap .18s ease, color .18s ease; }
.hp-course--featured .hp-course-link{ color:var(--accent); }
.hp-course-link:hover{ gap:8px; }

/* ── Modal (advice) ── */
.hp-modal-scrim{ position:fixed; inset:0; background:rgba(43,36,22,.5); z-index:1000; display:grid; place-items:center;
  backdrop-filter:blur(3px); animation:hpFade .25s ease; padding:24px; }
.hp-modal{ background:var(--bg); border:1px solid var(--border); border-radius:26px; padding:38px 40px; max-width:420px; width:100%;
  text-align:center; box-shadow:0 40px 80px -24px rgba(43,36,22,.6); position:relative; animation:hpPop .3s cubic-bezier(.34,1.56,.64,1); }
.hp-modal-close{ position:absolute; top:14px; right:16px; background:none; border:none; font-size:18px; cursor:pointer; color:var(--sub); line-height:1; padding:6px; border-radius:8px; }
.hp-modal-close:hover{ color:var(--ink); background:var(--badge-bg); }
.hp-modal-icon{ width:60px; height:60px; margin:0 auto 14px; border-radius:50%; background:var(--badge-bg); display:grid; place-items:center; }
.hp-modal-title{ font-family:${DISPLAY}; font-weight:800; font-size:24px; margin-bottom:10px; }
.hp-modal-text{ margin:0 0 20px; font-size:15px; line-height:1.65; color:var(--sub); }
.hp-modal-cta{ font-size:17px; padding:14px 28px; }
@keyframes hpFade{ from{opacity:0} to{opacity:1} }
@keyframes hpPop{ from{opacity:0; transform:scale(.9) translateY(14px)} to{opacity:1; transform:none} }
@media (prefers-reduced-motion:reduce){ .hp-modal-scrim,.hp-modal{ animation:none !important; } }

/* ── Schedule ── */
.hp-sched-filters{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:22px; align-items:center; }
.hp-sched-filter-label{ display:inline-flex; align-items:center; gap:6px; font-size:13.5px; font-weight:800; color:var(--badge-tx); margin-right:4px; }
.hp-sched-filter{ border:1.5px solid var(--border); background:#fff; color:var(--sub); font-weight:800; font-size:13px;
  padding:8px 16px; border-radius:999px; cursor:pointer; transition:all .18s ease; }
.hp-sched-filter:hover{ transform:translateY(-2px); box-shadow:0 6px 14px -6px rgba(122,88,10,.4); }
.hp-sched-filter[data-active="true"]{ border-color:var(--accent); background:var(--accent); color:#fff; box-shadow:0 6px 16px -6px rgba(242,167,12,.6); }
.hp-sched-filter:focus-visible{ outline:3px solid ${C.accent}88; outline-offset:2px; }
.hp-sched-count{ font-size:13px; font-weight:700; margin-left:4px; }
.hp-sched-scroll{ overflow-x:auto; border-radius:22px; border:1px solid var(--border); box-shadow:0 20px 44px -24px rgba(122,88,10,.4); }
.hp-sched-table{ border-collapse:separate; border-spacing:0; width:100%; min-width:1040px; background:#fff; }
.hp-sched-th{ background:var(--ink); color:var(--bg); font-family:${DISPLAY}; font-weight:800; font-size:14px; padding:14px 12px; min-width:130px; }
.hp-sched-th--time{ position:sticky; left:0; z-index:2; text-align:left; min-width:104px; }
.hp-sched-table thead th:first-child{ border-top-left-radius:22px; }
.hp-sched-table thead th:last-child{ border-top-right-radius:22px; }
.hp-sched-time{ position:sticky; left:0; z-index:1; background:var(--badge-bg); color:var(--badge-tx); font-weight:800; font-size:13px;
  padding:12px 16px; white-space:nowrap; border-bottom:1px solid var(--border); border-right:2px solid var(--border); vertical-align:top; }
.hp-sched-cell{ padding:7px; border-bottom:1px solid var(--border); border-right:1px dashed var(--border); vertical-align:top; }
.hp-sched-cell:last-child{ border-right:none; }
.hp-sched-pill{ border-radius:8px; padding:6px 9px; font-size:12px; font-weight:700; line-height:1.35;
  transition:opacity .3s ease, transform .15s ease, box-shadow .15s ease, filter .15s ease; }
.hp-sched-pill:hover{ transform:translateX(3px) scale(1.04); box-shadow:0 4px 12px -4px rgba(43,36,22,.25); filter:saturate(1.25); }
.hp-legend{ display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; align-items:center; }
.hp-legend-label{ font-size:13px; font-weight:800; color:var(--badge-tx); }
.hp-legend-item{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--sub);
  background:#fff; border:1px solid var(--border); border-radius:999px; padding:5px 12px; }
.hp-legend-swatch{ width:10px; height:10px; border-radius:3px; }

/* ── Achievements ── */
.hp-achv{ margin:0; overflow:hidden; display:flex; flex-direction:column; background:var(--bg); }
.hp-achv-imgwrap{ overflow:hidden; }
.hp-achv-img{ width:100%; aspect-ratio:4/3; object-fit:cover; display:block; transition:transform .45s ease; }
.hp-achv:hover .hp-achv-img{ transform:scale(1.05); }
.hp-achv-cap{ padding:16px 20px; font-size:14.5px; font-weight:600; color:var(--ink); line-height:1.55; display:flex; gap:10px; align-items:flex-start; }

/* ── Testimonials ── */
.hp-quote{ margin:0; padding:26px; display:flex; flex-direction:column; gap:14px; }
.hp-quote-text{ margin:0; font-size:15px; line-height:1.65; color:var(--ink); }
.hp-quote-who{ display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700; color:var(--badge-tx); }
.hp-quote-ava{ width:34px; height:34px; border-radius:50%; background:var(--badge-bg); color:var(--badge-tx);
  display:grid; place-items:center; font-family:${DISPLAY}; font-weight:800; font-size:15px; flex:none; }

/* ── Contact ── */
.hp-contact{ display:grid; grid-template-columns:1fr 1fr; gap:clamp(20px,3vw,28px); align-items:stretch; }
.hp-contact-info{ display:flex; flex-direction:column; gap:16px; }
.hp-contact-rows{ display:flex; flex-direction:column; gap:12px; }
.hp-contact-item{ display:inline-flex; align-items:center; gap:12px; font-size:15px; color:var(--sub); line-height:1.5; }
.hp-contact-ico{ width:40px; height:40px; border-radius:12px; background:var(--badge-bg); color:var(--accent-d); display:grid; place-items:center; flex:none; }
.hp-map{ border:0; width:100%; flex:1; min-height:280px; border-radius:20px; margin-top:4px; }
.hp-form{ background:var(--dark); border-radius:26px; padding:clamp(26px,3vw,36px); display:flex; flex-direction:column; gap:14px; color:var(--bg); }
.hp-form-title{ margin:0; font-family:${DISPLAY}; font-weight:800; font-size:26px; }
.hp-form-sub{ margin:0 0 2px; font-size:14px; color:var(--dark-sub); line-height:1.6; }
.hp-field{ display:flex; flex-direction:column; gap:6px; }
.hp-label{ font-size:12.5px; font-weight:700; color:var(--dark-sub); letter-spacing:.02em; }
.hp-input{ background:#3A3220; border:1px solid #55492E; border-radius:14px; padding:13px 15px; font-size:15px; color:var(--bg); font-family:inherit; transition:border-color .18s ease, box-shadow .18s ease; }
.hp-input::placeholder{ color:#9C8E6E; }
.hp-input:focus{ outline:none; border-color:var(--accent); box-shadow:0 0 0 3px ${C.accent}33; }
.hp-form-err{ color:#fca5a5; font-size:13.5px; }
.hp-form-submit{ margin-top:4px; padding:15px; font-size:15.5px; }
.hp-form-done{ display:flex; flex-direction:column; gap:12px; align-items:center; justify-content:center; flex:1; text-align:center; padding:20px 0; }
.hp-form-done-ico{ width:60px; height:60px; border-radius:50%; background:var(--accent); display:grid; place-items:center; }
.hp-form-done-title{ font-family:${DISPLAY}; font-weight:800; font-size:20px; color:var(--accent); }
.hp-form-done-text{ margin:0; font-size:14.5px; color:var(--dark-sub); line-height:1.6; }

/* ── Footer ── */
.hp-footer{ background:#fff; border-top:1px solid var(--border); padding:clamp(32px,5vw,48px) clamp(18px,5vw,48px) 24px; }
.hp-footer-grid{ display:grid; grid-template-columns:1.3fr 1fr 1fr; gap:28px; align-items:start; }
.hp-footer-brand{ display:inline-flex; align-items:center; gap:8px; font-family:${DISPLAY}; font-weight:800; font-size:18px; color:var(--ink); }
.hp-footer-addr{ margin:10px 0 0; font-size:13.5px; color:var(--sub); line-height:1.6; max-width:34ch; }
.hp-footer-nav{ display:flex; flex-direction:column; gap:9px; font-size:14px; font-weight:600; color:var(--sub); }
.hp-footer-contact{ display:flex; flex-direction:column; gap:12px; align-items:flex-start; }
.hp-footer-cta{ font-size:14.5px; padding:11px 20px; }
.hp-footer-fb{ display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:700; color:var(--badge-tx); }
.hp-footer-bottom{ margin-top:26px; padding-top:20px; border-top:1px solid var(--border); font-size:12.5px; color:#8A7A54; }

/* ── Responsive ── */
@media (max-width:900px){
  .hp-hero-grid{ grid-template-columns:1fr; gap:36px; }
  .hp-hero-media{ max-width:460px; margin:0 auto; width:100%; }
  .hp-stats{ grid-template-columns:repeat(2,1fr); }
  .hp-grid-3{ grid-template-columns:repeat(2,1fr); }
  .hp-contact{ grid-template-columns:1fr; }
  .hp-form{ order:-1; }
  .hp-footer-grid{ grid-template-columns:1fr 1fr; }
  .hp-head-row{ flex-direction:column; align-items:stretch; }
  .hp-nav-arrows{ margin-bottom:20px; }
}
@media (max-width:600px){
  .hp-grid-3,.hp-grid-2,.hp-stats{ grid-template-columns:1fr; }
  .hp-hero-cta .hp-btn{ flex:1; }
  .hp-footer-grid{ grid-template-columns:1fr; gap:20px; }
  .hp-hero-badge{ padding:12px 16px; }
  .hp-hero-rating{ display:none; }
}
`

// ReportsTab.jsx — Super admin xem báo cáo tổng hợp: vắng học / bỏ bài / điểm thấp
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadReportsCsv, getReports, markReports, notifyReports } from '../store/attendanceStore.js'
import { getAllClasses } from '../store/classStore.js'

/* ─── Icons ─── */
function Svg({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }}>{children}</svg>
  )
}
const IcSearch = (s = 16) => <Svg size={s}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>
const IcEye    = (s = 16) => <Svg size={s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>
const IcMail   = (s = 16) => <Svg size={s}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></Svg>
const IcCheck  = (s = 16) => <Svg size={s} ><polyline points="20 6 9 17 4 12" /></Svg>
const IcDown   = (s = 16) => <Svg size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Svg>
const IcUndo   = (s = 16) => <Svg size={s}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></Svg>
const IcX      = (s = 16) => <Svg size={s}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>

/* ─── Loại báo cáo: mỗi loại một màu riêng để quét bảng bằng mắt cho nhanh ─── */
const TYPES = {
  vang_hoc:  { label: 'Vắng học',  icon: '🗓️', tone: 'orange' },
  bo_bai:    { label: 'Bỏ bài',    icon: '📝', tone: 'red' },
  diem_thap: { label: 'Điểm thấp', icon: '📉', tone: 'amber' },
}
const TYPE_ORDER = ['vang_hoc', 'bo_bai', 'diem_thap']

const PER_PAGE = 20

/* ─── Ngày giờ ─── */
const pad = n => String(n).padStart(2, '0')
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysAgo = (n) => { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d }
/* input[type=date] dùng ngày local dạng YYYY-MM-DD */
const dateInputValue = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDateInput = (s) => {
  const [y, m, d] = (s || '').split('-').map(Number)
  return (y && m && d) ? new Date(y, m - 1, d) : null
}

/* "08:26 · 23/08" — năm chỉ hiện khi khác năm hiện tại */
function fmtWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const day  = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `/${d.getFullYear()}`
  return `${time} · ${day}${year}`
}

const fmtNum = n => (n == null ? '' : String(Math.round(Number(n) * 100) / 100))

/* ─── Rút gọn nội dung ────────────────────────────────────────────────────────
   Báo cáo cũ ghi cả câu "Học sinh X không nộp bài 'Y' (lớp Z)" — tên học sinh và
   lớp đã có cột riêng nên cắt bỏ, chỉ giữ phần thông tin thật sự mới.            */
function stripRepeats(r) {
  let t = r.detail || ''
  if (r.studentName) t = t.split(`Học sinh ${r.studentName} `).join('')
  if (r.className) {
    t = t.split(`(lớp ${r.className})`).join('').split(`của lớp ${r.className}`).join('')
  }
  // Cắt xong hay còn khoảng trắng lửng trước dấu câu: " , dưới ngưỡng" → ", dưới ngưỡng"
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/^,|,$/g, '').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}

/* Tên bài tập / buổi học liên quan — báo cáo cũ chỉ có trong `title` */
function reportContext(r) {
  if (r.context) return r.context
  const i = (r.title || '').indexOf(': ')
  return i >= 0 ? r.title.slice(i + 2) : ''
}

/* Nội dung hiển thị ở cột chính: { main, sub } */
function reportContent(r) {
  const ctx = reportContext(r)
  if (r.type === 'diem_thap') {
    const hasScore = r.score != null && r.maxScore
    return {
      main: hasScore ? `Điểm ${fmtNum(r.score)}/${fmtNum(r.maxScore)}` : (stripRepeats(r) || 'Điểm dưới ngưỡng'),
      sub:  hasScore ? ctx : '',
    }
  }
  if (r.type === 'bo_bai') {
    return { main: ctx || 'Không nộp bài', sub: 'Không nộp đúng hạn' }
  }
  // vang_hoc — ưu tiên ghi chú của giáo viên
  return { main: (r.note || '').trim() || stripRepeats(r) || 'Vắng không phép', sub: ctx }
}

/* Chữ cái đầu làm avatar khi học sinh chưa có ảnh */
const initialOf = name => (name || '?').trim()[0]?.toUpperCase() || '?'
const AVATAR_TONES = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F43F5E', '#6366F1']
const avatarTone = (id) => AVATAR_TONES[Math.abs(String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_TONES.length]

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ReportsTab({ viewerId, onCount }) {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [counts, setCounts]   = useState({ byType: {}, pending: 0, all: 0 })
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [busy, setBusy]       = useState('')
  const [toast, setToast]     = useState('')

  // Bộ lọc
  const [type, setType]       = useState('')
  const [classId, setClassId] = useState('')
  const [status, setStatus]   = useState('')
  const [range, setRange]     = useState('all')      // all | today | 7d | 30d | custom
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [search, setSearch]   = useState('')
  const [q, setQ]             = useState('')          // bản đã trễ nhịp của `search`
  const [page, setPage]       = useState(1)

  // Chọn nhiều + mở rộng dòng
  const [selected, setSelected] = useState(() => new Set())
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { getAllClasses(viewerId).then(setClasses).catch(() => {}) }, [viewerId])

  // Gõ tới đâu tìm tới đó, nhưng chờ 350ms cho ngớt phím rồi mới gọi server
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  /* Khoảng ngày gửi lên server: mốc nửa đêm THEO GIỜ MÁY, quy sang ISO — cắt theo
     ngày UTC sẽ lệch 7 tiếng, "hôm nay" hụt mất các báo cáo lúc rạng sáng. */
  const dateRange = useMemo(() => {
    const endOfToday = () => { const d = startOfDay(new Date()); d.setDate(d.getDate() + 1); return d }
    if (range === 'today') return { dateFrom: startOfDay(new Date()).toISOString(), dateTo: endOfToday().toISOString() }
    if (range === '7d')    return { dateFrom: daysAgo(6).toISOString(),  dateTo: endOfToday().toISOString() }
    if (range === '30d')   return { dateFrom: daysAgo(29).toISOString(), dateTo: endOfToday().toISOString() }
    if (range === 'custom') {
      const f = parseDateInput(customFrom)
      const t = parseDateInput(customTo)
      if (t) t.setDate(t.getDate() + 1)     // bao trọn cả ngày kết thúc
      return { dateFrom: f ? f.toISOString() : '', dateTo: t ? t.toISOString() : '' }
    }
    return { dateFrom: '', dateTo: '' }
  }, [range, customFrom, customTo])

  const filters = useMemo(
    () => ({ type, classId, q, status, viewerId, ...dateRange }),
    [type, classId, q, status, viewerId, dateRange],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReports({ ...filters, limit: PER_PAGE, offset: (page - 1) * PER_PAGE })
      setRows(data.rows || [])
      setTotal(data.total || 0)
      setCounts(data.counts || { byType: {}, pending: 0, all: 0 })
    } catch {
      setRows([]); setTotal(0)
    }
    setLoading(false)
  }, [filters, page])

  useEffect(() => { load() }, [load])

  // Đổi bộ lọc/trang → bỏ chọn, tránh thao tác hàng loạt lên dòng không còn thấy
  useEffect(() => { setSelected(new Set()); setExpanded(null) }, [filters, page])

  // Số cạnh tiêu đề tab = TỔNG toàn hệ thống (không đổi theo bộ lọc, tránh hiểu
  // nhầm); con số đang lọc đã có ở dòng tóm tắt bên dưới bộ lọc.
  const onCountRef = useRef(onCount)
  onCountRef.current = onCount
  useEffect(() => { onCountRef.current?.(counts.grandTotal ?? total) }, [counts.grandTotal, total])

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.id))
  const someChecked = rows.some(r => selected.has(r.id)) && !allChecked

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map(r => r.id)))

  const resetFilters = () => {
    setType(''); setClassId(''); setStatus(''); setRange('all')
    setCustomFrom(''); setCustomTo(''); setSearch(''); setPage(1)
  }
  const hasFilters = !!(type || classId || status || range !== 'all' || q)

  const runMark = async (ids, next) => {
    if (!ids.length) return
    setBusy('mark')
    try {
      await markReports(ids, next)
      flash(next === 'da_xu_ly' ? `Đã đánh dấu xử lý ${ids.length} báo cáo.` : `Đã mở lại ${ids.length} báo cáo.`)
      setSelected(new Set())
      load()
    } catch (e) { flash(e.message) } finally { setBusy('') }
  }

  const runNotify = async (ids) => {
    if (!ids.length) return
    if (!confirm(`Gửi nhắc nhở tới ${ids.length} học sinh của các báo cáo đã chọn?`)) return
    setBusy('notify')
    try {
      const res = await notifyReports(ids)
      flash(`Đã gửi nhắc nhở tới ${res.sent} học sinh.`)
    } catch (e) { flash(e.message) } finally { setBusy('') }
  }

  const runExport = async () => {
    setBusy('export')
    try {
      await downloadReportsCsv(filters)
      flash('Đã tải file báo cáo (.csv — mở được bằng Excel).')
    } catch (e) { flash(e.message) } finally { setBusy('') }
  }

  const typeChips = [
    { key: '', label: 'Tất cả', icon: '', tone: 'slate', n: counts.all },
    ...TYPE_ORDER.map(k => ({
      key: k, label: TYPES[k].label, icon: TYPES[k].icon, tone: TYPES[k].tone,
      n: counts.byType?.[k]?.total ?? 0,
    })),
  ]

  return (
    <div className="rp-root">
      {/* ══ Bộ lọc ══ */}
      <div className="rp-filters">
        <div className="rp-filter-row">
          <label className="rp-search">
            <span className="rp-search-icon">{IcSearch(15)}</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên học sinh hoặc mã HS…" />
            {search && (
              <button className="rp-search-clear" onClick={() => setSearch('')} title="Xoá tìm kiếm">
                {IcX(13)}
              </button>
            )}
          </label>

          <select className="rp-select" value={classId}
            onChange={e => { setClassId(e.target.value); setPage(1) }}>
            <option value="">Tất cả lớp</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select className="rp-select" value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="">Mọi trạng thái</option>
            <option value="moi">Chưa xử lý{counts.pending ? ` (${counts.pending})` : ''}</option>
            <option value="da_xu_ly">Đã xử lý</option>
          </select>

          <button className="rp-btn rp-btn--ghost" disabled={busy === 'export' || total === 0}
            onClick={runExport} title="Xuất danh sách đang lọc ra file Excel/CSV">
            {IcDown(14)} {busy === 'export' ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
        </div>

        <div className="rp-filter-row">
          <div className="rp-chips">
            {typeChips.map(c => (
              <button key={c.key}
                className={`rp-chip rp-chip--${c.tone} ${type === c.key ? 'rp-chip--on' : ''}`}
                onClick={() => { setType(c.key); setPage(1) }}>
                {c.icon && <span className="rp-chip-ic">{c.icon}</span>}
                {c.label}
                <span className="rp-chip-n">{c.n}</span>
              </button>
            ))}
          </div>

          <div className="rp-dates">
            {[['all', 'Tất cả'], ['today', 'Hôm nay'], ['7d', '7 ngày'], ['30d', '30 ngày'], ['custom', 'Tuỳ chọn']].map(([k, label]) => (
              <button key={k} className={`rp-date-btn ${range === k ? 'rp-date-btn--on' : ''}`}
                onClick={() => { setRange(k); setPage(1) }}>{label}</button>
            ))}
          </div>
        </div>

        {range === 'custom' && (
          <div className="rp-filter-row rp-custom-range">
            <label>Từ <input type="date" className="rp-date-input" value={customFrom}
              max={customTo || dateInputValue(new Date())}
              onChange={e => { setCustomFrom(e.target.value); setPage(1) }} /></label>
            <label>đến <input type="date" className="rp-date-input" value={customTo}
              min={customFrom} max={dateInputValue(new Date())}
              onChange={e => { setCustomTo(e.target.value); setPage(1) }} /></label>
          </div>
        )}

        {hasFilters && (
          <div className="rp-filter-row rp-filter-summary">
            <span>Đang lọc: <b>{total}</b> / {counts.grandTotal ?? total} báo cáo</span>
            <button className="rp-link-btn" onClick={resetFilters}>{IcUndo(12)} Xoá bộ lọc</button>
          </div>
        )}
      </div>

      {/* ══ Thanh thao tác hàng loạt ══ */}
      {selected.size > 0 && (
        <div className="rp-bulk">
          <span className="rp-bulk-count">Đã chọn <b>{selected.size}</b></span>
          <button className="rp-btn rp-btn--primary" disabled={busy === 'mark'}
            onClick={() => runMark([...selected], 'da_xu_ly')}>
            {IcCheck(14)} Đánh dấu đã xử lý
          </button>
          <button className="rp-btn rp-btn--ghost" disabled={busy === 'mark'}
            onClick={() => runMark([...selected], 'moi')}>
            {IcUndo(14)} Mở lại
          </button>
          <button className="rp-btn rp-btn--ghost" disabled={busy === 'notify'}
            onClick={() => runNotify([...selected])}>
            {IcMail(14)} Gửi nhắc nhở
          </button>
          <button className="rp-link-btn rp-bulk-clear" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}

      {toast && <div className="rp-toast">{toast}</div>}

      {/* ══ Bảng ══ */}
      {loading ? (
        <div className="sa-loading">Đang tải…</div>
      ) : (
        <>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-col-check">
                    <input type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll} aria-label="Chọn tất cả" />
                  </th>
                  <th>Loại</th>
                  <th>Học sinh</th>
                  <th>Lớp</th>
                  <th>Nội dung</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th className="rp-col-act">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="rp-empty">
                    {hasFilters ? 'Không có báo cáo nào khớp bộ lọc.' : 'Chưa có báo cáo nào.'}
                  </td></tr>
                ) : rows.map(r => {
                  const t = TYPES[r.type] || { label: r.type, icon: '•', tone: 'slate' }
                  const { main, sub } = reportContent(r)
                  const done = r.status === 'da_xu_ly'
                  const isOpen = expanded === r.id
                  return (
                    <React.Fragment key={r.id}>
                      <tr className={`${selected.has(r.id) ? 'rp-row--sel' : ''} ${done ? 'rp-row--done' : ''}`}>
                        <td className="rp-col-check">
                          <input type="checkbox" checked={selected.has(r.id)}
                            onChange={() => toggleOne(r.id)}
                            aria-label={`Chọn báo cáo của ${r.studentName}`} />
                        </td>
                        <td data-label="Loại">
                          <span className={`rp-tag rp-tag--${t.tone}`}>{t.icon} {t.label}</span>
                        </td>
                        <td data-label="Học sinh">
                          <div className="rp-student">
                            <span className="rp-avatar" style={{ background: avatarTone(r.studentId) }}>
                              {initialOf(r.studentName)}
                            </span>
                            <span className="rp-student-text">
                              <b>{r.studentName || 'Không rõ'}</b>
                              {r.studentId && <em>#{r.studentId}</em>}
                            </span>
                          </div>
                        </td>
                        <td data-label="Lớp"><span className="rp-class">{r.className || '—'}</span></td>
                        <td data-label="Nội dung" className="rp-content-cell">
                          <span className="rp-content-main" title={r.detail || r.title}>{main}</span>
                          {sub && <span className="rp-content-sub">{sub}</span>}
                        </td>
                        <td data-label="Thời gian"><span className="rp-when">{fmtWhen(r.createdAt)}</span></td>
                        <td data-label="Trạng thái">
                          <span className={`rp-status ${done ? 'rp-status--done' : 'rp-status--new'}`}>
                            {done ? 'Đã xử lý' : 'Chưa xử lý'}
                          </span>
                        </td>
                        <td className="rp-col-act" data-label="Thao tác">
                          <div className="rp-actions">
                            <button className={`rp-icon-btn ${isOpen ? 'rp-icon-btn--on' : ''}`}
                              title="Xem chi tiết báo cáo"
                              onClick={() => setExpanded(isOpen ? null : r.id)}>{IcEye(15)}</button>
                            <button className="rp-icon-btn" title="Gửi nhắc nhở cho học sinh"
                              disabled={busy === 'notify' || !r.studentId}
                              onClick={() => runNotify([r.id])}>{IcMail(15)}</button>
                            <button className={`rp-icon-btn ${done ? 'rp-icon-btn--done' : ''}`}
                              title={done ? 'Mở lại (chưa xử lý)' : 'Đánh dấu đã xử lý'}
                              disabled={busy === 'mark'}
                              onClick={() => runMark([r.id], done ? 'moi' : 'da_xu_ly')}>
                              {done ? IcUndo(15) : IcCheck(15)}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="rp-detail-row">
                          <td colSpan={8}>
                            <div className="rp-detail">
                              <div><span>Tiêu đề</span><b>{r.title || '—'}</b></div>
                              <div><span>Mô tả đầy đủ</span><b>{r.detail || '—'}</b></div>
                              {reportContext(r) && <div><span>Liên quan</span><b>{reportContext(r)}</b></div>}
                              {r.score != null && r.maxScore
                                ? <div><span>Điểm</span><b>{fmtNum(r.score)}/{fmtNum(r.maxScore)}</b></div> : null}
                              <div><span>Ghi nhận</span><b>{fmtWhen(r.createdAt)}</b></div>
                              {done && <div><span>Đã xử lý</span><b>{fmtWhen(r.handledAt)}</b></div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="sa-pagination">
              <button className="sa-pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`sa-pg-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="sa-pg-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

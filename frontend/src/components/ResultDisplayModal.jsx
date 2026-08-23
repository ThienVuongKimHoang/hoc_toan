import React, { useEffect, useState } from 'react'
import { SHOW, fetchDisplaySettings, saveDisplaySettings } from '../store/examStore.js'

/* ─── Icons ─── */
function Svg({ size = 16, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle' }} {...rest}>
      {children}
    </svg>
  )
}
export const gearIcon = (s = 16) => (
  <Svg size={s}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)
export const eyeOffIcon = (s = 16) => (
  <Svg size={s}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </Svg>
)
const icScore  = (s = 16) => <Svg size={s}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Svg>
const icKey    = (s = 16) => <Svg size={s}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" /></Svg>
const icInfo   = (s = 14) => <Svg size={s}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Svg>
const icCheck  = (s = 16) => <Svg size={s} strokeWidth="2.6"><polyline points="20 6 9 17 4 12" /></Svg>

/* ─── Bong bóng giải thích khi di chuột vào dấu (?) ─── */
function Tip({ text }) {
  return (
    <span className="rds-tip" tabIndex={0} aria-label={text}>
      {icInfo(14)}
      <span className="rds-tip-bubble">{text}</span>
    </span>
  )
}

/* ─── Nút gạt (toggle switch) ─── */
function Switch({ checked, onChange, disabled }) {
  return (
    <label className={`rds-switch ${disabled ? 'rds-switch--off' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)} />
      <span className="rds-switch-track"><span className="rds-switch-thumb" /></span>
    </label>
  )
}

/* ─── Chọn mốc thời gian (thanh phân đoạn) ─── */
function TimingPicker({ value, onChange, options, name }) {
  return (
    <div className="rds-seg" role="radiogroup" aria-label={name}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={`rds-seg-btn ${value === o.value ? 'rds-seg-btn--on' : ''}`}
          title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const fmtDt = iso => iso
  ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
  : null

/**
 * Phần thân của form cài đặt — dùng chung cho modal bánh răng (thẻ bài tập)
 * và cho bước "Phát đề thi". Trạng thái do component cha giữ.
 *
 * cfg = { showScoreType, showAnswerType, answerMinScore, resultsRevealed }
 */
export function ResultDisplayFields({ cfg, onChange, closeTime, compact = false }) {
  const closeLabel = fmtDt(closeTime)
  const set = patch => onChange({ ...cfg, ...patch })

  const scoreOn  = cfg.showScoreType !== SHOW.NEVER
  const answerOn = cfg.showAnswerType !== SHOW.NEVER
  const minOn    = cfg.answerMinScore != null

  const timingOptions = [
    { value: SHOW.AFTER_SUBMIT, label: 'Ngay khi nộp bài', hint: 'Học sinh thấy ngay trên màn hình nộp bài' },
    { value: SHOW.AFTER_CLOSE,  label: 'Khi hết hạn nộp',  hint: closeLabel ? `Mở lúc ${closeLabel}` : 'Mở khi đề đóng (theo hạn nộp của lần giao bài)' },
    { value: SHOW.MANUAL,       label: 'Khi GV công bố',   hint: 'Bạn tự bấm "Công bố" khi muốn mở' },
  ]

  return (
    <div className={`rds-fields ${compact ? 'rds-fields--compact' : ''}`}>

      {/* ── Nhóm 1: Xem điểm ── */}
      <section className={`rds-group ${scoreOn ? '' : 'rds-group--off'}`}>
        <header className="rds-group-head">
          <span className="rds-group-icon rds-group-icon--score">{icScore(17)}</span>
          <div className="rds-group-titles">
            <div className="rds-group-title">
              Cho phép học sinh xem điểm
              <Tip text="Tắt: học sinh chỉ thấy 'Đã nộp bài', không thấy điểm ở bất kỳ màn hình nào." />
            </div>
            <div className="rds-group-sub">Điểm hiển thị ở màn hình nộp bài, lớp học và lịch sử làm bài.</div>
          </div>
          <Switch checked={scoreOn}
            onChange={on => set({
              showScoreType: on ? SHOW.AFTER_SUBMIT : SHOW.NEVER,
              // Tắt điểm thì đáp án cũng đóng theo — xem lời giải mà không biết điểm
              // là trạng thái nửa vời, dễ gây hiểu nhầm.
              showAnswerType: on ? cfg.showAnswerType : SHOW.NEVER,
            })} />
        </header>

        {scoreOn && (
          <div className="rds-group-body">
            <div className="rds-field-label">Thời điểm mở điểm</div>
            <TimingPicker name="Thời điểm mở điểm" value={cfg.showScoreType}
              options={timingOptions} onChange={v => set({ showScoreType: v })} />
            {cfg.showScoreType === SHOW.AFTER_CLOSE && (
              <div className="rds-note">
                {closeLabel
                  ? <>Điểm tự mở lúc <b>{closeLabel}</b> — không cần bạn thao tác gì thêm.</>
                  : <>Đề chưa đặt hạn đóng nên điểm sẽ chưa mở. Hãy đặt hạn nộp trước.</>}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Nhóm 2: Xem đáp án & lời giải ── */}
      <section className={`rds-group ${answerOn && scoreOn ? '' : 'rds-group--off'}`}>
        <header className="rds-group-head">
          <span className="rds-group-icon rds-group-icon--answer">{icKey(17)}</span>
          <div className="rds-group-titles">
            <div className="rds-group-title">
              Cho phép xem đáp án chi tiết
              <Tip text="Trang 'Xem lại bài làm': đáp án đúng của từng câu, câu sai và lời giải. Nên chỉ mở sau khi đề đã đóng hoàn toàn để tránh gian lận." />
            </div>
            <div className="rds-group-sub">Mở trang xem lại bài làm kèm đáp án đúng từng câu.</div>
          </div>
          <Switch checked={answerOn} disabled={!scoreOn}
            onChange={on => set({ showAnswerType: on ? SHOW.AFTER_CLOSE : SHOW.NEVER })} />
        </header>

        {!scoreOn && (
          <div className="rds-group-body">
            <div className="rds-note rds-note--warn">
              Đang tắt xem điểm nên đáp án cũng bị khoá theo.
            </div>
          </div>
        )}

        {scoreOn && answerOn && (
          <div className="rds-group-body">
            <div className="rds-field-label">Thời điểm mở đáp án</div>
            <TimingPicker name="Thời điểm mở đáp án" value={cfg.showAnswerType}
              options={timingOptions} onChange={v => set({ showAnswerType: v })} />
            {cfg.showAnswerType === SHOW.AFTER_SUBMIT && (
              <div className="rds-note rds-note--warn">
                Mở đáp án ngay khi nộp: học sinh làm trước có thể chụp đáp án đưa bạn.
                Chỉ nên dùng cho bài luyện tập.
              </div>
            )}
            {cfg.showAnswerType === SHOW.AFTER_CLOSE && closeLabel && (
              <div className="rds-note">Đáp án tự mở lúc <b>{closeLabel}</b>.</div>
            )}
            {cfg.showAnswerType !== cfg.showScoreType && (
              <div className="rds-hint">
                Đáp án chỉ mở khi điểm đã mở — xem lời giải mà chưa biết điểm dễ gây hiểu nhầm.
              </div>
            )}

            {/* Ô nhập điểm để NGOÀI <label> — nằm trong label thì bấm vào ô sẽ
                vô tình gạt luôn checkbox. */}
            <div className="rds-check-row">
              <label className="rds-check">
                <input type="checkbox" checked={minOn}
                  onChange={e => set({ answerMinScore: e.target.checked ? 5 : null })} />
                <span className="rds-check-box">{icCheck(12)}</span>
                <span className="rds-check-text">Chỉ mở đáp án khi đạt từ</span>
              </label>
              <input type="number" className="rds-min-input" min="0" max="10" step="0.5"
                disabled={!minOn} value={minOn ? cfg.answerMinScore : 5}
                onChange={e => set({ answerMinScore: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} />
              <span className="rds-check-text">điểm trở lên</span>
              <Tip text="Bài dưới ngưỡng sẽ thấy điểm nhưng chưa mở đáp án — khuyến khích học sinh làm lại trước khi xem lời giải." />
            </div>
          </div>
        )}
      </section>

      {/* Công tắc công bố — chỉ cần khi có mốc "khi GV công bố" */}
      {(cfg.showScoreType === SHOW.MANUAL || cfg.showAnswerType === SHOW.MANUAL) && (
        <label className="rds-inline-toggle rds-inline-toggle--solo">
          <Switch checked={!!cfg.resultsRevealed} onChange={v => set({ resultsRevealed: v })} />
          <span>
            <b>Công bố kết quả ngay bây giờ</b>
            <em>Bật để cả lớp thấy ngay; tắt để thu lại. Áp cho mọi mục đang đặt "Khi GV công bố".</em>
          </span>
        </label>
      )}
    </div>
  )
}

/** Tóm tắt một dòng cho cấu hình hiện tại — dùng ở phần xem trước / chip. */
export function displaySummary(cfg) {
  const t = {
    [SHOW.NEVER]: 'không hiện', [SHOW.AFTER_SUBMIT]: 'ngay khi nộp',
    [SHOW.AFTER_CLOSE]: 'khi hết hạn', [SHOW.MANUAL]: 'khi GV công bố',
  }
  const score = `Điểm: ${t[cfg.showScoreType] ?? '—'}`
  const answer = cfg.showAnswerType === SHOW.NEVER
    ? 'Đáp án: không mở'
    : `Đáp án: ${t[cfg.showAnswerType] ?? '—'}${cfg.answerMinScore != null ? ` (≥ ${cfg.answerMinScore}đ)` : ''}`
  return `${score} · ${answer}`
}

export const DEFAULT_DISPLAY_CFG = {
  showScoreType:   SHOW.AFTER_SUBMIT,
  showAnswerType:  SHOW.AFTER_CLOSE,
  answerMinScore:  null,
  resultsRevealed: false,
}

/**
 * Modal độc lập (mở từ icon bánh răng trên thẻ bài tập).
 * closeTime: hạn đóng THỰC TẾ áp cho lần giao bài này — hiển thị trong gợi ý.
 */
export default function ResultDisplayModal({ examId, examTitle, closeTime, onClose, onSaved }) {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    fetchDisplaySettings(examId)
      .then(d => {
        if (!alive) return
        setCfg({
          showScoreType:   d.showScoreType ?? SHOW.AFTER_SUBMIT,
          showAnswerType:  d.showAnswerType ?? SHOW.AFTER_SUBMIT,
          answerMinScore:  d.answerMinScore ?? null,
          resultsRevealed: !!d.resultsRevealed,
        })
        setLoading(false)
      })
      .catch(e => { if (alive) { setErr(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [examId])

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const saved = await saveDisplaySettings(examId, cfg)
      onSaved?.(saved)
      onClose()
    } catch (e) {
      setErr(e.message || 'Lưu cài đặt thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rds-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rds-modal" role="dialog" aria-modal="true" aria-label="Cấu hình hiển thị kết quả">
        <div className="rds-head">
          <div className="rds-head-icon">{gearIcon(18)}</div>
          <div className="rds-head-text">
            <h2 className="rds-title">Cấu hình hiển thị kết quả</h2>
            <p className="rds-sub">{examTitle || 'Đề thi'}</p>
          </div>
          <button className="rds-close" onClick={onClose} aria-label="Đóng">
            <Svg size={17}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>
          </button>
        </div>

        <div className="rds-body">
          {loading && <div className="rds-loading">Đang tải cài đặt…</div>}
          {!loading && cfg && (
            <>
              <ResultDisplayFields cfg={cfg} onChange={setCfg} closeTime={closeTime} />
              <div className="rds-preview">
                <span className="rds-preview-label">Học sinh sẽ thấy</span>
                <span className="rds-preview-text">{displaySummary(cfg)}</span>
              </div>
            </>
          )}
          {err && <div className="rds-error">⚠️ {err}</div>}
        </div>

        <div className="rds-foot">
          <button className="rds-btn rds-btn--ghost" onClick={onClose}>Hủy</button>
          <button className="rds-btn rds-btn--save" disabled={loading || saving || !cfg} onClick={handleSave}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

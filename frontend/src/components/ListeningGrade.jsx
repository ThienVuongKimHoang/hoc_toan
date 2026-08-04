import React, { useEffect, useRef, useState } from 'react'
import { getGradesSummary, updateAiGrade } from '../store/classStore.js'
import { AnnotatedEssay, BandChip, bandColor, GradeButton } from './IeltsGrade.jsx'

/* ─── Chấm bài nói (audio → transcript → ngữ pháp/từ vựng) ─── */

export const LISTENING_CRITERIA_META = [
  ['grammar', 'Ngữ pháp', '📐'],
  ['vocabulary', 'Từ vựng', '📚'],
]
const CRIT_KEYS = ['grammar', 'vocabulary']
const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => i * 0.5)

function overallBandFromCriteria(criteria) {
  const bands = CRIT_KEYS.map(k => criteria?.[k]?.band ?? 0)
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length
  return Math.floor(avg * 2 + 0.5) / 2
}

const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function fmtDur(sec) {
  if (sec == null) return null
  const s = Math.round(sec)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}p${s % 60 ? ` ${s % 60}s` : ''}`
}

/* Ghép transcript đầy đủ từ các segment đã định vị (charStart/charEnd), phần
   không định vị được (gap) hiển thị dạng text thường — không mất chữ. */
function buildSyncSegments(transcript, segments) {
  const located = (segments || [])
    .map((s, i) => ({ ...s, _idx: i }))
    .filter(s => s.charStart != null && s.charEnd != null && s.charStart < s.charEnd && s.charEnd <= transcript.length)
    .sort((a, b) => a.charStart - b.charStart)

  const out = []
  let cursor = 0
  for (const s of located) {
    if (s.charStart < cursor) continue
    if (s.charStart > cursor) out.push({ kind: 'gap', text: transcript.slice(cursor, s.charStart) })
    out.push({ kind: 'seg', text: transcript.slice(s.charStart, s.charEnd), idx: s._idx })
    cursor = s.charEnd
  }
  if (cursor < transcript.length) out.push({ kind: 'gap', text: transcript.slice(cursor) })
  return out
}

/* ─── Audio player đồng bộ highlight theo transcript (kiểu karaoke) ─── */
export function SyncedTranscript({ audioUrl, transcript, segments }) {
  const audioRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(null)

  const pieces = buildSyncSegments(transcript || '', segments)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      const t = audio.currentTime
      const idx = (segments || []).findIndex(s => s.start != null && s.end != null && t >= s.start && t < s.end)
      setActiveIdx(idx === -1 ? null : idx)
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [segments])

  const seek = (idx) => {
    const seg = segments?.[idx]
    if (!seg || seg.start == null || !audioRef.current) return
    audioRef.current.currentTime = seg.start
  }

  if (!audioUrl) return null

  return (
    <div className="ls-block">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} controls src={audioUrl} className="ls-audio-player" />
      <div className="ls-transcript">
        {pieces.map((p, i) => p.kind === 'gap'
          ? <React.Fragment key={i}>{p.text}</React.Fragment>
          : (
            <span key={i}
              className={`ls-segment ${activeIdx === p.idx ? 'ls-segment--active' : ''}`}
              onClick={() => seek(p.idx)}>
              {p.text}
            </span>
          )
        )}
      </div>
      <div className="ls-hint">💡 Bấm vào một đoạn văn bản để tua audio tới đó</div>
    </div>
  )
}

function makeDraft(g) {
  return {
    criteria: CRIT_KEYS.reduce((acc, k) => {
      acc[k] = { band: g.criteria?.[k]?.band ?? 0, comment: g.criteria?.[k]?.comment || '' }
      return acc
    }, {}),
    feedback: g.feedback || '',
    strengths: (g.strengths || []).join('\n'),
    improvements: (g.improvements || []).join('\n'),
    corrections: (g.corrections || []).map(c => ({ ...c })),
  }
}

/* ─── Kết quả chấm chi tiết (học sinh & giáo viên đều xem được) ─── */
export function ListeningGradeModal({ grade, studentName, onClose, editable = false, classId, assignmentId, studentId, onSaved }) {
  const [current, setCurrent] = useState(grade || {})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pendingFocus, setPendingFocus] = useState(null)
  const [essayFocusIdx, setEssayFocusIdx] = useState(null)

  useEffect(() => { setCurrent(grade || {}); setEditing(false) }, [grade])

  const g = current
  const crit = g.criteria || {}

  const startEditing = (focus = null, idx = null) => {
    setDraft(makeDraft(g)); setEditing(true); setPendingFocus(focus); setEssayFocusIdx(idx)
  }
  const cancelEditing = () => { setDraft(null); setEditing(false); setPendingFocus(null); setEssayFocusIdx(null) }

  const updateCorrections = (updater) => setDraft(d => ({ ...d, corrections: updater(d.corrections) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const patch = {
        criteria: draft.criteria,
        feedback: draft.feedback,
        strengths: draft.strengths.split('\n').map(s => s.trim()).filter(Boolean),
        improvements: draft.improvements.split('\n').map(s => s.trim()).filter(Boolean),
        corrections: draft.corrections,
      }
      const res = await updateAiGrade(classId, assignmentId, studentId, patch)
      setCurrent(res.aiGrade)
      setEditing(false)
      onSaved?.(res.aiGrade)
    } catch (e) {
      alert(e?.message || 'Lưu chỉnh sửa thất bại')
    } finally {
      setSaving(false)
    }
  }

  const liveOverall = editing ? overallBandFromCriteria(draft.criteria) : g.overallBand

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box ielts-modal">
        <div className="modal-header">
          <h2>{editable ? '🎧 Kết quả chấm nói (AI)' : '🎧 Kết quả chấm nói'}</h2>
          <div className="ielts-modal-head-actions">
            {editable && g.status === 'done' && !editing && (
              <button className="mec-btn" onClick={() => startEditing()}>✏️ Sửa</button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ielts-modal-body">
          {g.status === 'pending' && (
            <div className="ielts-pending"><span className="fdz-spinner" /> {editable ? 'AI đang chuyển giọng nói và chấm bài' : 'Đang chấm bài'}, vui lòng đợi trong giây lát…</div>
          )}
          {g.status === 'error' && (
            <div className="cm-error" style={{ marginTop: 0 }}>⚠️ {g.error || 'Chấm bài thất bại.'}</div>
          )}

          {g.status === 'done' && (
            <>
              <div className="ielts-overall">
                <div className="ielts-overall-circle" style={{ borderColor: bandColor(liveOverall) }}>
                  <div className="ielts-overall-score" style={{ color: bandColor(liveOverall) }}>
                    {liveOverall?.toFixed(1)}
                  </div>
                  <div className="ielts-overall-label">Overall Band</div>
                </div>
                <div className="ielts-overall-info">
                  {studentName && <div className="ielts-student-name">👤 {studentName}</div>}
                  <div className="ielts-meta-row">
                    📝 {g.wordCount ?? '—'} từ
                    {fmtDur(g.durationSec) && <> · 🎤 {fmtDur(g.durationSec)}</>}
                    {' '}· 🕒 Chấm lúc {fmtDt(g.gradedAt)}
                  </div>
                  {g.editedAt && <div className="ielts-meta-row">✏️ GV sửa lúc {fmtDt(g.editedAt)}</div>}
                </div>
              </div>

              <div className="ielts-criteria-grid">
                {LISTENING_CRITERIA_META.map(([key, label, icon]) => {
                  const c = editing ? draft.criteria[key] : (crit[key] || {})
                  return (
                    <div key={key} className="ielts-criterion-card">
                      <div className="ielts-criterion-head">
                        <span className="ielts-criterion-label">{icon} {label}</span>
                        {editing ? (
                          <select className="ielts-band-select" value={c.band} autoFocus={pendingFocus === 'band-' + key}
                            onChange={e => setDraft(d => ({ ...d, criteria: { ...d.criteria, [key]: { ...d.criteria[key], band: parseFloat(e.target.value) } } }))}>
                            {BAND_OPTIONS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}
                          </select>
                        ) : (
                          <span className={editable ? 'ielts-dbl-editable' : ''}
                            onDoubleClick={editable ? () => startEditing('band-' + key) : undefined}
                            title={editable ? 'Bấm đúp để sửa band' : undefined}>
                            <BandChip band={c.band} />
                          </span>
                        )}
                      </div>
                      {editing ? (
                        <textarea className="ielts-criterion-edit-comment" rows={2} value={c.comment} autoFocus={pendingFocus === 'comment-' + key}
                          onChange={e => setDraft(d => ({ ...d, criteria: { ...d.criteria, [key]: { ...d.criteria[key], comment: e.target.value } } }))}
                          placeholder="Nhận xét tiêu chí..." />
                      ) : (
                        (c.comment || editable) && (
                          <div className={`ielts-criterion-comment ${editable ? 'ielts-dbl-editable' : ''}`}
                            onDoubleClick={editable ? () => startEditing('comment-' + key) : undefined}>
                            {c.comment || 'Bấm đúp để thêm nhận xét…'}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="ielts-section">
                <h4 className="ielts-section-title">💬 {editable ? 'Nhận xét của AI' : 'Nhận xét'}</h4>
                {editing ? (
                  <textarea className="ielts-edit-textarea" rows={4} value={draft.feedback} autoFocus={pendingFocus === 'feedback'}
                    onChange={e => setDraft(d => ({ ...d, feedback: e.target.value }))}
                    placeholder="Nhận xét tổng quan..." />
                ) : (
                  (g.feedback || editable) && (
                    <div className={`ielts-feedback ${editable ? 'ielts-dbl-editable' : ''}`}
                      onDoubleClick={editable ? () => startEditing('feedback') : undefined}>
                      {g.feedback || 'Bấm đúp để thêm nhận xét…'}
                    </div>
                  )
                )}
              </div>

              {editing ? (
                <div className="ielts-two-col">
                  <div className="ielts-section ielts-list-box ielts-list-box--good">
                    <h4 className="ielts-section-title">✅ Điểm mạnh (mỗi dòng 1 ý)</h4>
                    <textarea className="ielts-edit-textarea" rows={4} value={draft.strengths} autoFocus={pendingFocus === 'strengths'}
                      onChange={e => setDraft(d => ({ ...d, strengths: e.target.value }))} />
                  </div>
                  <div className="ielts-section ielts-list-box ielts-list-box--warn">
                    <h4 className="ielts-section-title">🔧 Cần cải thiện (mỗi dòng 1 ý)</h4>
                    <textarea className="ielts-edit-textarea" rows={4} value={draft.improvements} autoFocus={pendingFocus === 'improvements'}
                      onChange={e => setDraft(d => ({ ...d, improvements: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="ielts-two-col">
                  {g.strengths?.length > 0 && (
                    <div className={`ielts-section ielts-list-box ielts-list-box--good ${editable ? 'ielts-dbl-editable' : ''}`}
                      onDoubleClick={editable ? () => startEditing('strengths') : undefined}>
                      <h4 className="ielts-section-title">✅ Điểm mạnh</h4>
                      <ul>{g.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {g.improvements?.length > 0 && (
                    <div className={`ielts-section ielts-list-box ielts-list-box--warn ${editable ? 'ielts-dbl-editable' : ''}`}
                      onDoubleClick={editable ? () => startEditing('improvements') : undefined}>
                      <h4 className="ielts-section-title">🔧 Cần cải thiện</h4>
                      <ul>{g.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              {/* Nghe theo dõi — transcript đồng bộ theo audio đang phát */}
              {g.audioUrl && (
                <details className="ielts-section ielts-details" open>
                  <summary className="ielts-section-title">🎧 Nghe theo dõi bản ghi</summary>
                  <SyncedTranscript audioUrl={g.audioUrl} transcript={g.transcript} segments={g.segments} />
                </details>
              )}

              {/* Bản ghi + lỗi — tô màu lỗi + ghi chú kiểu Google Docs (giống essay Writing) */}
              {g.transcript && (
                <details className="ielts-section ielts-details">
                  <summary className="ielts-section-title">📄 Bản ghi văn bản ({g.wordCount} từ) — bấm vào đoạn tô màu để xem ghi chú lỗi</summary>
                  <AnnotatedEssay
                    text={g.transcript}
                    corrections={editing ? draft.corrections : (g.corrections || [])}
                    editable={editing}
                    canEdit={editable}
                    focusIndex={editing ? essayFocusIdx : null}
                    onRequestEdit={(idx) => startEditing('essay-annot', idx)}
                    onChangeCorrection={(idx, patch) => updateCorrections(list => list.map((c, i) => i === idx ? { ...c, ...patch } : c))}
                    onDeleteCorrection={(idx) => updateCorrections(list => list.filter((_, i) => i !== idx))}
                    onAddCorrection={(item) => updateCorrections(list => [...list, item])}
                  />
                </details>
              )}

              {editing && (
                <div className="ielts-edit-footer">
                  <button className="mec-btn" onClick={cancelEditing} disabled={saving}>✕ Huỷ</button>
                  <button className="mec-btn ielts-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? <><span className="fdz-spinner" style={{ width: 12, height: 12 }} /> Đang lưu…</> : <>✓ Lưu thay đổi</>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Bảng tóm tắt thống kê điểm từng người ─── */
export function ListeningStatsTable({ classId, assignmentId, refreshKey = 0, onViewStudent }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    getGradesSummary(classId, assignmentId)
      .then(d => { if (alive) setData(d) })
      .catch(() => { if (alive) setData({ rows: [], stats: {} }) })
    return () => { alive = false }
  }, [classId, assignmentId, refreshKey])

  if (!data) return <div className="ielts-stats-loading">Đang tải bảng điểm…</div>
  const { rows = [], stats = {} } = data
  if (rows.length === 0) return <div className="ielts-stats-loading">Chưa có bài nộp nào.</div>

  return (
    <div className="ielts-stats">
      <div className="ielts-stats-cards">
        <div className="ielts-stat-card"><span>{stats.graded ?? 0}/{stats.total ?? 0}</span><small>Đã chấm</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.avg) }}>{stats.avg ?? '—'}</span><small>Band TB</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.max) }}>{stats.max ?? '—'}</span><small>Cao nhất</small></div>
        <div className="ielts-stat-card"><span style={{ color: bandColor(stats.min) }}>{stats.min ?? '—'}</span><small>Thấp nhất</small></div>
      </div>
      <div className="ielts-stats-table-wrap">
        <table className="ielts-stats-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Học sinh</th>
              <th>Ngữ pháp</th><th>Từ vựng</th>
              <th>Overall</th><th>Số từ</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.studentId}>
                <td style={{ textAlign: 'left' }}>
                  <span className="ielts-stats-name">{r.studentName || r.studentId}</span>
                </td>
                {CRIT_KEYS.map(k => (
                  <td key={k}>{r[k] != null ? <span style={{ color: bandColor(r[k]), fontWeight: 700 }}>{r[k].toFixed(1)}</span> : '—'}</td>
                ))}
                <td>{r.status === 'done' ? <BandChip band={r.overallBand} size="sm" />
                  : r.status === 'pending' ? <span className="ielts-pending-chip">⏳</span>
                  : r.status === 'error' ? <span title="Chấm lỗi">⚠️</span> : '—'}</td>
                <td>{r.wordCount ?? '—'}</td>
                <td>
                  {onViewStudent && r.status === 'done' && (
                    <button className="ielts-view-btn" onClick={() => onViewStudent(r.studentId)}>👁 Xem</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Modal bảng điểm (dùng phía học sinh) ─── */
export function ListeningStatsModal({ classId, assignment, onClose, onViewStudent }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>📊 Bảng điểm — {assignment.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <ListeningStatsTable classId={classId} assignmentId={assignment.id} onViewStudent={onViewStudent} />
        </div>
      </div>
    </div>
  )
}

export { GradeButton }

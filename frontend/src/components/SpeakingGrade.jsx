import React, { useEffect, useState } from 'react'
import { getGradesSummary, updateAiGrade } from '../store/classStore.js'
import { AnnotatedEssay, BandChip, bandColor } from './IeltsGrade.jsx'
import { SyncedTranscript } from './ListeningGrade.jsx'

/* ─── Chấm IELTS Speaking: Task 1 (kịch bản viết + audio mẫu AI) + Task 2 (nói, đối chiếu phát âm) ─── */

const CRIT_KEYS = ['grammar', 'vocabulary']
const CRITERIA_META = [
  ['grammar', 'Ngữ pháp', '📐'],
  ['vocabulary', 'Từ vựng', '📚'],
]
const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => i * 0.5)

function overallBandFromCriteria(criteria) {
  const bands = CRIT_KEYS.map(k => criteria?.[k]?.band ?? 0)
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length
  return Math.floor(avg * 2 + 0.5) / 2
}

function overallBandFromTasks(t1, t2) {
  const bands = [t1, t2].filter(b => b != null)
  if (!bands.length) return null
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length
  return Math.floor(avg * 2 + 0.5) / 2
}

const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function fmtDur(sec) {
  if (sec == null) return null
  const s = Math.round(sec)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}p${s % 60 ? ` ${s % 60}s` : ''}`
}

/* Dự phòng khi TTS server (Groq Orpheus) lỗi/hết quota: đọc improvedText bằng giọng đọc trình duyệt */
function BrowserTtsButton({ text }) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])
  const toggle = () => {
    if (!('speechSynthesis' in window)) { alert('Trình duyệt này không hỗ trợ đọc giọng nói.'); return }
    window.speechSynthesis.cancel()
    if (speaking) { setSpeaking(false); return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }
  return (
    <button type="button" className="mec-btn" onClick={toggle}>
      {speaking ? '⏹ Dừng đọc' : '🔊 Nghe bằng giọng đọc trình duyệt (dự phòng)'}
    </button>
  )
}

function makeTaskDraft(t) {
  return {
    criteria: CRIT_KEYS.reduce((acc, k) => {
      acc[k] = { band: t?.criteria?.[k]?.band ?? 0, comment: t?.criteria?.[k]?.comment || '' }
      return acc
    }, {}),
    feedback: t?.feedback || '',
    strengths: (t?.strengths || []).join('\n'),
    improvements: (t?.improvements || []).join('\n'),
    corrections: (t?.corrections || []).map(c => ({ ...c })),
    improvedText: t?.improvedText || '',
  }
}

/* Khối hiển thị/sửa chung cho 1 task (band chips, nhận xét, essay chú thích lỗi) */
function TaskPanel({ task, taskKey, textKey, editable, editing, draft, setDraft, pendingFocus, essayFocusIdx, onStartEdit, updateCorrections, originalAudio }) {
  const t = task || {}
  const crit = t.criteria || {}
  const text = t[textKey] || ''
  const liveOverall = editing ? overallBandFromCriteria(draft.criteria) : t.overallBand

  const originalTextBlock = text && (
    <details className="ielts-section ielts-details">
      <summary className="ielts-section-title">
        📄 {taskKey === 'task1' ? 'Kịch bản gốc học sinh nộp' : 'Bản ghi văn bản'} ({t.wordCount} từ) — bấm vào đoạn tô màu để xem ghi chú lỗi
      </summary>
      <AnnotatedEssay
        text={text}
        corrections={editing ? draft.corrections : (t.corrections || [])}
        editable={editing}
        canEdit={editable}
        focusIndex={editing ? essayFocusIdx : null}
        onRequestEdit={(idx) => onStartEdit('essay-annot', idx)}
        onChangeCorrection={(idx, patch) => updateCorrections(list => list.map((c, i) => i === idx ? { ...c, ...patch } : c))}
        onDeleteCorrection={(idx) => updateCorrections(list => list.filter((_, i) => i !== idx))}
        onAddCorrection={(item) => updateCorrections(list => [...list, item])}
      />
    </details>
  )

  return (
    <div className="ielts-task-panel">
      <div className="ielts-meta-row">
        📝 {t.wordCount ?? '—'} từ
        {fmtDur(t.durationSec) && <> · 🎤 {fmtDur(t.durationSec)}</>}
        {' '}· Band: <BandChip band={liveOverall} size="sm" />
      </div>

      <div className="ielts-criteria-grid">
        {CRITERIA_META.map(([key, label, icon]) => {
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
                    onDoubleClick={editable ? () => onStartEdit('band-' + key) : undefined}
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
                    onDoubleClick={editable ? () => onStartEdit('comment-' + key) : undefined}>
                    {c.comment || 'Bấm đúp để thêm nhận xét…'}
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>

      <div className="ielts-section">
        <h4 className="ielts-section-title">💬 Nhận xét</h4>
        {editing ? (
          <textarea className="ielts-edit-textarea" rows={4} value={draft.feedback} autoFocus={pendingFocus === 'feedback'}
            onChange={e => setDraft(d => ({ ...d, feedback: e.target.value }))} placeholder="Nhận xét tổng quan..." />
        ) : (
          (t.feedback || editable) && (
            <div className={`ielts-feedback ${editable ? 'ielts-dbl-editable' : ''}`}
              onDoubleClick={editable ? () => onStartEdit('feedback') : undefined}>
              {t.feedback || 'Bấm đúp để thêm nhận xét…'}
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
          {t.strengths?.length > 0 && (
            <div className={`ielts-section ielts-list-box ielts-list-box--good ${editable ? 'ielts-dbl-editable' : ''}`}
              onDoubleClick={editable ? () => onStartEdit('strengths') : undefined}>
              <h4 className="ielts-section-title">✅ Điểm mạnh</h4>
              <ul>{t.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {t.improvements?.length > 0 && (
            <div className={`ielts-section ielts-list-box ielts-list-box--warn ${editable ? 'ielts-dbl-editable' : ''}`}
              onDoubleClick={editable ? () => onStartEdit('improvements') : undefined}>
              <h4 className="ielts-section-title">🔧 Cần cải thiện</h4>
              <ul>{t.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {taskKey === 'task1' && originalTextBlock}

      {taskKey === 'task1' && originalAudio?.audioUrl && (
        <details className="ielts-section ielts-details" open>
          <summary className="ielts-section-title">🎧 File audio gốc — nghe theo dõi bản ghi</summary>
          <SyncedTranscript audioUrl={originalAudio.audioUrl} transcript={originalAudio.transcript} segments={originalAudio.segments} />
        </details>
      )}

      {taskKey === 'task1' && (
        <div className="ielts-section">
          <h4 className="ielts-section-title">✨ Bản hoàn thiện hơn</h4>
          {editing ? (
            <textarea className="ielts-edit-textarea" rows={6} value={draft.improvedText}
              onChange={e => setDraft(d => ({ ...d, improvedText: e.target.value }))} />
          ) : (
            <pre className="ielts-essay-text">{t.improvedText || '—'}</pre>
          )}
          {t.audioFile?.url ? (
            <div className="ls-block">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={t.audioFile.url} className="ls-audio-player" />
              <div className="ls-hint">{editable ? '🔊 Audio mẫu do AI đọc bản đã sửa — nghe để luyện phát âm chuẩn' : '🔊 Nghe audio mẫu bản đã sửa để luyện phát âm chuẩn'}</div>
            </div>
          ) : (
            <div className="ls-block">
              <div className="ls-hint">
                ⚠️ {editable
                  ? `Không tạo được audio AI mẫu (lỗi TTS${t.audioError ? `: ${t.audioError}` : ''}, có thể do hết quota) — dùng tạm phương án dự phòng:`
                  : 'Chưa có audio mẫu AI — nghe tạm bằng giọng đọc trình duyệt:'}
              </div>
              <BrowserTtsButton text={t.improvedText} />
            </div>
          )}
        </div>
      )}

      {taskKey === 'task2' && t.pronunciationNotes?.length > 0 && (
        <div className="ielts-section">
          <h4 className="ielts-section-title">🔊 Đối chiếu phát âm (kịch bản vs. lời nói)</h4>
          {t.pronunciationNotes.map((n, i) => (
            <div key={i} className="ielts-correction">
              <div className="ielts-corr-error">📝 Kịch bản: "{n.script}"</div>
              <div className="ielts-corr-fix">🗣 Đã nói: "{n.spoken}"</div>
              {n.note && <div className="ielts-corr-explain">{n.note}</div>}
            </div>
          ))}
        </div>
      )}

      {taskKey === 'task2' && originalTextBlock}
    </div>
  )
}

/* ─── Kết quả chấm chi tiết (học sinh & giáo viên đều xem được) ─── */
export function SpeakingGradeModal({ grade, studentName, onClose, editable = false, classId, assignmentId, studentId, onSaved }) {
  const [current, setCurrent] = useState(grade || {})
  const [editingTask, setEditingTask] = useState(null)   // 'task1' | 'task2' | null
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pendingFocus, setPendingFocus] = useState(null)
  const [essayFocusIdx, setEssayFocusIdx] = useState(null)

  useEffect(() => { setCurrent(grade || {}); setEditingTask(null); setDraft(null) }, [grade])

  const g = current
  const t1 = g.task1 || {}
  const t2 = g.task2

  const startEditing = (task, focus = null, idx = null) => {
    setDraft(makeTaskDraft(task === 'task1' ? t1 : t2))
    setEditingTask(task); setPendingFocus(focus); setEssayFocusIdx(idx)
  }
  const cancelEditing = () => { setDraft(null); setEditingTask(null); setPendingFocus(null); setEssayFocusIdx(null) }
  const updateCorrections = (updater) => setDraft(d => ({ ...d, corrections: updater(d.corrections) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const patch = {
        [editingTask]: {
          criteria: draft.criteria,
          feedback: draft.feedback,
          strengths: draft.strengths.split('\n').map(s => s.trim()).filter(Boolean),
          improvements: draft.improvements.split('\n').map(s => s.trim()).filter(Boolean),
          corrections: draft.corrections,
          ...(editingTask === 'task1' ? { improvedText: draft.improvedText } : {}),
        },
      }
      const res = await updateAiGrade(classId, assignmentId, studentId, patch)
      setCurrent(res.aiGrade)
      cancelEditing()
      onSaved?.(res.aiGrade)
    } catch (e) {
      alert(e?.message || 'Lưu chỉnh sửa thất bại')
    } finally {
      setSaving(false)
    }
  }

  const liveT1Overall = editingTask === 'task1' ? overallBandFromCriteria(draft.criteria) : t1.overallBand
  const liveT2Overall = editingTask === 'task2' ? overallBandFromCriteria(draft.criteria) : t2?.overallBand
  const liveOverall = overallBandFromTasks(liveT1Overall, t2 ? liveT2Overall : null)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box ielts-modal">
        <div className="modal-header">
          <h2>🗣 {editable ? 'Kết quả chấm Speaking (AI)' : 'Kết quả chấm Speaking'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ielts-modal-body">
          {g.status === 'pending' && (
            <div className="ielts-pending"><span className="fdz-spinner" /> {editable ? 'AI đang chấm bài' : 'Đang chấm bài'}, vui lòng đợi trong giây lát…</div>
          )}
          {g.status === 'error' && (
            <div className="cm-error" style={{ marginTop: 0 }}>⚠️ {g.error || 'Chấm bài thất bại.'}</div>
          )}

          {g.status === 'done' && (
            <>
              <div className="ielts-overall">
                <div className="ielts-overall-circle" style={{ borderColor: bandColor(liveOverall) }}>
                  <div className="ielts-overall-score" style={{ color: bandColor(liveOverall) }}>{liveOverall?.toFixed(1)}</div>
                  <div className="ielts-overall-label">Overall Band</div>
                </div>
                <div className="ielts-overall-info">
                  {studentName && <div className="ielts-student-name">👤 {studentName}</div>}
                  <div className="ielts-meta-row">
                    {editable
                      ? <>🏷️ Nhãn: {g.studentLabel === 'on' ? 'Ổn (Task 1+2)' : 'Yếu (Task 1)'} · </>
                      : (g.studentLabel === 'on' && <>🌟 Thành tích tốt (Task 1+2) · </>)}
                    🕒 Chấm lúc {fmtDt(g.gradedAt)}
                  </div>
                  {g.editedAt && <div className="ielts-meta-row">✏️ GV sửa lúc {fmtDt(g.editedAt)}</div>}
                </div>
              </div>

              <details className="ielts-section ielts-details" open>
                <summary className="ielts-section-title">📄 Task 1 — Kịch bản viết</summary>
                <TaskPanel task={t1} taskKey="task1" textKey="scriptText" editable={editable}
                  editing={editingTask === 'task1'} draft={editingTask === 'task1' ? draft : null}
                  setDraft={setDraft} pendingFocus={pendingFocus} essayFocusIdx={essayFocusIdx}
                  onStartEdit={(focus, idx) => startEditing('task1', focus, idx)}
                  updateCorrections={updateCorrections}
                  originalAudio={t2 && t2.status === 'done' ? t2 : null} />
              </details>

              {t2 && t2.status === 'done' && (
                <details className="ielts-section ielts-details" open>
                  <summary className="ielts-section-title">🎤 Task 2 — Bài nói</summary>
                  <TaskPanel task={t2} taskKey="task2" textKey="transcript" editable={editable}
                    editing={editingTask === 'task2'} draft={editingTask === 'task2' ? draft : null}
                    setDraft={setDraft} pendingFocus={pendingFocus} essayFocusIdx={essayFocusIdx}
                    onStartEdit={(focus, idx) => startEditing('task2', focus, idx)}
                    updateCorrections={updateCorrections} />
                </details>
              )}
              {t2 && t2.status === 'error' && (
                <div className="cm-error">⚠️ Task 2: {t2.error || 'Chấm thất bại.'}</div>
              )}
              {!t2 && (
                <div className="ielts-meta-row" style={{ opacity: 0.7 }}>
                  {editable ? 'Học sinh thuộc nhãn "Yếu" — chỉ làm Task 1.' : 'Bài chỉ có Task 1.'}
                </div>
              )}

              {editingTask && (
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
export function SpeakingStatsTable({ classId, assignmentId, refreshKey = 0, onViewStudent }) {
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
              <th>Nhãn</th><th>Task 1</th><th>Task 2</th>
              <th>Overall</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.studentId}>
                <td style={{ textAlign: 'left' }}><span className="ielts-stats-name">{r.studentName || r.studentId}</span></td>
                <td>{r.studentLabel === 'on' ? 'Ổn' : r.studentLabel === 'yeu' ? 'Yếu' : '—'}</td>
                <td>{r.task1Band != null ? <span style={{ color: bandColor(r.task1Band), fontWeight: 700 }}>{r.task1Band.toFixed(1)}</span> : '—'}</td>
                <td>{r.task2Band != null ? <span style={{ color: bandColor(r.task2Band), fontWeight: 700 }}>{r.task2Band.toFixed(1)}</span> : '—'}</td>
                <td>{r.status === 'done' ? <BandChip band={r.overallBand} size="sm" />
                  : r.status === 'pending' ? <span className="ielts-pending-chip">⏳</span>
                  : r.status === 'error' ? <span title="Chấm lỗi">⚠️</span> : '—'}</td>
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
export function SpeakingStatsModal({ classId, assignment, onClose, onViewStudent }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>📊 Bảng điểm — {assignment.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <SpeakingStatsTable classId={classId} assignmentId={assignment.id} onViewStudent={onViewStudent} />
        </div>
      </div>
    </div>
  )
}

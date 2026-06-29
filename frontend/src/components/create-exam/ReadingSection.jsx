import React, { useState } from 'react'
import EditableQuestion, { PassageEditor } from './EditableQuestion.jsx'
import ReadingTakeView, { remapPassageBlanks } from '../ReadingTakeView.jsx'
import './EditableQuestion.css'

/* ════════════════════════════════════════════════════════════
   Reading (bài đọc) editor — bố cục 2 cột:
     • Trái:  toàn bộ đoạn văn / bài đọc (dùng chung cho cả nhóm)
     • Phải:  các câu hỏi gắn với bài đọc đó

   Mỗi nhóm câu hỏi (passage_group) chia sẻ một đoạn văn. Đoạn văn
   được lưu trên câu ĐẦU của nhóm (anchor) — khớp với cách hiển thị
   ở trang làm bài (QuestionCard đọc q.passage_text).
═══════════════════════════════════════════════════════════════ */

let _rid = Date.now()
const newUid = () => `r${++_rid}`

function emptyReadingQ(passageGroup) {
  return {
    _uid: newUid(),
    question_number: 0,
    section: 'READING',
    passage_group: passageGroup,
    passage_title: null,
    passage_text: null,
    question_text: '',
    choices: { A: '', B: '', C: '', D: '' },
    answer: null,
    has_figure: false,
    points: 0.25,
  }
}

const gidOf = (q) => q.passage_group ?? 1

/* Gom câu hỏi thành các nhóm theo passage_group, giữ thứ tự xuất hiện */
function buildGroups(questions) {
  const groups = []
  const idx = new Map()
  questions.forEach(q => {
    const gid = gidOf(q)
    if (!idx.has(gid)) { const g = { gid, items: [] }; idx.set(gid, g); groups.push(g) }
    idx.get(gid).items.push(q)
  })
  return groups
}

/* Đánh số lại 1..N toàn phần & đảm bảo đoạn văn chỉ nằm trên câu đầu mỗi nhóm.
   Đồng thời đồng bộ số chỗ trống "(N)____" trong đoạn văn với số câu hỏi mới. */
function normalize(questions) {
  const groups = buildGroups(questions)
  let n = 0
  const out = []
  groups.forEach(g => {
    const src    = g.items.find(q => q.passage_text || q.passage_title)
    const pTitle = src?.passage_title ?? null
    const startN = n + 1
    const newNums = g.items.map((_, i) => startN + i)
    const { text: pText } = remapPassageBlanks(src?.passage_text ?? null, newNums)
    g.items.forEach((q, i) => {
      n++
      out.push({
        ...q,
        section: 'READING',
        passage_group: g.gid,
        question_number: n,
        passage_text:  i === 0 ? pText  : null,
        passage_title: i === 0 ? pTitle : null,
      })
    })
  })
  return out
}

/* Ghi đoạn văn/tiêu đề vào câu đầu (anchor) của nhóm gid */
function setPassage(questions, gid, patch) {
  let done = false
  return questions.map(q => {
    if (!done && gidOf(q) === gid) { done = true; return { ...q, ...patch } }
    return q
  })
}

/* Thêm câu hỏi mới vào cuối nhóm gid */
function addQuestion(questions, gid) {
  let lastIdx = -1
  questions.forEach((q, i) => { if (gidOf(q) === gid) lastIdx = i })
  const arr = [...questions]
  arr.splice(lastIdx + 1, 0, emptyReadingQ(gid))
  return arr
}

/* Chèn câu hỏi mới NGAY SAU câu uid (cùng nhóm) */
function insertQuestionAfter(questions, uid) {
  const idx = questions.findIndex(q => q._uid === uid)
  if (idx === -1) return questions
  const arr = [...questions]
  arr.splice(idx + 1, 0, emptyReadingQ(gidOf(questions[idx])))
  return arr
}

/* Xoá 1 câu — nếu xoá câu anchor thì chuyển đoạn văn sang câu kế trong nhóm */
function deleteQuestion(questions, uid) {
  const target = questions.find(q => q._uid === uid)
  let arr = questions
  if (target && (target.passage_text || target.passage_title)) {
    const gid = gidOf(target)
    const sibling = questions.find(q => q._uid !== uid && gidOf(q) === gid)
    if (sibling) {
      arr = questions.map(q => q._uid === sibling._uid
        ? { ...q, passage_text: target.passage_text, passage_title: target.passage_title }
        : q)
    }
  }
  return arr.filter(q => q._uid !== uid)
}

/* Thêm một bài đọc mới (nhóm mới + 1 câu trống) */
function addPassage(questions) {
  const maxGid = questions.reduce((m, q) => Math.max(m, gidOf(q)), 0)
  return [...questions, emptyReadingQ(maxGid + 1)]
}

export default function ReadingSection({ questions, grade, pointsPerQ, onChange, onReport }) {
  const [mode, setMode] = useState('edit')   // 'edit' | 'preview'
  const apply = (fn) => onChange(normalize(fn(questions)))

  const updateQ        = (uid, updated) => apply(qs => qs.map(q => q._uid === uid ? updated : q))
  const removeQ        = (uid)          => apply(qs => deleteQuestion(qs, uid))
  const addQ           = (gid)          => apply(qs => addQuestion(qs, gid))
  const insertAfterQ   = (uid)          => apply(qs => insertQuestionAfter(qs, uid))
  const setGroupTitle  = (gid, title)   => apply(qs => setPassage(qs, gid, { passage_title: title || null }))
  const setGroupText   = (gid, text)    => apply(qs => setPassage(qs, gid, { passage_text: text }))
  const addNewPassage  = ()             => apply(qs => addPassage(qs))
  const removePassage  = (gid, count)   => {
    if (count > 0 && !confirm(`Xoá cả bài đọc này cùng ${count} câu hỏi?`)) return
    apply(qs => qs.filter(q => gidOf(q) !== gid))
  }

  const groups = buildGroups(questions)

  return (
    <div className="rdg-wrap">
      <div className="rdg-modebar">
        <button type="button"
          className={`rdg-mode-btn ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => setMode('edit')}>
          ✏️ Chỉnh sửa
        </button>
        <button type="button"
          className={`rdg-mode-btn ${mode === 'preview' ? 'active' : ''}`}
          onClick={() => setMode('preview')}>
          👁️ Xem trước (như học sinh)
        </button>
      </div>

      {mode === 'preview' ? (
        <div className="rdg-preview">
          <ReadingTakeView questions={questions} examMode={true} />
        </div>
      ) : (
      <>
      <div className="rdg-intro">
        📖 Mỗi bài đọc gồm <strong>đoạn văn (cột trái)</strong> dùng chung và{' '}
        <strong>các câu hỏi liên quan (cột phải)</strong>.
      </div>

      {groups.length === 0 && (
        <div className="rdg-empty">
          <div className="rdg-empty-icon">📭</div>
          <p>Chưa có bài đọc nào</p>
        </div>
      )}

      {groups.map((g, gi) => {
        const anchor = g.items.find(q => q.passage_text || q.passage_title) || g.items[0]
        const qnums = g.items.map(q => q.question_number)
        const { text: ptext } = remapPassageBlanks(anchor?.passage_text || '', qnums)
        const isClozeQ = (q) => new RegExp(`\\(\\s*${q.question_number}\\s*\\)`).test(ptext)
        return (
          <div className="rdg-group" key={g.gid}>
            <div className="rdg-group-head">
              <span className="rdg-group-title">📖 Bài đọc {gi + 1}</span>
              <span className="rdg-group-count">{g.items.length} câu</span>
              <button type="button" className="rdg-del-passage"
                onClick={() => removePassage(g.gid, g.items.length)}
                title="Xoá bài đọc và toàn bộ câu hỏi của nó">
                🗑 Xoá bài đọc
              </button>
            </div>

            <div className="rdg-cols">
              {/* ── Cột trái: đoạn văn ── */}
              <div className="rdg-passage">
                <div className="rdg-pane-label">📄 Đoạn văn / Bài đọc</div>
                <input
                  className="rdg-passage-title"
                  placeholder="Tiêu đề bài đọc (tuỳ chọn)…"
                  value={anchor?.passage_title || ''}
                  onChange={e => setGroupTitle(g.gid, e.target.value)}
                />
                <PassageEditor
                  value={ptext}
                  onChange={val => setGroupText(g.gid, val)}
                />
              </div>

              <div className="rdg-divider" />

              {/* ── Cột phải: câu hỏi ── */}
              <div className="rdg-questions">
                <div className="rdg-pane-label">❓ Câu hỏi của bài đọc</div>
                {g.items.map(q => (
                  <div key={q._uid} className="rdg-q-wrap">
                    <EditableQuestion
                      q={q}
                      grade={grade}
                      readingMode
                      clozeMode={isClozeQ(q)}
                      pointsPerQ={pointsPerQ}
                      onUpdate={updated => updateQ(q._uid, updated)}
                      onDelete={() => removeQ(q._uid)}
                      onReportSubmit={onReport}
                    />
                    <button type="button" className="rdg-insert-q"
                      onClick={() => insertAfterQ(q._uid)}
                      title="Chèn một câu hỏi mới ngay sau câu này">
                      + Chèn câu hỏi vào đây
                    </button>
                  </div>
                ))}
                <button type="button" className="rdg-add-q" onClick={() => addQ(g.gid)}>
                  + Thêm câu hỏi cho bài đọc này
                </button>
              </div>
            </div>
          </div>
        )
      })}

      <button type="button" className="rdg-add-passage" onClick={addNewPassage}>
        + Thêm bài đọc mới
      </button>
      </>
      )}
    </div>
  )
}

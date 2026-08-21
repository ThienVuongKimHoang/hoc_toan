import React, { useEffect, useRef, useState } from 'react'
import MathText from './MathText.jsx'
import MarkerText, { InlineImage, referencedImageIds } from './MarkerText.jsx'

const CONTENT_EDITABLE_TAG = /<(strong|em|u|b|i|div|br|span|p)\b/i

export function toPassageHTML(text) {
  if (!text) return ''
  if (CONTENT_EDITABLE_TAG.test(text)) {
    return text
      .replace(/\n\n+/g, '<div class="passage-para-break"></div>')
      .replace(/\n/g, '<br>')
  }
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n+/g, '<div class="passage-para-break"></div>')
    .replace(/\n/g, '<br>')
}

export function FigureImages({ path }) {
  if (!path) return null
  const src = `/images/${path.replace('images/', '')}`
  return (
    <div className="figure-images">
      <img src={src} alt="Hình vẽ minh họa" className="figure-img" loading="lazy" />
    </div>
  )
}

// Render question_text với [img:id] markers → ảnh thật.
// Ảnh đính kèm không được marker nào (kể cả trong các đáp án choices) tham chiếu
// vẫn hiển thị ở cuối đề bài, tránh mất ảnh nếu marker bị xoá nhầm.
export function QuestionText({ q }) {
  const text = q?.question_text || ''
  const images = q?.images || []
  const referenced = new Set([
    ...referencedImageIds(text),
    ...Object.values(q?.choices || {}).flatMap(referencedImageIds),
  ])
  const orphans = images.filter(im => !referenced.has(im.id))
  if (!text && orphans.length === 0) return null
  return (
    <>
      <MarkerText text={text} images={images} />
      {orphans.map((img, i) => <InlineImage key={img.id || `o${i}`} img={img} />)}
    </>
  )
}

function PassageBlock({ title, text }) {
  const [collapsed, setCollapsed] = useState(false)
  if (!text) return null
  return (
    <div className="passage-block">
      <div className="passage-header" onClick={() => setCollapsed(v => !v)}>
        <span className="passage-label">{title || 'Đoạn văn / Bài đọc'}</span>
        <span className="passage-toggle">{collapsed ? '▼ Xem' : '▲ Thu gọn'}</span>
      </div>
      {!collapsed && (
        <div className="passage-text"
          dangerouslySetInnerHTML={{ __html: toPassageHTML(text) }} />
      )}
    </div>
  )
}

/* ── Trắc nghiệm 1 đáp án (PHẦN I Toán + Tiếng Anh) ── */
function MultipleChoiceCard({ q, examMode, onAnswerChange, hidePassage = false, saved, choiceOrder, shuffleChoices, readOnly = false }) {
  // Khởi tạo từ đáp án đã lưu ở component cha — giữ lựa chọn khi học sinh chuyển phần rồi quay lại
  const [selected, setSelected] = useState(saved ?? null)
  const correct = q.answer  // null nếu không có đáp án

  const handleSelect = (key) => {
    if (readOnly) return
    if (examMode) {
      setSelected(key)
      onAnswerChange?.(key)
      return
    }
    // Practice mode: lock sau khi chọn (nếu có đáp án), hoặc cho toggle (nếu không có)
    if (correct !== null && selected !== null) return
    setSelected(key)
    onAnswerChange?.(key)
  }

  const getState = (key) => {
    if (examMode) return selected === key ? 'selected' : ''
    if (readOnly) {
      if (correct === null) return selected === key ? 'selected' : ''
      if (key === correct) return 'correct'
      if (key === selected) return 'wrong'
      return ''
    }
    if (selected === null) return ''
    if (correct === null) return selected === key ? 'selected' : ''  // chưa có đáp án
    if (key === correct) return 'correct'
    if (key === selected) return 'wrong'
    return ''
  }

  // Trộn thứ tự hiển thị + gán lại nhãn A/B/C/D theo VỊ TRÍ trên màn hình khi
  // đề bật "Trộn thứ tự" — nội dung nào ứng với chữ cái nào là khác nhau giữa
  // các học sinh, nhưng `key` dùng để chọn/lưu vẫn luôn là chữ cái GỐC của
  // q.choices nên không ảnh hưởng đến việc lưu/nộp/chấm điểm.
  // shuffleChoices tách riêng khỏi examMode: lúc thi (examMode=true) luôn trộn nếu có
  // choiceOrder; lúc xem lại bài làm (examMode=false, có hiện đúng/sai) vẫn cần trộn
  // ĐÚNG THEO thứ tự học sinh đã thấy lúc làm, nên cha truyền shuffleChoices riêng.
  const rawEntries = Object.entries(q.choices || {})
  const useShuffled = shuffleChoices && Array.isArray(choiceOrder) && choiceOrder.length === rawEntries.length
  const entries = useShuffled ? choiceOrder.map(k => [k, q.choices[k]]) : rawEntries
  const DISPLAY_LABELS = ['A', 'B', 'C', 'D']
  // Câu chữ giải thích ("Đáp án đúng: X") phải in NHÃN TRÊN MÀN HÌNH của đáp án đó, không
  // phải chữ cái GỐC trong q.choices — khi đề bật trộn, 2 cái có thể khác nhau (ô đúng có
  // thể nằm ở vị trí "B" trên màn hình dù key gốc là "A"), nếu không sẽ vừa tô xanh đúng ô
  // vừa ghi nhãn sai, nhìn như mâu thuẫn.
  const labelOf = (realKey) => {
    if (!useShuffled || realKey == null) return realKey
    const idx = entries.findIndex(([k]) => k === realKey)
    return idx >= 0 ? (DISPLAY_LABELS[idx] || realKey) : realKey
  }
  const correctLabel = labelOf(correct)

  return (
    <div className="q-body">
      {!hidePassage && <PassageBlock title={q.passage_title} text={q.passage_text} />}
      <p className="q-text"><QuestionText q={q} /></p>
      <FigureImages path={q.figure_path} />
      <div className="choices">
        {entries.map(([key, val], i) => (
          <button
            key={key}
            className={`choice-btn ${getState(key)}`}
            onClick={() => handleSelect(key)}
            disabled={readOnly || (!examMode && correct !== null && selected !== null)}
          >
            <span className="choice-label">{useShuffled ? (DISPLAY_LABELS[i] || key) : key}.</span>
            <span className="choice-text"><MarkerText text={val} images={q.images} /></span>
          </button>
        ))}
      </div>
      {!examMode && selected !== null && correct !== null && (
        <p className={`answer-feedback ${selected === correct ? 'correct' : 'wrong'}`}>
          {selected === correct
            ? `✓ Đúng! Đáp án: ${correctLabel}`
            : `✗ Sai! Đáp án đúng là: ${correctLabel}`}
        </p>
      )}
      {!examMode && readOnly && selected === null && correct !== null && (
        <p className="answer-feedback wrong">Chưa chọn đáp án. Đáp án đúng: {correctLabel}</p>
      )}
      {!examMode && selected !== null && correct === null && (
        <p className="answer-feedback neutral">Chưa có đáp án chính thức cho câu này.</p>
      )}
    </div>
  )
}

/* ── PHẦN II: Đúng/Sai ── */
function TrueFalseCard({ q, examMode, onAnswerChange, saved, readOnly = false }) {
  // Khởi tạo từ đáp án đã lưu — nếu không, quay lại phần này rồi tick tiếp sẽ ghi đè mất các ý đã chọn
  const [answers, setAnswers] = useState(saved ?? {})
  const subs = q.sub_questions || []

  const toggle = (label, val) => {
    if (readOnly) return
    const next = { ...answers, [label]: answers[label] === val ? undefined : val }
    setAnswers(next)
    onAnswerChange?.(next)
  }

  const getResult = (sub) => {
    if (examMode) return null
    if (sub.correct_answer === null) return null
    const userAns = answers[sub.label]
    if (userAns === undefined) return readOnly ? 'missing' : null
    return userAns === sub.correct_answer ? 'correct' : 'wrong'
  }

  return (
    <div className="q-body">
      <p className="q-text"><QuestionText q={q} /></p>
      <FigureImages path={q.figure_path} />
      <div className="sub-questions">
        {subs.map((sub) => {
          const result = getResult(sub)
          const rowClass = result === 'missing' ? 'wrong' : (result || '')
          return (
            <div key={sub.label} className={`sub-row ${rowClass}`}>
              <span className="sub-label">{sub.label})</span>
              <span className="sub-text"><MathText text={sub.text} /></span>
              <div className="tf-buttons">
                <button
                  className={`tf-btn true-btn ${answers[sub.label] === true ? 'active' : ''}`}
                  onClick={() => toggle(sub.label, true)}
                  disabled={readOnly}
                >Đúng</button>
                <button
                  className={`tf-btn false-btn ${answers[sub.label] === false ? 'active' : ''}`}
                  onClick={() => toggle(sub.label, false)}
                  disabled={readOnly}
                >Sai</button>
              </div>
              {!examMode && result && (
                <span className={`sub-result ${rowClass}`}>
                  {result === 'correct' ? '✓' : result === 'missing'
                    ? `— chưa chọn (Đúng: ${sub.correct_answer ? 'Đúng' : 'Sai'})`
                    : `✗ (${sub.correct_answer ? 'Đúng' : 'Sai'})`}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── PHẦN III: trả lời ngắn ── */
function ShortAnswerCard({ q, examMode, onAnswerChange, saved, readOnly = false }) {
  const [value, setValue]       = useState(saved ?? '')
  const [submitted, setSubmitted] = useState(readOnly)
  const correct = q.answer

  const check = () => { if (value.trim()) setSubmitted(true) }

  const isCorrect = correct && value.trim().toLowerCase() === correct.toString().toLowerCase()

  if (examMode) {
    return (
      <div className="q-body">
        <p className="q-text"><QuestionText q={q} /></p>
        <FigureImages path={q.figure_path} />
        <div className="short-answer-row">
          <input
            className="short-input"
            type="text"
            placeholder="Nhập đáp án…"
            value={value}
            onChange={e => { setValue(e.target.value); onAnswerChange?.(e.target.value) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="q-body">
      <p className="q-text"><QuestionText q={q} /></p>
      <FigureImages path={q.figure_path} />
      <div className="short-answer-row">
        <input
          className="short-input"
          type="text"
          placeholder="Nhập đáp án…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSubmitted(false); onAnswerChange?.(e.target.value) }}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          disabled={readOnly || (submitted && isCorrect)}
        />
        {!readOnly && (
          <button className="check-btn" onClick={check} disabled={!value.trim()}>
            Kiểm tra
          </button>
        )}
      </div>
      {submitted && correct && (
        <p className={`answer-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
          {isCorrect ? `✓ Chính xác!`
            : !value.trim() ? `— Chưa trả lời. Đáp án: ${correct}`
            : `✗ Chưa đúng. Đáp án: ${correct}`}
        </p>
      )}
      {submitted && !correct && (
        <p className="answer-feedback neutral">Chưa có đáp án mẫu.</p>
      )}
    </div>
  )
}

/* ── TỰ LUẬN: học sinh upload ảnh bài làm (chụp / thư viện / kéo thả) ── */
async function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/submissions/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Upload thất bại (HTTP ${res.status})`)
  }
  return res.json()   // { url, name, size }
}

function EssayUploadCard({ q, examMode, onAnswerChange, saved, readOnly = false }) {
  const [images, setImages]     = useState(Array.isArray(saved) ? saved : [])
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const [dragOver, setDragOver] = useState(false)
  const cameraRef  = useRef(null)
  const libraryRef = useRef(null)

  const commit = (next) => { setImages(next); onAnswerChange?.(next) }

  if (readOnly) {
    return (
      <div className="q-body">
        <p className="q-text"><QuestionText q={q} /></p>
        <FigureImages path={q.figure_path} />
        {images.length > 0 ? (
          <div className="essay-thumbs">
            {images.map((img, i) => (
              <div key={img.url || i} className="essay-thumb">
                <img src={img.url} alt={img.name || `Ảnh ${i + 1}`} loading="lazy"
                  onClick={() => window.open(img.url, '_blank')} />
              </div>
            ))}
          </div>
        ) : (
          <p className="answer-feedback neutral">Chưa nộp ảnh bài làm cho câu này.</p>
        )}
      </div>
    )
  }

  const addFiles = async (files) => {
    const imgs = Array.from(files || []).filter(f => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    setError(''); setUploading(true)
    try {
      const uploaded = []
      for (const f of imgs) {
        if (f.size > 15 * 1024 * 1024) { setError(`"${f.name}" quá lớn (tối đa 15 MB).`); continue }
        uploaded.push(await uploadImage(f))
      }
      if (uploaded.length) commit([...images, ...uploaded])
    } catch (e) {
      setError(e.message || 'Upload thất bại. Thử lại.')
    } finally {
      setUploading(false)
    }
  }

  const removeAt = (idx) => {
    const img = images[idx]
    commit(images.filter((_, i) => i !== idx))
    // Xóa file trên server (best-effort) — chưa nộp nên gỡ luôn cho gọn
    const fname = img?.url?.split('/').pop()
    if (fname) fetch(`/api/submissions/upload/${fname}`, { method: 'DELETE' }).catch(() => {})
  }

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }

  return (
    <div className="q-body">
      <p className="q-text"><QuestionText q={q} /></p>
      <FigureImages path={q.figure_path} />

      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }}
        onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
      <input ref={libraryRef} type="file" accept="image/*" multiple
        style={{ display: 'none' }}
        onChange={e => { addFiles(e.target.files); e.target.value = '' }} />

      <div
        className={`essay-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="essay-dz-icon">📸</div>
        <div className="essay-dz-text">
          Chụp ảnh hoặc chọn ảnh bài làm — hoặc <strong>kéo &amp; thả ảnh vào đây</strong>
        </div>
        <div className="essay-dz-actions">
          <button type="button" className="essay-btn essay-btn-camera"
            onClick={() => cameraRef.current?.click()} disabled={uploading}>
            📷 Chụp ảnh
          </button>
          <button type="button" className="essay-btn essay-btn-library"
            onClick={() => libraryRef.current?.click()} disabled={uploading}>
            🖼 Chọn từ thư viện
          </button>
        </div>
        {uploading && <div className="essay-uploading">⏳ Đang tải ảnh lên…</div>}
        {error && <div className="essay-error">⚠️ {error}</div>}
      </div>

      {images.length > 0 && (
        <div className="essay-thumbs">
          {images.map((img, i) => (
            <div key={img.url || i} className="essay-thumb">
              <img src={img.url} alt={img.name || `Ảnh ${i + 1}`} loading="lazy"
                onClick={() => window.open(img.url, '_blank')} />
              <button type="button" className="essay-thumb-del"
                onClick={() => removeAt(i)} title="Xóa ảnh">✕</button>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <p className="essay-count">✅ Đã đính kèm {images.length} ảnh</p>
      )}
    </div>
  )
}

/* ── Card tổng hợp ── */
const SECTION_CLASS = {
  'PHẦN I':    'phan-1',
  'PHẦN II':   'phan-2',
  'PHẦN III':  'phan-3',
  'TỰ LUẬN':   'phan-essay',
  'TIẾNG ANH': 'phan-english',
  'READING':   'phan-english',
}
export const SECTION_PREFIX = {
  'PHẦN I':    'I',
  'PHẦN II':   'II',
  'PHẦN III':  'III',
  'TỰ LUẬN':   'TL',
  'TIẾNG ANH': 'EN',
  'READING':   'RD',
}

function _isMultipleChoice(q) {
  return q.section === 'PHẦN I' || q.section === 'TIẾNG ANH' || q.section === 'READING'
}

export default function QuestionCard({ q, index, displayNumber, examMode = false, shuffleChoices, onAnswerChange, hidePassage = false, answers, choiceOrders, readOnly = false }) {
  const [expanded, setExpanded] = useState(true)
  const points   = q.points ? `${q.points}đ` : ''
  const secClass = SECTION_CLASS[q.section] || 'phan-1'
  const prefix   = SECTION_PREFIX[q.section] || 'I'
  const qKey     = `${prefix}_${q.question_number}`
  // Số hiển thị cho học sinh: khi đề bật trộn câu, mỗi học sinh thấy "Câu 1, 2, 3…" theo
  // VỊ TRÍ đã trộn (không lộ thứ tự gốc) — displayNumber (truyền từ ExamTakePage) khác
  // q.question_number (số câu THẬT, dùng để lưu/chấm đáp án qua qKey ở trên).
  const shownNumber = displayNumber ?? q.question_number

  // Đáp án đã lưu ở cha cho câu này — dùng để khôi phục khi card mount lại (đổi phần)
  const saved        = answers?.[qKey]
  const choiceOrder  = choiceOrders?.[qKey]
  const handleChange = (ans) => onAnswerChange?.(qKey, ans)

  const hasAnswer = q.answer != null
  const isEnglish = q.section === 'TIẾNG ANH' || q.section === 'READING'

  return (
    <div className={`question-card ${secClass}`}>
      <div className="q-header" onClick={() => setExpanded(v => !v)}>
        <span className="q-num">
          {isEnglish ? `Question ${shownNumber}` : `Câu ${shownNumber}`}
        </span>
        {points && <span className="q-points">{points}</span>}
        {q.has_figure && <span className="q-badge img-badge">📷 Hình</span>}
        {/* Badge "chưa có đáp án" chỉ đáng tin khi có đáp án để soi (giáo viên sửa đề / luyện tập) —
            lúc thi thật server đã ẩn q.answer nên hasAnswer luôn false, không phản ánh đúng thực tế. */}
        {!examMode && isEnglish && !hasAnswer && <span className="q-badge no-ans-badge">—</span>}
        <span className="q-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        _isMultipleChoice(q) ? (
          <MultipleChoiceCard q={q} examMode={examMode} onAnswerChange={handleChange} hidePassage={hidePassage} saved={saved} choiceOrder={choiceOrder} shuffleChoices={shuffleChoices ?? examMode} readOnly={readOnly} />
        ) : q.section === 'PHẦN II' ? (
          <TrueFalseCard q={q} examMode={examMode} onAnswerChange={handleChange} saved={saved} readOnly={readOnly} />
        ) : q.section === 'TỰ LUẬN' ? (
          <EssayUploadCard q={q} examMode={examMode} onAnswerChange={handleChange} saved={saved} readOnly={readOnly} />
        ) : (
          <ShortAnswerCard q={q} examMode={examMode} onAnswerChange={handleChange} saved={saved} readOnly={readOnly} />
        )
      )}
    </div>
  )
}

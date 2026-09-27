import React from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
// Mở rộng mhchem: hỗ trợ công thức hoá học \ce{...} (đề Hóa, nhất là các mệnh đề
// Đúng/Sai ở PHẦN II). Thiếu import này thì mọi \ce sẽ hiện chữ đỏ báo lỗi.
import 'katex/dist/contrib/mhchem.mjs'

// ── LaTeX control-char recovery ───────────────────────────────────────────────
// The backend JSON parser used to corrupt \frac → form-feed (\x0c) and
// \beta → backspace (\x08) because those are valid single-char JSON escapes.
// Map them back to a literal backslash so KaTeX can parse them correctly.
// We do NOT attempt to auto-add \ before command names — that approach is too
// fragile (e.g. "in" matches inside \sin, \infty, etc.) and causes more breakage
// than it prevents. The backend sanitize_json_escapes fix is the right long-term
// solution; this is only a safety net for already-stored corrupted data.

function recoverLatex(math) {
  return math
    .replace(/\x0c/g, '\\f')   // form-feed  ← JSON \f corruption of \frac, \flat…
    .replace(/\x08/g, '\\b')   // backspace  ← JSON \b corruption of \beta, \binom…
    .replace(/[\x00-\x07\x0b\x0e-\x1f]/g, '') // remove other stray control chars
}

// ── KaTeX rendering ───────────────────────────────────────────────────────────

const KATEX_OPTS = {
  throwOnError: false,
  strict:       false,
  trust:        true,
  errorColor:   '#e53e3e',
}

function renderMathHtml(math, displayMode) {
  const src = recoverLatex(math)
  try {
    return katex.renderToString(src, { ...KATEX_OPTS, displayMode })
  } catch {
    const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<span class="katex-error" style="color:#e53e3e">${esc}</span>`
  }
}

// ── Nhấn mạnh chữ "sai" trong đề bài ─────────────────────────────────────────
// Câu "Khẳng định nào sau đây là sai?" rất dễ bị đọc vội thành "đúng" rồi chọn
// ngược đáp án, nên chữ "sai" được in đậm + to hơn (class .mt-sai).
// Chỉ bật cho ĐỀ BÀI qua prop `emphasizeSai`: đáp án A/B/C/D và các ý a–d của
// PHẦN II giữ nguyên, nếu không cả câu sẽ lỗ chỗ chữ đậm và mất tác dụng nhấn.
const SAI_RE = /\bsai\b/gi
// Thuật ngữ có chứa "sai" (sai số, sai lệch…) — không phải yêu cầu chọn phương
// án sai, tô đậm là nhấn nhầm chỗ. Chặn cuối bằng (?!\p{L}) chứ không phải \b:
// chữ có dấu ("số", "lệch") kết thúc bằng ký tự ngoài ASCII nên \b không khớp.
const SAI_COMPOUND_RE = /^\s*(?:số|lệch|sót|khác|biệt|phân|lầm|dấu)(?!\p{L})/iu
// "đúng hay sai", "Đúng/Sai", "xét tính đúng sai" — đề hỏi cả hai chiều (hay gặp
// ở đề bài PHẦN II), nhấn mạnh một bên là làm lệch đề.
const BOTH_WAYS_RE = /đúng\s*(?:hay|hoặc|\/|,|-|–)?\s*$/i

// Trả về mảng node đã chèn <strong>, hoặc null nếu không có gì cần nhấn —
// null để phía gọi render nguyên chuỗi như cũ, khỏi bọc thêm node vô ích.
function emphasizeSaiNodes(value, keyPrefix) {
  const nodes = []
  let last = 0
  for (const m of value.matchAll(SAI_RE)) {
    const end = m.index + m[0].length
    if (SAI_COMPOUND_RE.test(value.slice(end))) continue
    if (BOTH_WAYS_RE.test(value.slice(0, m.index))) continue
    if (m.index > last) nodes.push(value.slice(last, m.index))
    nodes.push(<strong key={`${keyPrefix}-s${m.index}`} className="mt-sai">{m[0]}</strong>)
    last = end
  }
  if (!nodes.length) return null
  if (last < value.length) nodes.push(value.slice(last))
  return nodes
}

// ── Markdown table ────────────────────────────────────────────────────────────

function isTableBlock(text) {
  const lines = text.trim().split('\n')
  return (
    lines.length >= 2 &&
    lines[0].includes('|') &&
    /^\|[\s\-:|]+\|/.test(lines[1])
  )
}

function renderTable(text, key) {
  const lines = text.trim().split('\n').filter((l) => l.trim())
  const headers = lines[0].split('|').filter((c) => c.trim()).map((c) => c.trim())
  const rows = lines.slice(2).map((row) =>
    row.split('|').filter((c) => c.trim()).map((c) => c.trim())
  )
  return (
    <div key={key} className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}><MathText text={h} /></th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => <td key={ci}><MathText text={cell} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function splitTableBlocks(text) {
  const TABLE_RE = /((?:(?:\|[^\n]+\|\n?){2,}))/g
  const parts = []
  let last = 0
  for (const m of text.matchAll(TABLE_RE)) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    parts.push({ type: isTableBlock(m[0]) ? 'table' : 'text', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

// ── LaTeX segment parser ──────────────────────────────────────────────────────

function parseLatexSegments(text) {
  const segments = []
  // Allow \n inside $...$ so multi-line expressions (cases, etc.) work
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    if (raw.startsWith('$$')) {
      segments.push({ type: 'block', value: raw.slice(2, -2).trim() })
    } else {
      segments.push({ type: 'inline', value: raw.slice(1, -1).trim() })
    }
    lastIndex = match.index + raw.length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments
}

function renderLatexSegment(seg, idx, emphasizeSai) {
  if (seg.type === 'inline') {
    return (
      <span
        key={idx}
        dangerouslySetInnerHTML={{ __html: renderMathHtml(seg.value, false) }}
      />
    )
  }
  if (seg.type === 'block') {
    return (
      <div
        key={idx}
        dangerouslySetInnerHTML={{ __html: renderMathHtml(seg.value, true) }}
      />
    )
  }
  // Chỉ chữ thường mới được nhấn — phần trong $...$ đã tách thành segment riêng
  // ở trên nên KaTeX không bao giờ nhận thêm thẻ HTML lạ.
  return seg.value.split('\n').map((line, i, arr) => (
    <React.Fragment key={`${idx}-${i}`}>
      {emphasizeSai ? (emphasizeSaiNodes(line, `${idx}-${i}`) || line) : line}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ))
}

function RichText({ text, emphasizeSai }) {
  const segs = parseLatexSegments(text)
  return <>{segs.map((s, i) => renderLatexSegment(s, i, emphasizeSai))}</>
}

// ── Public component ──────────────────────────────────────────────────────────

export default function MathText({ text, className = '', emphasizeSai = false }) {
  if (text == null || text === '') return null
  // Ép về chuỗi: đáp án trả lời ngắn có thể là số (vd 42, 2.5) — nếu để nguyên,
  // các hàm chuỗi (matchAll/split) sẽ ném lỗi và làm trắng cả trang.
  const str = typeof text === 'string' ? text : String(text)
  const blocks = splitTableBlocks(str)
  return (
    <span className={className}>
      {blocks.map((b, i) =>
        b.type === 'table'
          ? renderTable(b.value, i)
          : <RichText key={i} text={b.value} emphasizeSai={emphasizeSai} />
      )}
    </span>
  )
}

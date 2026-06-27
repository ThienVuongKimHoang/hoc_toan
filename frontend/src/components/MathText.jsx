import React from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

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

function renderLatexSegment(seg, idx) {
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
  return seg.value.split('\n').map((line, i, arr) => (
    <React.Fragment key={`${idx}-${i}`}>
      {line}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ))
}

function RichText({ text }) {
  const segs = parseLatexSegments(text)
  return <>{segs.map((s, i) => renderLatexSegment(s, i))}</>
}

// ── Public component ──────────────────────────────────────────────────────────

export default function MathText({ text, className = '' }) {
  if (!text) return null
  const blocks = splitTableBlocks(text)
  return (
    <span className={className}>
      {blocks.map((b, i) =>
        b.type === 'table'
          ? renderTable(b.value, i)
          : <RichText key={i} text={b.value} />
      )}
    </span>
  )
}

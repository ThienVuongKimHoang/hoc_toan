import React, { useEffect, useState } from 'react'

const MESSAGES = [
  '🧠 AI đang phân tích cấu trúc tài liệu...',
  '🔍 Nhận diện các câu hỏi và phần thi...',
  '📝 Đang trích xuất đáp án và nội dung...',
  '🔢 Xử lý công thức toán học (LaTeX)...',
  '🗂️ Phân loại câu hỏi theo từng phần...',
  '✨ Sắp hoàn tất, giữ nguyên nhé...',
]

export default function ProcessingStep({ events, source }) {
  const [msgIdx, setMsgIdx] = useState(0)

  // Rotate motivational message
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 2800)
    return () => clearInterval(t)
  }, [])

  // Parse progress from events
  const startEvt    = events.find(e => e.type === 'start')
  const totalPages  = startEvt?.total_pages ?? 0
  const pagesDone   = events.filter(e => e.type === 'page_done').length
  const isDone      = events.some(e => e.type === 'done')
  const isError     = events.some(e => e.type === 'error')
  const totalFound  = events.filter(e => e.type === 'page_done')
                            .reduce((s, e) => s + (e.questions_found ?? 0), 0)

  // Classification phase (after extraction)
  const classifyEvts  = events.filter(e => e.type === 'classifying')
  const isClassifying = classifyEvts.length > 0 && !isDone
  const classifyLast  = classifyEvts.at(-1)
  const classifyTotal = classifyLast?.total ?? 0
  const classifyDone  = classifyLast?.done  ?? 0
  const classifyPct   = classifyTotal > 0 ? Math.round((classifyDone / classifyTotal) * 100) : 0

  const extractionDone = pagesDone >= totalPages && totalPages > 0
  const pct = isClassifying
    ? 100   // extraction bar stays full during classification
    : totalPages > 0 ? Math.round((pagesDone / totalPages) * 100) : (isDone ? 100 : 0)

  const pageLog = events
    .filter(e => e.type === 'page_done')
    .slice(-6)
    .reverse()

  const errorEvt = events.find(e => e.type === 'error')

  return (
    <div className="ps-wrap">
      {/* AI Orb animation */}
      <div className="ps-orb-wrap">
        <div className={`ps-orb ${isDone ? 'done' : isError ? 'error' : 'active'}`}>
          <div className="ps-orb-core">
            {isDone ? '✅' : isError ? '❌' : '🤖'}
          </div>
          {!isDone && !isError && (
            <>
              <div className="ps-orb-ring ring1" />
              <div className="ps-orb-ring ring2" />
              <div className="ps-orb-ring ring3" />
            </>
          )}
        </div>
      </div>

      {/* Status text */}
      <div className="ps-status">
        {isError ? (
          <p className="ps-msg error">❌ {errorEvt?.message || 'Đã xảy ra lỗi.'}</p>
        ) : isDone ? (
          <p className="ps-msg done">✅ Hoàn tất! Trích xuất <strong>{totalFound}</strong> câu hỏi và phân loại chủ đề xong.</p>
        ) : isClassifying ? (
          <p className="ps-msg classifying">🏷️ AI đang phân loại chủ đề và độ khó… ({classifyDone}/{classifyTotal})</p>
        ) : (
          <p className="ps-msg" key={msgIdx}>{MESSAGES[msgIdx]}</p>
        )}
        {totalPages > 0 && !isDone && !isClassifying && !isError && (
          <p className="ps-sub-status">Trang {pagesDone} / {totalPages}</p>
        )}
      </div>

      {/* Extraction progress bar */}
      <div className="ps-progress-wrap">
        <div className="ps-progress-track">
          <div
            className={`ps-progress-fill ${isDone ? 'done' : isError ? 'error' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="ps-pct">{pct}%</span>
      </div>

      {/* Classification progress bar (shown only during classifying phase) */}
      {(isClassifying || (isDone && classifyEvts.length > 0)) && (
        <div className="ps-classify-wrap">
          <span className="ps-classify-label">🏷️ Phân loại chủ đề</span>
          <div className="ps-progress-track ps-classify-track">
            <div
              className={`ps-progress-fill ps-classify-fill ${isDone ? 'done' : ''}`}
              style={{ width: `${isDone ? 100 : classifyPct}%` }}
            />
          </div>
          <span className="ps-pct">{isDone ? 100 : classifyPct}%</span>
        </div>
      )}

      {/* Page steps indicator */}
      {totalPages > 0 && (
        <div className="ps-pages-row">
          {[...Array(Math.min(totalPages, 20))].map((_, i) => {
            const done = i < pagesDone
            const active = i === pagesDone && !isDone
            return (
              <div
                key={i}
                className={`ps-page-dot ${done ? 'done' : active ? 'active' : ''}`}
                title={`Trang ${i + 1}`}
              />
            )
          })}
          {totalPages > 20 && <span className="ps-pages-more">+{totalPages - 20}</span>}
        </div>
      )}

      {/* Live log */}
      {pageLog.length > 0 && (
        <div className="ps-log">
          <div className="ps-log-title">Nhật ký xử lý</div>
          {pageLog.map((e, i) => (
            <div key={i} className="ps-log-row">
              <span className="ps-log-page">Trang {e.page}</span>
              <span className="ps-log-secs">{(e.sections || []).join(', ')}</span>
              <span className="ps-log-found">
                {e.questions_found > 0 ? `+${e.questions_found} câu` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* File info */}
      <div className="ps-file-info">
        📄 {source || startEvt?.source || 'Đang xử lý...'}
      </div>
    </div>
  )
}

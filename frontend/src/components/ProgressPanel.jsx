import React from 'react'

export default function ProgressPanel({ events, status }) {
  const startEvent = events.find((e) => e.type === 'start')
  const donePages = events.filter((e) => e.type === 'page_done')
  const total = startEvent?.total_pages ?? 0
  const current = donePages.length
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const totalFound = donePages.reduce((s, e) => s + (e.questions_found || 0), 0)

  const errorEvent = events.find((e) => e.type === 'error')
  const doneEvent = events.find((e) => e.type === 'done')

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <span className="progress-label">
          {status === 'error' ? '❌ Lỗi trích xuất' : status === 'done' ? '✅ Hoàn tất!' : '⏳ Đang xử lý…'}
        </span>
        {total > 0 && (
          <span className="progress-count">{current}/{total} trang</span>
        )}
      </div>

      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${status === 'error' ? 'error' : status === 'done' ? 'done' : ''}`}
          style={{ width: `${status === 'done' ? 100 : pct}%` }}
        />
      </div>

      {startEvent && (
        <p className="progress-source">📄 {startEvent.source}</p>
      )}

      {errorEvent && (
        <p className="progress-error">{errorEvent.message}</p>
      )}

      {doneEvent && (
        <p className="progress-done">
          Tìm được <strong>{doneEvent.total_questions}</strong> câu hỏi
        </p>
      )}

      <div className="progress-log">
        {donePages.slice(-6).map((e, i) => (
          <div key={i} className="log-line">
            <span className="log-page">Trang {e.page}</span>
            <span className="log-sections">[{e.sections?.join(', ')}]</span>
            <span className="log-found">+{e.questions_found} câu</span>
          </div>
        ))}
      </div>
    </div>
  )
}

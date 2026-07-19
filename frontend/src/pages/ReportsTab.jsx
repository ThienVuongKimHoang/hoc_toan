// ReportsTab.jsx — Super admin xem báo cáo tổng hợp: vắng học / bỏ bài / điểm thấp
import React, { useCallback, useEffect, useState } from 'react'
import { getReports } from '../store/attendanceStore.js'
import { getAllClasses } from '../store/classStore.js'

const TYPE_LABELS = {
  vang_hoc:   { label: 'Vắng học', icon: '🗓️' },
  bo_bai:     { label: 'Bỏ bài',   icon: '📝' },
  diem_thap:  { label: 'Điểm thấp', icon: '📉' },
}

const PER_PAGE = 20

export default function ReportsTab({ viewerId }) {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [type, setType]       = useState('')
  const [classId, setClassId] = useState('')
  const [classes, setClasses] = useState([])
  const [page, setPage]       = useState(1)

  useEffect(() => { getAllClasses(viewerId).then(setClasses).catch(() => {}) }, [viewerId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReports({ type, classId, limit: PER_PAGE, offset: (page - 1) * PER_PAGE, viewerId })
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch {
      setRows([]); setTotal(0)
    }
    setLoading(false)
  }, [type, classId, page, viewerId])

  useEffect(() => { load() }, [load])

  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const fmt = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="sa-exams">
      <div className="sa-toolbar">
        <div className="sa-filter-tabs">
          {[
            { key: '', label: 'Tất cả' },
            { key: 'vang_hoc', label: '🗓️ Vắng học' },
            { key: 'bo_bai', label: '📝 Bỏ bài' },
            { key: 'diem_thap', label: '📉 Điểm thấp' },
          ].map(f => (
            <button key={f.key} className={`sa-filter-tab ${type === f.key ? 'active' : ''}`}
              onClick={() => { setType(f.key); setPage(1) }}>{f.label}</button>
          ))}
        </div>

        <select className="sa-search" style={{ maxWidth: 220 }} value={classId}
          onChange={e => { setClassId(e.target.value); setPage(1) }}>
          <option value="">Tất cả lớp</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="sa-count-badge">{total} báo cáo</div>
      </div>

      {loading ? (
        <div className="sa-loading">Đang tải…</div>
      ) : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Lớp</th>
                  <th>Học sinh</th>
                  <th>Chi tiết</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="sa-empty">Không có báo cáo nào.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id}>
                    <td>{TYPE_LABELS[r.type]?.icon || '•'} {TYPE_LABELS[r.type]?.label || r.type}</td>
                    <td>{r.className}</td>
                    <td>{r.studentName}</td>
                    <td className="sa-title-cell">{r.detail || r.title}</td>
                    <td>{fmt(r.createdAt)}</td>
                  </tr>
                ))}
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

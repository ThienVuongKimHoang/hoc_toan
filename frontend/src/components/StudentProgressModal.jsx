import React, { useState } from 'react'
import { scaledScore } from '../store/examStore.js'

/* Chi tiết tiến độ 1 học sinh: điểm theo thời gian (biểu đồ vùng, quy về thang 10),
   các thẻ chỉ số trực quan, và các bảng chi tiết điểm số, đi trễ/vắng + bài bỏ. */

const Y_TICKS = [10, 7.5, 5, 2.5, 0]

const fmtShort = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  : '—'
const fmtFull = iso => iso
  ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

const getGpaColorBg = (gpa) => {
  if (gpa == null) return '#f1f5f9'
  if (gpa >= 8.0) return '#dcfce7'
  if (gpa >= 6.5) return '#fef3c7'
  return '#fee2e2'
}

const getGpaColorText = (gpa) => {
  if (gpa == null) return '#475569'
  if (gpa >= 8.0) return '#16a34a'
  if (gpa >= 6.5) return '#d97706'
  return '#dc2626'
}

const getGpaBadgeType = (gpa) => {
  if (gpa == null) return 'gray'
  if (gpa >= 8.0) return 'success'
  if (gpa >= 6.5) return 'warning'
  return 'danger'
}

const getGpaText = (gpa) => {
  if (gpa == null) return ''
  if (gpa >= 8.0) return 'Giỏi / Xuất sắc'
  if (gpa >= 6.5) return 'Khá'
  return 'Cần cố gắng'
}

const getAttendanceColorBg = (rate) => {
  if (rate == null) return '#f1f5f9'
  if (rate >= 90) return '#dcfce7'
  if (rate >= 75) return '#fef3c7'
  return '#fee2e2'
}

const getAttendanceColorText = (rate) => {
  if (rate == null) return '#475569'
  if (rate >= 90) return '#16a34a'
  if (rate >= 75) return '#d97706'
  return '#dc2626'
}

export default function StudentProgressModal({ student, onClose }) {
  const [hover, setHover] = useState(null)
  const [activeTab, setActiveTab] = useState('scores') // 'scores', 'attendance', 'assignments'

  if (!student) return null

  const { studentName, attendance = {}, assignments = {}, scoreHistory = [] } = student

  const points = [...scoreHistory]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map(s => ({ ...s, scaled: scaledScore(s.score, s.maxScore) }))
  const avg = points.length
    ? Math.round((points.reduce((sum, p) => sum + p.scaled, 0) / points.length) * 100) / 100
    : null

  const lateDates = (attendance.detail || []).filter(d => d.status === 'tre')
  const absentDates = (attendance.detail || []).filter(d => d.status === 'vang')
  const missed = assignments.missed || []

  // Combine and sort attendance logs chronologically (newest first)
  const attendanceExceptions = [
    ...lateDates.map(d => ({ ...d, type: 'late' })),
    ...absentDates.map(d => ({ ...d, type: 'absent' }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box spd-box" style={{ maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Dynamic Profile Header */}
        <div className="modal-header spd-header-profile" style={{ borderRadius: '20px 20px 0 0' }}>
          <div className="spd-avatar">
            {studentName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="spd-profile-info">
            <div className="spd-profile-name">{studentName}</div>
            <div className="spd-profile-subtitle">Hồ sơ chi tiết tiến độ học tập & chuyên cần</div>
          </div>
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {/* Top Metric Cards */}
          <div className="spd-metrics-grid">
            {/* GPA Card */}
            <div className="spd-metric-card">
              <div className="spd-metric-icon" style={{ backgroundColor: getGpaColorBg(avg), color: getGpaColorText(avg) }}>
                🎓
              </div>
              <div className="spd-metric-content">
                <div className="spd-metric-value-row">
                  <div className="spd-metric-value">{avg != null ? avg : '—'}</div>
                  {avg != null && <small style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>/10</small>}
                </div>
                <div className="spd-metric-label">Điểm trung bình ({points.length} bài)</div>
                {avg != null && (
                  <span className={`spd-badge spd-badge--${getGpaBadgeType(avg)}`} style={{ marginTop: '8px' }}>
                    {getGpaText(avg)}
                  </span>
                )}
              </div>
            </div>

            {/* Attendance Card */}
            <div className="spd-metric-card">
              <div className="spd-metric-icon" style={{ backgroundColor: getAttendanceColorBg(attendance.rate), color: getAttendanceColorText(attendance.rate) }}>
                🗓️
              </div>
              <div className="spd-metric-content">
                <div className="spd-metric-value-row">
                  <div className="spd-metric-value">{attendance.rate != null ? `${attendance.rate}%` : '—'}</div>
                </div>
                <div className="spd-metric-label">Chuyên cần ({attendance.total || 0} buổi)</div>
                {attendance.rate != null && (
                  <div className="spd-progress-bar-container">
                    <div 
                      className="spd-progress-bar" 
                      style={{ 
                        width: `${attendance.rate}%`, 
                        backgroundColor: getAttendanceColorText(attendance.rate) 
                      }} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Homework Card */}
            <div className="spd-metric-card">
              <div className="spd-metric-icon" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                📝
              </div>
              <div className="spd-metric-content">
                <div className="spd-metric-value-row">
                  <div className="spd-metric-value">
                    {assignments.submitted ?? 0}
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>/{assignments.total ?? 0}</span>
                  </div>
                </div>
                <div className="spd-metric-label">Bài tập đã nộp</div>
                {assignments.total > 0 && (
                  <div className="spd-progress-bar-container">
                    <div 
                      className="spd-progress-bar" 
                      style={{ 
                        width: `${((assignments.submitted ?? 0) / assignments.total) * 100}%`, 
                        backgroundColor: '#0284c7' 
                      }} 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="spd-tabs">
            <button 
              className={`spd-tab-btn ${activeTab === 'scores' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('scores')}
            >
              📊 Bảng điểm & Biểu đồ
            </button>
            <button 
              className={`spd-tab-btn ${activeTab === 'attendance' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              ⏰ Chuyên cần ({lateDates.length + absentDates.length})
            </button>
            <button 
              className={`spd-tab-btn ${activeTab === 'assignments' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('assignments')}
            >
              ⚠️ Bài tập chưa nộp ({missed.length})
            </button>
          </div>

          {/* Tab 1 Content: Scores & Charts */}
          {activeTab === 'scores' && (
            <div className="spd-tab-pane">
              <h3 className="sd-heading" style={{ marginTop: 8, marginBottom: 12 }}>Điểm số theo thời gian</h3>
              {points.length === 0 ? (
                <div className="spd-empty-state">
                  <div className="spd-empty-icon">📈</div>
                  <div className="spd-empty-text">Chưa có bài kiểm tra hoặc bài tập nào được chấm điểm.</div>
                </div>
              ) : (
                <>
                  <div className="sd-card" style={{ marginBottom: 20 }}>
                    <div className="sd-card-body">
                      <div className="sd-chart" style={{ height: 220 }}>
                        <div className="sd-yaxis">
                          {Y_TICKS.map(v => <span key={v} className="sd-ytick">{v}</span>)}
                        </div>
                        <div className="sd-plot">
                          <div className="sd-grid-lines">
                            {Y_TICKS.map(v => (
                              <div key={v} className="sd-gridline" style={{ bottom: `${(v / 10) * 100}%` }} />
                            ))}
                          </div>
                          
                          <svg className="sd-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                            <defs>
                              <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {points.length > 1 && (
                              <>
                                <polygon
                                  className="sd-area-path"
                                  points={
                                    `${(0.5 / points.length) * 100},100 ` +
                                    points.map((p, i) => `${((i + 0.5) / points.length) * 100},${100 - (p.scaled / 10) * 100}`).join(' ') +
                                    ` ${(points.length - 0.5) / points.length * 100},100`
                                  }
                                  style={{ fill: 'url(#chartAreaGrad)', stroke: 'none' }}
                                />
                                <polyline
                                  className="sd-line-path"
                                  points={points
                                    .map((p, i) => `${((i + 0.5) / points.length) * 100},${100 - (p.scaled / 10) * 100}`)
                                    .join(' ')}
                                  style={{ strokeWidth: 3, stroke: '#2563eb' }}
                                />
                              </>
                            )}
                          </svg>

                          {points.map((p, i) => {
                            const h = (p.scaled / 10) * 100
                            const on = hover === i
                            return (
                              <div
                                key={i}
                                className={`sd-col sd-col--line${on ? ' is-hover' : ''}`}
                                onMouseEnter={() => setHover(i)}
                                onMouseLeave={() => setHover(cur => (cur === i ? null : cur))}
                              >
                                <div className="sd-bar-area">
                                  {on && (
                                    <div className="sd-tip" style={{ bottom: `calc(${h}% + 28px)`, zIndex: 10 }}>
                                      <div className="sd-tip-label">{p.title}</div>
                                      <div className="sd-tip-label" style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Ngày: {fmtFull(p.date)}</div>
                                      <div className="sd-tip-value">
                                        <i className="sd-tip-dot" />Điểm: <b>{p.score}/{p.maxScore}</b> ({p.scaled}/10)
                                      </div>
                                    </div>
                                  )}
                                  <span className="sd-count" style={{ bottom: `calc(${h}% + 14px)` }}>{p.scaled}</span>
                                  <div className="sd-dot" style={{ bottom: `${h}%` }} />
                                </div>
                                <div className="sd-xlabel">{fmtShort(p.date)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <h3 className="sd-heading" style={{ marginTop: 24, marginBottom: 12 }}>Bảng điểm chi tiết</h3>
                  <div className="spd-table-wrapper">
                    <table className="spd-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>STT</th>
                          <th>Tên bài thi / Bài tập</th>
                          <th style={{ width: '120px' }}>Ngày nộp</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Điểm số</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Quy đổi (/10)</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Đánh giá</th>
                        </tr>
                      </thead>
                      <tbody>
                        {points.map((p, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{p.title}</td>
                            <td>{fmtFull(p.date)}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.score}/{p.maxScore}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`spd-badge spd-badge--${getGpaBadgeType(p.scaled)}`} style={{ minWidth: '40px', justifyContent: 'center' }}>
                                {p.scaled}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`spd-badge spd-badge--${getGpaBadgeType(p.scaled)}`}>
                                {p.scaled >= 8.0 ? 'Giỏi' : p.scaled >= 6.5 ? 'Khá' : p.scaled >= 5.0 ? 'Đạt' : 'Cần cố gắng'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2 Content: Attendance Exceptions */}
          {activeTab === 'attendance' && (
            <div className="spd-tab-pane">
              <h3 className="sd-heading" style={{ marginTop: 8, marginBottom: 12 }}>Lịch sử vắng học & Đi trễ</h3>
              {attendanceExceptions.length === 0 ? (
                <div className="spd-empty-state">
                  <div className="spd-empty-icon" style={{ color: '#10b981' }}>✅</div>
                  <div className="spd-empty-text">Tuyệt vời! Học sinh luôn đi học đầy đủ và đúng giờ.</div>
                </div>
              ) : (
                <div className="spd-table-wrapper">
                  <table className="spd-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>STT</th>
                        <th style={{ width: '200px' }}>Ngày học</th>
                        <th>Trạng thái</th>
                        <th>Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceExceptions.map((item, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{fmtFull(item.date)}</td>
                          <td>
                            {item.type === 'late' ? (
                              <span className="spd-badge spd-badge--warning">
                                ⏰ Đi trễ
                              </span>
                            ) : (
                              <span className="spd-badge spd-badge--danger">
                                ❌ Vắng mặt
                              </span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.82rem' }}>
                            {item.type === 'late' 
                              ? 'Học sinh đến lớp muộn so với giờ bắt đầu học.'
                              : 'Học sinh vắng mặt không phép hoặc có phép.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3 Content: Missed Homework */}
          {activeTab === 'assignments' && (
            <div className="spd-tab-pane">
              <h3 className="sd-heading" style={{ marginTop: 8, marginBottom: 12 }}>Danh sách bài tập chưa hoàn thành</h3>
              {missed.length === 0 ? (
                <div className="spd-empty-state">
                  <div className="spd-empty-icon" style={{ color: '#10b981' }}>⭐</div>
                  <div className="spd-empty-text">Tuyệt vời! Học sinh đã nộp đầy đủ tất cả bài tập được giao.</div>
                </div>
              ) : (
                <div className="spd-table-wrapper">
                  <table className="spd-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>STT</th>
                        <th>Tên bài tập / Đề thi</th>
                        <th style={{ width: '180px' }}>Hạn nộp</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missed.map((m, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: '#dc2626' }}>{m.title}</td>
                          <td>{fmtFull(m.date)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="spd-badge spd-badge--danger">
                              ⚠️ Trễ hạn / Bỏ bài
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

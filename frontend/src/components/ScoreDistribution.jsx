import React, { useState } from 'react'

/* ── Thống kê phổ điểm ──
   Chia điểm (thang 10) thành 10 khoảng: 0-1, 1-2, … , 9-10.
   Bên trái: biểu đồ cột; bên phải: bảng thống kê + điểm trung bình + mốc phổ biến nhất. */

const NUM_BINS = 10

const IcChart = (s = 14) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="18" y1="20" x2="18" y2="10" />
  </svg>
)

const IcList = (s = 14) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" />
    <line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
  </svg>
)

/* Nhãn mốc điểm: khoảng "lo-hi", ví dụ 1-2, 2-3, … */
const fmtNum = n => {
  const r = Math.round(n * 100) / 100
  return String(r)
}
const binLabel = (i, step) => `${fmtNum(i * step)}-${fmtNum((i + 1) * step)}`

export default function ScoreDistribution({ subs, maxScore = 10, chartTitle }) {
  const [hover, setHover] = useState(null)

  const scores = (subs || []).map(s => Number(s.score) || 0)
  if (!scores.length || !maxScore) return null

  const step = maxScore / NUM_BINS
  const bins = Array.from({ length: NUM_BINS }, () => 0)
  scores.forEach(sc => {
    const idx = Math.min(Math.floor(sc / step), NUM_BINS - 1)
    bins[Math.max(0, idx)]++
  })

  const peak     = Math.max(...bins, 1)
  const tickStep = Math.max(1, Math.ceil(peak / 4))
  const axisMax  = tickStep * Math.ceil(peak / tickStep) || 1
  const ticks    = []
  for (let v = axisMax; v >= 0; v -= tickStep) ticks.push(v)

  const avg     = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
  const modeIdx = bins.indexOf(peak)

  return (
    <section className="sd-wrap">
      <h3 className="sd-heading">Thống kê phổ điểm</h3>

      <div className="sd-grid">
        {/* ── Biểu đồ ── */}
        <div className="sd-card">
          <div className="sd-card-head">{IcChart(15)} Biểu đồ phổ điểm</div>

          <div className="sd-card-body">
            {chartTitle && <div className="sd-chart-title">{chartTitle}</div>}

            <div className="sd-chart">
              <div className="sd-yaxis">
                {ticks.map(v => <span key={v} className="sd-ytick">{v}</span>)}
              </div>

              <div className="sd-plot">
                <div className="sd-grid-lines">
                  {ticks.map(v => (
                    <div key={v} className="sd-gridline" style={{ bottom: `${(v / axisMax) * 100}%` }} />
                  ))}
                </div>

                {bins.map((count, i) => {
                  const h  = (count / axisMax) * 100
                  const on = hover === i
                  return (
                    <div
                      key={i}
                      className={`sd-col${on ? ' is-hover' : ''}`}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(h => (h === i ? null : h))}
                    >
                      <div className="sd-bar-area">
                        {on && (
                          <div className="sd-tip" style={{ bottom: `calc(${h}% + 28px)` }}>
                            <div className="sd-tip-label">{binLabel(i, step)}</div>
                            <div className="sd-tip-value"><i className="sd-tip-dot" />Số lượng: <b>{count}</b></div>
                          </div>
                        )}
                        {count > 0 && <span className="sd-count">{count}</span>}
                        <div
                          className="sd-bar"
                          style={{ height: `${h}%`, minHeight: count > 0 ? 3 : 0 }}
                        />
                      </div>
                      <div className="sd-xlabel">{binLabel(i, step)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="sd-legend"><i className="sd-legend-dot" /> Số lượng</div>
          </div>
        </div>

        {/* ── Bảng thống kê ── */}
        <div className="sd-card">
          <div className="sd-card-head">{IcList(15)} Thống kê</div>

          <div className="sd-card-body">
            <div className="sd-rows">
              {bins.map((count, i) => (
                <div
                  key={i}
                  className={`sd-row${hover === i ? ' is-hover' : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(h => (h === i ? null : h))}
                >
                  <span className="sd-row-label">{binLabel(i, step)}</span>
                  <span className="sd-row-track">
                    <span className="sd-row-fill" style={{ width: `${(count / peak) * 100}%` }} />
                  </span>
                  <span className="sd-row-count">{count}</span>
                </div>
              ))}
            </div>

            <div className="sd-foot">
              <div className="sd-foot-item">
                <div className="sd-foot-value">{avg}</div>
                <div className="sd-foot-label">Điểm trung bình</div>
              </div>
              <div className="sd-foot-item">
                <div className="sd-foot-value">{binLabel(modeIdx, step)}</div>
                <div className="sd-foot-label">Mốc điểm có nhiều học sinh đạt được nhất</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

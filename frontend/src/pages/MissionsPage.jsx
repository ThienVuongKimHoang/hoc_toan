import React, { useEffect, useState } from 'react'
import { getMyMissions } from '../store/missionStore.js'

function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcCoin = (s) => <Ic size={s}><circle cx="12" cy="12" r="9"/><path d="M9.5 15.5c.5 1 1.5 1.5 2.5 1.5 1.7 0 3-1 3-2.3 0-3-5.5-1.5-5.5-4.5 0-1.3 1.3-2.2 3-2.2 1 0 2 .4 2.5 1.3"/><line x1="12" y1="6.5" x2="12" y2="17.5"/></Ic>
const IcFire  = (s) => <Ic size={s}><path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-3 2 1 3 4 3 6a7 7 0 0 1-14 0c0-4 3-6 4-9 .5-1.5 1.5-2 2-1z"/></Ic>
const IcTrend = (s) => <Ic size={s}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Ic>
const IcTarget = (s) => <Ic size={s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></Ic>
const IcWarn  = (s) => <Ic size={s}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ic>

const BREAKDOWN_LABELS = [
  ['completionXu', 'Hoàn thành'],
  ['bracketXu', 'Theo điểm'],
  ['milestoneXu', 'Vượt mốc'],
  ['maintainXu', 'Duy trì'],
  ['effortXu', 'Chuỗi nỗ lực'],
]

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
}

function ClassMissionCard({ cls, onOpenClass }) {
  return (
    <div className="mission-card">
      <div className="mission-card-head">
        <h3>{cls.className}</h3>
        <button className="mission-open-btn" onClick={() => onOpenClass?.(cls.classId)}>Mở lớp →</button>
      </div>

      <div className="mission-streaks">
        <div className="mission-streak-chip">
          {IcFire(15)}
          <span>Duy trì ≥7đ: <b>{cls.highScoreStreak}</b> tuần</span>
        </div>
        <div className="mission-streak-chip">
          {IcTrend(15)}
          <span>Chuỗi nỗ lực: <b>{cls.effortStreak}</b> tuần</span>
        </div>
      </div>

      {cls.streakBrokenSinceLastAward && (
        <div className="mission-warn">{IcWarn(14)} Có bài đã quá hạn chưa nộp — chuỗi sẽ bị đứt ở lần thưởng tới.</div>
      )}

      {cls.nextMilestone && (
        <div className="mission-next-milestone">
          {IcTarget(14)} Còn <b>{cls.nextMilestone.pointsAway}</b> điểm để chạm mốc <b>{cls.nextMilestone.tier}</b> (+{cls.nextMilestone.bonus} Xu)
        </div>
      )}

      {cls.pendingEligible.length > 0 && (
        <div className="mission-pending">
          <div className="mission-sub-title">Có thể kiếm Xu</div>
          {cls.pendingEligible.map(p => (
            <button key={p.assignmentId} className="mission-pending-item" onClick={() => onOpenClass?.(cls.classId)}>
              <span>{p.title || '(Chưa đặt tên)'}</span>
              <span className="mission-pending-due">{formatDate(p.dueDate)}</span>
            </button>
          ))}
        </div>
      )}

      {cls.recentAwards.length > 0 && (
        <div className="mission-history">
          <div className="mission-sub-title">Lịch sử nhận Xu</div>
          {cls.recentAwards.map(a => (
            <div key={a.assignmentId} className="mission-history-item">
              <div className="mission-history-top">
                <span className="mission-history-title">{a.title || '(Chưa đặt tên)'}</span>
                <span className="mission-history-total">{IcCoin(13)} +{a.totalXu}</span>
              </div>
              <div className="mission-history-meta">
                {formatDate(a.awardedAt)} · {a.normalizedScore?.toFixed(1)} đ
              </div>
              <div className="mission-history-breakdown">
                {BREAKDOWN_LABELS.filter(([key]) => a.breakdown[key] > 0).map(([key, label]) => (
                  <span key={key} className="mission-chip">{label} +{a.breakdown[key]}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MissionsPage({ user, onGoHome, onOpenClass }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getMyMissions(user.id).then(res => { if (alive) { setData(res); setLoading(false) } })
    return () => { alive = false }
  }, [user.id])

  return (
    <div className="study-page">
      <div className="study-header">
        <div className="study-header-inner">
          <div>
            <h1 className="study-title">Nhiệm vụ</h1>
            <p className="study-sub">Hoàn thành bài tập, giữ điểm cao và học đều để nhận Xu</p>
          </div>
          <button className="study-back-btn" onClick={onGoHome}>← Trang chủ</button>
        </div>
      </div>

      <div className="study-body mission-body">
        <div className="mission-balance">
          {IcCoin(28)}
          <div>
            <div className="mission-balance-num">{loading ? '…' : (data?.coins ?? 0)}</div>
            <div className="mission-balance-label">Xu hiện có</div>
          </div>
        </div>

        {loading && <div className="mission-empty">Đang tải nhiệm vụ…</div>}

        {!loading && (!data || data.classes.length === 0) && (
          <div className="mission-empty">
            Chưa có nhiệm vụ nào. Xu sẽ xuất hiện khi bạn hoàn thành và được chấm bài tập/đề thi trong lớp.
          </div>
        )}

        {!loading && data?.classes.map(cls => (
          <ClassMissionCard key={cls.classId} cls={cls} onOpenClass={onOpenClass} />
        ))}
      </div>
    </div>
  )
}

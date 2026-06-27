import React, { useState } from 'react'
import Geo3DViewer from '../components/Geo3DViewer.jsx'

const TABS = [
  { id: 'geo3d', icon: '📐', label: 'Hình học 3D' },
]

export default function StudyPage({ user, onGoHome }) {
  const [tab, setTab] = useState('geo3d')

  return (
    <div className="study-page">
      <div className="study-header">
        <div className="study-header-inner">
          <div>
            <h1 className="study-title">Học tập</h1>
            <p className="study-sub">Công cụ học tập tương tác — hình học, đại số, giải tích</p>
          </div>
          <button className="study-back-btn" onClick={onGoHome}>← Trang chủ</button>
        </div>

        <div className="study-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`study-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="study-body">
        {tab === 'geo3d' && <Geo3DViewer />}
      </div>
    </div>
  )
}

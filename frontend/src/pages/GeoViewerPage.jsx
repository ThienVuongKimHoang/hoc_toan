import React from 'react'
import Geo3DViewer from '../components/Geo3DViewer.jsx'

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const CubeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

export default function GeoViewerPage({ onBack }) {
  return (
    <div className="tool-page">
      <div className="tool-page-topbar">
        <button className="tool-page-back" onClick={onBack}>
          <ArrowLeftIcon />
          Quay lại
        </button>
        <span className="tool-page-title">
          <CubeIcon />
          Vẽ hình không gian
        </span>
      </div>
      <div className="tool-page-content">
        <Geo3DViewer />
      </div>
    </div>
  )
}

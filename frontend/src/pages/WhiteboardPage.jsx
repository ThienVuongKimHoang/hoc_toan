import React, { useCallback, useEffect, useState } from 'react'
import InfiniteWhiteboard from '../components/InfiniteWhiteboard.jsx'
import { getClassById } from '../store/classStore.js'

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const PenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
)

export default function WhiteboardPage({ onBack, classId = null, subject = null }) {
  const [cls, setCls] = useState(null)

  const refreshClass = useCallback(() => {
    if (!classId) return
    getClassById(classId).then(setCls)
  }, [classId])

  useEffect(() => {
    setCls(null)
    refreshClass()
  }, [refreshClass])

  const primarySubject = cls?.subject || cls?.subjects?.[0] || null
  const subjDocs = cls
    ? (cls.documents || []).filter(d => (d.subject || primarySubject) === subject)
    : []
  const folderNames = [...new Set(subjDocs.map(d => d.folder).filter(Boolean))]

  return (
    <div className="tool-page">
      <div className="tool-page-topbar">
        <button className="tool-page-back" onClick={onBack}>
          <ArrowLeftIcon />
          Quay lại
        </button>
        <span className="tool-page-title">
          <PenIcon />
          Bảng trắng{cls ? ` — ${cls.name}` : ''}
        </span>
      </div>
      <div className="tool-page-content">
        <InfiniteWhiteboard classId={classId} subject={subject} existingFolders={folderNames} folderDocs={subjDocs} onSaved={refreshClass} />
      </div>
    </div>
  )
}

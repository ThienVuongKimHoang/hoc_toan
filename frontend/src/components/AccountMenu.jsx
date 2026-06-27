import React, { useEffect, useRef, useState } from 'react'
import RoleBadge from './RoleBadge.jsx'
import { ROLE_META, ROLES, hasTeacherAccess } from '../auth/mockUsers.js'
import { AvatarDisplay } from '../pages/ProfilePage.jsx'

const IC = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
    </svg>
  ),
  createExam: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2 2 0 0 1 3 3L13 14l-4 1 1-4Z"/>
    </svg>
  ),
  myExams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

function MenuItem({ icon, label, danger, highlight, onClick }) {
  return (
    <button className={`acct-menu-item ${danger ? 'danger' : ''} ${highlight ? 'highlight' : ''}`} onClick={onClick}>
      <span className="ami-icon">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function buildMenu(role, actions) {
  const tier = ROLE_META[role]?.tier ?? 1
  const items = []

  items.push({ icon: IC.profile,    label: 'Hồ sơ cá nhân', action: actions.onGoProfile })

  if (role === ROLES.STUDENT) {
    items.push({ icon: IC.stats,   label: 'Học tập',          action: actions.onGoStudy })
    items.push({ icon: IC.users,   label: 'Lớp của tôi',      action: actions.onGoMyClasses })
    items.push({ icon: IC.history, label: 'Lịch sử làm bài',  action: null })
  }

  if (hasTeacherAccess(role)) {
    items.push({ icon: IC.createExam, label: 'Tạo đề thi',       action: actions.onCreateExam })
    items.push({ icon: IC.myExams,    label: 'Đề thi của tôi',    action: actions.onMyExams })
    items.push({ icon: IC.users,      label: 'Quản lý lớp học',   action: actions.onGoClasses })
    items.push({ icon: <span style={{fontSize:'15px'}}>🛠</span>, label: 'Công cụ', action: actions.onGoTools, highlight: true })
  }

  if (tier >= 3) {
    items.push({ icon: IC.system, label: 'Bảng điều khiển Admin', action: actions.onGoAdmin, highlight: true })
  }

  items.push({ icon: IC.settings, label: 'Cài đặt', action: null })
  return items
}

export default function AccountMenu({ user, onLogout, onCreateExam, onMyExams, onGoProfile, onGoAdmin, onGoStudy, onGoClasses, onGoMyClasses, onGoTools }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef(null)
  const meta = ROLE_META[user.role]

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const close = () => setOpen(false)
  const menuItems = buildMenu(user.role, { onCreateExam, onMyExams, onGoProfile, onGoAdmin, onGoStudy, onGoClasses, onGoMyClasses, onGoTools })

  return (
    <div className="acct-wrap" ref={ref}>
      <button
        className={`acct-trigger acct-trigger--${user.role}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Tài khoản"
      >
        <AvatarDisplay user={user} size={34} className={`acct-avatar-wrap acct-avatar-wrap--${user.role}`} />
        <span className="acct-trigger-name">{user.name}</span>
      </button>

      {open && (
        <div className="acct-dropdown">
          {/* User info */}
          <div className="acct-header">
            <AvatarDisplay user={user} size={44} className={`acct-av-lg-wrap acct-av-lg-wrap--${user.role}`} />
            <div className="acct-info">
              <div className="acct-name">{user.name}</div>
              <div className="acct-email">{user.email}</div>
              <RoleBadge role={user.role} size="sm" />
            </div>
          </div>

          <div className="acct-divider" />

          <div className="acct-menu">
            {menuItems.map((m, i) => (
              <MenuItem
                key={i}
                icon={m.icon}
                label={m.label}
                highlight={m.highlight}
                onClick={() => { close(); m.action?.() }}
              />
            ))}
          </div>

          <div className="acct-divider" />

          <MenuItem icon={IC.logout} label="Đăng xuất" danger onClick={() => { close(); onLogout() }} />
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import RoleBadge from './RoleBadge.jsx'
import { ROLE_META, ROLES, hasTeacherAccess, hasVocabAccess } from '../auth/mockUsers.js'
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
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
  ielts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20"/>
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

function buildMenu(user, actions) {
  const role = user.role
  const tier = ROLE_META[role]?.tier ?? 1
  const items = []

  items.push({ icon: IC.profile,    label: 'Hồ sơ cá nhân', action: actions.onGoProfile })

  // Tính năng "Ôn luyện IELTS" (từ vựng) đang thử nghiệm riêng tư cho 1 tài khoản duy nhất.
  if (hasVocabAccess(user)) {
    items.push({ icon: IC.ielts, label: 'Ôn luyện IELTS', action: actions.onGoVocab })
  }

  if (role === ROLES.STUDENT) {
    items.push({ icon: IC.users,   label: 'Lớp của tôi',      action: actions.onGoMyClasses })
    items.push({ icon: IC.history, label: 'Lịch sử làm bài',  action: actions.onGoHistory })
  }

  if (hasTeacherAccess(role)) {
    items.push({ icon: IC.users,      label: 'Quản lý lớp học',   action: actions.onGoClasses })
  }

  // Giáo viên có thể đồng thời là học sinh của một lớp khác (vd. học lớp IELTS của
  // đồng nghiệp) — cần lối vào riêng vì "Quản lý lớp học" chỉ hiện lớp họ làm chủ.
  if (role === ROLES.TEACHER) {
    items.push({ icon: IC.users, label: 'Lớp tôi tham gia', action: actions.onGoMyClasses })
  }

  if (tier >= 3) {
    items.push({ icon: IC.system, label: 'Bảng điều khiển Admin', action: actions.onGoAdmin, highlight: true })
  }

  if (hasTeacherAccess(role)) {
    items.push({ icon: IC.settings, label: 'Cài đặt', action: actions.onGoSettings })
  }
  return items
}

export default function AccountMenu({ user, onLogout, onGoProfile, onGoAdmin, onGoClasses, onGoMyClasses, onGoTools, onGoHistory, onGoSettings, onGoVocab }) {
  const [open, setOpen] = useState(false)
  const ref  = useRef(null)
  const meta = ROLE_META[user.role]

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const close = () => setOpen(false)
  const menuItems = buildMenu(user, { onGoProfile, onGoAdmin, onGoClasses, onGoMyClasses, onGoTools, onGoHistory, onGoSettings, onGoVocab })

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

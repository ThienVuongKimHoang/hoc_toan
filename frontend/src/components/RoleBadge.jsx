import React from 'react'
import { ROLE_META } from '../auth/mockUsers.js'

export default function RoleBadge({ role, size = 'md' }) {
  const meta = ROLE_META[role]
  if (!meta) return null

  const isGradient = typeof meta.bg === 'string' && meta.bg.startsWith('linear') || meta.bg.startsWith('gradient')

  return (
    <span
      className={`role-badge role-badge--${meta.effect} role-badge--${size}`}
      style={{
        '--rb-color':      meta.color,
        '--rb-text':       meta.textColor,
        background:        meta.bg,
      }}
      title={meta.label}
    >
      <span className="rb-icon">{meta.icon}</span>
      <span className="rb-label">{meta.label}</span>
      {meta.effect === 'shimmer' && <span className="rb-shimmer" aria-hidden />}
    </span>
  )
}

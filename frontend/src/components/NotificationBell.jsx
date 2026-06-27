import React, { useEffect, useRef, useState } from 'react'
import { getNotifications, markAllRead, markRead } from '../store/notificationStore.js'

export default function NotificationBell({ user }) {
  const [notifs,  setNotifs]  = useState([])
  const [open,    setOpen]    = useState(false)
  const ref = useRef(null)

  const load = async () => {
    if (!user) return
    const list = await getNotifications(String(user.id))
    setNotifs(list)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [user?.id])

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const unread = notifs.filter(n => !n.read).length

  const handleOpen = () => {
    setOpen(v => !v)
  }

  const handleMarkAll = async () => {
    await markAllRead(String(user.id))
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleClickNotif = async (n) => {
    if (!n.read) {
      await markRead(n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
  }

  const formatDt = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60)   return 'Vừa xong'
    if (diff < 3600) return `${Math.floor(diff/60)} phút trước`
    if (diff < 86400) return `${Math.floor(diff/3600)} giờ trước`
    return d.toLocaleDateString('vi-VN')
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-btn" onClick={handleOpen} aria-label="Thông báo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-drop-header">
            <span className="notif-drop-title">Thông báo</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>Đọc tất cả</button>
            )}
          </div>
          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">Không có thông báo nào.</div>
            ) : (
              notifs.map(n => (
                <div key={n.id}
                  className={`notif-item ${!n.read ? 'notif-item--unread' : ''}`}
                  onClick={() => handleClickNotif(n)}>
                  <div className="notif-icon">📝</div>
                  <div className="notif-content">
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-time">{formatDt(n.createdAt)}</div>
                  </div>
                  {!n.read && <div className="notif-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import AccountMenu from './AccountMenu.jsx'
import NotificationBell from './NotificationBell.jsx'

export default function Header({ user, onGoHome, onGoLogin, onGoLobby, onLogout, onCreateExam, onMyExams, onGoProfile, onGoAdmin, onGoStudy, onGoClasses, onGoMyClasses, onOpenClass, onGoTools }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-inner">
        <button className="logo" onClick={onGoHome}>
          <img className="logo-icon" src="/img/logo.png" alt="Trung tâm Ánh Sáng" />
          <span className="logo-text">Trung tâm <span className="logo-dot">Ánh Sáng</span></span>
        </button>

        <div className="header-right">
          {user ? (
            <>
              <NotificationBell user={user} onOpenClass={onOpenClass} />
              <AccountMenu
                user={user}
                onLogout={onLogout}
                onGoHome={onGoHome}
                onCreateExam={onCreateExam}
                onMyExams={onMyExams}
                onGoProfile={onGoProfile}
                onGoAdmin={onGoAdmin}
                onGoStudy={onGoStudy}
                onGoClasses={onGoClasses}
                onGoMyClasses={onGoMyClasses}
                onGoTools={onGoTools}
              />
            </>
          ) : (
            <button className="header-cta" onClick={onGoLogin}>
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

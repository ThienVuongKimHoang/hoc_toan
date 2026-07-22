import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ROLES, hasAdminAccess, hasTeacherAccess, authHeaders, getToken } from './auth/mockUsers.js'
import Header from './components/Header.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ExamTakePage from './pages/ExamTakePage.jsx'
import PracticeExamPage from './pages/PracticeExamPage.jsx'
import ExamLobbyPage from './pages/ExamLobbyPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import SuperAdminPage from './pages/SuperAdminPage.jsx'
import StudyPage from './pages/StudyPage.jsx'
import ClassManagementPage from './pages/ClassManagementPage.jsx'
import MyClassesPage from './pages/MyClassesPage.jsx'
import AssignmentPopup from './components/AssignmentPopup.jsx'
import UploadZone from './components/UploadZone.jsx'
import ProgressPanel from './components/ProgressPanel.jsx'
import QuestionCard from './components/QuestionCard.jsx'
import TeacherToolsModal from './components/TeacherToolsModal.jsx'
import ExerciseSolver from './components/ExerciseSolver.jsx'
import GeoViewerPage from './pages/GeoViewerPage.jsx'
import WhiteboardPage from './pages/WhiteboardPage.jsx'

const SECTIONS = ['PHẦN I', 'PHẦN II', 'PHẦN III']
const SECTION_LABELS = {
  'PHẦN I': { label: 'Phần I – Trắc nghiệm', color: '#2563eb' },
  'PHẦN II': { label: 'Phần II – Đúng / Sai', color: '#7c3aed' },
  'PHẦN III': { label: 'Phần III – Trả lời ngắn', color: '#059669' },
}
const ENGLISH_SECTION = 'TIẾNG ANH'
const READING_SECTION = 'READING'
const ENGLISH_LABELS = {
  'TIẾNG ANH': { label: 'Tiếng Anh – Trắc nghiệm', color: '#0f766e' },
  'READING':   { label: 'Reading – Bài đọc',       color: '#0e7490' },
}
const USER_KEY = 'hoctoan_user'

/* ── Hash-based routing ── */
function parseHash() {
  const hash = window.location.hash.slice(1)
  if (hash.startsWith('take/')) {
    // take/<examId>[/<classId>[/<assignmentId>]] — assignmentId phân biệt
    // 2 lần giao cùng một đề trong cùng một lớp
    const [examId, classId, assignmentId] = hash.slice(5).split('/')
    return { view: 'take-exam', examId, classId: classId || null, assignmentId: assignmentId || null }
  }
  if (hash.startsWith('join/')) return { view: 'my-classes', examId: null, classId: hash.slice(5) }
  if (hash.startsWith('class/')) return { view: 'my-classes', examId: null, classId: null, openClassId: hash.slice(6) }
  if (hash.startsWith('lobby/')) return { view: 'exam-lobby', examId: hash.slice(6) || null, classId: null }
  if (hash === 'lobby') return { view: 'exam-lobby', examId: null, classId: null }
  if (hash.startsWith('practice/')) return { view: 'practice-exam', examId: hash.slice(9), classId: null }
  if (hash === 'admin') return { view: 'super-admin', examId: null, classId: null, adminTab: null }
  if (hash.startsWith('admin/')) return { view: 'super-admin', examId: null, classId: null, adminTab: hash.slice(6) || null }
  if (hash === 'study') return { view: 'study', examId: null, classId: null }
  // classes | classes/<khối> | classes/<khối>/<classId> — điều hướng khối→lớp→chi tiết
  // do ClassManagementPage tự đọc từ hash; ở đây chỉ cần giữ view class-mgmt.
  if (hash === 'classes' || hash.startsWith('classes/')) return { view: 'class-mgmt', examId: null, classId: null }
  if (hash === 'my-classes') return { view: 'my-classes', examId: null, classId: null }
  if (hash === 'tools/solver') return { view: 'solver-page', examId: null, classId: null }
  if (hash === 'tools/geo3d') return { view: 'geo3d-page', examId: null, classId: null }
  if (hash === 'tools/whiteboard') return { view: 'whiteboard-page', examId: null, classId: null }
  if (hash.startsWith('tools/whiteboard/')) {
    // tools/whiteboard/<classId>/<subject>/<returnHash đã encode> — mở bảng trắng từ trong 1 lớp,
    // giữ subject để lưu tài liệu đúng môn và returnHash để nút "Quay lại" trở về đúng lớp đó.
    const [cid, subj, retEnc] = hash.slice('tools/whiteboard/'.length).split('/')
    return {
      view: 'whiteboard-page', examId: null, classId: cid || null,
      whiteboardSubject: subj || null,
      whiteboardReturnHash: retEnc ? decodeURIComponent(retEnc) : null,
    }
  }
  return { view: 'home', examId: null, classId: null }
}

function setHash(str) {
  window.history.pushState(null, '', str ? `#${str}` : window.location.pathname)
}

function AccessDenied({ message, onGoHome, onGoLogin, isLoggedIn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🔒</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Không có quyền truy cập</h2>
      <p style={{ fontSize: '0.92rem', color: '#64748b', maxWidth: 400, margin: 0 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" onClick={onGoHome}>← Về trang chủ</button>
        {!isLoggedIn && <button className="btn-secondary" onClick={onGoLogin}>Đăng nhập</button>}
      </div>
    </div>
  )
}

export default function App() {
  /* ── Auth ── */
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  // Lưu lại view cần redirect về sau khi đăng nhập thành công
  const [loginRedirect, setLoginRedirect] = useState(null) // { view, examId, classId }

  const handleUpdateUser = (updated) => {
    setUser(updated)
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
  }
  useEffect(() => {
    const handler = (e) => handleUpdateUser(e.detail)
    window.addEventListener('hoctoan_user_updated', handler)
    return () => window.removeEventListener('hoctoan_user_updated', handler)
  }, [])

  // Sync trạng thái đăng nhập giữa các tab
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== USER_KEY) return
      if (!e.newValue) {
        // Tab khác logout → logout tab này
        setUser(null)
        setView('home')
      } else {
        try {
          const fresh = JSON.parse(e.newValue)
          // Chỉ sync nếu là CÙNG user (cập nhật role/tên)
          // Không cho phép tab khác tự động switch sang user khác
          setUser(prev => {
            if (!prev) return fresh           // tab này chưa login → nhận user mới
            if (prev.id === fresh.id) return fresh  // cùng user → cập nhật role/tên
            return prev                       // khác user → giữ nguyên
          })
        } catch { }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])




  // ── Sync role khi F5 và polling 30s ──
  useEffect(() => {
    if (!user?.id) return

    const syncRole = async () => {
      try {
        const r = await fetch('/api/auth/me', { headers: authHeaders() })
        if (!r.ok) return
        const fresh = await r.json()
        if (fresh.error) return
        // Bỏ qua nếu server trả về user khác ID (không nên xảy ra nhưng phòng thủ)
        if (String(fresh.id) !== String(user.id)) return
        if (
          fresh.role !== user.role ||
          fresh.name !== user.name ||
          fresh.email !== user.email
        ) {
          const updated = { ...user, ...fresh }
          setUser(updated)
          localStorage.setItem(USER_KEY, JSON.stringify(updated))
        }
      } catch { }
    }

    syncRole() // chạy ngay khi mount/F5
    const interval = setInterval(syncRole, 30_000)
    return () => clearInterval(interval)
  }, [user?.id]) // re-run khi login/logout



  const handleLogin = (u) => {
    setUser(u)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    if (loginRedirect) {
      const { view: rv, examId: rid, classId: rcid, assignmentId: raid } = loginRedirect
      setLoginRedirect(null)
      if (rv === 'take-exam') {
        // Giữ nguyên ngữ cảnh lớp/bài tập — mất nó thì bài nộp không được tính vào lớp
        const parts = [rid, rcid, raid].filter(Boolean).join('/')
        setHash(`take/${parts}`)
        setExamId(rid)
        setClassId(rcid ?? null)
        setAssignmentId(raid ?? null)
        setView('take-exam')
      } else if (rv === 'my-classes' && rcid) {
        setHash(`join/${rcid}`)
        setClassId(rcid)
        setView('my-classes')
      } else {
        setHash('')
        setView(rv)
      }
    } else {
      setView('home')
    }
  }
  const handleLogout = () => {
    const token = getToken()
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {})
    setUser(null); localStorage.removeItem(USER_KEY); setView('home')
  }

  /* ── Routing ── */
  const [view, setView] = useState(() => parseHash().view)
  const [examId, setExamId] = useState(() => parseHash().examId)
  const [classId, setClassId] = useState(() => parseHash().classId ?? null)
  const [assignmentId, setAssignmentId] = useState(() => parseHash().assignmentId ?? null)
  const [openClassId, setOpenClassId] = useState(() => parseHash().openClassId ?? null)
  const [whiteboardSubject, setWhiteboardSubject] = useState(() => parseHash().whiteboardSubject ?? null)
  const [whiteboardReturnHash, setWhiteboardReturnHash] = useState(() => parseHash().whiteboardReturnHash ?? null)
  const [adminTab, setAdminTab] = useState(() => parseHash().adminTab ?? null)
  const [adminNavNonce, setAdminNavNonce] = useState(0)
  const [showTeacherTools, setShowTeacherTools] = useState(false)

  useEffect(() => {
    const onHash = () => {
      const { view: v, examId: id, classId: cid, assignmentId: aid, openClassId: ocid, whiteboardSubject: wbs, whiteboardReturnHash: wbr, adminTab: at } = parseHash()
      setView(v); setExamId(id); setClassId(cid ?? null); setAssignmentId(aid ?? null); setOpenClassId(ocid ?? null)
      setWhiteboardSubject(wbs ?? null); setWhiteboardReturnHash(wbr ?? null)
      setAdminTab(at ?? null); setAdminNavNonce(n => n + 1)
    }
    window.addEventListener('popstate', onHash)
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => {
      window.removeEventListener('popstate', onHash)
      window.removeEventListener('hashchange', onHash)
    }
  }, []) // eslint-disable-line

  // Khi truy cập #join/<code> mà chưa đăng nhập → lưu redirect và chuyển sang login
  const joinRedirectHandled = useRef(false)
  useEffect(() => {
    if (view === 'my-classes' && !user && classId && !joinRedirectHandled.current) {
      joinRedirectHandled.current = true
      setLoginRedirect({ view: 'my-classes', classId })
      setView('login')
    }
  }, [view, user, classId])

  const goHome = () => { setHash(''); setView('home') }
  const goProfile = () => user ? (setHash(''), setView('profile')) : goLogin()
  const goLogin = () => { setHash(''); setView('login') }
  const goExam = () => user ? (setHash(''), setView('exam')) : goLogin()
  const goAdmin = () => {
    if (!user) { goLogin(); return }
    if (!hasAdminAccess(user.role)) return
    setHash('admin'); setView('super-admin')
  }
  /* Mở trang Admin thẳng vào 1 tab cụ thể (vd: từ thông báo báo cáo → tab "Báo cáo").
     Tăng adminNavNonce để SuperAdminPage luôn nhảy tab dù bấm lại đúng tab cũ. */
  const goAdminTab = (tabKey) => {
    if (!user) { goLogin(); return }
    if (!hasAdminAccess(user.role)) return
    setHash(`admin/${tabKey}`); setAdminTab(tabKey); setAdminNavNonce(n => n + 1); setView('super-admin')
  }
  const goStudy = () => user ? (setHash('study'), setView('study')) : goLogin()
  const goClasses = () => {
    if (!user) { goLogin(); return }
    if (!hasTeacherAccess(user.role)) return
    setHash('classes'); setView('class-mgmt')
  }
  const goMyClasses = () => user ? (setClassId(null), setOpenClassId(null), setHash('my-classes'), setView('my-classes')) : goLogin()
  const openClass = (cid) => user ? (setClassId(null), setOpenClassId(cid), setHash(`class/${cid}`), setView('my-classes')) : goLogin()
  const goTools = () => user ? setShowTeacherTools(true) : goLogin()

  // Sảnh chờ thi — không yêu cầu đăng nhập (auth xử lý trong ExamTakePage)
  const goExamLobby = () => {
    setHash('lobby'); setExamId(null); setView('exam-lobby')
  }

  // Vào thi trực tiếp theo id (từ homepage featured exam)
  const goTakeExamById = (id) => {
    setHash(`take/${id}`); setExamId(id); setView('take-exam')
  }

  // Redirect về đề thi sau khi login (giữ cả lớp/bài tập nếu vào từ link của lớp)
  const goLoginFromExam = (id, cid = null, aid = null) => {
    setLoginRedirect({ view: 'take-exam', examId: id, classId: cid, assignmentId: aid })
    setHash('')
    setView('login')
  }

  const goPractice = (id) => {
    setHash(`practice/${id}`)
    setExamId(id)
    setView('practice-exam')
  }

  const goLogin_redirect = () => {
    // After login, go back to exam
    const savedHash = window.location.hash
    goLogin()
    // Restore hash after login handled in handleLogin
  }

  /* ── Exam extract state (student direct upload) ── */
  const [phase, setPhase] = useState('idle')
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [activeSection, setActiveSection] = useState('PHẦN I')

  const handleUpload = useCallback(async (file) => {
    setPhase('extracting'); setEvents([]); setResult(null)
    const form = new FormData()
    form.append('file', file)
    let taskId
    try {
      const res = await fetch('/api/extract', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json(); taskId = data.task_id
    } catch (e) {
      setPhase('error')
      setEvents([{ type: 'error', message: `Upload thất bại: ${e.message}` }]); return
    }
    const sse = new EventSource(`/api/progress/${taskId}`)
    sse.onmessage = (e) => {
      const evt = JSON.parse(e.data)
      setEvents(prev => [...prev, evt])
      if (evt.type === 'done') {
        sse.close()
        fetch(`/api/result/${taskId}`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
          .then(data => {
            setResult(data)
            setPhase('done')
            setActiveSection(data.subject === 'english' ? ENGLISH_SECTION : 'PHẦN I')
          })
          .catch(() => setPhase('error'))
      }
      if (evt.type === 'error') { sse.close(); setPhase('error') }
    }
    sse.onerror = () => {
      sse.close(); setPhase('error')
      setEvents(prev => [...prev, { type: 'error', message: 'Mất kết nối.' }])
    }
  }, [])

  const resetExam = () => { setPhase('idle'); setEvents([]); setResult(null) }

  const isEnglish = result?.subject === 'english'
  const effectiveSecs = isEnglish
    ? [ENGLISH_SECTION, READING_SECTION].filter(s => result.sections?.[s])
    : SECTIONS
  const effectiveLbls = isEnglish ? ENGLISH_LABELS : SECTION_LABELS
  const questions = result?.sections?.[activeSection]?.questions ?? []

  /* ── Shared header ── */
  const header = (
    <Header
      user={user}
      onGoHome={goHome}
      onGoLogin={goLogin}
      onGoLobby={goExamLobby}
      onLogout={handleLogout}
      onGoProfile={goProfile}
      onGoAdmin={goAdmin}
      onGoStudy={goStudy}
      onGoClasses={goClasses}
      onGoMyClasses={goMyClasses}
      onOpenClass={openClass}
      onOpenReports={() => goAdminTab('reports')}
      onGoTools={goTools}
    />
  )

  const goSolverPage = () => { setHash('tools/solver'); setView('solver-page') }
  const goGeo3dPage = () => { setHash('tools/geo3d'); setView('geo3d-page') }
  const goWhiteboardPage = () => {
    setHash('tools/whiteboard'); setView('whiteboard-page')
    setClassId(null); setWhiteboardSubject(null); setWhiteboardReturnHash(null)
  }

  /* ── Teacher tools modal (hiển thị mọi nơi) ── */
  const teacherToolOverlays = showTeacherTools && (
    <TeacherToolsModal
      onSelectTool={id => {
        setShowTeacherTools(false)
        if (id === 'solver') goSolverPage()
        if (id === 'geo3d') goGeo3dPage()
        if (id === 'whiteboard') goWhiteboardPage()
      }}
      onClose={() => setShowTeacherTools(false)}
    />
  )


  /* ── Views ── */
  if (view === 'super-admin') {
    if (!user) return (
      <>{header}<AccessDenied message="Bạn cần đăng nhập để truy cập trang này." onGoHome={goHome} onGoLogin={goLogin} isLoggedIn={false} /></>
    )
    if (!hasAdminAccess(user.role)) return (
      <>{header}<AccessDenied message="Trang Admin chỉ dành cho Admin và Super Admin." onGoHome={goHome} onGoLogin={goLogin} isLoggedIn={true} /></>
    )
    return (
      <>
        {header}
        <SuperAdminPage user={user} onGoHome={goHome} initialTab={adminTab} navNonce={adminNavNonce} />
        {teacherToolOverlays}
      </>
    )
  }

  if (view === 'study') return (
    <>
      {header}
      <StudyPage user={user} onGoHome={goHome} />
      {teacherToolOverlays}
    </>
  )

  if (view === 'class-mgmt') {
    if (!user) return (
      <>{header}<AccessDenied message="Bạn cần đăng nhập để truy cập trang này." onGoHome={goHome} onGoLogin={goLogin} isLoggedIn={false} /></>
    )
    if (!hasTeacherAccess(user.role)) return (
      <>{header}<AccessDenied message="Quản lý lớp học chỉ dành cho Giáo viên, Admin và Super Admin." onGoHome={goHome} onGoLogin={goLogin} isLoggedIn={true} /></>
    )
    return (
      <>
        {header}
        <ClassManagementPage user={user} onGoHome={goHome} />
        {teacherToolOverlays}
      </>
    )
  }

  if (view === 'my-classes' && user) {
    if (user.role === ROLES.GUEST) return (
      <>
        {header}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Bạn cần tài khoản thành viên</h2>
          <p style={{ fontSize: '0.92rem', color: '#64748b', maxWidth: 380, margin: 0 }}>
            Vai trò <strong>Khách</strong> không được phép tham gia lớp học. Liên hệ Super Admin để được nâng cấp quyền.
          </p>
          <button className="btn-primary" onClick={goHome}>← Về trang chủ</button>
        </div>
        {teacherToolOverlays}
      </>
    )
    return (
      <>
        {header}
        <MyClassesPage user={user} initialJoinCode={classId ?? ''} initialClassId={openClassId} />
        {teacherToolOverlays}
      </>
    )
  }

  if (view === 'profile') {
    if (!user) return (
      <>{header}<AccessDenied message="Bạn cần đăng nhập để xem hồ sơ." onGoHome={goHome} onGoLogin={goLogin} isLoggedIn={false} /></>
    )
    return (
      <>
        {header}
        <ProfilePage
          user={user}
          onUpdateUser={handleUpdateUser}
          onGoHome={goHome}
        />
        {teacherToolOverlays}
      </>
    )
  }

  if (view === 'login') return <LoginPage onLogin={handleLogin} onGoHome={goHome} />

  if (view === 'exam-lobby') return (
    <>
      {header}
      <ExamLobbyPage
        initialCode={examId ?? ''}
        onGoExam={(id) => { setHash(`take/${id}`); setExamId(id); setView('take-exam') }}
        onGoPractice={(id) => { setHash(`practice/${id}`); setExamId(id); setView('practice-exam') }}
        onGoHome={goHome}
      />
      {teacherToolOverlays}
    </>
  )

  if (view === 'take-exam') return (
    <ExamTakePage examId={examId} classId={classId} assignmentId={assignmentId} user={user} onGoHome={goHome} onGoLogin={() => goLoginFromExam(examId, classId, assignmentId)} />
  )

  if (view === 'practice-exam') return (
    <PracticeExamPage examId={examId} onGoHome={goHome} />
  )

  if (view === 'solver-page') {
    if (!user || !hasTeacherAccess(user.role)) return (
      <>{header}<AccessDenied message="Công cụ giải bài chỉ dành cho Giáo viên, Admin và Super Admin." onGoHome={goHome} onGoLogin={goLogin} isLoggedIn={!!user} /></>
    )
    return (
      <>
        {header}
        <ExerciseSolver onBack={() => { setHash(''); setView('home') }} />
      </>
    )
  }

  if (view === 'geo3d-page') return (
    <>
      {header}
      <GeoViewerPage onBack={() => { setHash(''); setView('home') }} />
    </>
  )

  if (view === 'whiteboard-page') return (
    <>
      {header}
      <WhiteboardPage
        classId={classId}
        subject={whiteboardSubject}
        onBack={() => {
          if (whiteboardReturnHash) { setHash(whiteboardReturnHash); setView('class-mgmt') }
          else { setHash(''); setView('home') }
        }}
      />
    </>
  )

  if (view === 'home') return (
    <>
      {header}
      <HomePage onGoLobby={goExamLobby} onGoExam={goTakeExamById} user={user} />
      {user?.role === 'hoc_sinh' && <AssignmentPopup user={user} onGoMyClasses={goMyClasses} />}
      {teacherToolOverlays}
    </>
  )

  /* ── view === 'exam' (direct upload mode) ── */
  return (
    <>
      {header}
      <div className="app">
        <div className="exam-topbar">
          <button className="back-btn" onClick={goHome}>← Trang chủ</button>
          <h1 className="exam-title">
            {isEnglish ? '📝 Luyện đề thi Tiếng Anh THPT' : '📐 Luyện đề thi Toán THPT'}
          </h1>
          <p className="exam-subtitle">Upload file PDF — AI tự động trích xuất câu hỏi</p>
        </div>

        <main className="app-main">
          {(phase === 'idle' || phase === 'error') && (
            <UploadZone onUpload={handleUpload} disabled={phase === 'extracting'} />
          )}
          {(phase === 'extracting' || phase === 'error') && (
            <ProgressPanel events={events} status={phase} />
          )}
          {phase === 'done' && result && (
            <section className="result-section">
              <div className="result-meta">
                <div className="result-title">
                  <h2>📋 {result.source}</h2>
                  <span className="total-badge">{result.total_questions} câu hỏi</span>
                  {result.has_answer_key && (
                    <span className="answer-key-badge">✓ Có đáp án</span>
                  )}
                  {result.has_answer_key === false && (
                    <span className="no-answer-badge">— Không có đáp án</span>
                  )}
                </div>
                <button className="reset-btn" onClick={resetExam}>↩ Upload đề khác</button>
              </div>
              {effectiveSecs.length > 1 && (
                <div className="section-tabs">
                  {effectiveSecs.map(sec => {
                    const count = result.sections?.[sec]?.questions?.length ?? 0
                    const meta = effectiveLbls[sec]
                    if (!meta) return null
                    return (
                      <button key={sec}
                        className={`tab-btn ${activeSection === sec ? 'active' : ''}`}
                        style={{ '--tab-color': meta.color }}
                        onClick={() => setActiveSection(sec)}
                      >
                        {meta.label}
                        <span className="tab-count">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {result.sections?.[activeSection] && (
                <div className="section-desc">
                  <span style={{ color: (effectiveLbls[activeSection] || {}).color }}>
                    {(effectiveLbls[activeSection] || {}).label}
                  </span>
                  {' — '}{result.sections[activeSection].questions.length} câu ×{' '}
                  {result.sections[activeSection].points_per_q}đ/câu
                  {isEnglish && result.has_answer_key && (
                    <span className="answers-filled-info">
                      {' '}({result.answers_filled ?? 0}/{result.total_questions} đáp án)
                    </span>
                  )}
                </div>
              )}
              <div className="question-list">
                {questions.length === 0
                  ? <p className="empty-msg">Không tìm thấy câu hỏi nào.</p>
                  : questions.map((q, i) => (
                    <QuestionCard key={`${q.section}-${q.question_number}-${i}`} q={q} index={i} />
                  ))
                }
              </div>
            </section>
          )}
        </main>
      </div>
      {teacherToolOverlays}
    </>
  )
}

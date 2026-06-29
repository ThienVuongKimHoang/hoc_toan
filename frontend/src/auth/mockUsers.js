export const ROLES = {
  GUEST:      'khach',
  STUDENT:    'hoc_sinh',
  TEACHER:    'giao_vien',
  ADMIN:      'admin',
  SUPERADMIN: 'super_admin',
}

export const ROLE_META = {
  khach: {
    label:       'Khách',
    icon:        '👤',
    color:       '#6b7280',
    bg:          '#f3f4f6',
    textColor:   '#374151',
    tier:        0,
    effect:      'none',
  },
  hoc_sinh: {
    label:       'Học sinh',
    icon:        '🎒',
    color:       '#2563eb',
    bg:          '#dbeafe',
    textColor:   '#1d4ed8',
    tier:        1,
    effect:      'none',
  },
  giao_vien: {
    label:       'Giáo viên',
    icon:        '📚',
    color:       '#059669',
    bg:          '#d1fae5',
    textColor:   '#047857',
    tier:        2,
    effect:      'pulse',
  },
  admin: {
    label:       'Admin',
    icon:        '🛡️',
    color:       '#7c3aed',
    bg:          'linear-gradient(135deg,#ede9fe,#ddd6fe)',
    textColor:   '#5b21b6',
    tier:        3,
    effect:      'glow',
  },
  super_admin: {
    label:       'Super Admin',
    icon:        '👑',
    color:       '#f59e0b',
    bg:          'linear-gradient(90deg,#fef3c7,#fde68a,#fbbf24,#fde68a,#fef3c7)',
    textColor:   '#92400e',
    tier:        4,
    effect:      'shimmer',
  },
}

// Tài khoản demo — không kết nối backend
export const MOCK_USERS = [
  { id: 1, email: 'hocsinh@test.com',    password: '123456', name: 'Nguyễn Văn An',   role: ROLES.STUDENT,    avatar: 'A' },
  { id: 2, email: 'giaovien@test.com',   password: '123456', name: 'Trần Thị Lan',    role: ROLES.TEACHER,    avatar: 'L' },
  { id: 3, email: 'admin@test.com',      password: '123456', name: 'Lê Minh Khoa',    role: ROLES.ADMIN,      avatar: 'K' },
  { id: 4, email: 'superadmin@test.com', password: '123456', name: 'Phạm Hoàng Anh',  role: ROLES.SUPERADMIN, avatar: 'P' },
]

const REG_KEY = 'hoctoan_registered_users'

function getRegistered() {
  try { return JSON.parse(localStorage.getItem(REG_KEY)) || [] } catch { return [] }
}

export function hasTeacherAccess(role) {
  return (ROLE_META[role]?.tier ?? 0) >= 2
}

export function hasAdminAccess(role) {
  return role === ROLES.ADMIN || role === ROLES.SUPERADMIN
}

export function hasMemberAccess(role) {
  return (ROLE_META[role]?.tier ?? 0) >= 1
}

export async function login(email, password) {
  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim(), password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Đăng nhập thất bại.' }
    return { user: data }
  } catch {
    // Fallback khi server offline: thử mock + localStorage
    const all  = [...MOCK_USERS, ...getRegistered()]
    const user = all.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
    if (!user) return { error: 'Email hoặc mật khẩu không đúng.' }
    const { password: _, ...safe } = user
    return { user: safe }
  }
}

export async function register({ name, email, password }) {
  try {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Đăng ký thất bại.' }
    return { user: data }
  } catch {
    // Fallback: lưu localStorage khi không có server
    const all = [...MOCK_USERS, ...getRegistered()]
    if (all.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'Email này đã được sử dụng.' }
    }
    const list    = getRegistered()
    const newUser = {
      id:           Date.now(),
      email:        email.trim(),
      password,
      name:         name.trim(),
      role:         ROLES.GUEST,
      avatar:       name.trim()[0].toUpperCase(),
      isRegistered: true,
    }
    list.push(newUser)
    localStorage.setItem(REG_KEY, JSON.stringify(list))
    const { password: _, ...safe } = newUser
    return { user: safe }
  }
}

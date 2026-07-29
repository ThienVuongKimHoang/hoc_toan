// Server luôn kiểm tra user còn tồn tại mỗi lần xác thực session (xem require_auth
// trong api.py — token của user đã bị xóa cũng bị hủy ngay do sessions có
// ON DELETE CASCADE theo users). Patch fetch() một lần ở đây để MỌI request có
// Authorization header, hễ bị server từ chối vì phiên hết hạn/không hợp lệ, đều
// tự đăng xuất ngay — thay vì chỉ chờ vòng polling /api/auth/me mỗi 30s, tránh
// việc một tài khoản đã bị xóa vẫn thao tác được và gây xung đột dữ liệu.
const SESSION_EXPIRED_MSG = 'Chưa đăng nhập hoặc phiên đã hết hạn.'

let installed = false

function getHeader(headers, name) {
  if (!headers) return null
  if (headers instanceof Headers) return headers.get(name)
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : null
}

export function installSessionGuard() {
  if (installed) return
  installed = true
  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const res = await nativeFetch(...args)
    if (res.status === 401 && getHeader(args[1]?.headers, 'Authorization')) {
      res.clone().json().then((data) => {
        if (data?.error === SESSION_EXPIRED_MSG) {
          window.dispatchEvent(new CustomEvent('hoctoan_session_expired'))
        }
      }).catch(() => {})
    }
    return res
  }
}

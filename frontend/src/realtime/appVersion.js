// Phát hiện đã có bản build mới trên server rồi nạp lại tab đang mở.
//
// Vì sao cần: index.html giờ đã "no-cache" nên LẦN MỞ TAB SAU luôn lấy bản mới,
// nhưng một tab đang mở sẵn thì không bao giờ tự biết. Trước đây user phải tự F5.
//
// Cách làm: vite.config.js nhúng __APP_VERSION__ vào bundle và ghi cùng giá trị
// đó ra dist/version.json. Lệch nhau ⇒ server đã deploy bản mới.
import { RT_EVENT } from './eventStream.js'
import { isReloadBlocked, RELOAD_UNBLOCKED } from './reloadGuard.js'

export const UPDATE_AVAILABLE = 'hoctoan_update_available'

/* eslint-disable no-undef */
const CURRENT = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null
/* eslint-enable no-undef */

const MIN_INTERVAL = 30_000     // chống kiểm tra dồn dập khi user bật/tắt tab liên tục

let updateReady = false
let lastCheck = 0
let started = false

export function isUpdateReady() {
  return updateReady
}

/** Nạp lại nếu được phép; không thì để dành, RELOAD_UNBLOCKED sẽ thử lại sau. */
function reloadIfSafe() {
  if (!updateReady) return
  if (document.visibilityState !== 'visible') return
  if (isReloadBlocked()) return
  window.location.reload()
}

async function check() {
  if (updateReady || !CURRENT) return
  const now = Date.now()
  if (now - lastCheck < MIN_INTERVAL) return
  lastCheck = now

  let latest
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    latest = (await res.json())?.version
  } catch {
    // Lúc `vite dev` không có version.json (chỉ sinh khi build) → bỏ qua im lặng.
    return
  }
  if (typeof latest !== 'string' || latest === CURRENT) return

  updateReady = true
  window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE))
  reloadIfSafe()
}

/** Bắt đầu theo dõi phiên bản. Gọi nhiều lần là vô hại. */
export function startVersionWatch() {
  if (started || !CURRENT) return
  started = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    // Có bản mới đang chờ + vừa quay lại tab ⇒ đây là thời điểm reload ít phiền nhất.
    if (updateReady) reloadIfSafe()
    else check()
  })

  // Mỗi lần SSE nối lại thường là dấu hiệu server vừa khởi động lại (deploy).
  window.addEventListener(RT_EVENT, (e) => {
    if (e.detail?.type === 'resync') check()
  })

  // Vừa nộp bài / trích xuất xong → khoá được gỡ, nạp bản mới luôn.
  window.addEventListener(RELOAD_UNBLOCKED, reloadIfSafe)

  check()
}

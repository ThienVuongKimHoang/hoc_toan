// Kênh realtime phía client: một kết nối SSE duy nhất cho cả tab, nhận "gợi ý
// invalidate" từ server rồi phát lại thành CustomEvent trên window. Các trang
// nghe event đó và gọi chính hàm reload() sẵn có của mình — server không đẩy dữ
// liệu, chỉ đẩy tin "có gì đó vừa đổi", nên không phải đồng bộ shape dữ liệu ở hai nơi.
import { authHeaders, getToken } from '../auth/mockUsers.js'

export const RT_EVENT = 'hoctoan_rt'

const HEARTBEAT_TIMEOUT = 60_000   // 60s không một tín hiệu nào → coi như chết
const BACKOFF_MIN = 1_000
const BACKOFF_MAX = 30_000

let source = null
let backoff = BACKOFF_MIN
let retryTimer = null
let watchdog = null
let started = false
let generation = 0                 // chặn kết nối cũ ghi đè kết nối mới sau khi stop()

function emit(evt) {
  window.dispatchEvent(new CustomEvent(RT_EVENT, { detail: evt }))
}

function clearTimers() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (watchdog) { clearTimeout(watchdog); watchdog = null }
}

function closeSource() {
  if (source) { try { source.close() } catch { /* đã đóng */ } source = null }
}

/** Không nhận được gì (kể cả ping 25s của server) trong 60s → nối lại.
 *  Cần thiết vì proxy có thể cắt kết nối mà trình duyệt không báo lỗi. */
function armWatchdog(gen) {
  if (watchdog) clearTimeout(watchdog)
  watchdog = setTimeout(() => {
    if (gen !== generation) return
    closeSource()
    scheduleReconnect(gen)
  }, HEARTBEAT_TIMEOUT)
}

function scheduleReconnect(gen) {
  if (gen !== generation || !started) return
  clearTimers()
  // Jitter để nhiều tab không cùng đập vào server một lúc sau khi mạng trở lại.
  const delay = backoff + Math.random() * 500
  backoff = Math.min(backoff * 2, BACKOFF_MAX)
  retryTimer = setTimeout(() => connect(gen), delay)
}

async function connect(gen) {
  if (gen !== generation || !started || !getToken()) return
  closeSource()

  let ticket
  try {
    // EventSource không gửi được header Authorization, nên đổi session token lấy
    // vé ngắn hạn (dùng một lần) qua một request có xác thực bình thường.
    const res = await fetch('/api/events/ticket', { method: 'POST', headers: authHeaders() })
    if (!res.ok) throw new Error(`ticket ${res.status}`)
    ticket = (await res.json()).ticket
  } catch {
    scheduleReconnect(gen)
    return
  }
  if (gen !== generation || !started || !ticket) return

  const es = new EventSource(`/api/events?ticket=${encodeURIComponent(ticket)}`)
  source = es

  es.onopen = () => {
    if (gen !== generation) return
    backoff = BACKOFF_MIN
    armWatchdog(gen)
    // Vừa nối (lại) — không có cơ chế phát lại sự kiện đã lỡ, nên bảo mọi trang
    // quét lại một lượt để bù phần đứt quãng.
    emit({ type: 'resync' })
  }

  es.onmessage = (e) => {
    if (gen !== generation) return
    armWatchdog(gen)
    try { emit(JSON.parse(e.data)) } catch { /* bỏ qua payload hỏng */ }
  }

  es.onerror = () => {
    if (gen !== generation) return
    // Vé dùng một lần nên cơ chế tự nối lại của EventSource sẽ luôn thất bại
    // (401) — phải tự đóng rồi xin vé mới.
    closeSource()
    scheduleReconnect(gen)
  }
}

/** Mở kênh realtime. Gọi nhiều lần là vô hại. */
export function startEventStream() {
  if (started || !getToken()) return
  started = true
  backoff = BACKOFF_MIN
  generation += 1
  connect(generation)
}

/** Đóng kênh (đăng xuất / hết phiên). */
export function stopEventStream() {
  started = false
  generation += 1
  clearTimers()
  closeSource()
}

// Mạng trở lại → nối ngay, không ngồi chờ hết backoff.
window.addEventListener('online', () => {
  if (started && !source) {
    backoff = BACKOFF_MIN
    clearTimers()
    connect(generation)
  }
})

// Quay lại tab mà kênh đã chết → nối lại ngay.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && started && !source) {
    backoff = BACKOFF_MIN
    clearTimers()
    connect(generation)
  }
})

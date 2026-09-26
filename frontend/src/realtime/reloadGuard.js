// Khoá tự động tải lại trang ở những lúc reload sẽ phá hỏng việc user đang làm:
// đang làm bài thi, đang trích xuất PDF, đang chấm điểm. Bản cập nhật vẫn được
// nạp — chỉ là chờ tới khi khoá được gỡ.
export const RELOAD_UNBLOCKED = 'hoctoan_reload_unblocked'

const blocks = new Set()

/**
 * Chặn mọi lần tự reload cho tới khi gọi hàm trả về.
 * Dùng trong useEffect: `useEffect(() => blockReload('dang-lam-bai'), [])`
 *
 * @param {string} reason  nhãn để debug, đồng thời là khoá chống trùng
 * @returns {() => void}   hàm gỡ chặn (idempotent)
 */
export function blockReload(reason) {
  blocks.add(reason)
  let released = false
  return () => {
    if (released) return
    released = true
    blocks.delete(reason)
    if (blocks.size === 0) window.dispatchEvent(new CustomEvent(RELOAD_UNBLOCKED))
  }
}

export function isReloadBlocked() {
  return blocks.size > 0
}

/* ── Miễn trừ tạm thời cho chế độ khóa màn hình (chống gian lận) ──────────────
   Khi làm bài ở chế độ khóa, học sinh vẫn cần những thao tác hợp lệ phải nhờ tới
   hệ thống: bấm 📷 chụp ảnh bài làm, chọn ảnh từ thư viện, chụp màn hình, hoặc
   trình duyệt hỏi quyền camera / quay màn hình. Các thao tác đó luôn làm cửa sổ
   làm bài mất tiêu điểm (blur / visibilitychange / thoát toàn màn hình) — trước
   đây bị đếm là vi phạm và che kín đề.

   Vì vậy trước khi mở hộp thoại của hệ thống, nơi gọi bật "miễn trừ": trong lúc
   miễn trừ, useExamLock (ExamTakePage) không đếm vi phạm và không che đề; xong
   việc thì tự tắt khi cửa sổ làm bài lấy lại tiêu điểm.                       */

const MAX_GRACE_MS = 5 * 60_000   // trần an toàn, phòng khi không bắt được lúc quay lại
const TAIL_MS      = 1500         // giữ thêm một nhịp để nuốt nốt blur/visibility còn sót

let graceUntil = 0

/** Bật miễn trừ trước khi mở camera / hộp chọn ảnh / xin quyền quay màn hình. */
export function beginLockGrace(ms = MAX_GRACE_MS) {
  graceUntil = Math.max(graceUntil, Date.now() + Math.min(ms, MAX_GRACE_MS))
}

/** Hạ miễn trừ (vẫn chừa `tailMs` cho các sự kiện đến muộn). */
export function endLockGrace(tailMs = TAIL_MS) {
  if (graceUntil === 0) return
  graceUntil = Math.min(graceUntil, Date.now() + tailMs)
}

/** Đang trong lúc học sinh dùng camera / chụp màn hình hợp lệ? */
export function isLockGrace() {
  return Date.now() < graceUntil
}

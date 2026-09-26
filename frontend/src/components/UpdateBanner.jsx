import React, { useEffect, useState } from 'react'
import { isUpdateReady, UPDATE_AVAILABLE } from '../realtime/appVersion.js'

/**
 * Chỉ hiện khi có bản mới NHƯNG chưa tự nạp lại được — tức user đang làm bài,
 * đang trích xuất đề hoặc đang chấm điểm (xem realtime/reloadGuard.js). Ở mọi
 * trường hợp khác tab đã tự reload nên banner này không bao giờ xuất hiện.
 */
export default function UpdateBanner() {
  const [ready, setReady] = useState(isUpdateReady())

  useEffect(() => {
    const h = () => setReady(true)
    window.addEventListener(UPDATE_AVAILABLE, h)
    return () => window.removeEventListener(UPDATE_AVAILABLE, h)
  }, [])

  if (!ready) return null

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-dot" />
      <span>Đã có phiên bản mới của trang.</span>
      <button className="update-banner-btn" onClick={() => window.location.reload()}>
        Tải lại
      </button>
    </div>
  )
}

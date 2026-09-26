import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import { installSessionGuard } from './auth/sessionGuard.js'
import './index.css'

installSessionGuard()

/* Dọn cache đề thi cũ trong localStorage.
   Trước đây examStore lưu nguyên đề KÈM ẢNH BASE64 vào key này. Một đề có ảnh đã
   nặng vài MB, trong khi localStorage chỉ ~5 MB/origin → setItem ném
   QuotaExceededError. Server mới là nguồn thật nên cache đã bị bỏ hẳn; dòng này
   trả lại dung lượng cho những máy đã lỡ tích rác từ bản cũ. */
try { localStorage.removeItem('hoctoan_exams') } catch { /* chế độ riêng tư */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Nằm ngoài <App /> vì App có nhiều nhánh return riêng cho từng view —
        đặt ở đây để banner hiện được ở mọi màn hình. */}
    <UpdateBanner />
    <App />
  </React.StrictMode>,
)

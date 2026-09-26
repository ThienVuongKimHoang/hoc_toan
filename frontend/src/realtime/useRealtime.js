import { useEffect, useRef } from 'react'
import { RT_EVENT } from './eventStream.js'

const SAFETY_POLL = 120_000   // lưới an toàn khi SSE chết âm thầm sau proxy

/**
 * Gọi lại `handler` khi server báo có thay đổi thuộc `types`.
 *
 * Kèm sẵn hai lưới an toàn, nên nơi gọi không cần tự lo:
 *  - refetch khi user quay lại tab (kể cả khi SSE đã đứt mà không báo lỗi),
 *  - poll chậm 120s, CHỈ chạy khi tab đang hiện (tab ẩn không tốn request nào).
 *
 * `types`: mảng tên sự kiện. Sự kiện 'resync' luôn được nhận, không cần khai báo.
 *
 * @param {string[]} types
 * @param {Function} handler  không cần memo hoá — luôn gọi bản mới nhất
 * @param {boolean}  enabled  false để tạm ngưng (vd. chưa đăng nhập)
 */
export function useRealtime(types, handler, enabled = true) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const key = Array.isArray(types) ? types.join(',') : String(types || '')

  useEffect(() => {
    if (!enabled) return
    const wanted = new Set(key ? key.split(',').filter(Boolean) : [])
    const run = () => { try { handlerRef.current?.() } catch { /* lỗi ở 1 trang không được làm hỏng các trang khác */ } }

    const onRt = (e) => {
      const type = e.detail?.type
      if (type === 'resync' || wanted.has(type)) run()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') run() }

    window.addEventListener(RT_EVENT, onRt)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') run()
    }, SAFETY_POLL)

    return () => {
      window.removeEventListener(RT_EVENT, onRt)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [key, enabled])
}

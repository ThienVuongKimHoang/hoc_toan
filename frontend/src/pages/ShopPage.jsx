import React, { useEffect, useState } from 'react'
import { ROLES, authHeaders } from '../auth/mockUsers.js'
import { AvatarDisplay, FRAME_STYLES } from './ProfilePage.jsx'

const USER_KEY = 'hoctoan_user'

function Ic({ size = 16, children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {children}
    </svg>
  )
}
const IcCheck = (s) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>
const IcHome  = (s) => <Ic size={s}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ic>
const IcCoin  = (s) => <Ic size={s}><circle cx="12" cy="12" r="9"/><path d="M9.5 15.5c.5 1 1.5 1.5 2.5 1.5 1.7 0 3-1 3-2.3 0-3-5.5-1.5-5.5-4.5 0-1.3 1.3-2.2 3-2.2 1 0 2 .4 2.5 1.3"/><line x1="12" y1="6.5" x2="12" y2="17.5"/></Ic>
const IcBag   = (s) => <Ic size={s}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></Ic>

const RARITY_LABEL = { common: 'Phổ thông', rare: 'Hiếm', epic: 'Sử thi', legendary: 'Huyền thoại' }
const RARITY_COLOR = { common: '#64748b', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706' }

/* ── Cửa hàng khung viền (học sinh mua bằng xu; super admin mở khoá sẵn hết) ── */
export default function ShopPage({ user, onUpdateUser, onGoHome }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shop/frames', { headers: authHeaders() })
      if (res.ok) setData(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const applyUser = (updated) => {
    const merged = { ...user, ...updated }
    localStorage.setItem(USER_KEY, JSON.stringify(merged))
    onUpdateUser(merged)
  }

  const handleBuy = async (frame) => {
    setError(''); setBusy(true)
    try {
      const res  = await fetch('/api/shop/buy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ frameId: frame.id }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Mua khung viền thất bại.'); return }
      applyUser(body)
      await load()
    } catch {
      setError('Không thể kết nối server.')
    } finally {
      setBusy(false)
    }
  }

  const handleEquip = async (frameId) => {
    setError(''); setBusy(true)
    try {
      const res  = await fetch('/api/shop/equip', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ frameId }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Trang bị khung viền thất bại.'); return }
      applyUser(body)
      await load()
    } catch {
      setError('Không thể kết nối server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="prof-page">
      <div className="container prof-container">
        <h1 className="prof-page-title">Cửa hàng</h1>

        <div className="prof-section">
          <h3 className="prof-section-title">
            {IcBag(16)} Cửa hàng khung viền
            <span className="prof-coin-badge">{IcCoin(14)} {loading ? '…' : (data?.coins ?? 0)} xu</span>
          </h3>
          <p className="prof-section-desc">
            {user.role === ROLES.SUPERADMIN
              ? 'Tài khoản super admin được mở khoá toàn bộ khung viền — chọn một khung để trang bị.'
              : 'Dùng xu để mở khoá khung viền cho ảnh đại diện. Xu hiện được super admin cấp thủ công.'}
          </p>

          {error && <div className="form-error">{error}</div>}

          {loading ? (
            <p className="prof-section-desc">Đang tải…</p>
          ) : !data ? (
            <div className="form-error">Không thể tải cửa hàng.</div>
          ) : (
            <div className="prof-shop-grid">
              <button
                type="button"
                className={`prof-shop-card ${!data.equippedFrame ? 'prof-shop-card--equipped' : ''}`}
                onClick={() => handleEquip(null)}
                disabled={busy}
              >
                <AvatarDisplay user={user} size={64} />
                <span className="prof-shop-name">Không dùng khung</span>
                {!data.equippedFrame && <span className="prof-shop-tag prof-shop-tag--equipped">{IcCheck(11)} Đang dùng</span>}
              </button>

              {data.frames.map(f => {
                const isEquipped = data.equippedFrame === f.id
                return (
                  <button
                    type="button"
                    key={f.id}
                    className={`prof-shop-card ${isEquipped ? 'prof-shop-card--equipped' : ''}`}
                    onClick={() => f.owned ? handleEquip(f.id) : handleBuy(f)}
                    disabled={busy}
                  >
                    <AvatarDisplay user={user} size={64} frameStyle={FRAME_STYLES[f.id]} />
                    <span className="prof-shop-name">{f.name}</span>
                    <span className="prof-shop-rarity" style={{ color: RARITY_COLOR[f.rarity] }}>{RARITY_LABEL[f.rarity] || f.rarity}</span>
                    {isEquipped ? (
                      <span className="prof-shop-tag prof-shop-tag--equipped">{IcCheck(11)} Đang dùng</span>
                    ) : f.owned ? (
                      <span className="prof-shop-tag prof-shop-tag--owned">Đã sở hữu — bấm để dùng</span>
                    ) : (
                      <span className="prof-shop-tag prof-shop-tag--price">{IcCoin(11)} {f.price} xu</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="prof-back-row">
          <button className="prof-btn prof-btn--ghost" onClick={onGoHome}>
            {IcHome(15)} Về trang chủ
          </button>
        </div>
      </div>
    </div>
  )
}

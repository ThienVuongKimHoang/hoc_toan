import { authHeaders } from '../auth/mockUsers.js'

export async function getNotifications(userId) {
  const res = await fetch('/api/notifications', { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function markRead(notifId) {
  await fetch('/api/notifications/read', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: notifId }),
  })
}

export async function markAllRead(userId) {
  await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: authHeaders(),
  })
}

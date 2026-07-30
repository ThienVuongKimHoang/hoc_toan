import { authHeaders } from '../auth/mockUsers.js'

export async function getMyMissions(studentId) {
  const res = await fetch(`/api/students/${studentId}/missions`, { headers: authHeaders() })
  if (!res.ok) return null
  return res.json()
}

import { authHeaders } from '../auth/mockUsers.js'

/** Toàn bộ nhãn chủ đề (môn + cấp học) từ custom_topics, gom theo nhóm —
 * cùng shape { group, topics: [...] } mà getLabelGroups() cũ từng trả về. */
export async function fetchTopicGroups(subject, grade) {
  const res = await fetch(`/api/topics/custom?subject=${subject}&grade=${grade}`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  const byGroup = new Map()
  for (const t of (data.topics || [])) {
    const key = t.group || 'Khác'
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key).push(t.topic)
  }
  return Array.from(byGroup, ([group, topics]) => ({ group, topics }))
}

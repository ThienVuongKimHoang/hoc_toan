import { authHeaders } from '../auth/mockUsers.js'

export async function getVocabProgress() {
  const res = await fetch('/api/vocab-progress', { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function setQueueMembership(wordId, inQueue) {
  const res = await fetch('/api/vocab-progress/queue', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ wordId, inQueue }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function recordResult(wordId, correct) {
  const res = await fetch('/api/vocab-progress/result', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ wordId, correct }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function clearQueue() {
  await fetch('/api/vocab-progress/clear-queue', {
    method: 'POST',
    headers: authHeaders(),
  })
}

export async function generateExamples(word, vietnamese) {
  const res = await fetch('/api/vocab/examples', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ word, vietnamese }),
  })
  if (!res.ok) throw new Error('Không tạo được câu ví dụ')
  return res.json()
}

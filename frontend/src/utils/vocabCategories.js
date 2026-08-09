import { categories } from '../data/vocabulary.js'

const LABELS = Object.fromEntries(categories.map(c => [c.id, c.label]))

// Nhãn chủ đề tiếng Việt theo category id (word.topic trong dữ liệu gốc là tiếng Anh).
export function categoryLabel(id) {
  return LABELS[id] || id
}

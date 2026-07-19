/* Gom nhóm document theo cấu trúc Buổi (folder) → Câu → Đề / Đáp án giải.
   Chỉ document có kind === 'exercise' mới thuộc cấu trúc này — tài liệu rời/thường
   (kind khác hoặc không có kind) không bị ảnh hưởng, luôn hiển thị theo kiểu cũ. */

export const isExerciseDoc = (d) => d?.kind === 'exercise'

const byOrderThenTime = (a, b) =>
  (a.order ?? 0) - (b.order ?? 0) || new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0)

/** docs đã lọc sẵn theo 1 folder → mảng các nhóm { cauLabel, de: [...], dapAn: [...] }, đã sắp xếp. */
export function groupByCau(docs) {
  const map = new Map()
  for (const d of docs) {
    if (!isExerciseDoc(d)) continue
    const label = d.cauLabel || 'Câu 1'
    if (!map.has(label)) map.set(label, { cauLabel: label, de: [], dapAn: [] })
    const group = map.get(label)
    if (d.section === 'dap_an') group.dapAn.push(d)
    else group.de.push(d)
  }
  for (const group of map.values()) {
    group.de.sort(byOrderThenTime)
    group.dapAn.sort(byOrderThenTime)
  }
  return [...map.values()].sort((a, b) => {
    const na = parseInt((a.cauLabel.match(/\d+/) || [])[0], 10)
    const nb = parseInt((b.cauLabel.match(/\d+/) || [])[0], 10)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
    return a.cauLabel.localeCompare(b.cauLabel, 'vi')
  })
}

/** Nhãn Câu đã có trong 1 folder — dùng cho dropdown "Câu đã có" khi lưu ảnh mới. */
export function cauLabelsInFolder(docs, folder) {
  const set = new Set()
  for (const d of docs) {
    if (isExerciseDoc(d) && d.folder === folder && d.cauLabel) set.add(d.cauLabel)
  }
  return [...set]
}

/** Số thứ tự bước gợi ý tiếp theo cho phần đáp án giải của 1 câu trong 1 folder. */
export function nextDapAnOrder(docs, folder, cauLabel) {
  const steps = docs.filter(d =>
    isExerciseDoc(d) && d.folder === folder && d.cauLabel === cauLabel && d.section === 'dap_an')
  if (!steps.length) return 1
  return Math.max(...steps.map(d => d.order || 0)) + 1
}

/** Ảnh liên tục trong 1 câu — Đề rồi đến Đáp án giải theo thứ tự — dùng cho lightbox xem liên tục. */
export function flattenCau(cauGroup) {
  return [...cauGroup.de, ...cauGroup.dapAn]
}

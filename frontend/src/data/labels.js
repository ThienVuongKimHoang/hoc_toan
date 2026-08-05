export const DIFFICULTY_LEVELS = [
  {
    id:     'Nhận biết',
    short:  'NB',
    color:  '#16a34a',
    bg:     '#dcfce7',
    border: '#86efac',
    desc:   'Nhớ công thức, định nghĩa, nhận diện khái niệm',
  },
  {
    id:     'Thông hiểu',
    short:  'TH',
    color:  '#0891b2',
    bg:     '#cffafe',
    border: '#67e8f9',
    desc:   'Hiểu bản chất, áp dụng trực tiếp công thức',
  },
  {
    id:     'Vận dụng',
    short:  'VD',
    color:  '#ca8a04',
    bg:     '#fef9c3',
    border: '#fde047',
    desc:   'Kết hợp nhiều kiến thức để giải',
  },
  {
    id:     'Vận dụng cao',
    short:  'VDC',
    color:  '#dc2626',
    bg:     '#fee2e2',
    border: '#fca5a5',
    desc:   'Bài toán mới, nhiều bước suy luận, cần tư duy sâu',
  },
]

/* ══════════════════════════════════════════════════════════════════════
   Nhãn chủ đề (Toán/Lý/Hóa) không còn hardcode ở đây — toàn bộ sống trong
   bảng custom_topics (xem database.py, seed từ topic_seed.json), lấy qua
   fetchTopicGroups() ở store/topicStore.js.
══════════════════════════════════════════════════════════════════════ */
const TOPIC_SUBJECTS = ['toan', 'ly', 'hoa']

/** Môn có bộ nhãn chủ đề để phân loại hay không (Toán/Lý/Hóa có; Anh/Văn chưa). */
export function subjectHasLabels(subject) {
  return TOPIC_SUBJECTS.includes(subject)
}

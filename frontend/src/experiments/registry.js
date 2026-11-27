/* ─────────────────────────────────────────────────────────────
   Danh mục thí nghiệm ảo theo môn + khối.
   Tab "Thí nghiệm" chỉ có ở lớp môn Lý / Hoá; mỗi thí nghiệm khai báo môn và các khối
   được hiển thị. Thêm thí nghiệm mới: thêm 1 phần tử vào EXPERIMENTS và 1 nhánh render
   trong App.jsx (view 'lab-page').
───────────────────────────────────────────────────────────── */

export const LAB_SUBJECTS = ['ly', 'hoa']

export const EXPERIMENTS = [
  {
    id: 'incline',
    subject: 'ly',
    grades: ['10'],
    title: 'Mặt phẳng nghiêng',
    topic: 'Động lực học',
    desc: 'Vật trượt trên dốc: phân tích lực, ma sát, đồ thị v–t. Kéo – ném vật trực tiếp trên hình.',
    accent: '#991b1b',
  },
  {
    id: 'young',
    subject: 'ly',
    grades: ['11'],
    title: 'Giao thoa ánh sáng (khe Young)',
    topic: 'Sóng ánh sáng',
    desc: 'Chỉnh λ, a, D, môi trường; xem sóng từ hai khe, đo khoảng vân trên màn, ánh sáng trắng và hai bức xạ.',
    accent: '#4338ca',
  },
]

export const hasLab = subject => LAB_SUBJECTS.includes(subject)

export const experimentsFor = (subject, grade) =>
  EXPERIMENTS.filter(e => e.subject === subject && e.grades.includes(String(grade ?? '')))

export const getExperiment = id => EXPERIMENTS.find(e => e.id === id) || null

/* Hash mở một thí nghiệm, kèm hash để nút "Quay lại" trở về đúng chỗ (tab Thí nghiệm của lớp) */
export const labHash = (id, returnHash) =>
  returnHash ? `lab/${id}/${encodeURIComponent(returnHash)}` : `lab/${id}`

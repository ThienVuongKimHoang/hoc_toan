import React from 'react'

/** Loại hình lớp học — dùng chung cho trang giáo viên & học sinh */
export const SUBJECTS = {
  toan: { label: 'Toán',      icon: '📐' },
  ly:   { label: 'Vật lý',    icon: '⚡' },
  hoa:  { label: 'Hóa học',   icon: '🧪' },
  anh:  { label: 'Tiếng Anh', icon: '🇬🇧' },
  van:  { label: 'Ngữ văn',   icon: '📖' },
  khac: { label: 'Khác',      icon: '📚' },
}

export const SUBJECT_ORDER = ['toan', 'ly', 'hoa', 'anh', 'van', 'khac']

/** Cấp độ (khối lớp) — học sinh chọn khi đăng ký, lớp gắn với một cấp độ.
 *  Giá trị là chuỗi '1'..'12'; nhãn hiển thị "Lớp N". */
export const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1))
export const gradeLabel = (g) => (g ? `Lớp ${g}` : '')

/** Badge cấp độ (pill xám) — dùng cạnh tên lớp/thẻ học sinh. */
export function GradeBadge({ grade, size = 'md' }) {
  if (!grade) return null
  return (
    <span className={`subject-badge subject-badge--khac subject-badge--${size}`}>
      <span className="subject-badge-icon">🎓</span>
      {gradeLabel(grade)}
    </span>
  )
}

/** Bộ chọn cấp độ (single-select), dùng trong form đăng ký & form lớp. */
export function GradePicker({ value, onChange }) {
  return (
    <div className="subject-picker">
      {GRADES.map(g => (
        <button
          key={g} type="button"
          className={`subject-pick ${value === g ? 'subject-pick--active subject-badge--khac' : ''}`}
          onClick={() => onChange(value === g ? null : g)}
        >
          🎓 {gradeLabel(g)}
        </button>
      ))}
    </div>
  )
}

/** Bộ chọn NHIỀU môn (dùng khi tạo/sửa lớp = khối nhiều môn). */
export function MultiSubjectPicker({ value = [], onChange }) {
  const toggle = (key) =>
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  return (
    <div className="subject-picker">
      {SUBJECT_ORDER.map(key => (
        <button
          key={key} type="button"
          className={`subject-pick ${value.includes(key) ? `subject-pick--active subject-badge--${key}` : ''}`}
          onClick={() => toggle(key)}
        >
          <span>{SUBJECTS[key].icon}</span> {SUBJECTS[key].label}
        </button>
      ))}
    </div>
  )
}

/** Nhãn loại hình lớp học (pill có gradient màu theo môn) */
export default function SubjectBadge({ subject, size = 'md' }) {
  if (!subject || !SUBJECTS[subject]) return null
  const s = SUBJECTS[subject]
  return (
    <span className={`subject-badge subject-badge--${subject} subject-badge--${size}`}>
      <span className="subject-badge-icon">{s.icon}</span>
      {s.label}
    </span>
  )
}

/** Bộ chọn môn học (dùng trong form tạo / sửa lớp) */
export function SubjectPicker({ value, onChange }) {
  return (
    <div className="subject-picker">
      {SUBJECT_ORDER.map(key => (
        <button
          key={key} type="button"
          className={`subject-pick ${value === key ? `subject-pick--active subject-badge--${key}` : ''}`}
          onClick={() => onChange(value === key ? null : key)}
        >
          <span>{SUBJECTS[key].icon}</span> {SUBJECTS[key].label}
        </button>
      ))}
    </div>
  )
}

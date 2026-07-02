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

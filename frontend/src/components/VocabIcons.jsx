// Bộ icon SVG dùng chung cho tính năng "Ôn luyện IELTS" (từ vựng) — cùng convention
// với Svg wrapper trong HomePage.jsx: nét đồng nhất, thay hoàn toàn cho emoji.
export const Svg = ({ children, size = 20, sw = 1.8, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ flex: 'none', display: 'block', ...style }}>{children}</svg>
)

export const IconBook = p => <Svg {...p}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z" /><path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" /></Svg>
export const IconArrowLeft = p => <Svg {...p}><path d="M19 12H5M12 5l-7 7 7 7" /></Svg>
export const IconSpeaker = p => <Svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></Svg>
export const IconBookmark = p => <Svg {...p}><path d="M6 3h12v18l-6-4.5L6 21V3Z" /></Svg>
export const IconBookmarkFilled = p => <Svg fill="currentColor" {...p}><path d="M6 3h12v18l-6-4.5L6 21V3Z" /></Svg>
export const IconCheck = p => <Svg {...p}><path d="M20 6.5 9.5 17 4 11.5" /></Svg>
export const IconX = p => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
export const IconSearch = p => <Svg {...p}><circle cx="11" cy="11" r="6.4" /><path d="m20 20-3.6-3.6" /></Svg>
export const IconTarget = p => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></Svg>
export const IconPencil = p => <Svg {...p}><path d="M4 20.5 5 16l10.5-10.5a2.1 2.1 0 0 1 3 3L8 19l-4 1.5Z" /><path d="M13 6.5 17.5 11" /></Svg>
export const IconDocument = p => <Svg {...p}><path d="M6 2.5h8l4 4v15H6v-19Z" /><path d="M14 2.5V7h4M9 12h6M9 16h6" /></Svg>
export const IconChevronRight = p => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
export const IconEye = p => <Svg {...p}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" /></Svg>
export const IconRefresh = p => <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></Svg>
export const IconFlame = p => <Svg fill="currentColor" {...p}><path d="M12 2c1 3-3 4-3 7.5A3 3 0 0 0 12 13a3 3 0 0 0 3-3.5c1.5 1 2.5 2.8 2.5 4.7A5.5 5.5 0 0 1 12 20a5.5 5.5 0 0 1-5.5-5.8C6.5 9 9 6 12 2Z" /></Svg>
export const IconTrophy = p => <Svg {...p}><path d="M7 4h10v4a5 5 0 0 1-10 0Z" /><path d="M7 5.5H4.5V7A2.5 2.5 0 0 0 7 9.5M17 5.5h2.5V7A2.5 2.5 0 0 1 17 9.5M9.5 14.5h5M8.5 20h7M12 14.5V20" /></Svg>
export const IconLightbulb = p => <Svg {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9v.2h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z" /></Svg>
export const IconTrash = p => <Svg {...p}><path d="M4 6h16M9 6V4h6v2m-8 0 .8 13a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-1L17 6" /></Svg>
export const IconLoader = p => <Svg {...p} style={{ animation: 'vp-spin 0.8s linear infinite', ...(p.style || {}) }}><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></Svg>
export const IconRobot = p => <Svg {...p}><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 8V4M9 4h6" /><circle cx="9.5" cy="13" r="1.2" fill="currentColor" /><circle cx="14.5" cy="13" r="1.2" fill="currentColor" /><path d="M9 17h6" /></Svg>

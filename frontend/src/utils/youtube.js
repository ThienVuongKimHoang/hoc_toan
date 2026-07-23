/* Nhận diện & dựng link YouTube (watch, youtu.be, embed, shorts) cho tính năng
   đính kèm video vào bài tập / tài liệu lớp học. */
const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/

export function extractYoutubeId(url) {
  const m = String(url || '').match(YT_RE)
  return m ? m[1] : null
}

export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`
}

export function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`
}

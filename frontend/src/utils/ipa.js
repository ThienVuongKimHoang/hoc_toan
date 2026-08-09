// Phân loại ký hiệu IPA (tiếng Anh Mỹ) thành phụ âm / nguyên âm / dấu trọng âm,
// dùng để tô màu phần "phụ âm" trong khung phát âm ở WordModal.
// Danh sách bám theo bộ ký hiệu mà eng-to-ipa (dựa trên CMU Pronouncing Dictionary) tạo ra.

// Cụm 2 ký tự phải được kiểm tra TRƯỚC ký tự đơn (khớp dài nhất trước) — ví dụ
// nguyên âm đôi "eɪ" phải được nhận ra như một khối, không tách thành "e" + "ɪ".
const MULTI = {
  // Nguyên âm đôi (diphthongs)
  'eɪ': 'vowel', 'aɪ': 'vowel', 'ɔɪ': 'vowel', 'aʊ': 'vowel', 'oʊ': 'vowel',
  'ɪə': 'vowel', 'eə': 'vowel', 'ʊə': 'vowel',
  // Phụ âm tắc-xát viết bằng 2 ký tự (một số bộ ký hiệu dùng dạng này thay vì ʧ/ʤ)
  'tʃ': 'consonant', 'dʒ': 'consonant',
}

const SINGLE = {
  // Phụ âm
  p: 'consonant', b: 'consonant', t: 'consonant', d: 'consonant', k: 'consonant', g: 'consonant',
  f: 'consonant', v: 'consonant', θ: 'consonant', ð: 'consonant', s: 'consonant', z: 'consonant',
  ʃ: 'consonant', ʒ: 'consonant', h: 'consonant', m: 'consonant', n: 'consonant', ŋ: 'consonant',
  l: 'consonant', r: 'consonant', j: 'consonant', w: 'consonant', ʧ: 'consonant', ʤ: 'consonant',
  // Nguyên âm
  i: 'vowel', ɪ: 'vowel', e: 'vowel', ɛ: 'vowel', æ: 'vowel', ɑ: 'vowel', ɒ: 'vowel', ɔ: 'vowel',
  ʊ: 'vowel', u: 'vowel', ʌ: 'vowel', ɜ: 'vowel', ə: 'vowel', ɚ: 'vowel', ɝ: 'vowel', a: 'vowel', o: 'vowel',
  // Dấu trọng âm / độ dài / ranh giới âm tiết — không phải âm vị
  'ˈ': 'mark', 'ˌ': 'mark', 'ː': 'mark', '.': 'mark', '˞': 'mark',
}

// Tách chuỗi IPA thành các token {text, kind}, khớp cụm dài nhất trước.
export function tokenizeIpa(str) {
  if (!str) return []
  const tokens = []
  let i = 0
  while (i < str.length) {
    const two = str.slice(i, i + 2)
    if (MULTI[two]) {
      tokens.push({ text: two, kind: MULTI[two] })
      i += 2
      continue
    }
    const ch = str[i]
    const kind = SINGLE[ch] || 'mark'
    tokens.push({ text: ch, kind })
    i += 1
  }
  return tokens
}

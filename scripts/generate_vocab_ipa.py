#!/usr/bin/env python3
"""One-off script: port hoc_tap's 635-word vocabulary list into hoc_toan,
cleaning PDF-extraction spacing artifacts and attaching an IPA transcription
per word (used by the word-detail consonant/vowel pronunciation UI).

Run once: python3 scripts/generate_vocab_ipa.py
Requires: eng-to-ipa (pip install eng-to-ipa) — not a runtime dependency of
the app, so it is intentionally NOT added to requirements.txt.
"""
import json
import re
from pathlib import Path

import eng_to_ipa as ipa

SRC = Path("/Users/vuongkimhoangthien/hoc_tap/frontend/src/data/vocabulary.js")
DEST = Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "vocabulary.js"

# Nhãn chủ đề dịch sang tiếng Anh -> tiếng Việt (theo quy ước UI tiếng Việt của dự án)
CATEGORY_LABELS_VI = {
    "all": "Tất cả",
    "accidents": "Tai nạn",
    "appearance": "Ngoại hình",
    "communication": "Giao tiếp",
    "countryside": "Nông thôn",
    "culture": "Văn hóa & Tôn giáo",
    "education": "Giáo dục",
    "entertainment": "Giải trí & Truyền thông",
    "environment": "Môi trường & Thiên nhiên",
    "family": "Gia đình & Các mối quan hệ",
    "food": "Ẩm thực",
    "health": "Sức khỏe",
}


def extract_array(text, name):
    m = re.search(r"export const %s = (\[.*?\]);" % name, text, re.S)
    if not m:
        raise ValueError(f"Could not find export `{name}` in source file")
    return json.loads(m.group(1))


def clean_word(w):
    # Sửa lỗi PDF tách dòng làm rớt khoảng trắng giữa 1 từ, vd "correspondenc e"
    return w.strip().replace(" ", "")


def to_ipa(word):
    result = ipa.convert(word, keep_punct=False)
    if not result or "*" in result:
        return None  # không có trong từ điển / độ tin cậy thấp -> không hiển thị
    return result


def main():
    text = SRC.read_text(encoding="utf-8")
    raw_categories = extract_array(text, "categories")
    raw_vocabulary = extract_array(text, "vocabulary")

    categories = []
    for c in raw_categories:
        categories.append({
            "id": c["id"],
            "label": CATEGORY_LABELS_VI.get(c["id"], c["label"]),
            "count": c.get("count"),
        })

    vocabulary = []
    hits = 0
    for w in raw_vocabulary:
        word = clean_word(w["word"])
        entry_ipa = to_ipa(word)
        if entry_ipa:
            hits += 1
        vocabulary.append({
            "id": w["id"],
            "word": word,
            "pos": w["pos"],
            "vietnamese": w["vietnamese"],
            "example": w["example"],
            "topic": w["topic"],
            "category": w["category"],
            "ipa": entry_ipa,
        })

    total = len(vocabulary)
    print(f"IPA coverage: {hits}/{total} ({hits / total * 100:.1f}%)")

    out = (
        "// Auto-generated: ported from hoc_tap/frontend/src/data/vocabulary.js\n"
        "// + cleaned PDF-extraction spacing artifacts + augmented with `ipa` via\n"
        "// scripts/generate_vocab_ipa.py (không chỉnh sửa tay — sửa ở script rồi chạy lại)\n"
        f"export const categories = {json.dumps(categories, ensure_ascii=False, indent=2)};\n\n"
        f"export const vocabulary = {json.dumps(vocabulary, ensure_ascii=False, indent=2)};\n"
    )
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(out, encoding="utf-8")
    print(f"Wrote {DEST} ({total} words, {len(categories)} categories)")


if __name__ == "__main__":
    main()

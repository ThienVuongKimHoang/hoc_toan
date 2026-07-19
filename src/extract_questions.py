"""
Trích xuất câu hỏi, đáp án, hình ảnh từ đề thi PDF bằng GROQ Vision API.

Cấu trúc đề:
  PHẦN I  (3.0đ): Câu 1-12, trắc nghiệm 1 đáp án       → 0.25đ/câu
  PHẦN II (4.0đ): Câu 1-4,  đúng/sai 4 ý (a-d)         → 0.1/0.25/0.5/1.0đ
  PHẦN III(3.0đ): Câu 1-6,  trả lời ngắn                → 0.5đ/câu

Chạy: python3 extract_questions.py [--pdf path/to/file.pdf] [--out output.json]
"""

from __future__ import annotations

import os
import json
import base64
import argparse
import re
import time
from pathlib import Path

import fitz  # PyMuPDF
from groq import Groq
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SRC_DIR = Path(__file__).parent
ROOT_DIR = SRC_DIR.parent
DEFAULT_PDF = SRC_DIR / "Đề 1 - Đề Thi thử tốt nghiệp THPT năm 2026 Sở Đồng Nai.pdf"
DEFAULT_OUT = SRC_DIR / "output" / "questions.json"
IMAGES_DIR = SRC_DIR / "output" / "images"

SECTION_POINTS = {
    "PHẦN I":   {"type": "multiple_choice", "points_per_q": 0.25, "total": 3.0, "count": 12},
    "PHẦN II":  {"type": "true_false",      "points_per_q": 1.0,  "total": 4.0, "count": 4,
                 "sub_scoring": {1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0}},
    "PHẦN III": {"type": "short_answer",    "points_per_q": 0.5,  "total": 3.0, "count": 6},
}

SECTION_DESCS = {
    "PHẦN I":   "Trắc nghiệm nhiều phương án, chọn 1 đáp án đúng (Câu 1–12, 0.25đ/câu)",
    "PHẦN II":  "Trắc nghiệm Đúng/Sai, mỗi câu có 4 ý a-b-c-d (Câu 1–4, tối đa 1đ/câu)",
    "PHẦN III": "Trả lời ngắn, ghi đáp số (Câu 1–6, 0.5đ/câu)",
}

VISION_MODEL = "qwen/qwen3.6-27b"  # llama-4-scout bị Groq khai tử 17/07/2026
PAGE_DPI = 200
MAX_TOKENS_DEFAULT = 4096
MAX_TOKENS_RETRY = 8192

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_api_keys() -> list:
    """Trả về danh sách các API key: [primary, fallback, ...]"""
    load_dotenv(ROOT_DIR / ".env")
    keys = []
    for var in ("GROQ_API_KEY", "GROQ_API_KEY_FALLBACK", "GROQ_API_KEY_FALLBACK_2"):
        k = os.getenv(var)
        if k:
            keys.append(k)
    if not keys:
        raise RuntimeError("Không tìm thấy GROQ_API_KEY trong .env")
    return keys


def load_api_key() -> str:
    """Backward-compat: trả về key đầu tiên."""
    return load_api_keys()[0]


def page_to_base64(page: fitz.Page, dpi: int = PAGE_DPI) -> str:
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
    return base64.b64encode(pix.tobytes("png")).decode()


def extract_embedded_images(doc: fitz.Document, page_idx: int, out_dir: Path) -> list:
    """
    Lưu hình ảnh nhúng trong trang ra file.
    Trả về list dict sorted theo Y-position (trên → dưới):
      [{
        "path": "images/...",
        "y0": float, "y1": float,
        "xref": int,
        "is_content": bool,   # False nếu ở header/footer hoặc quá nhỏ
      }, ...]

    is_content = False khi:
      - Nằm trong vùng header (y0 < 10% chiều cao trang)
      - Nằm trong vùng footer (y0 > 90% chiều cao trang)
      - Kích thước pixel nhỏ hơn 60x60 (icon, bullet)
    """
    page = doc[page_idx]
    page_h = page.rect.height
    header_cutoff = page_h * 0.10
    footer_cutoff = page_h * 0.90
    MIN_PX = 60

    entries = []
    seen_xrefs = set()

    for img_info in page.get_images(full=True):
        xref = img_info[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)

        rects = page.get_image_rects(xref)
        y0 = rects[0].y0 if rects else 0.0
        y1 = rects[0].y1 if rects else 0.0

        base_image = doc.extract_image(xref)
        w, h = base_image.get("width", 0), base_image.get("height", 0)

        is_content = (
            y0 >= header_cutoff and
            y0 <= footer_cutoff and
            w >= MIN_PX and h >= MIN_PX
        )

        ext = base_image["ext"]
        fname = f"p{page_idx+1}_x{xref}.{ext}"
        (out_dir / fname).write_bytes(base_image["image"])
        entries.append({
            "path": f"images/{fname}",
            "y0": y0, "y1": y1,
            "xref": xref,
            "is_content": is_content,
        })

    entries.sort(key=lambda e: e["y0"])
    return entries


def scan_pdf_layout(doc: fitz.Document) -> tuple:
    """
    Phân tích bố cục PDF để tìm chính xác trang nào chứa câu hỏi của từng phần.
    Tổng quát cho mọi file: nhận diện bất kỳ "PHẦN X" nào (chữ số La Mã, chữ cái, số).
    Tự động phát hiện loại câu hỏi và số lượng từ mô tả header phần.

    Trả về:
      section_header_page: dict  section -> trang 0-indexed chứa header
      section_q_start_page: dict section -> trang 0-indexed bắt đầu có câu hỏi thực
      page_active_sections: dict page_idx -> list[section]
      detected_sections:    dict section -> {type, count, points_per_q, total, description}
    """
    # Nhận diện bất kỳ mã La Mã hoặc ký tự đơn sau "PHẦN"
    header_re = re.compile(r"PHẦN\s+([IVXLCDM]{1,6}|[A-Z]|\d{1,2})\b")

    count_re      = re.compile(r"từ câu\s+\d+\s+đến câu\s+(\d+)", re.IGNORECASE)
    type_patterns = [
        ("multiple_choice", re.compile(r"nhiều phương án|lựa chọn", re.IGNORECASE)),
        ("true_false",      re.compile(r"đúng sai",                  re.IGNORECASE)),
        ("short_answer",    re.compile(r"trả lời ngắn|điền vào|ngắn", re.IGNORECASE)),
    ]
    default_pts = {"multiple_choice": 0.25, "true_false": 1.0, "short_answer": 0.5, "unknown": 0.25}
    type_labels  = {
        "multiple_choice": "Trắc nghiệm nhiều phương án (chọn 1 đáp án đúng)",
        "true_false":      "Trắc nghiệm Đúng/Sai (4 ý a-b-c-d mỗi câu)",
        "short_answer":    "Trả lời ngắn (ghi đáp số)",
        "unknown":         "Câu hỏi",
    }

    section_header_page = {}
    detected_sections   = {}
    all_texts = [doc[i].get_text() for i in range(doc.page_count)]

    for i, text in enumerate(all_texts):
        for m in header_re.finditer(text):
            identifier = m.group(1)
            sec = f"PHẦN {identifier}"
            if sec in section_header_page:
                continue
            section_header_page[sec] = i
            excerpt = text[m.start():m.start() + 500]

            sec_type = "unknown"
            for t, pattern in type_patterns:
                if pattern.search(excerpt):
                    sec_type = t
                    break

            cm = count_re.search(excerpt)
            count = int(cm.group(1)) if cm else SECTION_POINTS.get(sec, {}).get("count", 12)
            pts   = default_pts.get(sec_type, 0.25)
            detected_sections[sec] = {
                "type":         sec_type,
                "count":        count,
                "points_per_q": pts,
                "total":        round(count * pts, 2),
                "description":  f"{type_labels[sec_type]} — Câu 1–{count}",
            }

    # Thứ tự các phần theo trang xuất hiện
    section_order = sorted(section_header_page, key=lambda s: section_header_page[s])

    # Tìm trang đầu tiên có "Câu 1." sau mỗi header (chỉ tìm AFTER header position)
    section_q_start_page = {}
    q1_re = re.compile(r"Câu\s+1[\.\s]")
    for sec in section_order:
        hdr_page = section_header_page[sec]
        roman = sec.replace("PHẦN ", "").strip()
        for i in range(hdr_page, doc.page_count):
            text = all_texts[i]
            if i == hdr_page:
                hm = re.search(rf"PHẦN\s+{re.escape(roman)}\b", text)
                search_text = text[hm.end():] if hm else text
            else:
                search_text = text
            if q1_re.search(search_text):
                section_q_start_page[sec] = i
                break

    # section_end_page: kết thúc tại TRANG HEADER của phần kế tiếp (bao gồm trang chuyển tiếp)
    # Điều này cho phép cả 2 phần cùng active trên trang chuyển tiếp
    section_end_page = {}
    for idx, sec in enumerate(section_order):
        if sec not in section_q_start_page:
            continue
        nxt = next((section_order[j] for j in range(idx+1, len(section_order))
                    if section_order[j] in section_q_start_page), None)
        if nxt:
            section_end_page[sec] = section_header_page[nxt]
        else:
            section_end_page[sec] = doc.page_count - 1

    page_active_sections = {}
    for i in range(doc.page_count):
        active = []
        for sec in section_order:
            start = section_q_start_page.get(sec, -1)
            end   = section_end_page.get(sec, -1)
            if start <= i <= end:
                active.append(sec)
        page_active_sections[i] = active if active else (section_order[:1] if section_order else ["PHẦN I"])

    return section_header_page, section_q_start_page, page_active_sections, detected_sections


def scan_question_starts(doc: fitz.Document, section_q_start_page: dict,
                          section_header_page: dict = None) -> dict:
    """
    Quét toàn bộ PDF để tìm trang nào bắt đầu câu hỏi nào, per section.

    Sửa lỗi quan trọng: Trên trang đầu của mỗi phần (trang chuyển tiếp),
    chỉ quét text SAU vị trí header để tránh nhầm số câu từ phần trước.
    Ví dụ: trang có PHẦN III ở cuối cũng có PHẦN II Câu 3,4 ở đầu → không
    gán nhầm Câu 3,4 đó cho PHẦN III.

    sec_ranges mở rộng tới trang chuyển tiếp (inclusive) để mỗi phần
    bắt được các câu tiếp nối sang trang kế.

    Trả về: dict (section, q_num) -> page_idx (0-indexed)
    """
    starts = sorted(section_q_start_page.items(), key=lambda x: x[1])
    sec_ranges = {}
    for idx, (sec, pg) in enumerate(starts):
        # Mở rộng đến trang chuyển tiếp (inclusive), không trừ 1
        next_pg = starts[idx+1][1] if idx + 1 < len(starts) else doc.page_count
        sec_ranges[sec] = (pg, next_pg)

    # Pre-compute char offset sau header trên trang bắt đầu của mỗi phần
    header_end_offsets = {}  # (sec, page_idx) -> char offset
    if section_header_page:
        for sec, hdr_pg in section_header_page.items():
            roman = sec.replace("PHẦN ", "").strip()
            m = re.search(rf"PHẦN\s+{re.escape(roman)}\b", doc[hdr_pg].get_text())
            if m:
                header_end_offsets[(sec, hdr_pg)] = m.end()

    q_starts = {}
    q_re = re.compile(r"Câu\s+(\d+)[\.\s]")
    all_texts = [doc[i].get_text() for i in range(doc.page_count)]

    for sec, (start_pg, end_pg) in sec_ranges.items():
        seen_nums = set()
        for pg in range(start_pg, min(end_pg + 1, doc.page_count)):
            page_text = all_texts[pg]
            # Trang bắt đầu: chỉ quét SAU header để tránh nhầm câu của phần trước
            if pg == start_pg:
                offset = header_end_offsets.get((sec, pg), 0)
                page_text = page_text[offset:]
            for m in q_re.finditer(page_text):
                num = int(m.group(1))
                if num not in seen_nums:
                    seen_nums.add(num)
                    if (sec, num) not in q_starts:
                        q_starts[(sec, num)] = pg

    return q_starts


def auto_detect_section_counts(doc: fitz.Document, section_q_start_page: dict,
                                section_header_page: dict = None) -> dict:
    """
    Quét PDF để tự động phát hiện số câu thực tế trong mỗi phần.
    Áp dụng cùng offset fix như scan_question_starts để tránh đếm nhầm
    câu của phần trước trên trang chuyển tiếp.
    Trả về dict: section -> max_question_number.
    """
    q_re = re.compile(r"Câu\s+(\d+)[\.\s]")
    starts = sorted(section_q_start_page.items(), key=lambda x: x[1])

    # Pre-compute header offsets
    header_end_offsets = {}
    if section_header_page:
        for sec, hdr_pg in section_header_page.items():
            roman = sec.replace("PHẦN ", "").strip()
            m = re.search(rf"PHẦN\s+{re.escape(roman)}\b", doc[hdr_pg].get_text())
            if m:
                header_end_offsets[(sec, hdr_pg)] = m.end()

    counts = {}
    for idx, (sec, pg) in enumerate(starts):
        # Mở rộng đến trang chuyển tiếp để đếm đủ câu hỏi
        next_pg = starts[idx + 1][1] if idx + 1 < len(starts) else doc.page_count
        max_q = 0
        for i in range(pg, next_pg + 1):
            if i >= doc.page_count:
                break
            text = doc[i].get_text()
            if i == pg:
                offset = header_end_offsets.get((sec, pg), 0)
                text = text[offset:]
            for m in q_re.finditer(text):
                num = int(m.group(1))
                if num > max_q:
                    max_q = num
        hardcoded = SECTION_POINTS.get(sec, {}).get("count", 12)
        counts[sec] = max(max_q, hardcoded) if max_q > 0 else hardcoded

    return counts


def build_section_context(page_idx: int, active_sections: list,
                          section_header_page: dict, q_starts: dict,
                          detected_sections: dict = None) -> str:
    """Tạo context string cho prompt với số câu cụ thể trên trang này.
    detected_sections: thông tin phần được phát hiện tự động từ scan_pdf_layout.
    """
    lines = []
    for sec in active_sections:
        qs_on_page = sorted(
            [q for (s, q), pg in q_starts.items() if s == sec and pg == page_idx]
        )
        qs_started_before = sorted(
            [q for (s, q), pg in q_starts.items() if s == sec and pg < page_idx]
        )
        continuing = None
        if qs_started_before:
            last_before = max(qs_started_before)
            next_q = last_before + 1
            # Tiếp tục nếu câu kế tiếp chưa xuất hiện, hoặc bắt đầu từ trang này trở đi
            # (câu trước có thể có nội dung ở đầu trang này trước khi câu kế bắt đầu)
            if (sec, next_q) not in q_starts or q_starts[(sec, next_q)] >= page_idx:
                continuing = last_before

        # Dùng mô tả từ detected_sections nếu có, fallback về SECTION_DESCS
        if detected_sections and sec in detected_sections:
            desc = detected_sections[sec]["description"]
        else:
            desc = SECTION_DESCS.get(sec, "")

        if qs_on_page and continuing:
            lines.append(f"{sec} ({desc}): Phần tiếp theo của Câu {continuing} + mới bắt đầu Câu {', '.join(map(str, qs_on_page))}")
        elif qs_on_page:
            lines.append(f"{sec} ({desc}): Câu {', '.join(map(str, qs_on_page))} bắt đầu trên trang này")
        elif continuing:
            lines.append(f"{sec} ({desc}): Chỉ có phần tiếp theo của Câu {continuing} (câu chưa kết thúc ở trang trước)")
        else:
            lines.append(f"{sec} ({desc})")

    if len(lines) == 1:
        return lines[0]
    return "Trang này chứa:\n" + "\n".join(f"  - {l}" for l in lines)


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

PROMPT_TEMPLATE = """Đây là trang {page_num} của đề thi toán THPT Việt Nam.
{section_context}
{prev_context}

Trang này có {num_figures} hình vẽ, đánh số từ trên xuống dưới: 1, 2, ... {num_figures}.

BẮT BUỘC — LATEX: Mọi ký hiệu toán học phải trong $...$. Ví dụ đúng/sai:
✓ $M(-500;\\,300;\\,500)$   ✗ "M   500; 300;500"
✓ $f(x)=\\frac{{2x+1}}{{x}}$  ✗ "f x = 2x+1/x"
✓ $\\int f(x)\\,dx=2x+\\ln|x|+C$  ✗ "f x dx 2 ln x C"
✓ $F(1)=3$, $G(5)+G'(5)=0$  ✗ "F 1 = 3", "G G 5 5 0"
✓ $a+b+c+d=19$  ✗ "a b c d   19"
Biến đơn lẻ cũng cần dấu $: $a$, $x$, $n$ — không để trần.

Trích xuất TẤT CẢ câu hỏi. Trả về CHỈ JSON, không có text nào khác:

{{
  "questions": [
    {{
      "section": "PHẦN I",
      "question_number": 1,
      "question_text": "nội dung câu hỏi, dùng LaTeX $...$ cho công thức toán",
      "choices": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "sub_questions": [
        {{"label": "a", "text": "...", "correct_answer": true}},
        {{"label": "b", "text": "...", "correct_answer": false}},
        {{"label": "c", "text": "...", "correct_answer": true}},
        {{"label": "d", "text": "...", "correct_answer": false}}
      ],
      "answer": "A",
      "figure_index": 0,
      "points": 0.25
    }}
  ]
}}

Lưu ý bắt buộc:
- "figure_index": PHẦN LỚN câu hỏi KHÔNG có hình → đặt 0. Chỉ đặt > 0 khi câu đó CÓ biểu đồ/đồ thị/hình vẽ riêng (nằm ngay dưới nội dung câu đó, trước đáp án). Đây là VỊ TRÍ (1 = hình cao nhất trang, 2 = hình thứ 2...), KHÔNG phải số câu. Mỗi hình chỉ thuộc 1 câu.
- "choices" chỉ có ở PHẦN I (bỏ qua ở PHẦN II và III)
- "sub_questions" chỉ có ở PHẦN II (4 ý a-b-c-d); correct_answer = true/false/null
- "answer" ở PHẦN I = "A"/"B"/"C"/"D"; ở PHẦN III = đáp số; ở PHẦN II bỏ field này
- "points": PHẦN I = 0.25 | PHẦN II = 1.0 (tối đa) | PHẦN III = 0.5
- KHÔNG trích xuất dòng tiêu đề phần như "PHẦN II. (4,0 điểm)..."
- DỪNG khi gặp mốc "ĐÁP ÁN", "HƯỚNG DẪN", "LỜI GIẢI" hoặc "----- HẾT -----": phần SAU các mốc này là đáp án/lời giải, KHÔNG phải câu hỏi — tuyệt đối không trích thành câu hỏi (kể cả bảng "Câu 1 2 3... Đáp án B D A...").
- Nếu không có câu hỏi nào, trả về: {{"questions": []}}
"""


# ---------------------------------------------------------------------------
# Core extraction
# ---------------------------------------------------------------------------

def repair_truncated_json(raw: str) -> str:
    """Cố gắng đóng các dấu ngoặc bị thiếu do response bị cắt ngang."""
    # Xoá comment JSON (// ...) nếu có
    raw = re.sub(r"//[^\n]*", "", raw)

    # Đếm mức độ lồng nhau
    stack = []
    in_string = False
    escape_next = False
    result = list(raw)

    for ch in raw:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ('{', '['):
            stack.append('}' if ch == '{' else ']')
        elif ch in ('}', ']'):
            if stack and stack[-1] == ch:
                stack.pop()

    # Đóng các dấu còn mở
    closing = "".join(reversed(stack))
    return raw.rstrip().rstrip(',') + closing


def sanitize_json_escapes(raw: str) -> str:
    """
    Fix invalid JSON escape sequences trong string values.
    LaTeX dùng \\command (single backslash) → trong JSON phải là \\\\command.
    Model hay output \\command trực tiếp (invalid JSON escape) → double it.
    Giữ nguyên: \\" \\\\ \\/ \\n \\r \\t \\uXXXX (valid JSON escapes).
    """
    # Always-safe JSON single-char escapes (these letters never start a LaTeX command)
    KEEP_ALWAYS = set('"\\/ nrt')   # \" \\ \/ \n \r \t — keep unconditionally
    # \b and \f are valid JSON escapes BUT clash with common LaTeX commands:
    # \beta \binom \bmod  vs  \frac \flat \forall \floor …
    # Strategy: keep as JSON escape only when NOT followed by a letter.
    KEEP_IF_NOT_ALPHA = set('bf')
    result = []
    i = 0
    in_str = False

    while i < len(raw):
        ch = raw[i]
        if not in_str:
            result.append(ch)
            if ch == '"':
                in_str = True
            i += 1
        else:
            if ch == '\\':
                nxt = raw[i + 1] if i + 1 < len(raw) else ''
                if nxt in KEEP_ALWAYS:
                    # \" \\ \/ \n \r \t — always keep as JSON escape
                    result.append(ch)
                    result.append(nxt)
                    i += 2
                elif nxt in KEEP_IF_NOT_ALPHA:
                    # \b \f: keep as JSON escape only when the next char is not a letter
                    lookahead = raw[i + 2] if i + 2 < len(raw) else ''
                    if lookahead.isalpha():
                        # LaTeX: \frac \flat \forall \beta \binom \bmod → double backslash
                        result.append('\\\\')
                        i += 1  # nxt processed in next iteration
                    else:
                        # Genuine JSON form-feed / backspace
                        result.append(ch)
                        result.append(nxt)
                        i += 2
                elif nxt == 'u' and i + 5 < len(raw) and all(c in '0123456789abcdefABCDEF' for c in raw[i+2:i+6]):
                    # \uXXXX — valid unicode escape
                    result.append(raw[i:i+6])
                    i += 6
                else:
                    # Invalid escape (LaTeX command như \frac, \sqrt, \Delta…)
                    # Double the backslash so it becomes a literal backslash in JSON
                    result.append('\\\\')
                    i += 1  # keep nxt to be processed next iteration
            elif ch == '"':
                result.append(ch)
                in_str = False
                i += 1
            else:
                result.append(ch)
                i += 1

    return ''.join(result)


def extract_json_from_text(text: str) -> str:
    """Tìm, lấy và làm sạch JSON object đầu tiên trong text."""
    # Bỏ code fence markdown
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    # Bỏ qua markdown/text thừa ở đầu
    if not text.lstrip().startswith("{"):
        match = re.search(r"\{", text)
        if match:
            text = text[match.start():]
    text = text.lstrip()
    # Fix invalid LaTeX backslash escapes
    text = sanitize_json_escapes(text)
    return text


def call_groq_vision(client: Groq, img_b64: str, prompt: str,
                     max_tokens: int = MAX_TOKENS_DEFAULT,
                     fallback_clients: list = None) -> str:
    """
    Gọi GROQ Vision API với retry khi gặp rate limit.
    Nếu có fallback_clients, tự động chuyển sang key tiếp theo khi hết quota.
    """
    all_clients = [client] + (fallback_clients or [])
    client_idx = 0

    for attempt in range(len(all_clients) * 2):  # mỗi key thử tối đa 2 lần
        cur_client = all_clients[client_idx % len(all_clients)]
        try:
            response = cur_client.chat.completions.create(
                model=VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.1,
                reasoning_effort="none",
            )
            raw = response.choices[0].message.content.strip()
            return extract_json_from_text(raw)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate_limit" in err_str.lower():
                # Thử fallback key ngay nếu có
                if client_idx + 1 < len(all_clients):
                    client_idx += 1
                    print(f"\n  [RATE LIMIT] Chuyển sang key {client_idx+1} ...", end=" ", flush=True)
                    continue
                # Không còn fallback → chờ, tối đa 90 giây
                wait_match = re.search(r"try again in (\d+)m([\d.]+)s", err_str)
                raw_wait = int(wait_match.group(1)) * 60 + float(wait_match.group(2)) + 5 if wait_match else 65
                wait_secs = min(raw_wait, 90)
                print(f"\n  [RATE LIMIT] Tất cả keys hết quota. Chờ {wait_secs:.0f}s ...", end=" ", flush=True)
                time.sleep(wait_secs)
                client_idx = 0  # reset về key đầu
                continue
            raise
    raise RuntimeError("Rate limit: đã thử tất cả keys và chờ, vẫn thất bại.")


def extract_page(client: Groq, page: fitz.Page, page_num: int,
                 section_context: str, last_q_per_section: dict,
                 page_images: list = None,
                 fallback_clients: list = None) -> list:
    """
    page_images: list dict từ extract_embedded_images (đã sorted theo y0).
    GROQ trả về figure_index (1-based), ta dùng để map đúng ảnh.
    """
    img_b64 = page_to_base64(page)
    num_figures = len(page_images) if page_images else 0

    if last_q_per_section:
        prev_lines = ["Câu hỏi đã trích xuất từ các trang trước (không trích lại):"]
        for sec, num in sorted(last_q_per_section.items()):
            prev_lines.append(f"  - {sec}: đã có đến Câu {num}")
        prev_lines.append("Chỉ trích xuất câu hỏi MỚI (câu tiếp theo sau số trên), hoặc phần còn lại của câu đang dở dang.")
        prev_context = "\n".join(prev_lines)
    else:
        prev_context = ""

    prompt = PROMPT_TEMPLATE.format(
        page_num=page_num,
        section_context=section_context,
        prev_context=prev_context,
        num_figures=num_figures,
    )
    fb = fallback_clients or []
    raw = call_groq_vision(client, img_b64, prompt, MAX_TOKENS_DEFAULT, fb)

    # Thử parse trực tiếp
    try:
        data = json.loads(raw)
        return data.get("questions", [])
    except json.JSONDecodeError:
        pass

    # Thử repair JSON bị truncate
    repaired = repair_truncated_json(raw)
    try:
        data = json.loads(repaired)
        print(f"(repaired) ", end="")
        return data.get("questions", [])
    except json.JSONDecodeError:
        pass

    # Thử lại với max_tokens cao hơn và prompt ngắn gọn hơn
    short_prompt = prompt + "\nQUAN TRỌNG: Viết CỰC NGẮN GỌN cho công thức toán, không giải thích thêm."
    raw2 = call_groq_vision(client, img_b64, short_prompt, MAX_TOKENS_RETRY, fb)
    try:
        data = json.loads(raw2)
        print(f"(retry) ", end="")
        return data.get("questions", [])
    except json.JSONDecodeError:
        repaired2 = repair_truncated_json(raw2)
        try:
            data = json.loads(repaired2)
            print(f"(retry+repair) ", end="")
            return data.get("questions", [])
        except json.JSONDecodeError:
            pass

    print(f"\n  [WARN] Trang {page_num}: không parse được JSON sau 2 lần thử.")
    print(f"  Raw (400 ký tự cuối): ...{raw[-400:]}")
    return []


# ---------------------------------------------------------------------------
# Answer key (ĐÁP ÁN) detection & extraction
# ---------------------------------------------------------------------------

# Header cụm từ CHỈ xuất hiện ở phần đáp án (không nhầm với hướng dẫn "chọn đáp án đúng")
_AK_STRONG_RE = re.compile(
    r"BẢNG\s*ĐÁP\s*ÁN"
    r"|ĐÁP\s*ÁN\s*(?:CHI\s*TIẾT|THAM\s*KHẢO|ĐỀ|VÀ)"
    r"|HƯỚNG\s*DẪN\s*(?:CHẤM|GIẢI)"
    r"|LỜI\s*GIẢI\s*(?:CHI\s*TIẾT|ĐỀ)",
    re.IGNORECASE,
)
# Fallback: dòng chỉ có "ĐÁP ÁN" (neo đầu dòng → tránh khớp câu hướng dẫn giữa dòng)
_AK_WEAK_RE = re.compile(r"(?m)^\s*(?:BẢNG\s+)?ĐÁP\s+ÁN\b", re.IGNORECASE)


def find_answer_key_page(doc: fitz.Document) -> int:
    """Tìm trang bắt đầu phần ĐÁP ÁN/HƯỚNG DẪN CHẤM. Trả về page_idx (0-indexed) hoặc -1.

    Ưu tiên header rõ ràng ở bất kỳ trang nào; nếu không có thì tìm dòng "ĐÁP ÁN"
    đứng riêng ở NỬA SAU tài liệu (tránh nhầm với chỉ dẫn "chọn 1 đáp án đúng" ở trang đầu).
    """
    for i in range(doc.page_count):
        if _AK_STRONG_RE.search(doc[i].get_text()):
            return i
    start = max(1, (doc.page_count + 1) // 2)
    for i in range(start, doc.page_count):
        if _AK_WEAK_RE.search(doc[i].get_text()):
            return i
    return -1


ANSWER_PROMPT_MATH = """Đây là trang {page_num} thuộc phần ĐÁP ÁN / HƯỚNG DẪN CHẤM của đề thi toán THPT Việt Nam.
Nhiệm vụ: đọc và trích xuất TẤT CẢ đáp án ĐÚNG có trên trang này. Trả về CHỈ JSON, không giải thích:

{{
  "phan_1": {{"1": "A", "2": "C"}},
  "phan_2": {{"1": {{"a": true, "b": false, "c": true, "d": false}}}},
  "phan_3": {{"1": "5", "2": "3,14"}}
}}

Quy tắc BẮT BUỘC:
- CHỈ đưa vào JSON những câu THỰC SỰ có đáp án nhìn thấy trên trang. Phần nào không có → object rỗng {{}}.
- Khóa là SỐ CÂU trong phần đó (bắt đầu lại từ 1 ở mỗi phần).
- phan_1 (Trắc nghiệm A/B/C/D): giá trị là một chữ cái "A"/"B"/"C"/"D". Bảng dạng "1.A 2.B" hay "Câu 1: A" → lấy đúng chữ cái.
- phan_2 (Đúng/Sai, 4 ý a-b-c-d): mỗi ý là true nếu ĐÚNG (Đ/T/Đúng), false nếu SAI (S/F/Sai). Bỏ ý nào không thấy.
- phan_3 (Trả lời ngắn): giữ nguyên đáp số dạng chuỗi (phân số/số thập phân giữ nguyên; công thức dùng LaTeX $...$).
- TUYỆT ĐỐI KHÔNG bịa đáp án. Nếu trang không có đáp án nào: {{"phan_1": {{}}, "phan_2": {{}}, "phan_3": {{}}}}.
"""


def _coerce_answer_bool(val) -> bool | None:
    """Chuẩn hóa giá trị Đúng/Sai từ đáp án về bool. Trả None nếu không xác định."""
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    s = str(val).strip().lower()
    if s in ("true", "đ", "d", "t", "đúng", "dung", "1", "yes", "x"):
        return True
    if s in ("false", "s", "f", "sai", "0", "no"):
        return False
    return None


def _answer_key_num(raw) -> int | None:
    m = re.search(r"\d+", str(raw))
    return int(m.group()) if m else None


def extract_math_answers_from_page(client: Groq, page: fitz.Page, page_num: int,
                                   fallback_clients: list = None) -> dict:
    """Trích đáp án từ MỘT trang đáp án. Dùng Vision (bảng đáp án thường có highlight/layout phức tạp).

    Trả về dict keyed theo LOẠI phần:
      {"multiple_choice": {num: "A"}, "true_false": {num: {"a": bool,...}}, "short_answer": {num: "val"}}
    """
    out = {"multiple_choice": {}, "true_false": {}, "short_answer": {}}
    img_b64 = page_to_base64(page)
    prompt = ANSWER_PROMPT_MATH.format(page_num=page_num)
    try:
        raw = call_groq_vision(client, img_b64, prompt, MAX_TOKENS_DEFAULT, fallback_clients or [])
        data = json.loads(raw)
    except Exception:
        try:
            data = json.loads(repair_truncated_json(raw))
        except Exception:
            return out
    if not isinstance(data, dict):
        return out

    for k, v in (data.get("phan_1") or {}).items():
        num = _answer_key_num(k)
        letter = str(v).strip().upper()[:1] if v is not None else ""
        if num is not None and letter in ("A", "B", "C", "D"):
            out["multiple_choice"][num] = letter

    for k, v in (data.get("phan_2") or {}).items():
        num = _answer_key_num(k)
        if num is None or not isinstance(v, dict):
            continue
        subs = {}
        for lbl, sval in v.items():
            lbl2 = str(lbl).strip().lower()[:1]
            b = _coerce_answer_bool(sval)
            if lbl2 in ("a", "b", "c", "d") and b is not None:
                subs[lbl2] = b
        if subs:
            out["true_false"][num] = subs

    for k, v in (data.get("phan_3") or {}).items():
        num = _answer_key_num(k)
        sval = str(v).strip() if v is not None else ""
        if num is not None and sval:
            out["short_answer"][num] = sval

    return out


def run(pdf_path: Path, out_path: Path, start_page: int = 1) -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    keys = load_api_keys()
    client = Groq(api_key=keys[0])
    fallback_clients = [Groq(api_key=k) for k in keys[1:]]

    doc = fitz.open(pdf_path)
    print(f"PDF: {pdf_path.name}  ({doc.page_count} trang)")

    section_header_page, section_q_start_page, page_active_sections, detected_sections = scan_pdf_layout(doc)
    q_starts = scan_question_starts(doc, section_q_start_page, section_header_page)
    detected_counts = auto_detect_section_counts(doc, section_q_start_page, section_header_page)

    print("Header phần ở trang:", {k: v+1 for k, v in section_header_page.items()})
    print("Câu hỏi bắt đầu ở trang:", {k: v+1 for k, v in section_q_start_page.items()})
    print("Số câu phát hiện được:", detected_counts)
    # Debug: show which questions start on which pages
    for pg in range(doc.page_count):
        qs = [(s, q) for (s, q), p in q_starts.items() if p == pg]
        if qs:
            qs_str = ", ".join(f"{s} Câu {q}" for s, q in sorted(qs, key=lambda x: (x[0], x[1])))
            print(f"  Trang {pg+1}: {qs_str}")

    # Load kết quả đã có (nếu resume từ giữa chừng)
    all_questions = []
    if start_page > 1 and out_path.exists():
        try:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
            for sec_data in existing.get("sections", {}).values():
                all_questions.extend(sec_data.get("questions", []))
            print(f"Đã load {len(all_questions)} câu hỏi từ file trước, tiếp tục từ trang {start_page}")
        except Exception:
            pass

    last_q_per_section: dict = {}  # sec -> last question_number extracted
    # Khởi tạo last_q từ all_questions đã load
    for q in all_questions:
        sec = q.get("section", "")
        num = q.get("question_number", 0)
        if sec and isinstance(num, int) and num > last_q_per_section.get(sec, 0):
            last_q_per_section[sec] = num

    for i in range(doc.page_count):
        if i + 1 < start_page:
            continue
        active = page_active_sections[i]
        section_ctx = build_section_context(i, active, section_header_page, q_starts, detected_sections)
        label = " + ".join(active)
        print(f"Trang {i+1}/{doc.page_count}  [{label}]  ...", end=" ", flush=True)

        page_images = extract_embedded_images(doc, i, IMAGES_DIR)
        # GROQ chỉ biết đến content images (không tính logo/header)
        content_images = [img for img in page_images if img["is_content"]]

        questions = extract_page(client, doc[i], i + 1, section_ctx,
                                   dict(last_q_per_section),
                                   page_images=content_images,
                                   fallback_clients=fallback_clients)

        for q in questions:
            fig_idx = q.pop("figure_index", 0)  # 1-based trong content_images
            if isinstance(fig_idx, int) and 1 <= fig_idx <= len(content_images):
                q["figure_path"] = content_images[fig_idx - 1]["path"]
            q["has_figure"] = "figure_path" in q
            # Cập nhật last_q tracker
            sec = q.get("section", "")
            num = q.get("question_number", 0)
            if sec and isinstance(num, int):
                if num > last_q_per_section.get(sec, 0):
                    last_q_per_section[sec] = num

        all_questions.extend(questions)
        print(f"{len(questions)} câu")

        # Lưu trung gian sau mỗi trang (để resume nếu bị lỗi)
        _save_result(all_questions, pdf_path, out_path, partial=True,
                 detected_counts=detected_counts, detected_sections=detected_sections)

    _save_result(all_questions, pdf_path, out_path, partial=False,
                 detected_counts=detected_counts, detected_sections=detected_sections)


def _save_result(all_questions: list, pdf_path: Path, out_path: Path,
                  partial: bool = False, detected_counts: dict = None,
                  detected_sections: dict = None) -> None:
    """
    detected_counts: dict section -> max_q_num từ auto_detect_section_counts.
    detected_sections: dict section -> {type, count, points_per_q, total, ...}
    Nếu None, dùng giới hạn cứng từ SECTION_POINTS.
    """
    # Deduplication: với mỗi (section, question_number), giữ lại bản CUỐI CÙNG
    deduped: dict = {}
    for q in all_questions:
        sec = q.get("section", "")
        num = q.get("question_number")
        if not sec or num is None:
            continue
        # Dùng count được phát hiện tự động, fallback về cứng, rồi 999
        if detected_counts and sec in detected_counts:
            max_num = detected_counts[sec]
        else:
            max_num = SECTION_POINTS.get(sec, {}).get("count", 999)
        if not isinstance(num, int) or num < 1 or num > max_num:
            continue
        deduped[(sec, num)] = q

    all_questions_clean = list(deduped.values())

    # Thu thập tất cả các section có trong kết quả (kể cả ngoài SECTION_POINTS)
    found_sections = sorted(set(q.get("section", "") for q in all_questions_clean if q.get("section")))
    all_sections = list(SECTION_POINTS.keys())
    for sec in found_sections:
        if sec not in all_sections:
            all_sections.append(sec)

    result = {
        "source": pdf_path.name,
        "total_questions": len(all_questions_clean),
        "partial": partial,
        "sections": {},
    }
    for sec in all_sections:
        # Ưu tiên thông tin phát hiện từ PDF, fallback về SECTION_POINTS
        if detected_sections and sec in detected_sections:
            info = {k: v for k, v in detected_sections[sec].items() if k != "description"}
        else:
            info = SECTION_POINTS.get(sec, {"type": "unknown", "points_per_q": 0, "total": 0})
        qs = sorted(
            [q for q in all_questions_clean if q.get("section") == sec],
            key=lambda q: q.get("question_number", 0)
        )
        result["sections"][sec] = {**info, "questions": qs}

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if not partial:
        print(f"\nTổng kết:")
        for sec in all_sections:
            qs = result["sections"][sec]["questions"]
            n = len(qs)
            expected = (detected_counts or {}).get(sec) or SECTION_POINTS.get(sec, {}).get("count", "?")
            nums = sorted(q.get("question_number", 0) for q in qs)
            status = "✓ OK" if n == expected else f"✗ {n}/{expected}"
            print(f"  {sec}: {n} câu [{status}] — số: {nums}")
        print(f"\nĐã lưu → {out_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Trích xuất câu hỏi từ đề thi PDF bằng GROQ Vision")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--start-page", type=int, default=1,
                        help="Bắt đầu từ trang số N (dùng để resume khi bị dừng giữa chừng)")
    args = parser.parse_args()
    run(args.pdf, args.out, start_page=args.start_page)


if __name__ == "__main__":
    main()

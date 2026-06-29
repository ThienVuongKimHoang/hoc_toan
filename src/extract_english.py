"""
Trích xuất câu hỏi đề thi Tiếng Anh THPT từ PDF.

Pipeline cho mỗi trang câu hỏi:
  1. Đọc text bằng PyMuPDF (fitz) — nhanh, không tốn quota Vision.
  2. Nếu text đủ chất lượng (>= MIN_TEXT_CHARS + có "Question N"):
       - Ảnh nhúng trong trang → mô tả từng ảnh bằng Groq Vision.
       - Ghép text + mô tả ảnh → gửi cho Groq text model để parse câu hỏi.
  3. Nếu text kém (PDF scan, < MIN_TEXT_CHARS):
       - Fallback: render trang thành ảnh → Groq Vision (pipeline cũ).
  4. Phần ĐÁP ÁN: luôn dùng Vision vì đáp án đúng được highlight trực quan.

Chạy: python3 extract_english.py [--pdf path/to/file.pdf] [--out output.json]
"""

import argparse
import base64
import json
import os
import re
import time
from pathlib import Path

import fitz
from dotenv import load_dotenv
from groq import Groq

from extract_questions import (
    MAX_TOKENS_DEFAULT,
    call_groq_vision,
    extract_json_from_text,
    page_to_base64,
    repair_truncated_json,
)

SRC_DIR = Path(__file__).parent
ROOT_DIR = SRC_DIR.parent
DEFAULT_PDF = SRC_DIR / "đề minh họa 1.pdf"
DEFAULT_OUT = SRC_DIR / "output" / "english_questions.json"
IMAGES_DIR  = SRC_DIR / "output" / "images"

ENGLISH_SECTION_NAME    = "TIẾNG ANH"
READING_SECTION_NAME    = "READING"
ENGLISH_POINTS_PER_Q    = 0.25
ENGLISH_TOTAL_QUESTIONS = 40

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TEXT_MODEL   = "llama-3.3-70b-versatile"
MIN_TEXT_CHARS = 150  # dưới ngưỡng này → coi là PDF scan, dùng Vision fallback

# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

def detect_exam_subject(doc: fitz.Document) -> str:
    """Trả về 'english' nếu phát hiện đề Tiếng Anh, ngược lại 'math'. Kiểm tra 3 trang đầu."""
    english_markers = [
        "TIẾNG ANH", "TIENG ANH", "MÔN: TIẾNG ANH",
        "MARK THE LETTER A, B, C, OR D",
        "QUESTION 1:", "QUESTION 2:",
    ]
    for i in range(min(3, doc.page_count)):
        text = doc[i].get_text().upper()
        if any(m in text for m in english_markers):
            return "english"
    return "math"


def find_answer_key_page(doc: fitz.Document) -> int:
    """Tìm trang bắt đầu phần ĐÁP ÁN. Trả về page_idx (0-indexed), hoặc -1."""
    ak_re = re.compile(r"ĐÁP\s+ÁN|DAP\s+AN|ANSWER\s+KEY", re.IGNORECASE)
    for i in range(doc.page_count):
        if ak_re.search(doc[i].get_text()):
            return i
    return -1


# ---------------------------------------------------------------------------
# Helpers: fitz quality check
# ---------------------------------------------------------------------------

def _is_text_sufficient(text: str) -> bool:
    """True nếu fitz trích được text đủ chất lượng, không cần Vision."""
    if len(text) < MIN_TEXT_CHARS:
        return False
    return bool(re.search(r"Question\s+\d+", text, re.IGNORECASE))


# ---------------------------------------------------------------------------
# Helpers: embedded image extraction & description
# ---------------------------------------------------------------------------

def _extract_page_content_images(
    doc: fitz.Document,
    page_idx: int,
    images_dir: Path,
    client: Groq,
    fallback_clients: list,
) -> list[dict]:
    """
    Trích xuất ảnh nội dung (bỏ qua header/footer/icon nhỏ) từ trang.
    Mô tả từng ảnh bằng Groq Vision.
    Trả về list sorted theo y-position (trên → dưới):
      [{"path": str, "description": str, "y0": float}, ...]
    """
    page = doc[page_idx]
    page_h = page.rect.height
    header_cutoff = page_h * 0.10
    footer_cutoff = page_h * 0.90
    MIN_PX = 60

    result = []
    seen_xrefs: set = set()

    for img_info in page.get_images(full=True):
        xref = img_info[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)

        rects = page.get_image_rects(xref)
        y0 = rects[0].y0 if rects else 0.0
        y1 = rects[0].y1 if rects else 0.0

        raw = doc.extract_image(xref)
        w, h = raw.get("width", 0), raw.get("height", 0)

        if not (y0 >= header_cutoff and y0 <= footer_cutoff and w >= MIN_PX and h >= MIN_PX):
            continue

        ext = raw["ext"].lower()
        fname = f"p{page_idx+1}_img{len(result)+1}.{ext}"
        if images_dir:
            images_dir.mkdir(parents=True, exist_ok=True)
            (images_dir / fname).write_bytes(raw["image"])

        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "webp": "image/webp"}.get(ext, "image/png")
        img_b64 = base64.b64encode(raw["image"]).decode()
        description = _describe_image(client, img_b64, mime, fallback_clients)

        result.append({"path": f"images/{fname}", "description": description, "y0": y0, "y1": y1})

    result.sort(key=lambda e: e["y0"])
    return result


def _describe_image(client: Groq, img_b64: str, mime: str, fallback_clients: list) -> str:
    """Dùng Groq Vision mô tả ngắn gọn một ảnh nhúng (1-2 câu)."""
    all_clients = [client] + (fallback_clients or [])
    prompt = (
        "This image is embedded in a Vietnamese THPT English exam PDF. "
        "Briefly describe what it shows (1-2 sentences). "
        "Focus on content type (advertisement, graph, chart, map, photo, etc.) "
        "and any visible key text, labels, or numbers."
    )
    for attempt in range(len(all_clients) * 2):
        cur = all_clients[attempt % len(all_clients)]
        try:
            resp = cur.chat.completions.create(
                model=VISION_MODEL,
                messages=[{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                    {"type": "text", "text": prompt},
                ]}],
                max_tokens=150,
                temperature=0.1,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            err = str(e)
            if "429" in err or "rate_limit" in err.lower():
                if attempt + 1 < len(all_clients):
                    continue
                time.sleep(65)
                continue
            return "[image]"
    return "[image]"


# ---------------------------------------------------------------------------
# Groq text-only call
# ---------------------------------------------------------------------------

def _call_groq_text(client: Groq, prompt: str,
                    max_tokens: int = MAX_TOKENS_DEFAULT,
                    fallback_clients: list = None) -> str:
    """Gọi Groq text-only model với fallback key khi rate limit."""
    all_clients = [client] + (fallback_clients or [])
    for attempt in range(len(all_clients) * 2):
        cur = all_clients[attempt % len(all_clients)]
        try:
            resp = cur.chat.completions.create(
                model=TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.1,
            )
            raw = resp.choices[0].message.content.strip()
            return extract_json_from_text(raw)
        except Exception as e:
            err = str(e)
            if "429" in err or "rate_limit" in err.lower():
                if attempt + 1 < len(all_clients):
                    print(f"\n  [RATE LIMIT text] Chuyển sang key {attempt+2}...", end=" ", flush=True)
                    continue
                wait_match = re.search(r"try again in (\d+)m([\d.]+)s", err)
                wait_secs = int(wait_match.group(1)) * 60 + float(wait_match.group(2)) + 5 if wait_match else 65
                print(f"\n  [RATE LIMIT text] Chờ {min(wait_secs, 90):.0f}s...", end=" ", flush=True)
                time.sleep(min(wait_secs, 90))
                continue
            raise
    raise RuntimeError("Rate limit: text model thất bại sau tất cả keys.")


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

QUESTION_TEXT_PROMPT = """\
This is page {page_num} of a Vietnamese THPT English exam (môn Tiếng Anh).
{prev_context}

Page text (extracted by PyMuPDF):
\"\"\"
{page_text}
\"\"\"
{image_section}
Extract ALL English exam questions on this page.
IMPORTANT: If you see "ĐÁP ÁN" or "THE END", STOP before that marker.

Rules:
- All questions are multiple-choice: options A, B, C, D.
- "question_number": integer after "Question" (e.g., Question 5 → 5).
- "question_text": the question stem. For pronunciation/stress questions, include all options inline.
- "passage_title": title of a reading/listening text ONLY for the FIRST question in a group. Null otherwise.
- "passage_text": full passage text ONLY for the first question in the group. Null otherwise.
  PRESERVE THE ORIGINAL LAYOUT: keep paragraph breaks as a blank line (\\n\\n) and put every
  bullet / list item on its own line starting with "• " (use \\n between lines). Keep the
  numbered blanks exactly as written (e.g. "(10) ______"). Do NOT collapse the passage into a
  single line.
- "choices": {{"A": "...", "B": "...", "C": "...", "D": "..."}}
- "answer": always null.
- "figure_index": 0 if the question has no image. If it references one of the images listed above, set to its 1-based position (1 = topmost image on page, etc.).
- Do NOT include section instruction lines like "Mark the letter A, B, C, or D...".
- If no questions found, return {{"questions": []}}.

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question_number": 1,
      "question_text": "...",
      "passage_title": null,
      "passage_text": null,
      "choices": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "answer": null,
      "figure_index": 0
    }}
  ]
}}"""


QUESTION_VISION_PROMPT = """\
This is page {page_num} of a Vietnamese THPT English exam (môn Tiếng Anh).
{prev_context}

Extract ALL English exam questions visible on this page.
IMPORTANT: If you see "ĐÁP ÁN" or "THE END" on this page, STOP extracting questions before that marker.

Rules:
- All questions are multiple-choice: 4 options A, B, C, D.
- "question_number": the integer after "Question" (e.g., Question 5 → 5).
- "question_text": the question stem. For pronunciation/stress questions, this is the full line.
- "passage_title": title of a reading text ONLY for the FIRST question in a group. Null otherwise.
- "passage_text": full text of a reading passage ONLY for the FIRST question in the group. Null otherwise.
  PRESERVE THE ORIGINAL LAYOUT: keep paragraph breaks as a blank line (\\n\\n) and put every
  bullet / list item on its own line starting with "• " (use \\n between lines). Keep the
  numbered blanks exactly as written (e.g. "(10) ______"). Do NOT collapse the passage into a
  single line.
- "choices": always {{"A": "...", "B": "...", "C": "...", "D": "..."}}
- "answer": always null here.
- "figure_index": 0 if no image. Set to 1-based position of the image on this page if question has a figure.
- Do NOT extract section instruction lines like "Mark the letter A, B, C, or D on your answer sheet to indicate...".
- If no questions found, return {{"questions": []}}.

Return ONLY valid JSON, no other text:
{{
  "questions": [
    {{
      "question_number": 1,
      "question_text": "...",
      "passage_title": null,
      "passage_text": null,
      "choices": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "answer": null,
      "figure_index": 0
    }}
  ]
}}"""


ANSWER_PROMPT = """\
This is page {page_num} of the ANSWER KEY (ĐÁP ÁN) section of a Vietnamese THPT English exam.

In this section, the CORRECT answer for each question is visually distinguished from the wrong answers.
It may be: bold text, underlined, boxed, printed in a different color, or otherwise emphasized/highlighted.

Carefully look at the visual styling of each answer option (A, B, C, D) for every question on this page.
Identify which option is the CORRECT answer (visually marked).

Return ONLY valid JSON, no other text:
{{
  "answers": {{
    "1": "B",
    "5": "A",
    "10": "D"
  }}
}}

Rules:
- Keys are question numbers as strings.
- Values are the correct letter: "A", "B", "C", or "D".
- Only include questions where you can clearly identify the correct answer.
- Omit questions where you are unsure.
- If no questions visible, return: {{"answers": {{}}}}"""


# ---------------------------------------------------------------------------
# JSON parsing helpers
# ---------------------------------------------------------------------------

def _parse_response(raw: str, key: str):
    """Parse JSON từ response AI, có fallback repair."""
    default = [] if key == "questions" else {}

    def _clean(text):
        text = re.sub(r"^```(?:json)?\s*", "", text.strip())
        text = re.sub(r"\s*```$", "", text)
        if not text.lstrip().startswith("{"):
            m = re.search(r"\{", text)
            if m:
                text = text[m.start():]
        return text.lstrip()

    cleaned = _clean(raw)
    try:
        return json.loads(cleaned).get(key, default)
    except json.JSONDecodeError:
        pass

    repaired = repair_truncated_json(cleaned)
    try:
        return json.loads(repaired).get(key, default)
    except json.JSONDecodeError:
        return default


# ---------------------------------------------------------------------------
# Khôi phục cấu trúc đoạn văn (xuống dòng) để dễ đọc
# ---------------------------------------------------------------------------

# Các từ mở đầu đoạn thường gặp trong bài đọc THPT → tách đoạn mới
_PARA_CUES = (
    "Firstly", "Secondly", "Thirdly", "Fourthly", "Finally",
    "Additionally", "Moreover", "Furthermore", "However",
    "In conclusion", "In addition", "On the other hand", "Therefore",
)
_PARA_RE = re.compile(
    r"(?<=[.!?\"”])\s+(?=(?:" + "|".join(_PARA_CUES) + r")\b)"
)


def _format_passage_text(text: str) -> str:
    """
    Khôi phục cấu trúc gốc của đoạn văn để dễ đọc:
      - Mỗi gạch đầu dòng "•" nằm trên một dòng riêng.
      - Tách đoạn mới trước các từ chuyển đoạn (Firstly, Secondly, However...).
    Nếu đoạn văn (sau khi model trích) đã có sẵn xuống dòng thì giữ nguyên.
    """
    if not text or not text.strip():
        return text
    # Đã có cấu trúc xuống dòng (model hoặc người dùng) → chỉ chuẩn hoá nhẹ.
    if "\n" in text or "<br" in text.lower() or "<div" in text.lower():
        return text

    t = re.sub(r"[ \t]+", " ", text).strip()

    # Mỗi bullet "•" xuống dòng riêng.
    if "•" in t:
        t = re.sub(r"\s*•\s*", "\n• ", t).strip()
        return t

    # Văn xuôi: tách đoạn trước các từ chuyển đoạn (giúp dễ đọc, đúng bố cục gốc).
    t = _PARA_RE.sub("\n\n", t)
    return t


# ---------------------------------------------------------------------------
# Phân loại phần: Trắc nghiệm rời  vs  Bài đọc (Reading)
# ---------------------------------------------------------------------------

READING_DETECT_PROMPT = """\
You are analyzing the questions of a Vietnamese THPT English exam (môn Tiếng Anh).
Below is the ordered list of questions. A line tagged [PASSAGE START: "..."] means a
shared reading text / cloze-test passage begins at that question.

{listing}

TASK: Identify the READING groups. A reading group is a set of consecutive questions that
all refer to the SAME shared text. This covers:
  - Cloze test (điền từ vào đoạn văn): one passage with several numbered blanks.
  - Reading comprehension (đọc hiểu): a passage followed by questions about it.

Standalone questions are NOT reading groups, e.g. pronunciation, stress, word choice,
grammar, sentence transformation/combination, communication, error identification.

Rules:
- Each reading group begins at a question tagged [PASSAGE START].
- A group = its anchor question + all following CONSECUTIVE questions about that same text,
  up to (but excluding) the next [PASSAGE START] or the next standalone question.
- "anchor" = the question number where the passage begins.
- Only include questions that genuinely share one reading text.

Return ONLY valid JSON, no other text:
{{
  "reading_groups": [
    {{"anchor": 25, "questions": [25, 26, 27, 28, 29]}},
    {{"anchor": 30, "questions": [30, 31, 32, 33, 34, 35]}}
  ]
}}
If there are no reading passages at all, return {{"reading_groups": []}}."""


def _detect_reading_groups(client: Groq, questions: list, fallback_clients: list = None):
    """
    Dùng Groq phân loại câu hỏi Tiếng Anh thành các nhóm bài đọc (reading).

    Trả về:
      - list các nhóm [{"anchor": int, "questions": [int, ...]}, ...] nếu thành công.
      - None nếu gọi Groq / parse thất bại (caller dùng phương án dự phòng).
    """
    if not questions:
        return []

    lines = []
    for q in questions:
        num   = q.get("question_number")
        stem  = (q.get("question_text") or "").replace("\n", " ").strip()[:110]
        title = (q.get("passage_title") or "").strip()[:60]
        tag   = f' [PASSAGE START: "{title}"]' if q.get("passage_text") else ""
        lines.append(f"Q{num}{tag}: {stem}")

    prompt = READING_DETECT_PROMPT.format(listing="\n".join(lines))
    try:
        raw = _call_groq_text(client, prompt, 1500, fallback_clients)
    except Exception:
        return None

    groups_raw = _parse_response(raw, "reading_groups")
    if not isinstance(groups_raw, list):
        return None

    valid_nums = {q.get("question_number") for q in questions}
    out = []
    for g in groups_raw:
        try:
            nums = sorted({int(x) for x in g.get("questions", []) if int(x) in valid_nums})
        except (ValueError, TypeError):
            continue
        if not nums:
            continue
        anchor = g.get("anchor")
        anchor = int(anchor) if isinstance(anchor, (int, str)) and str(anchor).isdigit() else nums[0]
        out.append({"anchor": anchor, "questions": nums})
    return out


def _fallback_reading_groups(questions: list) -> list:
    """
    Phương án dự phòng (không gọi Groq): gom nhóm theo passage_text đã trích.
    Mỗi câu có passage_text mở một nhóm; các câu phía sau (đến anchor kế tiếp) thuộc nhóm đó.
    """
    anchors = sorted(
        q.get("question_number") for q in questions
        if q.get("passage_text") and isinstance(q.get("question_number"), int)
    )
    if not anchors:
        return []
    nums = sorted(
        q.get("question_number") for q in questions
        if isinstance(q.get("question_number"), int)
    )
    groups = []
    for i, a in enumerate(anchors):
        nxt = anchors[i + 1] if i + 1 < len(anchors) else None
        grp = [n for n in nums if n >= a and (nxt is None or n < nxt)]
        groups.append({"anchor": a, "questions": grp})
    return groups


READING_PARSE_PROMPT = """\
You are parsing the READING parts of a Vietnamese THPT English exam (môn Tiếng Anh).
Below is the full text of the exam (questions section only) and the list of question
numbers that have already been extracted.

QUESTION NUMBERS PRESENT: {qnums}

FULL EXAM TEXT:
\"\"\"
{full_text}
\"\"\"

TASK: Find EVERY reading passage. There are two kinds:
  - Cloze / gap-fill (điền từ): an ad, announcement, letter or passage containing numbered
    blanks like "(10) ______". Each blank is one question.
  - Reading comprehension (đọc hiểu): a passage followed by questions asking about it.

These are NOT reading passages (ignore them): pronunciation, primary stress, single-sentence
grammar / word-choice questions, sentence transformation or combination, communication /
conversation, error identification, and sentence-ordering (arrange a-b-c-d-e) questions.

For EACH reading passage, return an object with:
  - "title": ONLY a short real heading printed above the passage — usually a few words,
    often in ALL CAPS (e.g. "JOIN OUR CREATIVE WRITING WORKSHOP!"). If the passage simply
    starts with an ordinary sentence and has no heading, set "title" to null. NEVER use a
    full sentence from the passage, and NEVER use an answer option (A./B./C./D.) as the title.
  - "passage_text": the FULL, CLEAN passage, well structured:
      * Keep every numbered blank EXACTLY as "(10) ______".
      * Preserve the layout — separate paragraphs with a blank line, and put each bullet /
        list item on its OWN line starting with "• ".
      * Do NOT include: the title, the section instruction line ("Mark the letter A, B, C..."),
        the answer options (A./B./C./D.), or the word "Question N".
  - "questions": the list of question numbers (integers) that belong to this passage, in order.

Return ONLY valid JSON, no other text:
{{
  "passages": [
    {{"title": "JOIN OUR CREATIVE WRITING WORKSHOP!", "passage_text": "Do you have a passion...\\n• (10) ______ experience required\\n• ...", "questions": [10, 11, 12]}},
    {{"title": null, "passage_text": "Sylvia Earle is an underwater explorer...", "questions": [29, 30, 31, 32, 33]}}
  ]
}}
If there are no reading passages at all, return {{"passages": []}}."""


def _parse_reading_passages(client: Groq, full_text: str, questions: list,
                            fallback_clients: list = None):
    """
    Dùng Groq parse TOÀN BỘ phần bài đọc từ text gốc của đề (có đầy đủ ngữ cảnh):
    trả về danh sách passage kèm tiêu đề, nội dung đầy đủ (có cấu trúc) và các câu thuộc về nó.

    Trả về:
      - list [{"title": str|None, "passage_text": str|None, "questions": [int,...]}, ...]
      - None nếu gọi Groq / parse thất bại (caller dùng phương án dự phòng).
    """
    if not questions or not full_text or not full_text.strip():
        return None

    valid_nums = {q.get("question_number") for q in questions if isinstance(q.get("question_number"), int)}
    qnums = ", ".join(str(n) for n in sorted(valid_nums))
    text = full_text.strip()
    if len(text) > 14000:                      # giới hạn token đầu vào
        text = text[:14000]

    prompt = READING_PARSE_PROMPT.format(qnums=qnums, full_text=text)
    try:
        raw = _call_groq_text(client, prompt, 4096, fallback_clients)
    except Exception:
        return None

    passages_raw = _parse_response(raw, "passages")
    if not isinstance(passages_raw, list):
        return None

    out = []
    for p in passages_raw:
        if not isinstance(p, dict):
            continue
        try:
            nums = sorted({int(x) for x in p.get("questions", []) if int(x) in valid_nums})
        except (ValueError, TypeError):
            continue
        if not nums:
            continue
        ptext = p.get("passage_text")
        ptext = ptext.strip() if isinstance(ptext, str) and ptext.strip() else None

        title = p.get("title")
        title = title.strip() if isinstance(title, str) and title.strip() else None
        if title and not _is_valid_passage_title(title, ptext):
            title = None

        out.append({"title": title, "passage_text": ptext, "questions": nums})
    return out


def _is_valid_passage_title(title, passage_text):
    """Loại tiêu đề rác: câu đầy đủ, phương án trả lời, hoặc trùng đầu đoạn văn."""
    t = title.strip()
    if len(t) > 80:                                  # quá dài → là câu, không phải tiêu đề
        return False
    if re.match(r"^[A-D][.)]\s", t):                 # "A. ...", "B) ..." → phương án trả lời
        return False
    if t.endswith((".", "?", "!")) and " " in t and not t.isupper():
        return False                                 # câu hoàn chỉnh thường, không phải tiêu đề
    if passage_text:
        head = passage_text.lstrip()[:len(t)].strip().lower()
        if head and head == t.lower():               # trùng phần đầu đoạn văn
            return False
    return True


def split_english_sections(questions: list, client: Groq, fallback_clients: list = None,
                           raw_text: str = None) -> dict:
    """
    Chia danh sách câu hỏi Tiếng Anh thành (tối đa) 2 phần:
      - "TIẾNG ANH": trắc nghiệm rời (giữ nguyên cấu trúc cũ).
      - "READING":   các câu thuộc bài đọc, kèm `passage_group` để gom theo đoạn văn.

    Nếu có `raw_text` (text gốc của đề), ưu tiên cho Groq parse trọn vẹn các bài đọc
    (tiêu đề + nội dung đầy đủ có cấu trúc). Nếu không, lùi về phương án phát hiện nhóm
    dựa trên passage_text trích từng trang.

    Passage được giữ trên câu ĐẦU của mỗi nhóm (anchor), khớp với cách hiển thị phía client.
    """
    # group: {"questions": [int], "passage_text": str|None, "passage_title": str|None}
    groups: list[dict] = []

    parsed = _parse_reading_passages(client, raw_text, questions, fallback_clients) if raw_text else None
    if parsed:
        for p in parsed:
            groups.append({
                "questions":     p["questions"],
                "passage_text":  p.get("passage_text"),
                "passage_title": p.get("title"),
            })
    else:
        # Phương án dự phòng: phát hiện nhóm rồi lấy passage từ câu đã trích.
        detected = _detect_reading_groups(client, questions, fallback_clients)
        has_anchors = any(q.get("passage_text") for q in questions)
        if not detected and has_anchors:
            detected = _fallback_reading_groups(questions)
        for g in (detected or []):
            groups.append({
                "questions":     g["questions"],
                "passage_text":  None,
                "passage_title": None,
            })

    qnum_to_group: dict[int, int] = {}
    group_passage: dict[int, tuple] = {}
    for gi, g in enumerate(groups, start=1):
        for n in g["questions"]:
            qnum_to_group[n] = gi
        group_passage[gi] = (g.get("passage_text"), g.get("passage_title"))

    mcq_qs, reading_qs = [], []
    for q in questions:
        num = q.get("question_number")
        if num in qnum_to_group:
            rq = dict(q)
            rq["section"] = READING_SECTION_NAME
            rq["passage_group"] = qnum_to_group[num]
            reading_qs.append(rq)
        else:
            mq = dict(q)
            mq["section"] = ENGLISH_SECTION_NAME
            mq.pop("passage_group", None)
            mcq_qs.append(mq)

    # Re-anchor: mỗi nhóm reading chỉ giữ passage trên câu có số thứ tự nhỏ nhất.
    # Ưu tiên passage do Groq parse trọn vẹn; nếu thiếu thì lấy passage trích từng trang.
    reading_qs.sort(key=lambda q: q.get("question_number", 0))
    by_group: dict[int, list] = {}
    for q in reading_qs:
        by_group.setdefault(q["passage_group"], []).append(q)
    for gi, qs in by_group.items():
        gp_text, gp_title = group_passage.get(gi, (None, None))
        ptext  = gp_text  or next((q.get("passage_text")  for q in qs if q.get("passage_text")),  None)
        ptitle = gp_title or next((q.get("passage_title") for q in qs if q.get("passage_title")), None)
        ptext  = _format_passage_text(ptext) if ptext else ptext
        for i, q in enumerate(qs):
            q["passage_text"]  = ptext  if i == 0 else None
            q["passage_title"] = ptitle if i == 0 else None

    def _sec(qs, sec_type):
        return {
            "type":         sec_type,
            "points_per_q": ENGLISH_POINTS_PER_Q,
            "count":        len(qs),
            "total":        round(len(qs) * ENGLISH_POINTS_PER_Q, 2),
            "questions":    qs,
        }

    sections: dict = {}
    if mcq_qs:
        sections[ENGLISH_SECTION_NAME] = _sec(mcq_qs, "multiple_choice")
    if reading_qs:
        sections[READING_SECTION_NAME] = _sec(reading_qs, "reading")
    if not sections:
        sections[ENGLISH_SECTION_NAME] = _sec([], "multiple_choice")
    return sections


# ---------------------------------------------------------------------------
# Core extraction — per page
# ---------------------------------------------------------------------------

def _extract_questions_from_page(
    client: Groq,
    page: fitz.Page,
    page_num: int,
    seen_q_nums: set,
    fallback_clients: list,
    doc: fitz.Document = None,
    page_idx: int = None,
    images_dir: Path = None,
) -> list[dict]:
    """
    Trích xuất câu hỏi từ một trang.

    Luồng:
      1. Fitz đọc text → nếu đủ chất lượng dùng Groq text model.
         - Ảnh nhúng (content images): mô tả bằng Groq Vision, ghép vào prompt.
      2. Fallback: Groq Vision render cả trang (PDF scan / text kém).
    """
    fb = fallback_clients or []

    # ── prev_context ──────────────────────────────────────────────────────────
    if seen_q_nums:
        last_nums = sorted(seen_q_nums)[-10:]
        prev_ctx = (
            f"Questions already extracted from previous pages: {last_nums}. "
            "Only extract NEW questions (numbers not in that list)."
        )
    else:
        prev_ctx = ""

    # ── Step 1: thử fitz ──────────────────────────────────────────────────────
    page_text = page.get_text().strip()
    use_vision = not _is_text_sufficient(page_text)

    # ── Step 2: trích ảnh nhúng (luôn chạy, bất kể path nào) ─────────────────
    content_images: list[dict] = []
    if doc is not None and page_idx is not None:
        content_images = _extract_page_content_images(doc, page_idx, images_dir, client, fb)

    # ── Step 3a: Groq Vision (PDF scan hoặc text kém) ─────────────────────────
    if use_vision:
        img_b64 = page_to_base64(page)
        prompt = QUESTION_VISION_PROMPT.format(page_num=page_num, prev_context=prev_ctx)
        raw = call_groq_vision(client, img_b64, prompt, MAX_TOKENS_DEFAULT, fb)
        questions = _parse_response(raw, "questions")

    # ── Step 3b: Groq text model (PDF có text) ────────────────────────────────
    else:
        if content_images:
            img_lines = [f"  [{i+1}] {img['description']}" for i, img in enumerate(content_images)]
            image_section = (
                f"\nThis page contains {len(content_images)} embedded image(s) "
                f"(numbered top to bottom):\n" + "\n".join(img_lines) + "\n"
            )
        else:
            image_section = ""

        prompt = QUESTION_TEXT_PROMPT.format(
            page_num=page_num,
            prev_context=prev_ctx,
            page_text=page_text,
            image_section=image_section,
        )
        raw = _call_groq_text(client, prompt, MAX_TOKENS_DEFAULT, fb)

        try:
            questions = json.loads(raw).get("questions", [])
        except json.JSONDecodeError:
            repaired = repair_truncated_json(raw)
            try:
                questions = json.loads(repaired).get("questions", [])
            except json.JSONDecodeError:
                print(f"\n  [WARN] Trang {page_num}: không parse được JSON từ text model.")
                questions = []

    # ── Post-process: dedup, gắn ảnh, gắn metadata ───────────────────────────
    result = []
    for q in questions:
        num = q.get("question_number")
        if not isinstance(num, int) or num in seen_q_nums:
            continue
        seen_q_nums.add(num)

        fig_idx = q.pop("figure_index", 0)
        if isinstance(fig_idx, int) and 1 <= fig_idx <= len(content_images):
            q["figure_path"] = content_images[fig_idx - 1]["path"]
            q["has_figure"] = True
        else:
            q.setdefault("has_figure", False)

        q["section"] = ENGLISH_SECTION_NAME
        q["points"]  = ENGLISH_POINTS_PER_Q
        q.setdefault("answer", None)
        q.setdefault("passage_title", None)
        q.setdefault("passage_text", None)
        result.append(q)

    return result


def _extract_answers_from_page(
    client: Groq,
    page: fitz.Page,
    page_num: int,
    fallback_clients: list,
) -> dict[int, str]:
    """
    Trích xuất đáp án từ một trang ĐÁP ÁN.
    Luôn dùng Vision vì đáp án đúng được highlight trực quan (bold/gạch chân/màu).
    """
    img_b64 = page_to_base64(page)
    prompt = ANSWER_PROMPT.format(page_num=page_num)
    raw = call_groq_vision(client, img_b64, prompt, MAX_TOKENS_DEFAULT, fallback_clients or [])
    raw_answers = _parse_response(raw, "answers")

    result = {}
    for k, v in raw_answers.items():
        try:
            num = int(k)
            letter = str(v).strip().upper()
            if letter in ("A", "B", "C", "D"):
                result[num] = letter
        except (ValueError, TypeError):
            pass
    return result


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_english(
    pdf_path: Path,
    client: Groq,
    fallback_clients: list = None,
    progress_cb=None,
    images_dir: Path = None,
) -> dict:
    """
    Main extraction function cho đề Tiếng Anh PDF.

    progress_cb: callable(event_dict) — gọi sau mỗi trang xử lý.
    images_dir:  thư mục lưu ảnh nhúng (mặc định: <SRC_DIR>/output/images).
    Trả về dict kết quả với sections và questions.
    """
    fb = fallback_clients or []
    imgs_dir = images_dir or IMAGES_DIR
    doc = fitz.open(str(pdf_path))
    total_pages = doc.page_count

    ak_page = find_answer_key_page(doc)
    has_answer_key = ak_page >= 0

    if has_answer_key:
        q_pages   = list(range(0, ak_page + 1))
        ans_pages = list(range(ak_page, total_pages))
    else:
        q_pages   = list(range(total_pages))
        ans_pages = []

    # ── Pass 1: trích câu hỏi ────────────────────────────────────────────────
    all_questions: list[dict] = []
    seen_q_nums: set[int] = set()
    q_pages_text: list[str] = []          # text gốc để parse bài đọc trọn vẹn

    for pg in q_pages:
        page = doc[pg]
        page_text = page.get_text().strip()
        if page_text:
            q_pages_text.append(page_text)
        new_qs = _extract_questions_from_page(
            client, page, pg + 1, seen_q_nums, fb,
            doc=doc, page_idx=pg, images_dir=imgs_dir,
        )
        all_questions.extend(new_qs)

        if progress_cb:
            progress_cb({
                "type": "page_done",
                "page": pg + 1,
                "total": total_pages,
                "questions_found": len(new_qs),
                "sections": [ENGLISH_SECTION_NAME],
                "phase": "questions",
            })

    # ── Pass 2: trích đáp án (nếu có ĐÁP ÁN) ────────────────────────────────
    answer_map: dict[int, str] = {}
    if has_answer_key:
        for pg in ans_pages:
            page = doc[pg]
            page_answers = _extract_answers_from_page(client, page, pg + 1, fb)
            answer_map.update(page_answers)

            if progress_cb:
                progress_cb({
                    "type": "page_done",
                    "page": pg + 1,
                    "total": total_pages,
                    "questions_found": len(page_answers),
                    "sections": [ENGLISH_SECTION_NAME],
                    "phase": "answers",
                })

        for q in all_questions:
            num = q.get("question_number")
            if num in answer_map:
                q["answer"] = answer_map[num]

    # Dedup: giữ lần xuất hiện cuối của mỗi question_number
    deduped: dict[int, dict] = {}
    for q in all_questions:
        num = q.get("question_number")
        if isinstance(num, int) and 1 <= num <= 100:
            deduped[num] = q

    questions_final  = sorted(deduped.values(), key=lambda q: q.get("question_number", 0))
    answers_count    = sum(1 for q in questions_final if q.get("answer"))

    # Groq tự phát hiện từng phần: trắc nghiệm rời  vs  bài đọc (reading),
    # đồng thời parse trọn vẹn nội dung từng bài đọc từ text gốc của đề.
    if progress_cb:
        progress_cb({"type": "detecting_parts", "total": len(questions_final)})
    raw_text = "\n\n".join(q_pages_text)
    sections = split_english_sections(questions_final, client, fb, raw_text=raw_text)

    return {
        "source":        pdf_path.name,
        "subject":       "english",
        "total_questions": len(questions_final),
        "has_answer_key":  has_answer_key,
        "answers_filled":  answers_count,
        "sections":        sections,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    load_dotenv(ROOT_DIR / ".env")
    keys = []
    for var in ("GROQ_API_KEY", "GROQ_API_KEY_FALLBACK", "GROQ_API_KEY_FALLBACK_2"):
        k = os.getenv(var)
        if k:
            keys.append(k)
    if not keys:
        raise RuntimeError("Không tìm thấy GROQ_API_KEY trong .env")

    parser = argparse.ArgumentParser(description="Trích xuất đề thi Tiếng Anh từ PDF")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    client = Groq(api_key=keys[0])
    fallback_clients = [Groq(api_key=k) for k in keys[1:]]

    def cli_progress(evt):
        phase = evt.get("phase", "")
        label = "ĐÁP ÁN" if phase == "answers" else "Câu hỏi"
        print(f"  [{label}] Trang {evt['page']}/{evt['total']} — {evt['questions_found']} mục")

    print(f"PDF: {args.pdf.name}")
    result = run_english(args.pdf, client, fallback_clients, cli_progress)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    qs = [q for sec in result["sections"].values() for q in sec["questions"]]
    answered = sum(1 for q in qs if q.get("answer"))
    parts = ", ".join(f"{name}: {sec['count']}" for name, sec in result["sections"].items())
    print(f"\nTổng kết: {len(qs)} câu — {answered} có đáp án  ({parts})")
    print(f"Đã lưu → {args.out}")


if __name__ == "__main__":
    main()

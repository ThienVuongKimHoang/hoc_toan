"""Dựng đề thi trực tiếp từ nội dung (Markdown) đã nhận dạng và người dùng đã sửa ở bước
File Word, KHÔNG gọi AI: người dùng đã sửa đúng thì đề phải giống đúng bản đó.

Nhận các trang dạng {"markdown", "figures"} như công cụ chuyển ảnh, trả về cùng cấu trúc
`result` với pipeline trích xuất PDF (sections PHẦN I/II/III/TỰ LUẬN, mỗi câu có
question_text, choices / sub_questions, figure_path, images...).

Quy ước đọc (đúng như định dạng AI nhận dạng ra và người dùng nhìn thấy khi sửa):
  - Dòng tiêu đề "PHẦN I/II/III/IV" (hoặc có chữ "TỰ LUẬN") đổi phần.
  - "Câu N." / "Câu N:" mở câu mới.
  - "A." "B." "C." "D." ở đầu dòng hoặc sau [[TAB]] là phương án trắc nghiệm.
  - "a)" "b)" "c)" "d)" ở đầu dòng hoặc sau [[TAB]] là ý Đúng/Sai.
  - [[FIG:n]] là hình n của trang đó.
  - Gặp "ĐÁP ÁN" / "HƯỚNG DẪN" / "LỜI GIẢI" / "HẾT" thì dừng.
"""
from __future__ import annotations

import re
import unicodedata

from extract_questions import SECTION_POINTS
from image_convert import _COLUMN_RE, _FIG_REF_RE, _clean_output, _expand_chemistry

ESSAY = "TỰ LUẬN"
_POINTS = {"PHẦN I": 0.25, "PHẦN II": 1.0, "PHẦN III": 0.5, ESSAY: 1.0}

_HEADER_RE = re.compile(r"^\s*(?:#+\s*)?PH[ẦA]N\s+(IV|III|II|I|[1-4])\b(.*)$", re.I)
_QUESTION_RE = re.compile(r"^\s*(?:#+\s*)?Câu\s+(\d{1,3})\s*[.:)]?\s*(.*)$", re.I)
_CHOICE_RE = re.compile(r"^\s*([A-D])\s*[.)]\s*(.*)$", re.S)
_SUB_RE = re.compile(r"^\s*([a-d])\s*\)\s*(.*)$", re.S)
_STOP_RE = re.compile(r"^[\s#*_\-–—.]*(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN|LỜI\s*GIẢI|HẾT)\b")
_FIG_TOKEN_RE = re.compile(r"\[\[FIGPATH:([^\]]+)\]\]")
_NUMERALS = {"I": 1, "II": 2, "III": 3, "IV": 4}
# Tiêu đề kiểu đề kiểm tra thường: "I. TRẮC NGHIỆM", "B. TỰ LUẬN", "TỰ LUẬN (3 điểm)".
# Từ khoá phải VIẾT HOA để không nhầm với câu chữ trong đề bài.
_KEYWORD_HEADER_RE = re.compile(
    r"^\s*(?:#+\s*)?(?:(?:IV|III|II|I|[A-D1-4])\s*[.):\-–]\s*)?"
    r"(TRẮC\s*NGHIỆM|TỰ\s*LUẬN|ĐÚNG\s*[-/]?\s*SAI|TRẢ\s*LỜI\s*NGẮN)")
_AUTO = "auto"     # phần chung chung ("TRẮC NGHIỆM"): đoán theo nội dung từng câu


def _is_stop(line: str) -> bool:
    """Chỉ dừng ở dòng tiêu đề viết HOA ("ĐÁP ÁN", "----- HẾT -----"), không dừng ở câu chữ
    thường như "Đáp án đúng là..." nằm trong đề bài."""
    text = unicodedata.normalize("NFC", line.strip())
    return bool(_STOP_RE.match(text)) and text == text.upper()


def _upper(text: str) -> str:
    return unicodedata.normalize("NFC", text).upper()


def _section_from_header(number: str, rest: str) -> str:
    rest = _upper(rest)
    if "TỰ LUẬN" in rest:
        return ESSAY
    if "ĐÚNG SAI" in rest or "ĐÚNG/SAI" in rest or "ĐÚNG - SAI" in rest:
        return "PHẦN II"
    if "TRẢ LỜI NGẮN" in rest:
        return "PHẦN III"
    if "NHIỀU PHƯƠNG ÁN" in rest:
        return "PHẦN I"
    n = _NUMERALS.get(number.upper()) or int(number)
    return {1: "PHẦN I", 2: "PHẦN II", 3: "PHẦN III"}.get(n, ESSAY)


def _section_from_keyword(line: str) -> str | None:
    """Trả phần theo tiêu đề có từ khoá, _AUTO nếu chỉ ghi "TRẮC NGHIỆM", None nếu không phải tiêu đề."""
    match = _KEYWORD_HEADER_RE.match(unicodedata.normalize("NFC", line))
    if not match:
        return None
    keyword = re.sub(r"\s+", " ", match.group(1))
    if keyword.startswith("TỰ"):
        return ESSAY
    if keyword.startswith("ĐÚNG"):
        return "PHẦN II"
    if keyword.startswith("TRẢ"):
        return "PHẦN III"
    return _AUTO


class _Question:
    def __init__(self, number: int, section: str | None, first_line: str):
        self.number = number
        self.section = section          # None: chưa gặp tiêu đề phần, đoán theo nội dung
        self.stem: list[str] = [first_line] if first_line else []
        self.choices: dict[str, list[str]] = {}
        self.subs: dict[str, list[str]] = {}
        self.target: list[str] = self.stem   # dòng tiếp theo nối vào đâu

    def add_line(self, line: str) -> None:
        cells = _COLUMN_RE.split(line) if _COLUMN_RE.search(line) else [line]
        for cell in cells:
            choice = _CHOICE_RE.match(cell)
            sub = _SUB_RE.match(cell)
            if choice and choice.group(1) not in self.choices and not self.subs:
                self.target = self.choices.setdefault(choice.group(1), [])
                self.target.append(choice.group(2))
            elif sub and sub.group(1) not in self.subs and not self.choices:
                self.target = self.subs.setdefault(sub.group(1), [])
                self.target.append(sub.group(2))
            else:
                self.target.append(cell)


def _join(lines: list[str]) -> str:
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _attach_figures(q: dict, text: str, kind: str, key: str = "") -> str:
    """Hình trong đề bài: hình đầu là figure_path như pipeline AI; các hình còn lại và hình
    trong phương án / ý phụ dùng marker [img:id] mà EditableQuestion/QuestionCard đã hiểu."""
    def replace(match: re.Match) -> str:
        path = match.group(1)
        if kind == "stem" and not q.get("figure_path"):
            q["figure_path"] = path
            return ""
        img_id = f"md_{len(q.setdefault('images', [])) + 1}_{q['question_number']}{key}"
        q["images"].append({"id": img_id, "url": path, "name": "Hình", "source": "ai"})
        return f"\n[img:{img_id}]\n"
    return re.sub(r"\n{3,}", "\n\n", _FIG_TOKEN_RE.sub(replace, text)).strip()


def _build_question(raw: _Question, section: str) -> dict:
    q: dict = {"section": section, "question_number": raw.number, "points": _POINTS[section]}
    q["question_text"] = _attach_figures(q, _join(raw.stem), "stem")
    if section == "PHẦN I":
        q["choices"] = {letter: _attach_figures(q, _join(raw.choices.get(letter, [])), "choice", letter)
                        for letter in "ABCD"}
        q["answer"] = None
    elif section == "PHẦN II":
        q["sub_questions"] = [
            {"label": label, "text": _attach_figures(q, _join(raw.subs.get(label, [])), "sub", label),
             "correct_answer": None}
            for label in "abcd"
        ]
        q["points"] = None
    else:
        # Phương án / ý phụ lọt vào câu trả lời ngắn hay tự luận thì trả lại vào đề bài.
        extra = [f"{k}. {_join(v)}" for k, v in raw.choices.items()] + \
                [f"{k}) {_join(v)}" for k, v in raw.subs.items()]
        if extra:
            q["question_text"] = _attach_figures(q, "\n".join([q["question_text"], *extra]), "stem")
        q["answer"] = ""
        if section == "PHẦN III":
            q["points"] = None
    q["has_figure"] = bool(q.get("figure_path"))
    return q


def _guess_section(raw: _Question) -> str:
    if raw.choices:
        return "PHẦN I"
    if raw.subs:
        return "PHẦN II"
    return "PHẦN III"


def _page_lines(pages: list[dict], save_figure) -> list[str]:
    lines: list[str] = []
    for page in pages:
        by_id = {str(f.get("id")): f for f in page.get("figures") or [] if isinstance(f, dict)}

        def replace(match: re.Match) -> str:
            figure = by_id.get(match.group(1))
            return f"\n[[FIGPATH:{save_figure(figure)}]]\n" if figure else ""

        text = _expand_chemistry(_clean_output(str(page.get("markdown") or "")))
        text = _FIG_REF_RE.sub(replace, text).replace("**", "")
        lines.extend(text.split("\n"))
    return lines


def parse_exam(pages: list[dict], save_figure, source: str) -> dict:
    """`save_figure(figure)` lưu hình (data URL) ra file, trả đường dẫn kiểu "images/x.png"."""
    questions: list[_Question] = []
    section: str | None = None
    current: _Question | None = None
    for line in _page_lines(pages, save_figure):
        if _is_stop(line):
            break
        header = _HEADER_RE.match(line)
        if header and not _QUESTION_RE.match(line):
            section = _section_from_header(header.group(1), header.group(2))
            current = None
            continue
        start = _QUESTION_RE.match(line)
        keyword_section = None if start else _section_from_keyword(line)
        if keyword_section:
            section = None if keyword_section == _AUTO else keyword_section
            current = None
            continue
        if start:
            current = _Question(int(start.group(1)), section, "")
            current.add_line(start.group(2))
            questions.append(current)
        elif current is not None:
            current.add_line(line)

    # Trùng số câu trong cùng một phần (vd ảnh chụp lặp trang): giữ bản xuất hiện trước.
    built: dict[tuple, dict] = {}
    for raw in questions:
        sec = raw.section or _guess_section(raw)
        built.setdefault((sec, raw.number), _build_question(raw, sec))

    result = {"source": source, "subject": "math", "total_questions": len(built),
              "has_answer_key": False, "sections": {}}
    for sec in [*SECTION_POINTS, ESSAY]:
        qs = sorted((q for (s, _), q in built.items() if s == sec), key=lambda q: q["question_number"])
        if sec in SECTION_POINTS:
            info = {k: v for k, v in SECTION_POINTS[sec].items() if k != "count"}
        elif qs:
            info = {"type": "essay", "points_per_q": 1.0, "total": float(len(qs))}
        else:
            continue
        result["sections"][sec] = {**info, "questions": qs}
    return result

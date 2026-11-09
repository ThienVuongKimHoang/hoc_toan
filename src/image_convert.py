"""Chuyển ảnh tài liệu thành Word (.docx) hoặc LaTeX (.zip gồm main.tex + hình).

Công thức → LaTeX (trong Word là công thức Word thật, sửa được). Hình vẽ → cắt thẳng
từ ảnh gốc, không vẽ lại. Hai bước tách rời và không giữ state trên server:
  1. recognize(): mỗi ảnh một request, trả Markdown + các hình đã cắt.
  2. build_docx() / build_latex_zip(): ghép các trang đã nhận dạng thành file.

Model trả Markdown chứ KHÔNG trả JSON: LaTeX nhét trong JSON rất dễ hỏng vì
"\\frac" bị đọc thành ký tự form-feed + "rac".
"""
import base64
import io
import re
import subprocess
import tempfile
import time
import unicodedata
import zipfile
from pathlib import Path

import cv2
import fitz
import numpy as np
import pypandoc
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_MODEL_SIDE = 2000      # cạnh dài của bản gửi Groq; hình cắt vẫn lấy từ ảnh gốc
MAX_FIGURES_PER_PAGE = 20
MAX_STORED_FIGURES = 60    # gồm cả ảnh người dùng dán thêm
MAX_MARKDOWN_CHARS = 200_000
MAX_ORIGINAL_SIDE = 1600   # ảnh gốc lưu trong phiên để đối chiếu
MAX_DETECT_SIDE = 3000     # ảnh lớn hơn được thu nhỏ khi dò hình rồi quy đổi lại toạ độ
PNG_LIMIT_BYTES = 2_000_000
RECOGNIZE_MAX_TOKENS = 8000
OVERLOAD_RETRIES = 3
HIDDEN_TEXT_SIZE = 3
EXAM_PAGE_MARGIN = 0.13    # tỉ lệ chiều cao ảnh, xem images_to_exam_pdf
PANDOC_TIMEOUT = 120

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

PROMPT = r"""Transcribe this document image into Markdown, exactly as printed.

Rules:
- Keep the original language, wording and reading order. Do not solve, translate, summarise, correct or add anything.
- Write EVERY mathematical expression in LaTeX, even a single variable or number with a unit in a formula: $...$ for inline, $$...$$ for display. Never use Unicode math symbols, \( \) or \[ \].
- Chemistry is written in LaTeX too, with upright symbols: $\mathrm{H_2SO_4}$, $\mathrm{Fe^{3+}}$, $\mathrm{SO_4^{2-}}$, $\mathrm{N_2 + 3H_2 \xrightarrow{t^\circ} 2NH_3}$, $\mathrm{H_2 + I_2 \rightleftharpoons 2HI}$. Physics units go inside the formula as $5\,\text{m/s}$.
- Join lines that are only wrapped by the page width into one line. Start a new line for each new paragraph and question.
- Answer options (A., B., C., D. or a), b), c), d)) must keep the row arrangement printed in the image. Options printed side by side on the same row go on one line, separated by [[TAB]], for example: A. $1$. [[TAB]] B. $2$. [[TAB]] C. $3$. [[TAB]] D. $4$. Options printed on separate rows go on separate lines: two rows of two options are two lines with one [[TAB]] each, and four rows of one option are four lines with no [[TAB]].
- Write tables as Markdown pipe tables, with formulas inside cells.
- Write fill-in blanks as a run of dots (......), never as underscores.
- Bold text may use **...**. Do not use Markdown headings or code blocks.
- Do NOT describe or redraw pictures. For each graph, chart, geometric drawing, diagram or photo, output [[FIGURE]] on its own line at the position where it appears. Tables and formulas are not figures.
- Output only the transcription, with no comments and no code fences."""

_FIGURE_RE = re.compile(r"\[\[\s*FIGURE\b[^\]\n]*\]\]", re.I)
_FIG_REF_RE = re.compile(r"\[\[FIG:(\d+)\]\]")
_COLUMN_RE = re.compile(r"[ \t]*\[\[\s*TAB\s*\]\][ \t]*", re.I)
_COLUMN_TOKEN = "IMGCONVCOLUMNTOKEN"       # chữ-số để pandoc giữ nguyên, thay sau khi convert
_COLUMN_SPLIT_RE = re.compile(rf"\s*{_COLUMN_TOKEN}\s*")
_DOCX_TEXT_WIDTH = 9000                    # twip, khoảng bề ngang vùng chữ của trang

# Tắt các cú pháp Markdown dễ "ăn" nhầm chữ trong đề thi, và tắt raw_* để nội dung
# model đọc từ ảnh không thể chèn LaTeX/HTML tuỳ ý vào file đầu ra.
_PANDOC_FROM = "markdown+hard_line_breaks" + "".join(f"-{ext}" for ext in (
    "raw_html", "raw_tex", "raw_attribute", "implicit_figures", "auto_identifiers",
    "fancy_lists", "example_lists", "citations", "yaml_metadata_block", "smart",
    "subscript", "superscript", "strikeout", "footnotes", "inline_notes",
    "native_divs", "native_spans", "fenced_divs", "bracketed_spans", "table_captions",
))

_LATEX_TEMPLATE = r"""\documentclass[12pt,a4paper]{article}
\usepackage{iftex}
\ifPDFTeX
  \usepackage[utf8]{inputenc}
  \usepackage[T5]{fontenc}
\else
  \usepackage{fontspec}
\fi
\usepackage[margin=2cm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{array,calc,longtable,booktabs}
\usepackage{hyperref}
\providecommand{\tightlist}{\setlength{\itemsep}{0pt}\setlength{\parskip}{0pt}}
\providecommand{\pandocbounded}[1]{#1}
\setlength{\parindent}{0pt}
\setlength{\parskip}{6pt}

\begin{document}

%s

\end{document}
"""


class ImageConvertError(ValueError):
    """Lỗi do dữ liệu đầu vào; thông báo được hiển thị thẳng cho người dùng."""


def _load_image(data: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise ImageConvertError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.")
        # Ảnh chụp điện thoại lưu chiều xoay trong EXIF; bỏ qua thì model đọc ảnh nằm ngang.
        return ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise ImageConvertError("Không đọc được ảnh, hoặc ảnh quá lớn.") from e


def _encode_for_model(img: Image.Image) -> str:
    small = img.copy()
    small.thumbnail((MAX_MODEL_SIDE, MAX_MODEL_SIDE))
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


def _encode_original(img: Image.Image) -> str:
    """Bản thu nhỏ của ảnh gốc, lưu trong phiên để đối chiếu khi mở lại."""
    small = img.copy()
    small.thumbnail((MAX_ORIGINAL_SIDE, MAX_ORIGINAL_SIDE))
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _encode_figure(crop: Image.Image) -> str:
    buf = io.BytesIO()
    crop.save(buf, "PNG", optimize=True)
    if buf.tell() <= PNG_LIMIT_BYTES:
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    buf = io.BytesIO()
    crop.save(buf, "JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _normalize_math(text: str) -> str:
    text = re.sub(r"\\\[(.+?)\\\]", lambda m: f"$${m.group(1).strip()}$$", text, flags=re.S)
    text = re.sub(r"\\\((.+?)\\\)", lambda m: f"${m.group(1).strip()}$", text, flags=re.S)
    # Pandoc không nhận "$ x $" là công thức nếu có khoảng trắng sát dấu $.
    text = re.sub(r"(?<![\\$])\$(?!\$)[ \t]*([^$\n]+?)[ \t]*(?<!\\)\$(?!\$)", r"$\1$", text)
    return text


def _clean_output(raw: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", raw or "", flags=re.S | re.I).strip()
    text = re.sub(r"^```[a-zA-Z]*\s*\n|\n```\s*$", "", text)
    text = unicodedata.normalize("NFC", text)      # font T5 chỉ có dấu tiếng Việt dựng sẵn
    text = _normalize_math(text)
    text = re.sub(r"^[ \t]+", "", text, flags=re.M)  # thụt ≥4 dấu cách thành code block
    # Pandoc chỉ nhận bảng khi có dòng trống phía trước.
    return re.sub(r"(?:^\|.*\n?){2,}", lambda m: f"\n{m.group(0).rstrip()}\n\n", text, flags=re.M)


def _is_table_like(mask: np.ndarray) -> bool:
    """Bảng (hoặc ảnh có khung kín) có ≥2 đường kẻ chạy suốt theo mỗi chiều.
    Bảng đã được chép thành bảng Markdown nên không cắt. Nới nhẹ để chịu ảnh chụp hơi nghiêng."""
    height, width = mask.shape
    pixels = mask.astype(np.uint8)
    rows = cv2.dilate(pixels, np.ones((max(3, width // 60), 1), np.uint8)).mean(axis=1) > 0.9
    cols = cv2.dilate(pixels, np.ones((1, max(3, height // 60)), np.uint8)).mean(axis=0) > 0.9

    def bands(flags: np.ndarray) -> int:
        return int(flags[0]) + int(np.count_nonzero(flags[1:] & ~flags[:-1]))

    return bands(rows) >= 2 and bands(cols) >= 2


def _overlaps(a: tuple, b: tuple) -> bool:
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return False
    smaller = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return w * h > 0.3 * smaller


def _merge_boxes(boxes: list) -> list[list]:
    merged: list[list] = []
    for box in sorted(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True):
        host = next((m for m in merged if _overlaps(m, box)), None)
        if host:
            host[:] = [min(host[0], box[0]), min(host[1], box[1]), max(host[2], box[2]), max(host[3], box[3])]
        else:
            merged.append(list(box))
    return merged


def _absorb_labels(box: list, small: np.ndarray, text_height: float) -> None:
    """Nới `box` để lấy các nhãn nằm ngoài nét vẽ (đỉnh A, B, S của hình học...),
    nhưng không ăn vào dòng chữ sát hình: nhãn đứng lẻ, còn chữ có nhiều ký tự kề bên."""
    reach = 1.5 * text_height
    margin = 0.7 * text_height     # để dấu tiếng Việt vẫn tính là cùng dòng với chữ
    # Chốt danh sách từ đầu: tính lại sau mỗi lần nới thì chữ đã bị lấy không còn được
    # đếm là hàng xóm, và cả dòng bị ăn dần.
    outside = small[(np.maximum(box[0] - small[:, 2], small[:, 0] - box[2]) > 0)
                    | (np.maximum(box[1] - small[:, 3], small[:, 1] - box[3]) > 0)]
    for _ in range(2):
        gap = np.maximum(np.maximum(box[0] - small[:, 2], small[:, 0] - box[2]),
                         np.maximum(box[1] - small[:, 3], small[:, 1] - box[3]))
        for c in small[(gap > 0) & (gap <= reach)]:
            same_line = (outside[:, 1] < c[3] + margin) & (outside[:, 3] > c[1] - margin)
            close = (outside[:, 0] < c[2] + 4 * text_height) & (outside[:, 2] > c[0] - 4 * text_height)
            if (same_line & close).sum() - 1 < 3:
                box[0], box[1] = min(box[0], c[0]), min(box[1], c[1])
                box[2], box[3] = max(box[2], c[2]), max(box[3], c[3])


def _detect_figures(img: Image.Image) -> tuple[list[tuple], list[tuple]]:
    """Tìm hình bằng xử lý ảnh; toạ độ của model thị giác lệch rất xa và đổi sau mỗi lần gọi.
    Hình là khối nét liền cao hơn hẳn chữ. Trả (các hình, các khối giống bảng), xếp trên → dưới."""
    scale = min(1.0, MAX_DETECT_SIDE / max(img.size))
    small_img = img.convert("L")
    if scale < 1:
        small_img = small_img.resize((round(img.width * scale), round(img.height * scale)))
    gray = cv2.GaussianBlur(np.asarray(small_img), (3, 3), 0)
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 12)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    height, width = binary.shape
    if count <= 1:
        return [], []

    stats = stats[1:]
    heights = stats[:, cv2.CC_STAT_HEIGHT]
    glyphs = heights[(heights > 3) & (heights < height / 20)]
    text_height = float(np.median(glyphs)) if glyphs.size else 15.0

    # Mỗi hàng: x1, y1, x2, y2 của các khối cỡ ký tự, dùng để nhận nhãn nằm ngoài hình.
    is_small = (heights <= 3 * text_height) & (stats[:, cv2.CC_STAT_AREA] >= 6)
    small = np.column_stack((
        stats[is_small, 0], stats[is_small, 1],
        stats[is_small, 0] + stats[is_small, 2], stats[is_small, 1] + stats[is_small, 3],
    ))

    figures, tables = [], []
    for index, (x, y, w, h, _area) in enumerate(stats):
        if h <= 5 * text_height or w <= 3 * text_height:
            continue
        if w >= 0.9 * width and h >= 0.6 * height:   # khung viền trang, mép giấy
            continue
        component = labels[y:y + h, x:x + w] == index + 1
        (tables if _is_table_like(component) else figures).append([x, y, x + w, y + h])

    # Ô của bảng thật chỉ chứa chữ; khối "giống bảng" mà bên trong có nét vẽ lớn là hình có
    # khung hoặc đồ thị có các đường tiệm cận.
    framed = [t for t in tables if any(_overlaps(t, f) for f in figures)]
    tables = [t for t in tables if t not in framed]
    merged = _merge_boxes(figures + framed)
    pad = max(2, round(0.3 * text_height))
    def finish(box: list) -> tuple:
        return (max(0, int((box[0] - pad) / scale)), max(0, int((box[1] - pad) / scale)),
                min(img.width, int((box[2] + pad) / scale)), min(img.height, int((box[3] + pad) / scale)))

    for box in merged:
        _absorb_labels(box, small, text_height)
    return ([finish(b) for b in sorted(merged, key=lambda b: b[1])],
            [finish(b) for b in sorted(tables, key=lambda b: b[1])])


def _extract_figures(text: str, img: Image.Image) -> tuple[str, list[dict], list[str]]:
    """Ghép dấu [[FIGURE]] của model (đúng vị trí trong văn bản) với hình dò được (đúng
    vị trí cắt) theo thứ tự trên → dưới. Trả (markdown, hình, cảnh báo)."""
    wanted = min(len(_FIGURE_RE.findall(text)), MAX_FIGURES_PER_PAGE)
    boxes: list[tuple] = []
    warnings: list[str] = []
    if wanted:
        boxes, tables = _detect_figures(img)
        if len(boxes) < wanted:                # khung biểu đồ kín cũng giống bảng → lấy lại
            boxes = sorted((tuple(b) for b in _merge_boxes(boxes + tables)), key=lambda b: b[1])
        if len(boxes) > wanted:                # dư thì giữ các khối lớn nhất
            warnings.append("Ảnh có nhiều khối giống hình hơn số hình đọc được, hãy kiểm tra lại các hình.")
            largest = sorted(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)[:wanted]
            boxes = sorted(largest, key=lambda b: b[1])

    figures: list[dict] = []
    missing = 0

    def replace(_match: re.Match) -> str:
        nonlocal missing
        if len(figures) >= len(boxes):
            missing += 1
            return ""
        box = boxes[len(figures)]
        figure_id = len(figures) + 1
        figures.append({
            "id": figure_id,
            "data": _encode_figure(img.crop(box)),
            # Giữ tỉ lệ so với chiều ngang trang gốc để hình không bị phóng to hết khổ.
            "widthPct": max(15, min(100, round((box[2] - box[0]) * 100 / img.width))),
        })
        return f"\n\n[[FIG:{figure_id}]]\n\n"

    markdown = _FIGURE_RE.sub(replace, text)
    if missing:
        warnings.append(f"Không tìm thấy vị trí của {missing} hình trong ảnh này, cần chèn thủ công.")
    return markdown, figures, warnings


def recognize(image_bytes: bytes, chat, model: str) -> dict:
    """`chat(model=, messages=, temperature=, max_tokens=, reasoning_effort=)` là hàm gọi Groq
    có xoay vòng key, do api.py truyền vào."""
    img = _load_image(image_bytes)
    messages = [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{_encode_for_model(img)}"}},
        {"type": "text", "text": PROMPT},
    ]}]
    for attempt in range(OVERLOAD_RETRIES + 1):
        try:
            response = chat(model=model, messages=messages, temperature=0.1,
                            max_tokens=RECOGNIZE_MAX_TOKENS, reasoning_effort="none")
            break
        except Exception as e:
            # Model thị giác của Groq thỉnh thoảng trả 503 "over capacity" vài giây.
            overloaded = "503" in str(e) or "over capacity" in str(e).lower()
            if not overloaded or attempt == OVERLOAD_RETRIES:
                raise
            time.sleep(3 * (attempt + 1))
    choice = response.choices[0]
    markdown, figures, warnings = _extract_figures(_clean_output(choice.message.content), img)
    if not markdown.strip():
        raise ImageConvertError("Không nhận dạng được nội dung trong ảnh.")
    if choice.finish_reason == "length":
        warnings.append("Ảnh quá dài nên phần cuối có thể bị thiếu, hãy tách thành ảnh nhỏ hơn.")
    return {"markdown": markdown, "figures": figures, "warnings": warnings, "original": _encode_original(img)}


def _insert_hidden_text(page: "fitz.Page", markdown: str) -> None:
    """Chép nội dung vào lớp chữ ẩn: pipeline dò PHẦN I/II/III, số câu và trang đáp án bằng
    page.get_text(), ảnh thuần không có chữ thì các phần bị gộp nhầm."""
    plain = _FIG_REF_RE.sub("", _COLUMN_RE.sub("    ", markdown)).replace("**", "")
    writer = fitz.TextWriter(page.rect)
    font = fitz.Font("helv")
    y = HIDDEN_TEXT_SIZE
    for line in filter(None, (raw.strip() for raw in plain.split("\n"))):
        if y > page.rect.height:
            break
        writer.append((1, y), line, font=font, fontsize=HIDDEN_TEXT_SIZE)
        y += HIDDEN_TEXT_SIZE * 1.2
    writer.write_text(page, render_mode=3)     # 3 = không hiển thị


def images_to_exam_pdf(images: list[bytes], chat, model: str) -> bytes:
    """Dựng PDF từ ảnh các trang đề để đưa vào đúng pipeline tạo đề từ PDF.

    Mỗi hình dò được đặt thành ảnh riêng đè lên đúng vị trí (nhìn vẫn như trang gốc), vì
    pipeline lấy hình của câu hỏi từ các ảnh nhúng trong PDF. Lề trên/dưới để hình sát mép
    ảnh không rơi vào vùng header/footer mà extract_embedded_images bỏ qua.
    """
    doc = fitz.open()
    for data in images:
        img = _load_image(data)
        margin = img.height * EXAM_PAGE_MARGIN
        page = doc.new_page(width=img.width, height=img.height + 2 * margin)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=88)
        page.insert_image(fitz.Rect(0, margin, img.width, img.height + margin), stream=buf.getvalue())
        boxes, _tables = _detect_figures(img)
        for box in boxes:
            crop = io.BytesIO()
            img.crop(box).save(crop, "PNG")
            page.insert_image(fitz.Rect(box[0], box[1] + margin, box[2], box[3] + margin), stream=crop.getvalue())
        _insert_hidden_text(page, recognize(data, chat, model)["markdown"])
    pdf = doc.tobytes(deflate=True)
    doc.close()
    return pdf


def _validate_figure(figure: dict) -> tuple[str, str]:
    """Trả (đuôi file, base64). Client gửi lại dữ liệu nên phải kiểm tra lại ở đây."""
    match = re.fullmatch(r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)", str(figure.get("data") or ""))
    if not match:
        raise ImageConvertError("Dữ liệu hình không hợp lệ.")
    try:
        with Image.open(io.BytesIO(base64.b64decode(match.group(2)))) as img:
            if img.format not in {"PNG", "JPEG"}:
                raise ImageConvertError("Dữ liệu hình không hợp lệ.")
    except (UnidentifiedImageError, OSError, ValueError) as e:
        raise ImageConvertError("Dữ liệu hình không hợp lệ.") from e
    return ("jpg" if match.group(1) == "jpeg" else "png"), match.group(2)


def validate_page_edit(markdown, figures) -> None:
    """Kiểm tra nội dung client gửi lên khi lưu; `figures=None` nghĩa là không đổi hình."""
    if not isinstance(markdown, str) or len(markdown) > MAX_MARKDOWN_CHARS:
        raise ImageConvertError("Nội dung không hợp lệ hoặc quá dài.")
    if figures is None:
        return
    if not isinstance(figures, list) or len(figures) > MAX_STORED_FIGURES \
            or not all(isinstance(f, dict) for f in figures):
        raise ImageConvertError("Dữ liệu hình không hợp lệ.")
    for figure in figures:
        _validate_figure(figure)


def _width_pct(figure: dict) -> int:
    try:
        return max(15, min(100, int(figure.get("widthPct") or 60)))
    except (TypeError, ValueError):
        return 60


def _substitute_figures(pages: list[dict], render) -> str:
    """Ghép các trang thành một Markdown, thay [[FIG:n]] bằng render(trang, hình)."""
    parts = []
    for page_index, page in enumerate(pages, 1):
        by_id = {str(f.get("id")): f for f in page.get("figures") or []}

        def replace(match: re.Match) -> str:
            figure = by_id.get(match.group(1))
            return render(page_index, figure) if figure else ""

        # Làm sạch lại vì người dùng có thể đã sửa: "$ x $" hay dòng thụt đầu sẽ bị
        # pandoc hiểu khác hẳn phần xem trước trên trình duyệt.
        parts.append(_FIG_REF_RE.sub(replace, _clean_output(str(page.get("markdown") or ""))))
    return _mark_columns(_expand_chemistry("\n\n".join(parts)))


_CE_ARROWS = [("<=>", r"\rightleftharpoons"), ("<->", r"\leftrightarrow"), ("->", r"\rightarrow"), ("<-", r"\leftarrow")]


def _ce_species(token: str) -> str:
    """Một chất trong \ce: H2SO4 → H_{2}SO_{4}, Fe^3+ hay Fe3+ → Fe^{3+}, 2H2 giữ hệ số 2."""
    if token == "^":
        return r"\uparrow"
    if token == "v":
        return r"\downarrow"
    match = re.match(r"\d*(?=[A-Z(\[])", token)
    coefficient, rest = match.group(0), token[match.end():]
    charge = ""
    tail = re.search(r"\^(\{[^}]*\}|\d*[+-])$|(?<=[A-Za-z)\]])(\d*[+-])$", rest)
    if tail:
        charge = "^{" + (tail.group(1) or tail.group(2)).strip("{}") + "}"
        rest = rest[:tail.start()]
    return coefficient + re.sub(r"(?<=[A-Za-z)\]])(\d+)", r"_{\1}", rest) + charge


def _ce_to_latex(body: str) -> str:
    parts = []
    for token in body.split():
        arrow = re.fullmatch(r"(<=>|<->|->|<-)(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?", token)
        if arrow:
            symbol = dict(_CE_ARROWS)[arrow.group(1)]
            if arrow.group(2) and arrow.group(1) == "->":
                below = f"[{arrow.group(3)}]" if arrow.group(3) else ""
                symbol = rf"\xrightarrow{below}{{{arrow.group(2)}}}"
            parts.append(symbol)
        else:
            parts.append(token if token in ("+", "-") else _ce_species(token))
    return r"\mathrm{" + " ".join(parts) + "}"


def _expand_chemistry(text: str) -> str:
    """Pandoc không hiểu \ce của mhchem nên cả công thức thành chữ thô trong Word; khung xem
    trước (KaTeX) thì hiểu, nên đổi lúc xuất file để ô soạn vẫn giữ nguyên chữ người dùng gõ."""
    out, position = [], 0
    while True:
        start = text.find(r"\ce{", position)
        if start < 0:
            return "".join(out) + text[position:]
        depth, end = 0, start + 3
        while end < len(text):
            depth += {"{": 1, "}": -1}.get(text[end], 0)
            if depth == 0:
                break
            end += 1
        if depth:                     # thiếu ngoặc đóng: để nguyên
            return "".join(out) + text[position:]
        out.append(text[position:start] + _ce_to_latex(text[start + 4:end]))
        position = end + 1


def _mark_columns(markdown: str) -> str:
    """Mỗi dòng có [[TAB]] (đáp án xếp ngang) thành một đoạn riêng, để chia cột theo từng dòng."""
    def replace(match: re.Match) -> str:
        line = match.group(0)
        if line.lstrip().startswith("|") or not _COLUMN_RE.search(line):
            return line
        return f"\n{_COLUMN_RE.sub(f' {_COLUMN_TOKEN} ', line)}\n"

    return re.sub(r"^.+$", replace, markdown, flags=re.M)


def _docx_column_runs(match: re.Match) -> str:
    """Tách một run chứa token thành các run chữ xen kẽ dấu tab, giữ nguyên định dạng."""
    props = match.group(1) or ""
    runs = []
    for index, part in enumerate(_COLUMN_SPLIT_RE.split(match.group(2))):
        if index:
            runs.append(f"<w:r>{props}<w:tab/></w:r>")
        if part:
            runs.append(f'<w:r>{props}<w:t xml:space="preserve">{part}</w:t></w:r>')
    return "".join(runs)


def _docx_paragraph_tabs(match: re.Match) -> str:
    """Đặt tab stop chia đều vùng chữ: căn thẳng hàng như giáo viên vẫn gõ đề, và sửa được trong Word."""
    paragraph = match.group(0)
    tabs = paragraph.count("<w:tab/>")
    if not tabs:
        return paragraph
    stops = "".join(
        f'<w:tab w:val="left" w:pos="{_DOCX_TEXT_WIDTH * i // (tabs + 1)}"/>' for i in range(1, tabs + 1)
    )
    block = f"<w:tabs>{stops}</w:tabs>"
    style = re.search(r"<w:pStyle [^>]*/>", paragraph)
    if style:   # theo schema của Word, tabs phải đứng sau pStyle
        return paragraph[:style.end()] + block + paragraph[style.end():]
    if "<w:pPr>" in paragraph:
        return paragraph.replace("<w:pPr>", f"<w:pPr>{block}", 1)
    return re.sub(r"^<w:p(?: [^>]*)?>", lambda m: f"{m.group(0)}<w:pPr>{block}</w:pPr>", paragraph, count=1)


def _apply_docx_columns(docx: bytes) -> bytes:
    source = zipfile.ZipFile(io.BytesIO(docx))
    xml = source.read("word/document.xml").decode("utf-8")
    if _COLUMN_TOKEN not in xml:
        return docx
    xml = re.sub(
        rf"<w:r(?: [^>]*)?>(<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>|<w:rPr ?/>)?<w:t(?: [^>]*)?>([^<]*{_COLUMN_TOKEN}[^<]*)</w:t></w:r>",
        _docx_column_runs, xml, flags=re.S,
    )
    xml = re.sub(r"<w:p(?: [^>]*)?>(?:(?!</w:p>).)*</w:p>", _docx_paragraph_tabs, xml, flags=re.S)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            data = xml.encode("utf-8") if info.filename == "word/document.xml" else source.read(info.filename)
            target.writestr(info, data)
    return output.getvalue()


def _latex_columns(body: str) -> str:
    def render(paragraph: str) -> str:
        if _COLUMN_TOKEN not in paragraph:
            return paragraph
        cells = _COLUMN_SPLIT_RE.split(paragraph.strip())
        width = 0.98 / len(cells)
        boxes = [f"\\begin{{minipage}}[t]{{{width:.3f}\\linewidth}}\n{cell}\n\\end{{minipage}}" for cell in cells]
        return "\\noindent " + "\\hfill\n".join(boxes)

    return "".join(render(part) for part in re.split(r"(\n\s*\n)", body))


def _pandoc(markdown: str, to: str) -> bytes:
    # --sandbox: Markdown đến từ model đọc ảnh, không được để ![](/etc/passwd) nhúng file server.
    result = subprocess.run(
        [pypandoc.get_pandoc_path(), "--sandbox", "-f", _PANDOC_FROM, "-t", to, "-o", "-"],
        input=markdown.encode("utf-8"), capture_output=True, timeout=PANDOC_TIMEOUT,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", "replace")[:500])
    return result.stdout


def build_docx(pages: list[dict]) -> bytes:
    def render(_page: int, figure: dict) -> str:
        _ext, b64 = _validate_figure(figure)
        mime = "jpeg" if figure["data"].startswith("data:image/jpeg") else "png"
        return f"![](data:image/{mime};base64,{b64}){{width={_width_pct(figure)}%}}"

    return _apply_docx_columns(_pandoc(_substitute_figures(pages, render), "docx"))


def build_docx_mathtype(pages: list[dict]) -> bytes:
    """Word có công thức là đối tượng MathType (Equation.DSMT6). Công thức nào không đổi
    được thì giữ nguyên dạng công thức Word, nên file vẫn đủ nội dung."""
    from omml_converter import convert    # import muộn: gói phụ, lỗi ở đây không được làm hỏng cả backend

    with tempfile.TemporaryDirectory() as folder:
        source, target = Path(folder, "vao.docx"), Path(folder, "ra.docx")
        source.write_bytes(build_docx(pages))
        summary = convert(str(source), str(target))
        if summary.errors:
            print(f"[image-convert] MathType: {summary.errors}/{summary.found} công thức giữ dạng Word")
        return target.read_bytes()


def build_latex_zip(pages: list[dict]) -> bytes:
    files: dict[str, bytes] = {}
    includes: dict[str, str] = {}

    def render(page: int, figure: dict) -> str:
        ext, b64 = _validate_figure(figure)
        name = f"images/p{page}_fig{len(files) + 1}.{ext}"
        files[name] = base64.b64decode(b64)
        # Dùng token chữ-số để pandoc giữ nguyên, thay bằng \includegraphics sau khi convert.
        token = f"IMGCONVTOKEN{len(files)}END"
        includes[token] = (
            "\\begin{center}\n"
            f"\\includegraphics[width={_width_pct(figure) / 100:.2f}\\linewidth]{{{name}}}\n"
            "\\end{center}"
        )
        return token

    body = _latex_columns(_pandoc(_substitute_figures(pages, render), "latex").decode("utf-8"))
    for token, latex in includes.items():
        body = body.replace(token, latex)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("main.tex", _LATEX_TEMPLATE % body)
        for name, data in files.items():
            archive.writestr(name, data)
    return buf.getvalue()

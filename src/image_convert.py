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
import time
import unicodedata
import zipfile

import cv2
import numpy as np
import pypandoc
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_MODEL_SIDE = 2000      # cạnh dài của bản gửi Groq; hình cắt vẫn lấy từ ảnh gốc
MAX_FIGURES_PER_PAGE = 20
MAX_DETECT_SIDE = 3000     # ảnh lớn hơn được thu nhỏ khi dò hình rồi quy đổi lại toạ độ
PNG_LIMIT_BYTES = 2_000_000
RECOGNIZE_MAX_TOKENS = 8000
OVERLOAD_RETRIES = 3
PANDOC_TIMEOUT = 120

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

PROMPT = r"""Transcribe this document image into Markdown, exactly as printed.

Rules:
- Keep the original language, wording and reading order. Do not solve, translate, summarise, correct or add anything.
- Write EVERY mathematical expression in LaTeX, even a single variable or number with a unit in a formula: $...$ for inline, $$...$$ for display. Never use Unicode math symbols, \( \) or \[ \].
- Join lines that are only wrapped by the page width into one line. Start a new line for each new paragraph, question and answer option (A., B., C., D. or a), b), c), d)).
- Write tables as Markdown pipe tables, with formulas inside cells.
- Write fill-in blanks as a run of dots (......), never as underscores.
- Bold text may use **...**. Do not use Markdown headings or code blocks.
- Do NOT describe or redraw pictures. For each graph, chart, geometric drawing, diagram or photo, output [[FIGURE]] on its own line at the position where it appears. Tables and formulas are not figures.
- Output only the transcription, with no comments and no code fences."""

_FIGURE_RE = re.compile(r"\[\[\s*FIGURE\b[^\]\n]*\]\]", re.I)
_FIG_REF_RE = re.compile(r"\[\[FIG:(\d+)\]\]")

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
    return re.sub(r"^[ \t]+", "", text, flags=re.M)  # thụt ≥4 dấu cách thành code block


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
    return {"markdown": markdown, "figures": figures, "warnings": warnings}


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

        parts.append(_FIG_REF_RE.sub(replace, str(page.get("markdown") or "")))
    return "\n\n".join(parts)


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

    return _pandoc(_substitute_figures(pages, render), "docx")


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

    body = _pandoc(_substitute_figures(pages, render), "latex").decode("utf-8")
    for token, latex in includes.items():
        body = body.replace(token, latex)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("main.tex", _LATEX_TEMPLATE % body)
        for name, data in files.items():
            archive.writestr(name, data)
    return buf.getvalue()

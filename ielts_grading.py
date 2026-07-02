"""
IELTS Writing grading — chấm bài Writing Task 1 / Task 2 bằng Groq.

Pipeline:
  1. Trích xuất đề bài từ tài liệu giáo viên đính kèm (ảnh/PDF → vision model
     mô tả biểu đồ + chép lại đề — quan trọng với Task 1).
  2. Trích xuất bài làm học sinh từ file nộp (txt/md/docx/pdf đọc text;
     ảnh hoặc PDF scan → vision model OCR).
  3. Chấm bằng llama-3.3-70b-versatile theo band descriptors trong
     tieu_chi_writing/task1.txt & task2.txt (part 1 ↔ task 1, part 2 ↔ task 2).
"""

import base64
import json
import math
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import fitz  # pymupdf

_BASE = Path(__file__).parent
_CRITERIA_DIR = _BASE / "tieu_chi_writing"

# Model chấm điểm (text) — theo lựa chọn: llama 3.3 70B trên Groq
GRADER_MODEL = "llama-3.3-70b-versatile"
# Model vision — đọc ảnh đề bài Task 1 & OCR bài viết tay (70B không có vision)
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

_IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp")

CRITERIA_KEYS = ["task_response", "coherence_cohesion", "lexical_resource", "grammatical_range"]


def load_criteria(task_type: str) -> str:
    """Đọc band descriptors: 'task1' → task1.txt, 'task2' → task2.txt."""
    n = "1" if task_type == "task1" else "2"
    f = _CRITERIA_DIR / f"task{n}.txt"
    return f.read_text(encoding="utf-8") if f.exists() else ""


# ─── File helpers ─────────────────────────────────────────────────────────────

def _resolve_path(file_meta: dict, docs_dir: Path) -> Optional[Path]:
    """Metadata file (từ /api/class-documents/upload) → đường dẫn trên đĩa."""
    name = file_meta.get("filename") or Path(str(file_meta.get("url", ""))).name
    if not name:
        return None
    p = docs_dir / Path(name).name          # chặn path traversal
    return p if p.exists() else None


def _file_to_images(path: Path, mime: str = "") -> list[tuple[str, str]]:
    """Trả về list (b64, mime) — ảnh giữ nguyên, PDF render từng trang (tối đa 3)."""
    suffix = path.suffix.lower()
    if suffix == ".pdf" or mime == "application/pdf":
        out = []
        with fitz.open(path) as doc:
            for page in doc[:3]:
                pix = page.get_pixmap(dpi=150)
                out.append((base64.b64encode(pix.tobytes("png")).decode(), "image/png"))
        return out
    if suffix in _IMG_EXT:
        m = mime if mime.startswith("image/") else f"image/{suffix.lstrip('.').replace('jpg', 'jpeg')}"
        return [(base64.b64encode(path.read_bytes()).decode(), m)]
    return []


def _docx_text(path: Path) -> str:
    """Đọc text từ .docx không cần python-docx (docx = zip chứa word/document.xml)."""
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
        xml = re.sub(r"</w:p>", "\n", xml)
        return re.sub(r"<[^>]+>", "", xml).strip()
    except Exception:
        return ""


def _pdf_text(path: Path) -> str:
    try:
        with fitz.open(path) as doc:
            return "\n".join(page.get_text() for page in doc).strip()
    except Exception:
        return ""


# ─── Vision calls ─────────────────────────────────────────────────────────────

def _vision_call(client, prompt: str, images: list[tuple[str, str]], max_tokens=2000) -> str:
    content = [{"type": "image_url", "image_url": {"url": f"data:{m};base64,{b64}"}}
               for b64, m in images[:4]]
    content.append({"type": "text", "text": prompt})
    resp = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[{"role": "user", "content": content}],
        temperature=0.1,
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


def describe_task_attachments(client, attachments: list, docs_dir: Path) -> str:
    """
    Trích xuất đề bài từ tài liệu giáo viên đính kèm (ảnh đề IELTS).
    Với Task 1: chép lại đề + mô tả chi tiết biểu đồ/bảng/sơ đồ kèm số liệu.
    """
    images = []
    for f in attachments or []:
        p = _resolve_path(f, docs_dir)
        if p is not None:
            images.extend(_file_to_images(p, f.get("mimeType", "")))
    if not images:
        return ""
    prompt = (
        "This image contains an IELTS Writing task prompt.\n"
        "1. Transcribe the full task instruction text exactly as written.\n"
        "2. If there is a chart, graph, table, map, or process diagram: describe it in "
        "complete detail — type of visual, title, axes/units, categories, and ALL data "
        "values/trends visible, so an examiner could verify the accuracy of an essay "
        "without seeing the image.\n"
        "Answer in English, plain text."
    )
    try:
        return _vision_call(client, prompt, images, max_tokens=2500)
    except Exception:
        return ""


def extract_essay_text(client, files: list, docs_dir: Path) -> str:
    """Ghép bài làm học sinh từ các file đã nộp (text đọc trực tiếp, ảnh/scan OCR)."""
    parts: list[str] = []
    ocr_images: list[tuple[str, str]] = []
    for f in files or []:
        p = _resolve_path(f, docs_dir)
        if p is None:
            continue
        suffix = p.suffix.lower()
        if suffix in (".txt", ".md"):
            parts.append(p.read_text(encoding="utf-8", errors="ignore").strip())
        elif suffix == ".docx":
            parts.append(_docx_text(p))
        elif suffix == ".pdf":
            text = _pdf_text(p)
            if len(text) >= 80:                     # PDF có text layer
                parts.append(text)
            else:                                   # PDF scan → OCR
                ocr_images.extend(_file_to_images(p))
        elif suffix in _IMG_EXT:
            ocr_images.extend(_file_to_images(p, f.get("mimeType", "")))
    if ocr_images:
        prompt = (
            "Transcribe the English essay in the image(s) exactly as written, including "
            "all errors. Preserve paragraph breaks. Output ONLY the transcribed essay text, "
            "no commentary."
        )
        try:
            parts.append(_vision_call(client, prompt, ocr_images, max_tokens=2500))
        except Exception:
            pass
    return "\n\n".join(t for t in parts if t).strip()


# ─── Grading ──────────────────────────────────────────────────────────────────

def _robust_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


def _clamp_band(v) -> float:
    """Ép band về thang 0–9, bước 0.5."""
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(9.0, round(x * 2) / 2))


def _overall_band(bands: list[float]) -> float:
    """Điểm tổng IELTS = trung bình 4 tiêu chí, làm tròn LÊN về 0.5 gần nhất (.25→.5, .75→1.0)."""
    avg = sum(bands) / len(bands)
    return math.floor(avg * 2 + 0.5) / 2


def grade_essay(client, task_type: str, question_text: str, image_desc: str, essay_text: str) -> dict:
    """Chấm bài theo band descriptors. Trả về dict kết quả đầy đủ (aiGrade)."""
    criteria_txt = load_criteria(task_type)
    is_t1 = task_type == "task1"
    c1_label = "Task Achievement" if is_t1 else "Task Response"
    word_count = len(essay_text.split())
    min_words = 150 if is_t1 else 250

    prompt = f"""You are a certified IELTS examiner. Grade the following IELTS Writing {"Task 1" if is_t1 else "Task 2"} essay strictly according to the official band descriptors below.

=== OFFICIAL BAND DESCRIPTORS (IELTS Writing {"Task 1" if is_t1 else "Task 2"}) ===
{criteria_txt}

=== TASK PROMPT ===
{question_text or "(not provided)"}
{f'''
=== VISUAL DATA IN THE TASK (chart/graph/table description) ===
{image_desc}''' if image_desc else ""}

=== STUDENT ESSAY ({word_count} words — minimum required: {min_words}) ===
{essay_text}

=== INSTRUCTIONS ===
- Assign a band (0-9, in 0.5 steps) for each of the 4 criteria. Be strict and realistic like a real examiner; penalize under-length essays and memorized/irrelevant responses per the descriptors.
- "comment" fields, "feedback", "strengths", "improvements" and "explain" MUST be written in VIETNAMESE (tiếng Việt) so the student understands. Quote English phrases from the essay where relevant.
- "feedback": nhận xét tổng quan chi tiết 4-8 câu.
- "corrections": 3-8 lỗi tiêu biểu nhất trong bài (ngữ pháp/từ vựng), mỗi lỗi gồm câu gốc, câu sửa, giải thích ngắn.

Return ONLY valid JSON with exactly this structure:
{{
  "criteria": {{
    "task_response": {{"band": 6.0, "comment": "..."}},
    "coherence_cohesion": {{"band": 6.0, "comment": "..."}},
    "lexical_resource": {{"band": 6.0, "comment": "..."}},
    "grammatical_range": {{"band": 6.0, "comment": "..."}}
  }},
  "feedback": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "corrections": [{{"error": "...", "fix": "...", "explain": "..."}}]
}}"""

    # Model đôi khi sinh JSON lỗi → thử JSON mode trước, lỗi thì thử lại ở plain mode
    data = None
    last_err = None
    for attempt, use_json_mode in enumerate((True, False, False)):
        try:
            kwargs = {"response_format": {"type": "json_object"}} if use_json_mode else {}
            resp = client.chat.completions.create(
                model=GRADER_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2 if attempt == 0 else 0.4,
                max_tokens=3500,
                **kwargs,
            )
            data = _robust_json((resp.choices[0].message.content or "").strip())
            break
        except Exception as e:
            last_err = e
    if data is None:
        raise last_err

    crit_in = data.get("criteria") or {}
    criteria = {}
    for key in CRITERIA_KEYS:
        c = crit_in.get(key) or {}
        criteria[key] = {"band": _clamp_band(c.get("band")), "comment": str(c.get("comment") or "")}

    return {
        "status": "done",
        "taskType": task_type,
        "criterionLabel": c1_label,          # nhãn tiêu chí 1 (TA cho task 1 / TR cho task 2)
        "gradedAt": datetime.now(timezone.utc).isoformat(),
        "model": GRADER_MODEL,
        "wordCount": word_count,
        "questionText": question_text or "",
        "imageDesc": image_desc or "",
        "essayText": essay_text,
        "criteria": criteria,
        "overallBand": _overall_band([criteria[k]["band"] for k in CRITERIA_KEYS]),
        "feedback": str(data.get("feedback") or ""),
        "strengths": [str(s) for s in (data.get("strengths") or [])],
        "improvements": [str(s) for s in (data.get("improvements") or [])],
        "corrections": [
            {"error": str(c.get("error") or ""), "fix": str(c.get("fix") or ""),
             "explain": str(c.get("explain") or "")}
            for c in (data.get("corrections") or []) if isinstance(c, dict)
        ],
    }


def run_grading(client, assignment: dict, submission: dict, docs_dir: Path) -> dict:
    """Pipeline đầy đủ: đề bài (ảnh đính kèm) + bài làm (file nộp) → kết quả chấm."""
    task_type = assignment.get("writingTask") or "task2"

    question_text = "\n".join(
        t for t in (assignment.get("title"), assignment.get("description")) if t
    ).strip()

    # Task 1: cố gắng trích xuất ảnh đề bài từ tài liệu giáo viên đính kèm
    image_desc = ""
    if assignment.get("attachments"):
        image_desc = describe_task_attachments(client, assignment["attachments"], docs_dir)

    essay_text = extract_essay_text(client, submission.get("files") or [], docs_dir)
    if not essay_text and (submission.get("note") or "").strip():
        essay_text = submission["note"].strip()   # học sinh dán bài vào ghi chú
    if not essay_text:
        return {"status": "error", "error": "Không đọc được nội dung bài làm từ file đã nộp.",
                "gradedAt": datetime.now(timezone.utc).isoformat()}
    if len(essay_text.split()) < 30:
        return {"status": "error", "error": "Bài làm quá ngắn hoặc OCR không đọc được chữ.",
                "gradedAt": datetime.now(timezone.utc).isoformat()}

    return grade_essay(client, task_type, question_text, image_desc, essay_text)

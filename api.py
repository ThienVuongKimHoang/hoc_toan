"""
FastAPI server: nhận upload PDF → trích xuất câu hỏi qua GROQ Vision → stream tiến trình SSE.

Chạy: uvicorn api:app --reload --port 8000
"""

import asyncio
import copy
import json
import os
import secrets
import sys
import tempfile
import uuid
from pathlib import Path
from typing import AsyncGenerator, Optional

import fitz
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from groq import Groq
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import datetime, timezone as _tz
import random as _random
import string as _string

SRC_DIR = Path(__file__).parent / "src"
sys.path.insert(0, str(SRC_DIR))

from extract_questions import (  # noqa: E402
    SECTION_POINTS,
    auto_detect_section_counts,
    build_section_context,
    derive_section_counts,
    extract_embedded_images,
    extract_math_answers_from_page,
    extract_page,
    find_answer_key_page,
    load_api_keys,
    repair_truncated_json,
    sanitize_json_escapes,
    scan_pdf_layout,
    scan_question_starts,
)
from extract_english import (  # noqa: E402
    detect_exam_subject,
    run_english,
)

IMAGES_DIR = SRC_DIR / "output" / "images"
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

import database as db
import ielts_grading as ielts

# task_id → {"status": pending|running|done|error, "progress": [...], "result": ..., "error": ...}
TASKS: dict[str, dict] = {}

# Cache trong RAM các IP bị cấm, nạp lại khi khởi động + mỗi lần super_admin ban/unban
BANNED_IPS: set[str] = set()

# Mặc định ẩn Swagger/ReDoc/OpenAPI schema (không lộ danh sách endpoint cho người ngoài).
# Bật lại khi cần xem docs lúc dev: export ENABLE_API_DOCS=1
_ENABLE_DOCS = os.getenv("ENABLE_API_DOCS", "").lower() in ("1", "true", "yes")
app = FastAPI(
    title="Hoc Toan API",
    docs_url="/docs" if _ENABLE_DOCS else None,
    redoc_url="/redoc" if _ENABLE_DOCS else None,
    openapi_url="/openapi.json" if _ENABLE_DOCS else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _client_ip(request: Request) -> str:
    """Lấy IP thật của client, ưu tiên header do Nginx set (X-Forwarded-For / X-Real-IP)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def _block_banned_ips(request: Request, call_next):
    if _client_ip(request) in BANNED_IPS:
        return JSONResponse({"error": "Địa chỉ IP của bạn đã bị cấm truy cập."}, status_code=403)
    return await call_next(request)


@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException):
    """Giữ đúng format lỗi hiện tại của app ({"error": ...}) thay vì {"detail": ...}
    mặc định của FastAPI, để các đoạn frontend đọc err.error không cần đổi."""
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


# ── Xác thực: session token thay cho teacherId/studentId/viewerId client tự khai ──

SESSION_TTL_DAYS = 30


async def get_current_user(request: Request) -> Optional[dict]:
    """Người gọi đã đăng nhập (nếu có) — suy ra từ header Authorization: Bearer <token>.
    Trả None nếu không có/token sai/hết hạn — dùng cho route vẫn cho phép ẩn danh."""
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    return db.get_session_user(auth[7:].strip())


async def require_auth(user: Optional[dict] = Depends(get_current_user)) -> dict:
    """Bắt buộc đã đăng nhập — 401 nếu thiếu/hết hạn token."""
    if not user:
        raise HTTPException(401, "Chưa đăng nhập hoặc phiên đã hết hạn.")
    return user


async def require_admin(user: dict = Depends(require_auth)) -> dict:
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Không có quyền truy cập.")
    return user


async def require_super_admin(user: dict = Depends(require_auth)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Chỉ super_admin mới có quyền này.")
    return user


@app.get("/api/security/check-ip")
async def security_check_ip():
    """Nginx gọi endpoint này qua auth_request để hỏi IP hiện tại có bị cấm không.
    Middleware _block_banned_ips đã trả 403 cho IP bị cấm trước khi tới đây,
    nên handler này chỉ chạy khi IP không bị cấm → luôn trả 200."""
    return {"ok": True}


@app.on_event("startup")
async def _startup():
    db.init_db()
    BANNED_IPS.update(ip["ip"] for ip in db.list_banned_ips())
    _migrate_split_multisubject_classes()
    asyncio.create_task(_report_scanner_loop())


_CLASSIFY_BATCH = 15   # câu mỗi lần gọi Groq

def _classify_inplace(groq_client, questions: list, task: dict, subject: str = "toan") -> None:
    """Phân loại topic + difficulty cho toàn bộ questions (sửa in-place). Non-fatal.
    Đề trích từ PDF mặc định là cấp THPT."""
    topic_list, subject_name = _topic_list_for(subject, "thpt")
    total = len(questions)
    done  = 0
    for batch_start in range(0, total, _CLASSIFY_BATCH):
        batch = questions[batch_start: batch_start + _CLASSIFY_BATCH]
        try:
            lines = []
            for i, q in enumerate(batch):
                text = (q.get("question_text") or "").strip()[:250]
                lines.append(f"{i+1}. {text}")
            q_str     = "\n".join(lines)
            topics_str = "\n".join(f"- {t}" for t in topic_list)
            prompt = (
                f"Phân loại {len(batch)} câu hỏi {subject_name} THPT theo 4 mức độ nhận thức của Bộ GD&ĐT Việt Nam. "
                f"Trả về JSON array có đúng {len(batch)} phần tử, không giải thích.\n\n"
                f"Câu hỏi:\n{q_str}\n\n"
                f"Chủ đề hợp lệ:\n{topics_str}\n\n"
                f"Mức độ (chọn đúng tên):\n"
                f"- Nhận biết: nhớ công thức, định nghĩa, nhận diện khái niệm\n"
                f"- Thông hiểu: hiểu bản chất, áp dụng trực tiếp công thức\n"
                f"- Vận dụng: kết hợp nhiều kiến thức để giải\n"
                f"- Vận dụng cao: bài toán mới, nhiều bước suy luận, cần tư duy sâu\n\n"
                f'JSON: [{{"topic_label":"...","level_label":"..."}},...]'
            )
            resp = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=len(batch) * 25 + 50,
            )
            raw    = resp.choices[0].message.content.strip()
            raw    = raw.strip("```json").strip("```").strip()
            labels = json.loads(raw)
            if isinstance(labels, list):
                for q, lbl in zip(batch, labels):
                    if isinstance(lbl, dict):
                        q["topic_label"] = lbl.get("topic_label") or None
                        q["level_label"] = lbl.get("level_label") or None
        except Exception:
            pass   # phân loại thất bại → để trống, không ảnh hưởng kết quả
        done += len(batch)
        task["progress"].append({"type": "classifying", "done": done, "total": total})


def _question_richness(q: dict) -> int:
    """Điểm 'độ đầy đủ' của một câu hỏi để chọn bản tốt nhất khi trùng (section, số câu)."""
    score = len((q.get("question_text") or "").strip())
    for v in (q.get("choices") or {}).values():
        score += len((v or "").strip())
    score += 20 * len(q.get("sub_questions") or [])
    return score


def _section_answer_type(sec_data: dict) -> str:
    """Loại đáp án của một phần: 'multiple_choice' | 'true_false' | 'short_answer'.

    Ưu tiên field 'type'; nếu không rõ (đề không theo tên PHẦN I/II/III) thì suy ra từ
    HÌNH DẠNG câu hỏi: có sub_questions → Đúng/Sai; có choices → trắc nghiệm; còn lại → trả lời ngắn.
    """
    stype = sec_data.get("type")
    if stype in ("multiple_choice", "true_false", "short_answer"):
        return stype
    qs = sec_data.get("questions") or []
    if any(q.get("sub_questions") for q in qs):
        return "true_false"
    if any(q.get("choices") for q in qs):
        return "multiple_choice"
    return "short_answer"


def _all_questions_answered(result: dict, answers: dict) -> bool:
    """True nếu MỌI câu đã trích đều có đáp án tương ứng trong `answers`.

    Không giả định cấu trúc/số câu: đề thuần trắc nghiệm (chỉ PHẦN I) hay đủ 3 phần đều đúng.
    Phần rỗng (không có câu) tự thỏa mãn.
    """
    for sec_data in result.get("sections", {}).values():
        amap = answers.get(_section_answer_type(sec_data)) or {}
        for q in sec_data.get("questions", []):
            if q.get("question_number") not in amap:
                return False
    return True


def _apply_math_answer_key(result: dict, answers: dict) -> int:
    """Ghi đè đáp án chính thức (từ trang ĐÁP ÁN) vào câu hỏi. Trả về số câu được điền.

    answers: {"multiple_choice": {num: "A"}, "true_false": {num: {"a": bool,...}},
              "short_answer": {num: "val"}} — keyed theo LOẠI phần (khớp field "type").
    """
    filled = 0
    for sec_data in result.get("sections", {}).values():
        atype = _section_answer_type(sec_data)
        amap = answers.get(atype)
        if not amap:
            continue
        for q in sec_data.get("questions", []):
            num = q.get("question_number")
            if num not in amap:
                continue
            val = amap[num]
            if atype == "true_false":
                changed = False
                for sub in q.get("sub_questions") or []:
                    lbl = str(sub.get("label", "")).strip().lower()
                    if lbl in val:
                        sub["correct_answer"] = val[lbl]
                        changed = True
                if changed:
                    filled += 1
            else:
                q["answer"] = val
                filled += 1
    return filled


def _run_extraction(task_id: str, pdf_path: Path, original_name: str = "", exam_subject: str = "toan") -> None:
    """Chạy trong thread pool; cập nhật TASKS[task_id] theo thời gian thực.
    `exam_subject` (toan|ly|hoa…) do GV chọn khi tạo — quyết định bộ nhãn khi auto-phân loại;
    khác với `subject` phát hiện từ nội dung PDF (math|english) dùng để chọn pipeline trích xuất."""
    task = TASKS[task_id]
    task["status"] = "running"
    task["subject"] = exam_subject
    source_name = original_name or pdf_path.name
    try:
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

        keys = load_api_keys()
        client = Groq(api_key=keys[0])
        fallback_clients = [Groq(api_key=k) for k in keys[1:]]
        doc = fitz.open(str(pdf_path))

        task["progress"].append({"type": "start", "total_pages": doc.page_count,
                                  "source": source_name})

        subject = detect_exam_subject(doc)

        # ── Đề Tiếng Anh ──────────────────────────────────────────────────
        if subject == "english":
            def _eng_progress(evt):
                task["progress"].append(evt)

            result = run_english(pdf_path, client, fallback_clients, _eng_progress)
            result["source"] = source_name
            total = result.get("total_questions", 0)
            task["result"] = result
            task["status"] = "done"
            task["progress"].append({"type": "done", "total_questions": total})
            return

        # ── Đề Toán (mặc định) ────────────────────────────────────────────
        # Phát hiện phần ĐÁP ÁN (thường ở các trang cuối). Nếu có → chỉ trích câu hỏi
        # ở các trang TRƯỚC đáp án, rồi lấy đáp án chính thức từ trang đáp án (không để
        # Groq tự "giải" từng câu).
        ak_page = find_answer_key_page(doc)
        # ak_page >= 1: phải có ít nhất 1 trang câu hỏi trước phần đáp án.
        # Trang ranh giới (ak_page) thường HỖN HỢP (đuôi câu hỏi + đầu bảng đáp án),
        # nên VẪN trích câu hỏi ở trang này (prompt sẽ tự dừng ở mốc "ĐÁP ÁN"/"HẾT").
        has_answer_key = ak_page >= 1
        q_page_count = (ak_page + 1) if has_answer_key else doc.page_count

        section_header_page, section_q_start_page, page_active_sections, detected_sections = scan_pdf_layout(doc)
        q_starts = scan_question_starts(doc, section_q_start_page, section_header_page)
        text_counts = auto_detect_section_counts(doc, section_q_start_page, section_header_page)

        all_questions: list[dict] = []
        last_q_per_section: dict[str, int] = {}

        for i in range(q_page_count):
            active = page_active_sections[i]
            section_ctx = build_section_context(i, active, section_header_page, q_starts, detected_sections)
            page_images = extract_embedded_images(doc, i, IMAGES_DIR)
            content_images = [img for img in page_images if img["is_content"]]

            questions = extract_page(client, doc[i], i + 1, section_ctx,
                                     dict(last_q_per_section),
                                     page_images=content_images,
                                     fallback_clients=fallback_clients)

            for q in questions:
                fig_idx = q.pop("figure_index", 0)
                if isinstance(fig_idx, int) and 1 <= fig_idx <= len(content_images):
                    q["figure_path"] = content_images[fig_idx - 1]["path"]
                q["has_figure"] = "figure_path" in q
                sec = q.get("section", "")
                num = q.get("question_number", 0)
                if sec and isinstance(num, int) and num > last_q_per_section.get(sec, 0):
                    last_q_per_section[sec] = num

            all_questions.extend(questions)
            task["progress"].append({
                "type": "page_done",
                "page": i + 1,
                "total": doc.page_count,
                "questions_found": len(questions),
                "sections": active,
            })

        # Suy detected_counts TỪ CHÍNH kết quả vừa trích (không tốn thêm Vision call) —
        # xem derive_section_counts(): cap luôn >= số câu Vision thực sự đọc được, nên
        # không còn nguy cơ tự lọc bỏ oan câu hỏi đúng của chính lượt trích xuất này.
        detected_counts = derive_section_counts(all_questions, text_counts)

        # Dedup: với mỗi (section, q_num) giữ bản ĐẦY ĐỦ nhất (tránh bảng đáp án ở
        # trang ranh giới ghi đè câu hỏi thật bằng bản rỗng).
        deduped: dict = {}
        for q in all_questions:
            sec = q.get("section", "")
            num = q.get("question_number")
            if not sec or num is None:
                continue
            if detected_counts and sec in detected_counts:
                max_num = detected_counts[sec]
            else:
                max_num = SECTION_POINTS.get(sec, {}).get("count", 999)
            if not isinstance(num, int) or num < 1 or num > max_num:
                continue
            prev = deduped.get((sec, num))
            if prev is None or _question_richness(q) >= _question_richness(prev):
                deduped[(sec, num)] = q

        clean_questions = list(deduped.values())

        # Thu thập tất cả sections (kể cả ngoài SECTION_POINTS)
        found_sections = sorted(set(q.get("section", "") for q in clean_questions if q.get("section")))
        all_sections = list(SECTION_POINTS.keys())
        for sec in found_sections:
            if sec not in all_sections:
                all_sections.append(sec)

        result = {
            "source": source_name,
            "subject": "math",
            "total_questions": len(clean_questions),
            "sections": {},
        }
        for sec in all_sections:
            if detected_sections and sec in detected_sections:
                info = {k: v for k, v in detected_sections[sec].items() if k != "description"}
            else:
                info = SECTION_POINTS.get(sec, {"type": "unknown", "points_per_q": 0, "total": 0})
            qs = sorted(
                [q for q in clean_questions if q.get("section") == sec],
                key=lambda q: q.get("question_number", 0),
            )
            result["sections"][sec] = {**info, "questions": qs}

        # ── Trích đáp án từ phần ĐÁP ÁN & ghi đè vào câu hỏi ─────────────
        result["has_answer_key"] = has_answer_key
        if has_answer_key:
            # Quét các trang đáp án cho tới khi MỌI câu đã trích đều có đáp án (bảng đáp
            # án gọn thường nằm ngay đầu phần đáp án; các trang lời giải chi tiết phía sau
            # là dư thừa → dừng sớm, khỏi gọi Vision thêm). Không giả định số câu/số phần,
            # nên đề thuần trắc nghiệm hay đủ 3 phần đều xử lý đúng.
            merged = {"multiple_choice": {}, "true_false": {}, "short_answer": {}}
            has_questions = any(s.get("questions") for s in result["sections"].values())
            for i in range(ak_page, doc.page_count):
                page_ans = extract_math_answers_from_page(client, doc[i], i + 1, fallback_clients)
                for stype, amap in page_ans.items():
                    merged[stype].update(amap)
                found = sum(len(v) for v in page_ans.values())
                task["progress"].append({
                    "type": "page_done",
                    "page": i + 1,
                    "total": doc.page_count,
                    "questions_found": found,
                    "sections": ["ĐÁP ÁN"],
                    "phase": "answers",
                })
                if has_questions and _all_questions_answered(result, merged):
                    break
            result["answers_filled"] = _apply_math_answer_key(result, merged)

        # ── Auto-classify topics & difficulty ────────────────────────────
        all_qs_flat = [q for sec_data in result["sections"].values() for q in sec_data["questions"]]
        if all_qs_flat:
            task["progress"].append({"type": "classifying", "done": 0, "total": len(all_qs_flat)})
            _classify_inplace(client, all_qs_flat, task, exam_subject)

        task["result"] = result
        task["status"] = "done"
        task["progress"].append({
            "type": "done",
            "total_questions": len(clean_questions),
            "has_answer_key": result.get("has_answer_key", False),
            "answers_filled": result.get("answers_filled", 0),
        })

    except Exception as exc:
        task["status"] = "error"
        task["error"] = str(exc)
        task["progress"].append({"type": "error", "message": str(exc)})
    finally:
        pdf_path.unlink(missing_ok=True)


@app.post("/api/extract")
async def extract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: str = Form("toan"),
):
    """Nhận PDF upload, bắt đầu trích xuất nền, trả về task_id."""
    task_id = str(uuid.uuid4())
    TASKS[task_id] = {"status": "pending", "progress": [], "result": None, "error": None}

    original_name = file.filename or "upload.pdf"
    content = await file.read()
    suffix = Path(original_name).suffix or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(content)
    tmp.close()

    background_tasks.add_task(_run_extraction, task_id, Path(tmp.name), original_name, subject)
    return {"task_id": task_id}


async def _sse_generator(task_id: str) -> AsyncGenerator[str, None]:
    task = TASKS.get(task_id)
    if not task:
        yield f"data: {json.dumps({'type': 'error', 'message': 'Task not found'})}\n\n"
        return

    sent = 0
    while True:
        while sent < len(task["progress"]):
            yield f"data: {json.dumps(task['progress'][sent])}\n\n"
            sent += 1
        if task["status"] in ("done", "error"):
            break
        await asyncio.sleep(0.25)


@app.get("/api/progress/{task_id}")
async def progress(task_id: str):
    """Server-Sent Events stream: tiến trình trích xuất theo trang."""
    return StreamingResponse(
        _sse_generator(task_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/result/{task_id}")
async def result(task_id: str):
    """Lấy kết quả JSON khi extraction hoàn tất."""
    task = TASKS.get(task_id)
    if not task:
        return JSONResponse({"error": "Task not found"}, status_code=404)
    if task["status"] == "error":
        return JSONResponse({"error": task["error"]}, status_code=422)
    if task["status"] != "done":
        return JSONResponse({"error": f"Task đang chạy: {task['status']}"}, status_code=202)
    return task["result"]


# ─── Chấm điểm phía server (đồng bộ với calcScore ở frontend) ────────────────

def _round2(x: float) -> float:
    return int(x * 100 + 0.5) / 100   # làm tròn nửa lên như Math.round


def _calc_score(exam: dict, answers: dict) -> float:
    answers = answers or {}
    secs = exam.get("sections") or {}
    score = 0.0

    p1 = secs.get("PHẦN I")
    if p1:
        ppq = p1.get("points_per_q") or 0.25
        for q in (p1.get("questions") or []):
            if answers.get(f"I_{q.get('question_number')}") == q.get("answer"):
                score += ppq

    p2 = secs.get("PHẦN II")
    if p2:
        ppq = p2.get("points_per_q") or 1.0
        for q in (p2.get("questions") or []):
            user = answers.get(f"II_{q.get('question_number')}") or {}
            subs = q.get("sub_questions") or []
            total = len(subs)
            n_right = sum(1 for s in subs if user.get(s.get("label")) == s.get("correct_answer"))
            pts = 0.0
            if total:
                if   n_right == total:     pts = ppq
                elif n_right == total - 1: pts = ppq * 0.5
                elif n_right == total - 2: pts = ppq * 0.25
                elif n_right == total - 3: pts = ppq * 0.1
            score += pts

    p3 = secs.get("PHẦN III")
    if p3:
        ppq = p3.get("points_per_q") or 0.5
        for q in (p3.get("questions") or []):
            user    = str(answers.get(f"III_{q.get('question_number')}") or "").strip().lower()
            correct = str(q.get("answer") or "").strip().lower()
            if user and correct and user == correct:
                score += ppq

    for key, prefix, default in (("TIẾNG ANH", "EN", 0.25), ("READING", "RD", 0.25)):
        sec = secs.get(key)
        if sec:
            ppq = sec.get("points_per_q") or default
            for q in (sec.get("questions") or []):
                if q.get("answer") and answers.get(f"{prefix}_{q.get('question_number')}") == q.get("answer"):
                    score += ppq

    return _round2(score)


def _calc_max_score(exam: dict) -> float:
    secs = exam.get("sections") or {}
    m = 0.0
    p1 = secs.get("PHẦN I")
    if p1: m += len(p1.get("questions") or []) * (p1.get("points_per_q") or 0.25)
    p2 = secs.get("PHẦN II")
    if p2: m += len(p2.get("questions") or []) * (p2.get("points_per_q") or 1.0)
    p3 = secs.get("PHẦN III")
    if p3: m += len(p3.get("questions") or []) * (p3.get("points_per_q") or 0.5)
    for key, default in (("TIẾNG ANH", 0.25), ("READING", 0.25)):
        sec = secs.get(key)
        if sec:
            ppq = sec.get("points_per_q") or default
            m += sum(1 for q in (sec.get("questions") or []) if q.get("answer")) * ppq
    # TỰ LUẬN — điểm tối đa = tổng điểm GV đặt cho từng câu (chấm tay)
    essay = secs.get("TỰ LUẬN")
    if essay:
        m += sum(_to_float(q.get("points")) for q in (essay.get("questions") or []))
    return _round2(m)


def _to_float(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _manual_total(manual_scores) -> float:
    """Tổng điểm chấm tay hợp lệ từ dict {TL_n: điểm}."""
    if not isinstance(manual_scores, dict):
        return 0.0
    return sum(_to_float(v) for v in manual_scores.values())


def _recompute_submissions(exam_id: str, exam: dict) -> int:
    """Chấm lại toàn bộ bài nộp theo đáp án hiện tại của đề. Trả về số bài đã đổi điểm."""
    max_score = _calc_max_score(exam)
    updated = 0
    for sub in db.get_submissions(exam_id):
        # Điểm tự động chấm lại + giữ nguyên điểm tự luận GV đã chấm tay
        new_score = _round2(_calc_score(exam, sub.get("answers") or {})
                            + _manual_total(sub.get("manualScores")))
        if sub.get("score") != new_score or sub.get("maxScore") != max_score:
            db.update_submission_score(sub["id"], new_score, max_score)
            updated += 1
    return updated


def _can_manage_exam(exam: dict, caller_id) -> bool:
    """Người gọi có quyền tạo/sửa/xóa đề thi này không: giáo viên (chính hoặc
    co-teacher) của lớp sở hữu đề, hoặc — với đề "mồ côi" (chưa gắn lớp, tạo
    trước khi có tính năng scope-theo-lớp) — chính người đã tạo ra đề."""
    if not caller_id:
        return False
    cid = str(caller_id)
    class_id = exam.get("classId")
    if class_id:
        cls = db.get_class(class_id)
        if cls and _is_class_teacher(cls, cid):
            return True
    return str(exam.get("createdBy") or "") == cid


def _strip_answers(exam: dict) -> dict:
    """Bản copy của đề thi đã bỏ đáp án đúng khỏi mọi câu hỏi — dùng khi trả đề
    cho người không phải giáo viên sở hữu (học sinh làm bài thật, khách vãng lai)."""
    stripped = copy.deepcopy(exam)
    for section in (stripped.get("sections") or {}).values():
        for q in (section.get("questions") or []):
            q.pop("answer", None)
            for sub in (q.get("sub_questions") or []):
                sub.pop("correct_answer", None)
    return stripped


@app.post("/api/exams/{exam_id}")
async def upsert_exam(exam_id: str, request: Request, caller: dict = Depends(require_auth)):
    """Lưu hoặc cập nhật một đề thi lên server. Nếu đáp án đổi → chấm lại bài đã nộp."""
    body = await request.json()
    existing = db.get_exam(exam_id) or {}
    caller_id = caller["id"]
    if not existing:
        class_id = body.get("classId")
        if not class_id:
            return JSONResponse({"error": "Thiếu lớp học cho đề thi mới"}, status_code=400)
        cls = db.get_class(class_id)
        if not cls or not _is_class_teacher(cls, caller_id):
            return JSONResponse({"error": "Không có quyền tạo đề cho lớp này"}, status_code=403)
    elif not _can_manage_exam(existing, caller_id):
        return JSONResponse({"error": "Không có quyền sửa đề thi này"}, status_code=403)
    body.setdefault("resultsRevealed", existing.get("resultsRevealed", False))
    body.pop("submissions", None)
    db.upsert_exam(exam_id, body)

    # Tự động chấm lại điểm khi đề có câu hỏi (tránh zero hóa nếu payload thiếu sections)
    rescored = 0
    if body.get("sections"):
        try:
            rescored = _recompute_submissions(exam_id, body)
        except Exception as exc:
            print(f"[rescore] error for {exam_id}: {exc}")

    return {"ok": True, "id": exam_id, "rescored": rescored}


@app.get("/api/exams/{exam_id}")
async def get_exam(exam_id: str, caller: Optional[dict] = Depends(get_current_user)):
    """Lấy đề thi theo ID (không trả về submissions). Route công khai (học sinh
    làm bài/xem đề qua link không cần đăng nhập). Ẩn đáp án đúng khỏi response
    trừ khi người gọi là giáo viên sở hữu đề (suy từ session token, không còn
    tự khai), hoặc đề đang bật chế độ luyện tập (practiceSettings.enabled — nơi
    đáp án được cố ý hiển thị ngay sau mỗi câu, đã có mật khẩu/lịch riêng ở
    practice-verify)."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    is_owner = _can_manage_exam(exam, caller["id"] if caller else None)
    practice_open = bool((exam.get("practiceSettings") or {}).get("enabled"))
    if not is_owner and not practice_open:
        exam = _strip_answers(exam)
    return exam


@app.delete("/api/exams/{exam_id}")
async def delete_exam_endpoint(exam_id: str, caller: dict = Depends(require_auth)):
    """Giáo viên xóa đề thi. (Trước đây route này không tồn tại nên nút xóa
    chỉ xóa localStorage — đề 'sống lại' khi mở máy khác.)
    Kèm dọn các lần giao bài trong lớp đang trỏ vào đề này."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa đề thi này"}, status_code=403)
    if not db.delete_exam(exam_id):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


def _asgn_candidates(cls, exam_id):
    """Các lần giao bài trong lớp dùng đề exam_id (một đề có thể giao nhiều lần)."""
    return [a for a in (cls.get("assignments") or []) if a.get("examId") == exam_id]


def _legacy_owner_id(cands):
    """Bài nộp cũ (chưa gắn assignmentId) được tính cho lần giao bài SỚM NHẤT."""
    if not cands:
        return None
    return min(cands, key=lambda a: a.get("createdAt") or "").get("id")


def _sub_belongs_to_asgn(sub, asgn_id, legacy_owner):
    """Bài nộp thuộc lần giao bài asgn_id? Bài cũ không có assignmentId
    được quy về lần giao bài sớm nhất (legacy_owner)."""
    sa = sub.get("assignmentId")
    if sa:
        return str(sa) == str(asgn_id)
    return legacy_owner is not None and str(asgn_id) == str(legacy_owner)


def _is_class_member(cls, student_id, email=None):
    """Học sinh có thuộc lớp không — khớp theo userId hoặc email."""
    if student_id is None:
        return False
    sid = str(student_id)
    em = (email or "").strip().lower()
    if not em:
        try:
            u = db.get_user_by_id(sid)
            em = ((u or {}).get("email") or "").strip().lower()
        except Exception:
            em = ""
    for m in cls.get("members", []):
        if str(m.get("userId")) == sid:
            return True
        if em and (m.get("email") or "").strip().lower() == em:
            return True
    return False


def _exam_assignment(cls_id, exam_id, asgn_id=None):
    """Lấy assignment của một lớp cho đề exam_id.
    Trả về (cls, asgn, legacy_owner_id). asgn_id có giá trị → lấy đúng lần giao
    bài đó; không có → lấy lần giao mới nhất (tương thích link cũ)."""
    cls = db.get_class(cls_id) if cls_id else None
    if not cls:
        return None, None, None
    cands = _asgn_candidates(cls, exam_id)
    if not cands:
        return cls, None, None
    legacy = _legacy_owner_id(cands)
    if asgn_id:
        asgn = next((a for a in cands if str(a.get("id")) == str(asgn_id)), None)
        return cls, asgn, legacy
    cands.sort(key=lambda a: a.get("createdAt") or "", reverse=True)
    return cls, cands[0], legacy


@app.post("/api/exams/{exam_id}/submit")
async def submit_exam(exam_id: str, request: Request, caller: Optional[dict] = Depends(get_current_user)):
    """Học sinh nộp bài thi. Route công khai (luyện tập/đề public không cần đăng
    nhập) — nhưng khi nộp QUA LỚP và có đăng nhập, danh tính lấy từ session token
    (không tin studentId client tự khai) để tránh học sinh mạo danh bạn cùng lớp."""
    body = await request.json()
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)

    # Nếu nộp qua LỚP: học sinh phải là thành viên; kiểm tra cửa sổ thời gian
    # & số lần làm tối đa THEO TỪNG LẦN GIAO BÀI (một đề có thể giao nhiều lần).
    cls_id       = body.get("classId")
    asgn_id      = body.get("assignmentId") or None
    max_attempts = None
    legacy_owner = None
    student_id   = caller["id"] if (caller and cls_id) else body.get("studentId")
    if cls_id:
        cls, asgn, legacy_owner = _exam_assignment(cls_id, exam_id, asgn_id)
        if not cls:
            return JSONResponse({"error": "Lớp học không còn tồn tại."}, status_code=403)
        if not _is_class_member(cls, student_id):
            return JSONResponse(
                {"error": "Bạn không (còn) thuộc lớp này nên không thể nộp bài qua lớp."},
                status_code=403)
        if asgn_id and not asgn:
            return JSONResponse({"error": "Bài tập này đã bị gỡ khỏi lớp."}, status_code=403)
        if asgn:
            asgn_id = asgn.get("id")   # link cũ không kèm assignmentId → gắn theo lần giao phù hợp
            now = datetime.now(_tz.utc)
            close = asgn.get("closeTime") or asgn.get("dueDate")
            try:
                if close and now > datetime.fromisoformat(str(close).replace("Z", "+00:00")):
                    return JSONResponse({"error": "Đã quá thời hạn làm bài."}, status_code=403)
            except Exception:
                pass
            max_attempts = asgn.get("maxAttempts")

    # Điểm do SERVER chấm từ answers — không tin điểm client gửi lên
    # (client có thể POST thẳng score giả). Đề không có sections (hiếm) mới
    # đành dùng điểm client như trước.
    answers = body.get("answers") or {}
    if exam.get("sections"):
        score     = _calc_score(exam, answers)
        max_score = _calc_max_score(exam)
    else:
        score     = body.get("score")
        max_score = body.get("maxScore")

    submission = {
        "submittedAt": body.get("submittedAt"),
        "startedAt":   body.get("startedAt"),
        "timeSpent":   body.get("timeSpent"),   # giây làm bài
        "violationCount": body.get("violationCount"),   # số lần vi phạm khóa màn hình
        "studentName":  body.get("studentName", "Ẩn danh"),
        "studentId":    student_id,
        "answers":      answers,
        "score":        score,
        "maxScore":     max_score,
        "className":    body.get("className"),
        "classId":      body.get("classId"),
        "assignmentId": asgn_id if cls_id else None,
        "manualScores": {},   # GV chấm câu tự luận sau khi nộp
    }
    # Đếm số lần đã làm + insert trong CÙNG transaction (khóa advisory) — hai
    # request nộp song song không thể cùng lách qua giới hạn maxAttempts.
    ok, result = db.add_submission_guarded(exam_id, submission, max_attempts, legacy_owner)
    if not ok:
        return JSONResponse(
            {"error": f"Bạn đã làm đủ {max_attempts} lần cho phép."}, status_code=403)
    # Trả kèm điểm SERVER đã chấm để client hiển thị ngay — client không còn nhận
    # được đáp án đúng qua GET /api/exams/{id} nên không thể tự tính điểm nữa.
    return {"ok": True, "submissionIndex": result, "score": score, "maxScore": max_score}


@app.get("/api/exams/{exam_id}/submissions")
async def get_submissions(exam_id: str, caller: dict = Depends(require_auth)):
    """Giáo viên xem danh sách bài nộp."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền xem bài nộp của đề này"}, status_code=403)
    subs = db.get_submissions(exam_id)
    return {
        "submissions":     subs,
        "resultsRevealed": exam.get("resultsRevealed", False),
        "hideResults":     (exam.get("settings") or {}).get("hideResults", False),
        "classes":         exam.get("classes", []),
    }


@app.post("/api/exams/{exam_id}/submissions/{sub_id}/grade")
async def grade_essay_submission(exam_id: str, sub_id: str, request: Request, caller: dict = Depends(require_auth)):
    """Giáo viên chấm tay câu tự luận (TỰ LUẬN) cho một bài nộp.
    body: { manualScores: { "TL_1": 1.5, ... } }. Điểm mỗi câu bị kẹp trong [0, điểm tối đa của câu].
    Điểm tổng = điểm tự động (trắc nghiệm/trả lời ngắn) + tổng điểm tự luận."""
    body = await request.json()
    manual_in = body.get("manualScores") or {}
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền chấm đề thi này"}, status_code=403)

    # Điểm tối đa hợp lệ theo từng câu tự luận
    essay = (exam.get("sections") or {}).get("TỰ LUẬN") or {}
    max_by_key = {f"TL_{q.get('question_number')}": _to_float(q.get("points"))
                  for q in (essay.get("questions") or [])}

    clean: dict = {}
    for key, val in (manual_in.items() if isinstance(manual_in, dict) else []):
        if key not in max_by_key:
            continue
        v = max(0.0, min(_to_float(val), max_by_key[key]))
        clean[key] = _round2(v)

    sub = next((s for s in db.get_submissions(exam_id) if str(s.get("id")) == str(sub_id)), None)
    if not sub:
        return JSONResponse({"error": "Không tìm thấy bài nộp"}, status_code=404)

    auto  = _calc_score(exam, sub.get("answers") or {})
    total = _round2(auto + _manual_total(clean))
    if not db.update_submission_grade(sub_id, clean, total):
        return JSONResponse({"error": "Không cập nhật được điểm"}, status_code=500)
    return {"ok": True, "score": total, "maxScore": _calc_max_score(exam), "manualScores": clean}


@app.delete("/api/exams/{exam_id}/submissions/{sub_id}")
async def delete_one_submission(exam_id: str, sub_id: str, caller: dict = Depends(require_auth)):
    """Giáo viên xóa MỘT bài nộp (một lần làm) theo id — dùng cho link công khai."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa bài nộp của đề này"}, status_code=403)
    if not db.delete_submission(sub_id):
        return JSONResponse({"error": "Không tìm thấy bài nộp"}, status_code=404)
    return {"ok": True}


@app.post("/api/exams/{exam_id}/submissions/delete-student")
async def delete_student_submissions(exam_id: str, request: Request, caller: dict = Depends(require_auth)):
    """Giáo viên xóa TẤT CẢ bài làm của một học sinh cho đề này.
    Truyền classId để giới hạn trong một lớp; bỏ trống = bài nộp qua link công khai."""
    body = await request.json()
    student_id = body.get("studentId")
    class_id   = body.get("classId") or None
    asgn_id    = body.get("assignmentId") or None
    if student_id is None:
        return JSONResponse({"error": "Thiếu studentId"}, status_code=400)
    if class_id:
        cls = db.get_class(class_id)
        if not cls or not _is_class_teacher(cls, caller["id"]):
            return JSONResponse({"error": "Không có quyền xóa bài nộp trong lớp này"}, status_code=403)
    else:
        exam = db.get_exam(exam_id)
        if not exam or not _can_manage_exam(exam, caller["id"]):
            return JSONResponse({"error": "Không có quyền xóa bài nộp của đề này"}, status_code=403)
    # Bài nộp cũ (chưa gắn assignment_id) chỉ bị xóa kèm khi xóa từ lần giao bài
    # sớm nhất — khớp với cách chúng được hiển thị.
    include_legacy = True
    if class_id and asgn_id:
        cls = db.get_class(class_id)
        if cls:
            cands = _asgn_candidates(cls, exam_id)
            include_legacy = not cands or str(_legacy_owner_id(cands)) == str(asgn_id)
    n = db.delete_submissions_for_student(exam_id, student_id, class_id, asgn_id, include_legacy)
    return {"ok": True, "deleted": n}


@app.post("/api/exams/{exam_id}/reveal")
async def reveal_results(exam_id: str, caller: dict = Depends(require_auth)):
    """Giáo viên công bố kết quả."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền công bố kết quả đề này"}, status_code=403)
    if not db.update_exam_field(exam_id, "resultsRevealed", True):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.post("/api/exams/{exam_id}/hide-results")
async def hide_results_endpoint(exam_id: str, caller: dict = Depends(require_auth)):
    """Giáo viên ẩn kết quả lại."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền ẩn kết quả đề này"}, status_code=403)
    if not db.update_exam_field(exam_id, "resultsRevealed", False):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.post("/api/exams/{exam_id}/toggle-public")
async def toggle_public(exam_id: str, request: Request, caller: dict = Depends(require_auth)):
    """Giáo viên bật/tắt chế độ công khai đề thi."""
    body = await request.json()
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền đổi chế độ công khai đề này"}, status_code=403)
    val = bool(body.get("isPublic", False))
    if not db.update_exam_field(exam_id, "isPublic", val):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True, "isPublic": val}


def _questions_preview(exam, max_q: int = 3):
    """Return first max_q question texts across all sections for preview."""
    sections = exam.get("sections") or {}
    preview = []
    for sec_data in sections.values():
        for q in (sec_data.get("questions") or []):
            text = q.get("question_text") or ""
            # Truncate cleanly: try not to cut inside a $...$ LaTeX expression
            if len(text) > 180:
                trunc = text[:180]
                # If odd number of $ → cut before the last unclosed one
                if trunc.count("$") % 2 == 1:
                    trunc = trunc[:trunc.rfind("$")]
                text = trunc.rstrip() + "…"
            preview.append({
                "num":  q.get("question_number", len(preview) + 1),
                "text": text,
            })
            if len(preview) >= max_q:
                return preview
    return preview


@app.get("/api/public-exams")
async def get_public_exams():
    """Danh sách đề thi công khai (không trả về submissions/mật khẩu)."""
    all_exams = db.load_exams()
    result = []
    for exam_id, exam in all_exams.items():
        if not exam.get("isPublic") or not exam.get("published"):
            continue
        s = exam.get("settings") or {}
        ps = exam.get("practiceSettings") or {}
        result.append({
            "id":              exam_id,
            "title":           exam.get("title", ""),
            "totalQuestions":  exam.get("totalQuestions", 0),
            "source":          exam.get("source", ""),
            "createdAt":       exam.get("createdAt"),
            "submissionCount": len(exam.get("submissions", [])),
            "questionsPreview": _questions_preview(exam),
            "settings": {
                "duration":    s.get("duration"),
                "openTime":    s.get("openTime"),
                "closeTime":   s.get("closeTime"),
                "hideResults": s.get("hideResults", False),
            },
            "practiceEnabled": ps.get("enabled", False),
        })
    result.sort(key=lambda e: (e.get("submissionCount", 0), e.get("createdAt") or ""), reverse=True)
    return result


@app.post("/api/exams/{exam_id}/practice-settings")
async def save_practice_settings(exam_id: str, request: Request, caller: dict = Depends(require_auth)):
    """Giáo viên lưu cài đặt chế độ luyện tập."""
    body = await request.json()
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    if not _can_manage_exam(exam, caller["id"]):
        return JSONResponse({"error": "Không có quyền sửa cài đặt luyện tập đề này"}, status_code=403)
    ps = {
        "enabled":   bool(body.get("enabled", False)),
        "password":  body.get("password") or None,
        "openTime":  body.get("openTime") or None,
        "closeTime": body.get("closeTime") or None,
    }
    if not db.update_exam_field(exam_id, "practiceSettings", ps):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.get("/api/exams/{exam_id}/practice-info")
async def get_practice_info(exam_id: str):
    """Thông tin chế độ luyện tập (public — không trả về mật khẩu)."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    ps = exam.get("practiceSettings") or {}
    return {
        "examId":         exam_id,
        "title":          exam.get("title", ""),
        "totalQuestions": exam.get("totalQuestions", 0),
        "enabled":        ps.get("enabled", False),
        "hasPassword":    bool(ps.get("password")),
        "openTime":       ps.get("openTime"),
        "closeTime":      ps.get("closeTime"),
    }


# Mật khẩu giáo viên/giám thị dùng để thoát chế độ khóa màn hình (Shift + 1 + 3).
LOCK_ESCAPE_PASSWORD = "toan_anh_sang"


@app.post("/api/lock/verify")
async def verify_lock_escape(request: Request):
    """Xác minh mật khẩu thoát khóa màn hình (kiểm tra phía server)."""
    body = await request.json()
    pwd  = body.get("password") or ""
    if pwd == LOCK_ESCAPE_PASSWORD:
        return {"ok": True}
    return JSONResponse({"error": "Sai mật khẩu thoát."}, status_code=401)


@app.post("/api/exams/{exam_id}/practice-verify")
async def verify_practice_password(exam_id: str, request: Request):
    """Học sinh xác minh mật khẩu luyện tập."""
    body = await request.json()
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy"}, status_code=404)
    ps = exam.get("practiceSettings") or {}
    if not ps.get("password"):
        return {"ok": True}
    if body.get("password") != ps["password"]:
        return JSONResponse({"error": "Sai mật khẩu"}, status_code=401)
    return {"ok": True}


# ─── Super Admin endpoints ────────────────────────────────────────────────────

@app.get("/api/admin/stats")
async def admin_stats(caller: dict = Depends(require_admin)):
    """Thống kê tổng quan cho super admin."""
    import psutil
    data = db.load_exams()
    total_exams      = len(data)
    published_exams  = sum(1 for e in data.values() if e.get("published"))
    public_exams     = sum(1 for e in data.values() if e.get("isPublic") and e.get("published"))
    featured_exams   = sum(1 for e in data.values() if e.get("featured"))
    total_subs       = sum(len(e.get("submissions", [])) for e in data.values())
    total_questions  = sum(e.get("totalQuestions", 0) for e in data.values())
    # submissions per day (last 7 days)
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    trend = {}
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        trend[d] = 0
    for exam in data.values():
        for sub in exam.get("submissions", []):
            ts = sub.get("submittedAt", "")
            if ts:
                try:
                    day = ts[:10]
                    if day in trend:
                        trend[day] += 1
                except Exception:
                    pass
    trend_list = [{"date": d, "submissions": v} for d, v in trend.items()]
    # system metrics
    cpu  = psutil.cpu_percent(interval=0.2)
    ram  = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "total_exams":     total_exams,
        "published_exams": published_exams,
        "public_exams":    public_exams,
        "featured_exams":  featured_exams,
        "total_submissions": total_subs,
        "total_questions": total_questions,
        "trend": trend_list,
        "system": {
            "cpu_percent":   round(cpu, 1),
            "ram_percent":   round(ram.percent, 1),
            "ram_used_gb":   round(ram.used / 1e9, 1),
            "ram_total_gb":  round(ram.total / 1e9, 1),
            "disk_percent":  round(disk.percent, 1),
            "disk_used_gb":  round(disk.used / 1e9, 1),
            "disk_total_gb": round(disk.total / 1e9, 1),
            "disk_free_gb":  round(disk.free / 1e9, 1),
        },
    }


@app.get("/api/admin/exams")
async def admin_all_exams(caller: dict = Depends(require_admin)):
    """Danh sách tất cả đề thi (kèm submission count) cho super admin."""
    return db.load_exams_meta()


@app.get("/api/my-exams")
async def my_exams(caller: dict = Depends(require_auth)):
    """Đề thi do giáo viên đang đăng nhập tạo (metadata, không kèm sections).
    Nguồn chuẩn cho trang 'Đề thi của tôi' và modal giao đề."""
    return db.load_exams_by_creator(str(caller["id"]))


@app.delete("/api/admin/exams/{exam_id}")
async def admin_delete_exam(exam_id: str, caller: dict = Depends(require_admin)):
    """Super admin xoá đề thi."""
    if not db.delete_exam(exam_id):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.post("/api/admin/exams/{exam_id}/feature")
async def admin_feature_exam(exam_id: str, request: Request, caller: dict = Depends(require_admin)):
    """Super admin đánh dấu/bỏ đánh dấu đề thi nổi bật."""
    body = await request.json()
    val = bool(body.get("featured", False))
    if not db.update_exam_field(exam_id, "featured", val):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True, "featured": val}


@app.get("/api/admin/config")
async def admin_get_config(caller: dict = Depends(require_admin)):
    """Lấy cấu hình hệ thống."""
    return db.load_config()


@app.post("/api/admin/config")
async def admin_save_config(request: Request, caller: dict = Depends(require_admin)):
    """Lưu cấu hình hệ thống."""
    body = await request.json()
    cfg = db.load_config()
    cfg.update(body)
    db.save_config(cfg)
    return {"ok": True, "config": cfg}


# ─── Nội dung trang chủ (super admin tùy chỉnh được) ─────────────────────────

_SITE_CONTENT_DEFAULT = {
    "info": {
        "name": "Trung tâm Ánh Sáng",
        "phone": "098 532 22 77",
        "phone2": "",
        "fb": "https://www.facebook.com/toan.ly.hoa.thay.duc.di.an",
        "address": "399/1 Trần Hưng Đạo, Đông Hòa, Dĩ An, Bình Dương",
        "heroTitle": "Học chắc kiến thức, sáng con đường thi cử",
        "heroDesc": "Trung tâm Ánh Sáng tại Dĩ An đồng hành cùng học sinh từ lớp 6 đến lớp 12: lớp nhỏ, thầy cô theo sát từng em, học phí phù hợp với phụ huynh.",
        "heroImage": "/img/lop_hoc2.jpg",
        "heroBadge": "1.500+",
        "heroBadgeLabel": "học viên đã theo học",
    },
    "stats": [
        {"value": "12+", "label": "năm kinh nghiệm giảng dạy"},
        {"value": "95%", "label": "học viên tăng từ 2 điểm trở lên"},
        {"value": "8.2", "label": "điểm trung bình thi vào 10 môn Toán"},
        {"value": "6.5+", "label": "IELTS đầu ra trung bình"},
    ],
    "teachers": [
        {"name": "Thầy Đức", "subject": "Toán – Lý – Hóa", "photo": "",
         "bio": "Hơn 12 năm luyện thi vào 10 và tốt nghiệp THPT, nổi tiếng dạy dễ hiểu với học sinh mất gốc."},
        {"name": "Cô Hương", "subject": "Ngữ Văn", "photo": "",
         "bio": "Chuyên luyện nghị luận xã hội và văn học, chấm chữa bài từng em mỗi tuần."},
        {"name": "Cô My", "subject": "Tiếng Anh – IELTS", "photo": "",
         "bio": "IELTS 8.0, phụ trách lớp tiếng Anh phổ thông và luyện IELTS mục tiêu 6.5+."},
    ],
    "courses": [
        {"name": "Toán 6 – 12", "desc": "2–3 buổi/tuần · bám sát chương trình trên lớp, luyện đề theo từng kỳ thi.", "fee": "500.000đ", "featured": False},
        {"name": "Lý – Hóa 8 – 12", "desc": "Học chắc lý thuyết, thí nghiệm minh họa, luyện chuyên đề thi tốt nghiệp.", "fee": "500.000đ", "featured": False},
        {"name": "Ngữ Văn 9 & 12", "desc": "Luyện viết mỗi buổi, chấm chữa chi tiết, ôn trọng tâm thi vào 10 và THPT.", "fee": "450.000đ", "featured": False},
        {"name": "Tiếng Anh phổ thông", "desc": "Ngữ pháp – từ vựng – đề thi, dành cho học sinh lớp 6 – 12.", "fee": "500.000đ", "featured": False},
        {"name": "IELTS 5.0 → 6.5+", "desc": "Lộ trình 4 – 6 tháng, luyện đủ 4 kỹ năng, thi thử hàng tháng có chấm band.", "fee": "800.000đ", "featured": True},
    ],
    # Lịch học: cells theo thứ tự [T2, T3, T4, T5, T6, T7, CN]; mỗi entry = [tên lớp, màu]
    # màu: xanhla | vang | cam | tim | do | xanhduong | hong | trang
    "schedule": {
        "note": "Lịch có thể thay đổi theo tuần — liên hệ trung tâm để biết lịch chính xác.",
        "days": ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"],
        "slots": [
            {"time": "8h00 – 9h30", "cells": [
                [],
                [["Ngữ pháp cơ bản (P2)", "xanhla"]],
                [],
                [["Ngữ pháp cơ bản", "xanhla"]],
                [],
                [["KIDS 2 8h00", "xanhla"], ["KHTN 8 (Ngân P5)", "trang"], ["Lý 11 (Tân P2)", "trang"], ["Lý 12 (Đức P3)", "trang"]],
                [["KIDS 2", "xanhla"], ["Toán 10 - Khoa - P5", "do"], ["AV 7 - Vy - P4", "vang"], ["Toán 8 - Quỳnh - P3", "do"], ["Lý 12 (Đức P3)", "trang"]],
            ]},
            {"time": "09h45 – 11h15", "cells": [
                [],
                [["Ngữ pháp nâng cao (P2)", "xanhla"]],
                [],
                [["Ngữ pháp nâng cao", "xanhla"]],
                [],
                [["KHTN 7 (Ngân P5)", "trang"], ["Hóa 11 (Đức P3)", "trang"], ["KHTN 9 (Tân P2)", "trang"], ["KIDS 1 09h45", "xanhla"]],
                [["AV 8 - Vy", "vang"], ["Toán 11 (Đức P3)", "do"], ["KHTN 9 - Tân - P5", "trang"], ["Toán 7 - Khoa - P4", "trang"], ["KIDS 1", "xanhla"]],
            ]},
            {"time": "13h30 – 15h15", "cells": [
                [], [], [], [], [],
                [["IELTS", "xanhla"]],
                [["IELTS", "xanhla"]],
            ]},
            {"time": "15h30 – 17h00", "cells": [
                [], [], [], [], [],
                [["Toán 11 (Đức P2)", "do"], ["Văn 9 - Thủy (15h00-17h00)", "tim"]],
                [["Văn 9 - Thủy (15h00-17h00)", "tim"]],
            ]},
            {"time": "17h45 – 19h15", "cells": [
                [["AV 10 - Kim", "xanhduong"], ["AV 9 - Vy (P3)", "vang"], ["Toán 12 (Đức P2)", "trang"], ["AV6", "cam"], ["Văn 8 - Thủy", "tim"]],
                [["AV 11 - Thùy Anh", "hong"], ["AV 8 - Vy", "vang"], ["Hóa 12 (Đức P3)", "trang"], ["Lý 10 (Quỳnh P1)", "trang"], ["IELTS", "xanhla"]],
                [["AV 10 - Kim", "xanhduong"], ["AV 9 - Vy", "vang"], ["Toán 12 (Đức P2)", "trang"], ["AV6", "cam"], ["Toán 7 (Khoa P5)", "trang"]],
                [["AV 11 - Thùy Anh", "hong"], ["Hóa 12 (Đức P3)", "trang"], ["KHTN 8 (Ngân P5)", "trang"], ["Văn 7 - Thủy", "tim"]],
                [["AV 10 - Kim", "xanhduong"], ["AV 9 - Vy", "vang"], ["Toán 12 (Đức P2)", "trang"], ["AV6", "cam"]],
                [["AV 11 - Thùy Anh", "hong"], ["AV 8 - Vy", "vang"], ["Toán 6 (Tân P3)", "trang"], ["Lý 10 (Quỳnh P1)", "trang"], ["Toán 7 (Khoa P2)", "trang"]],
                [],
            ]},
            {"time": "19h30 – 21h00", "cells": [
                [["AV 12 - Kim (P3)", "xanhduong"], ["Toán 6 (Tân P3)", "trang"], ["Văn 7 - Thủy", "tim"], ["Toán 9 (Đức P2)", "trang"]],
                [["Toán 11 (Đức P2)", "do"], ["AV 7 - Vy", "vang"], ["Toán 8 (Quỳnh P3)", "do"], ["Toeic", "xanhla"]],
                [["AV 12 - Kim", "xanhduong"], ["Lý 11 (Tân P5)", "trang"], ["Toán 10 (Khoa P4)", "trang"], ["Toán 9 (Đức P2)", "trang"]],
                [["Văn 8 - Thủy", "tim"], ["KHTN 7 (Ngân P5)", "trang"], ["Hóa 11 (Đức P3)", "trang"], ["Toeic", "xanhla"], ["Hóa 10 (V.Anh)", "trang"]],
                [["AV 12 - Kim", "xanhduong"], ["Toán 6 (Tân P3)", "trang"], ["Hóa 10 (V.Anh)", "trang"], ["Toán 9 (Đức P2)", "trang"]],
                [["AV 7 - Vy", "vang"], ["Toán 8 (Quỳnh P3)", "do"], ["Toeic", "xanhla"], ["Toán 10 (Khoa P2)", "trang"]],
                [],
            ]},
        ],
    },
    "achievements": [
        {"image": "/img/hoc_vien.jpg", "caption": "Học viên đạt thành tích cao trong kỳ thi vào 10"},
        {"image": "/img/hoc_vien2.jpg", "caption": "Vinh danh học viên xuất sắc tại trung tâm"},
    ],
    "testimonials": [
        {"quote": "Em mất gốc Toán từ lớp 7, học thầy Đức một năm thì thi vào 10 được 8.5. Thầy giảng chậm, kỹ, bài nào chưa hiểu được hỏi lại thoải mái.", "who": "Minh Anh — học sinh lớp 9, THCS Đông Hòa"},
        {"quote": "Lớp Lý – Hóa học vui mà chắc. Nhờ luyện đề ở trung tâm, em đạt 9.0 Hóa kỳ thi tốt nghiệp vừa rồi.", "who": "Quốc Bảo — học sinh lớp 12, THPT Dĩ An"},
        {"quote": "Cô My sửa từng câu Writing, mỗi tuần đều có bài Speaking 1-1. Sau 4 tháng em đạt IELTS 6.5 đúng mục tiêu.", "who": "Thu Hà — sinh viên năm nhất"},
    ],
}


@app.get("/api/site-content")
async def get_site_content():
    """Nội dung trang chủ — public, merge với mặc định."""
    saved = db.load_config().get("site_content") or {}
    return {**_SITE_CONTENT_DEFAULT, **saved}


@app.post("/api/site-content")
async def save_site_content(request: Request, caller: dict = Depends(require_admin)):
    """Super admin lưu nội dung trang chủ."""
    body = await request.json()
    db.save_config({"site_content": body})
    return {"ok": True}


@app.post("/api/site-register")
async def site_register(request: Request):
    """Form đăng ký tư vấn trên trang chủ → thông báo cho super admin."""
    body = await request.json()
    name = (body.get("name") or "").strip()
    phone = (body.get("phone") or "").strip()
    subject = (body.get("subject") or "").strip()
    if not name or not phone:
        return JSONResponse({"error": "Thiếu họ tên hoặc số điện thoại"}, status_code=400)
    for adm in db.get_super_admins():
        db.add_notif({
            "id": _cls_id(), "type": "register",
            "targetUserId": str(adm.get("id")), "classId": None,
            "className": "", "assignmentId": "",
            "title": f"Đăng ký tư vấn mới: {name}",
            "message": f"SĐT: {phone}" + (f" · Quan tâm: {subject}" if subject else ""),
            "createdAt": _now_iso(), "read": False,
        })
    return {"ok": True}


@app.post("/api/admin/super-admins")
async def create_super_admin(request: Request, caller: dict = Depends(require_super_admin)):
    """Tạo tài khoản super_admin mới hoặc nâng cấp user hiện có."""
    body     = await request.json()
    email    = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()
    name     = (body.get("name") or "Super Admin").strip()

    if not email or not password:
        return JSONResponse({"error": "Thiếu email hoặc mật khẩu."}, status_code=400)
    if len(password) < 6:
        return JSONResponse({"error": "Mật khẩu tối thiểu 6 ký tự."}, status_code=400)

    existing = db.get_user_by_email(email)
    if existing:
        # Nâng cấp user hiện có lên super_admin
        updated = db.update_user_role(str(existing["id"]), "super_admin")
        return {"ok": True, "action": "upgraded", "user": updated}

    # Tạo mới
    new_user = {
        "id":           int(datetime.now(_tz.utc).timestamp() * 1000),
        "email":        email,
        "password":     db.hash_password(password),
        "name":         name,
        "role":         "super_admin",
        "avatar":       name[0].upper() if name else "S",
        "isRegistered": True,
    }
    user = db.add_user(new_user)
    return {"ok": True, "action": "created", "user": user}


@app.get("/api/admin/super-admins")
async def list_super_admins(caller: dict = Depends(require_super_admin)):
    """Danh sách tất cả super_admin."""
    return db.get_super_admins()


@app.delete("/api/admin/super-admins/{user_id}")
async def remove_super_admin(user_id: str, caller: dict = Depends(require_super_admin)):
    """Hạ cấp super_admin xuống giao_vien."""
    updated = db.set_super_admin(user_id, enable=False)
    if not updated:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return {"ok": True, "user": updated}


@app.get("/api/admin/login-attempts")
async def admin_login_attempts(caller: dict = Depends(require_super_admin)):
    """Danh sách IP có lịch sử đăng nhập sai + IP đang bị cấm, cho super_admin theo dõi."""
    return {
        "attempts": db.list_login_attempts(),
        "banned":   db.list_banned_ips(),
    }


@app.post("/api/admin/banned-ips")
async def admin_ban_ip(request: Request, caller: dict = Depends(require_super_admin)):
    """Super_admin cấm thẳng một địa chỉ IP truy cập toàn bộ hệ thống."""
    body = await request.json()
    ip = (body.get("ip") or "").strip()
    if not ip:
        return JSONResponse({"error": "Thiếu địa chỉ IP."}, status_code=400)
    reason = (body.get("reason") or "").strip()
    db.ban_ip(ip, reason=reason, banned_by=caller["id"])
    BANNED_IPS.add(ip)
    return {"ok": True, "ip": ip}


@app.delete("/api/admin/banned-ips/{ip}")
async def admin_unban_ip(ip: str, caller: dict = Depends(require_super_admin)):
    """Super_admin gỡ cấm một địa chỉ IP."""
    db.unban_ip(ip)
    BANNED_IPS.discard(ip)
    return {"ok": True, "ip": ip}


# ─── End Super Admin endpoints ────────────────────────────────────────────────


# ─── User management ──────────────────────────────────────────────────────────


def _issue_session(user: dict) -> dict:
    """Tạo session mới cho user vừa đăng nhập/đăng ký — trả object user (không
    password) kèm field `token` mà client phải gửi lại qua Authorization header."""
    token = secrets.token_urlsafe(32)
    db.create_session(token, user["id"], SESSION_TTL_DAYS)
    return {**{k: v for k, v in user.items() if k != "password"}, "token": token}


@app.post("/api/auth/login")
async def api_login(request: Request):
    ip = _client_ip(request)
    locked_for = db.get_login_lock_seconds(ip)
    if locked_for > 0:
        return JSONResponse(
            {"error": f"Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau {locked_for} giây."},
            status_code=429,
        )
    body     = await request.json()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    # Chặn đăng nhập bằng mật khẩu rỗng (tài khoản Google có password = "")
    if not password:
        db.register_login_failure(ip)
        return JSONResponse({"error": "Email hoặc mật khẩu không đúng."}, status_code=401)
    user = db.get_user_by_email(email, pwd=True)
    if not user or not db.verify_password(password, user.get("password") or ""):
        locked_for = db.register_login_failure(ip)
        if locked_for > 0:
            return JSONResponse(
                {"error": f"Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau {locked_for} giây."},
                status_code=429,
            )
        return JSONResponse({"error": "Email hoặc mật khẩu không đúng."}, status_code=401)
    # Đăng nhập thành công → xoá lịch sử nhập sai của IP này
    db.clear_login_attempts(ip)
    # Bản ghi cũ còn plaintext → nâng cấp sang hash ngay khi đăng nhập thành công
    if not db.is_hashed(user.get("password") or ""):
        try:
            db.update_user_password(str(user["id"]), db.hash_password(password))
        except Exception:
            pass
    return _issue_session(user)


GOOGLE_CLIENT_ID = "397583765451-5i31p5rc3dk9ug7ld4c0qpd8nclu3d1g.apps.googleusercontent.com"

@app.post("/api/auth/google")
async def api_auth_google(request: Request):
    body = await request.json()
    token = (body.get("id_token") or "").strip()

    if not token:
        return JSONResponse({"error": "Thiếu id_token."}, status_code=400)

    # 1. Verify token với Google
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        return JSONResponse({"error": f"Token không hợp lệ: {str(e)}"}, status_code=401)

    # 2. Lấy thông tin user từ token đã verify
    google_id = idinfo["sub"]          # unique ID của Google user
    email     = idinfo["email"].lower()
    name      = idinfo.get("name", "")
    avatar    = idinfo.get("picture", "")

    # 3. Tìm hoặc tạo user trong DB
    user = db.get_user_by_email(email)
    if not user:
        new_uid = int(datetime.now(_tz.utc).timestamp() * 1000)
        user = db.add_user({
            "id": new_uid, "email": email, "name": name,
            "avatar": avatar if avatar else (name[0].upper() if name else "?"),
            "password": "", "role": "khach", "isRegistered": True,
        })
    elif not user.get("google_id"):
        # Email đã tồn tại nhưng chưa liên kết Google → liên kết
        db.update_user(user["id"], {"google_id": google_id, "avatar": avatar})

    # 4. Trả về user (bỏ password) kèm session token — tài khoản Google chưa có
    # khối lớp thì báo cho client biết để hỏi thêm họ tên + lớp trước khi vào trang chủ
    result = _issue_session(user)
    result["needsProfile"] = user.get("role") in ("khach", "hoc_sinh") and not user.get("grade")
    return result




@app.post("/api/auth/register")
async def api_register(request: Request):
    body     = await request.json()
    name     = (body.get("name") or "").strip()
    email    = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "")
    if not name or not email or not password:
        return JSONResponse({"error": "Thiếu thông tin bắt buộc."}, status_code=400)
    if db.get_user_by_email(email):
        return JSONResponse({"error": "Email này đã được sử dụng."}, status_code=409)
    new_user = {
        "id":           int(datetime.now(_tz.utc).timestamp() * 1000),
        "email":        email,
        "password":     db.hash_password(password),
        "name":         name,
        "role":         "khach",
        "avatar":       name[0].upper() if name else "?",
        "grade":        (body.get("grade") or "").strip() or None,   # cấp độ (khối lớp)
        "isRegistered": True,
    }
    user = db.add_user(new_user)
    return _issue_session(user)


@app.post("/api/auth/logout")
async def api_logout(request: Request):
    """Đăng xuất: huỷ session hiện tại. Luôn trả ok — logout không có token
    hợp lệ (đã hết hạn/đã xoá rồi) không phải lỗi cần báo cho client."""
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        db.delete_session(auth[7:].strip())
    return {"ok": True}


@app.get("/api/auth/me")
async def api_get_me(user: dict = Depends(require_auth)):
    """Thông tin user hiện tại — suy ra từ session token, không còn nhận userId
    tự khai từ client (trước đây cho phép xem profile của bất kỳ ai)."""
    return user


@app.put("/api/auth/profile")
async def api_update_profile(request: Request, user: dict = Depends(require_auth)):
    """Người dùng tự cập nhật hồ sơ của mình (họ tên, khối lớp) — dùng để hoàn
    tất thông tin ngay sau khi đăng nhập bằng Google, vốn chỉ có sẵn tên."""
    body = await request.json()
    fields = {}
    if "name" in body:
        name = (body.get("name") or "").strip()
        if not name:
            return JSONResponse({"error": "Vui lòng nhập họ tên."}, status_code=400)
        fields["name"] = name
    if "grade" in body:
        grade = (body.get("grade") or "").strip()
        fields["grade"] = grade or None
    if not fields:
        return JSONResponse({"error": "Không có thông tin để cập nhật."}, status_code=400)
    updated = db.update_user(user["id"], fields)
    if not updated:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return updated


@app.get("/api/admin/users")
async def admin_list_users(caller: dict = Depends(require_admin)):
    """Admin xem toàn bộ người dùng (không trả password)."""
    return db.load_users()


@app.get("/api/users/search")
async def search_users(q: str = "", role: str = "", grade: str = "", caller: dict = Depends(require_auth)):
    """Tìm kiếm người dùng theo query, role & cấp độ (grade) — giáo viên dùng để
    thêm học sinh/đồng giáo viên vào lớp, nên chỉ cần đăng nhập, không cần admin."""
    return db.search_users(q=q.strip(), role=role, grade=grade)


@app.put("/api/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, request: Request, caller: dict = Depends(require_super_admin)):
    body     = await request.json()
    new_role = body.get("role")
    if not new_role:
        return JSONResponse({"error": "Thiếu role."}, status_code=400)
    updated = db.update_user_role(user_id, new_role)
    if not updated:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return updated


@app.put("/api/admin/users/{user_id}/grade")
async def admin_update_user_grade(user_id: str, request: Request, caller: dict = Depends(require_admin)):
    """Admin sửa cấp độ lớp (khối) của người dùng. Gửi grade='' hoặc null để bỏ."""
    body = await request.json()
    raw = body.get("grade")
    grade = (str(raw).strip() or None) if raw not in (None, "") else None
    updated = db.update_user(user_id, {"grade": grade})
    if not updated:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return updated


@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: str, caller: dict = Depends(require_admin)):
    if not db.delete_user(user_id):
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return {"ok": True}


@app.put("/api/admin/users/{user_id}/password")
async def admin_reset_user_password(user_id: str, request: Request, caller: dict = Depends(require_super_admin)):
    body         = await request.json()
    new_password = (body.get("password") or "").strip()
    if len(new_password) < 6:
        return JSONResponse({"error": "Mật khẩu tối thiểu 6 ký tự."}, status_code=400)
    if not db.update_user_password(user_id, db.hash_password(new_password)):
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return {"ok": True}

# ─── End User management ──────────────────────────────────────────────────────


# ─── Class management ─────────────────────────────────────────────────────────

def _cls_id() -> str:
    return ''.join(_random.choices(_string.ascii_lowercase + _string.digits, k=8))

def _join_code() -> str:
    return ''.join(_random.choices(_string.ascii_uppercase + _string.digits, k=6))

def _now_iso() -> str:
    return datetime.now(_tz.utc).isoformat()


def _migrate_split_multisubject_classes() -> None:
    """Mỗi lớp = 1 khối + 1 môn. Lớp đa môn cũ (subjects > 1) được TÁCH thành nhiều
    lớp 1-môn: lớp gốc giữ môn đầu (s0), mỗi môn còn lại tạo lớp mới (id + mã join
    riêng) và chuyển members/assignments/documents thuộc môn đó sang. Idempotent:
    khi mọi lớp đã ≤ 1 môn thì không làm gì. Lớp cũ chưa gán môn (subjects rỗng) giữ nguyên."""
    try:
        classes = db.list_all_classes()
    except Exception as e:
        print(f"[DB] Bỏ qua tách lớp đa môn (không đọc được lớp): {e}")
        return
    n_split = 0
    for cls in classes:
        subs = [s for s in (cls.get("subjects") or []) if s]
        if len(subs) <= 1:
            continue
        s0, rest = subs[0], subs[1:]

        def _belongs(item, subj):
            return (item.get("subject") or None) == subj

        # Tạo lớp mới cho từng môn phụ (s1..sn), chuyển nội dung của môn đó sang.
        for si in rest:
            new_id = _cls_id()
            new_cls = {
                "id": new_id,
                "name": f"{cls.get('name', '')} · {si}",
                "description": cls.get("description", ""),
                "subject": si, "subjects": [si],
                "grade": cls.get("grade"),
                "teacherId": cls.get("teacherId"), "teacherName": cls.get("teacherName", ""),
                "createdAt": cls.get("createdAt") or _now_iso(),
                "joinCode": _join_code(), "joinPassword": cls.get("joinPassword"),
                "members":     [m for m in (cls.get("members") or [])     if _belongs(m, si)],
                "assignments": [a for a in (cls.get("assignments") or []) if _belongs(a, si)],
                "documents":   [d for d in (cls.get("documents") or [])   if _belongs(d, si)],
            }
            db.upsert_class(new_id, new_cls)
            n_split += 1

        # Lớp gốc giữ môn đầu s0: nội dung thuộc s0 hoặc chưa gán môn (quy về môn chính).
        keep_subj = lambda x: (x.get("subject") or None) in (None, s0)
        cls["subject"] = s0
        cls["subjects"] = [s0]
        cls["members"]     = [m for m in (cls.get("members") or [])     if keep_subj(m)]
        cls["assignments"] = [a for a in (cls.get("assignments") or []) if keep_subj(a)]
        cls["documents"]   = [d for d in (cls.get("documents") or [])   if keep_subj(d)]
        db.upsert_class(cls["id"], cls)

    if n_split:
        print(f"[DB] Tách lớp đa môn → tạo thêm {n_split} lớp 1-môn")


@app.post("/api/classes")
async def create_class_endpoint(request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    cid = _cls_id()
    # Mỗi lớp = 1 khối + ĐÚNG 1 môn. Nhận `subject`; chấp nhận `subjects[]` từ client
    # cũ nhưng chỉ lấy môn đầu tiên. Luôn giữ subjects = [subject] cho các helper lọc.
    subject = body.get("subject")
    if not subject:
        subs = body.get("subjects")
        subject = next((s for s in subs if s), None) if isinstance(subs, list) else None
    subjects = [subject] if subject else []
    cls = {
        "id": cid, "name": body.get("name", ""),
        "description": body.get("description", ""),
        "subject": subject,                                # môn của lớp (toan|ly|hoa|anh|van|khac)
        "grade": (body.get("grade") or "").strip() or None,  # cấp độ (khối lớp)
        "subjects": subjects,                              # = [subject] để tương thích helper lọc
        "teacherId": caller["id"], "teacherName": caller.get("name", ""),
        "createdAt": body.get("createdAt", _now_iso()),
        "joinCode": _join_code(), "joinPassword": body.get("joinPassword") or None,
        "members": [], "assignments": [], "documents": [],
        "schedule": body.get("schedule") or [], "settings": body.get("settings") or {},
    }
    db.upsert_class(cid, cls)
    return cls


def _is_class_teacher(cls: dict, user_id) -> bool:
    """True nếu user_id là giáo viên chính, giáo viên phụ (co-teacher) của lớp,
    hoặc admin/super_admin (được quản lý mọi lớp)."""
    if not user_id:
        return False
    uid = str(user_id)
    if str(cls.get("teacherId")) == uid:
        return True
    if any(str(ct.get("userId")) == uid for ct in cls.get("coTeachers") or []):
        return True
    viewer = db.get_user_by_id(uid)
    return (viewer or {}).get("role") in ("admin", "super_admin")


def _sanitize_class(cls: dict) -> dict:
    """Bản trả về cho HỌC SINH: không lộ mật khẩu tham gia lớp."""
    out = dict(cls)
    out["joinPassword"] = None
    out["hasJoinPassword"] = bool(cls.get("joinPassword"))
    return out


@app.get("/api/classes")
async def list_classes(teacherId: str = None, studentId: str = None, email: str = None,
                        viewAll: bool = False, viewerId: str = None,
                        caller: dict = Depends(require_auth)):
    """teacherId/studentId/viewerId chỉ còn dùng như CỜ chọn chế độ xem (giá trị bị
    bỏ qua) — danh tính thật luôn lấy từ session, tránh client tự khai ID của người khác."""
    if viewAll:
        # Chỉ super_admin mới được xem TOÀN BỘ lớp trong hệ thống.
        if caller.get("role") != "super_admin":
            return []
        return db.list_all_classes()
    if teacherId:
        return db.list_classes_by_teacher_or_coteacher(caller["id"])
    if studentId:
        return [_sanitize_class(c) for c in db.list_classes_by_student(caller["id"], caller.get("email"))]
    return []


@app.get("/api/students/pending")
async def student_pending(caller: dict = Depends(require_auth)):
    """
    Danh sách bài/đề HỌC SINH CHƯA HOÀN THÀNH, tính trực tiếp từ DB:
      - Bài tập nộp file: chưa nộp & chưa quá hạn.
      - Đề thi: chưa làm lần nào (đếm bài nộp của ĐỀ theo lớp) & chưa đóng.
    Luôn tính cho CHÍNH người gọi (suy từ session), không nhận studentId tự khai.
    """
    student_id = caller["id"]
    email = caller.get("email")

    now = datetime.now(_tz.utc)

    def _parse(iso):
        try:
            return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except Exception:
            return None

    items = []
    subs_cache = {}   # examId -> submissions (tránh query lặp)
    for cls in db.list_classes_by_student(student_id, email):
        cid = cls.get("id")
        asgns = cls.get("assignments", [])
        for a in asgns:
            close = _parse(a.get("closeTime") or a.get("dueDate"))
            if a.get("examId"):
                if close and now > close:
                    continue                                  # đã đóng
                eid = a["examId"]
                if eid not in subs_cache:
                    subs_cache[eid] = db.get_submissions(eid)
                # Đếm theo TỪNG LẦN GIAO BÀI — cùng một đề giao 2 lần là 2 bài khác nhau
                legacy_owner = _legacy_owner_id(_asgn_candidates(cls, eid))
                used = sum(
                    1 for s in subs_cache[eid]
                    if str(s.get("studentId")) == str(student_id)
                    and str(s.get("classId")) == str(cid)
                    and _sub_belongs_to_asgn(s, a.get("id"), legacy_owner)
                )
                if used > 0:
                    continue                                  # đã làm rồi
            else:
                if any(str(s.get("studentId")) == str(student_id) for s in a.get("submissions", [])):
                    continue                                  # đã nộp file
                if close and now > close:
                    continue                                  # quá hạn
            items.append({
                "classId": cid, "className": cls.get("name", ""),
                "assignmentId": a.get("id"), "title": a.get("title", ""),
                "kind": "exam" if a.get("examId") else "homework",
                "examId": a.get("examId"),
                "dueDate": a.get("closeTime") or a.get("dueDate"),
                "openTime": a.get("openTime"),
            })

    items.sort(key=lambda x: x.get("dueDate") or "")
    return {"count": len(items), "items": items}


# Must come before /{cls_id} to avoid ambiguity
@app.post("/api/classes/join")
async def join_class_by_code(request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    code = (body.get("code") or "").strip().upper()
    password = body.get("password") or None
    uid, uname, uemail = caller["id"], caller.get("name", ""), caller.get("email", "")
    cls = db.get_class_by_code(code)
    if not cls:
        return JSONResponse({"error": "Mã lớp không hợp lệ."}, status_code=404)
    if _is_class_teacher(cls, uid):
        return JSONResponse({"error": "Bạn là giáo viên của lớp này, không thể tham gia với tư cách học sinh."}, status_code=403)
    if cls.get("joinPassword") and cls["joinPassword"] != password:
        return JSONResponse({"error": "Sai mật khẩu."}, status_code=401)
    em = (uemail or "").strip().lower()

    # Chặn theo cấp độ: chỉ học sinh cùng cấp độ với lớp mới được tham gia.
    stu_grade = caller.get("grade")
    if cls.get("grade") and stu_grade and str(stu_grade) != str(cls.get("grade")):
        return JSONResponse(
            {"error": f"Lớp này dành cho học sinh cấp độ Lớp {cls.get('grade')}. Bạn không thể tham gia."},
            status_code=403)

    # Mỗi lớp chỉ 1 môn → học sinh vào thẳng môn của lớp (không cần chọn).
    cls_subject = cls.get("subject") or next((s for s in (cls.get("subjects") or []) if s), None)
    want = [cls_subject]   # None với lớp cũ chưa gán môn → một thành viên chung

    joined = []

    def mutate(c):
        members = c.get("members", [])
        for subj in want:
            already = any(
                (str(m.get("userId")) == str(uid)
                 or (em and (m.get("email") or "").strip().lower() == em))
                and (m.get("subject") or None) == (subj or None)
                for m in members)
            if already:
                continue
            members.append({"userId": uid, "name": uname, "email": uemail,
                            "subject": subj, "addedAt": _now_iso()})
            joined.append(subj)
        c["members"] = members
        if not joined:
            return False   # không có gì mới để tham gia
    db.update_class_atomic(cls["id"], mutate)
    return {"ok": True, "classId": cls["id"], "className": cls["name"], "subjects": joined}


@app.get("/api/classes/by-code/{code}")
async def get_class_by_code_endpoint(code: str):
    """Xem sơ bộ lớp theo mã (cho học sinh chọn môn trước khi tham gia).
    Không lộ mật khẩu/danh sách thành viên."""
    cls = db.get_class_by_code((code or "").strip().upper())
    if not cls:
        return JSONResponse({"error": "Mã lớp không hợp lệ."}, status_code=404)
    subject = cls.get("subject") or next((s for s in (cls.get("subjects") or []) if s), None)
    return {
        "id": cls["id"], "name": cls.get("name", ""),
        "teacherName": cls.get("teacherName", ""),
        "grade": cls.get("grade"),
        "subject": subject,                       # môn của lớp (mỗi lớp 1 môn)
        "subjects": [subject] if subject else [],  # tương thích client cũ
        "hasJoinPassword": bool(cls.get("joinPassword")),
    }


@app.get("/api/classes/{cls_id}")
async def get_class_endpoint(cls_id: str):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    # Endpoint này phục vụ trang lớp của HỌC SINH → ẩn mật khẩu tham gia.
    # (Giáo viên lấy lớp của mình qua /api/classes?teacherId=... nên vẫn đủ thông tin.)
    return _sanitize_class(cls)


@app.put("/api/classes/{cls_id}")
async def update_class_endpoint(cls_id: str, request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    cls0 = db.get_class(cls_id)
    if not cls0:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền sửa lớp này"}, status_code=403)

    def mutate(cls):
        for k in ("name", "description", "joinPassword", "grade", "schedule", "settings"):
            if k in body: cls[k] = body[k]
        # Mỗi lớp 1 môn: ưu tiên `subject`; nếu client cũ gửi `subjects[]` thì lấy môn đầu.
        if "subject" in body:
            subj = body["subject"] or None
        elif "subjects" in body:
            subj = next((s for s in (body.get("subjects") or []) if s), None)
        else:
            subj = "__keep__"
        if subj != "__keep__":
            cls["subject"] = subj
            cls["subjects"] = [subj] if subj else []
    cls = db.update_class_atomic(cls_id, mutate)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return cls


@app.delete("/api/classes/{cls_id}")
async def delete_class_endpoint(cls_id: str, caller: dict = Depends(require_auth)):
    cls0 = db.get_class(cls_id)
    if not cls0:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa lớp này"}, status_code=403)
    if not db.delete_class(cls_id):
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/members")
async def add_member_endpoint(cls_id: str, request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    em = (body.get("email") or "").strip().lower()
    subject = body.get("subject") or None   # thêm học sinh THEO MÔN
    err = {}

    # Chặn theo cấp độ: chỉ thêm học sinh cùng cấp độ với lớp.
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền thêm học sinh vào lớp này"}, status_code=403)
    if cls0.get("grade"):
        stu = db.get_user_by_id(body.get("userId")) if body.get("userId") is not None else None
        stu_grade = (stu or {}).get("grade")
        if not stu_grade or str(stu_grade) != str(cls0.get("grade")):
            return JSONResponse(
                {"error": f"Chỉ thêm được học sinh cấp độ Lớp {cls0.get('grade')} vào lớp này."},
                status_code=403)

    def mutate(cls):
        if _is_class_teacher(cls, body.get("userId")):
            err["msg"] = "Không thể thêm giáo viên của lớp vào danh sách học sinh."
            return False
        members = cls.get("members", [])
        # Trùng khi cùng học sinh VÀ cùng môn (một học sinh có thể học nhiều môn).
        if any((str(m.get("userId")) == str(body.get("userId"))
                or (em and (m.get("email") or "").strip().lower() == em))
               and (m.get("subject") or None) == subject
               for m in members):
            return False
        members.append({"userId": body.get("userId"), "name": body.get("name", ""),
                        "email": body.get("email", ""), "subject": subject,
                        "addedAt": _now_iso()})
        cls["members"] = members
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if err: return JSONResponse({"error": err["msg"]}, status_code=403)
    return {"ok": True}


@app.delete("/api/classes/{cls_id}/members/{user_id}")
async def remove_member_endpoint(cls_id: str, user_id: str, subject: str = None,
                                  caller: dict = Depends(require_auth)):
    """Xoá học sinh khỏi lớp. Có `subject` → chỉ xoá khỏi MÔN đó;
    không có → xoá khỏi toàn bộ lớp (mọi môn)."""
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa thành viên khỏi lớp này"}, status_code=403)
    subj = subject or None
    def mutate(cls):
        def keep(m):
            if str(m.get("userId")) != user_id:
                return True
            if subj is None:
                return False   # xoá khỏi mọi môn
            return (m.get("subject") or None) != subj
        cls["members"] = [m for m in cls.get("members", []) if keep(m)]
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/co-teachers")
async def add_co_teacher_endpoint(cls_id: str, request: Request, caller: dict = Depends(require_admin)):
    body = await request.json()
    uid = body.get("userId")

    def mutate(cls):
        if str(cls.get("teacherId")) == str(uid):
            return False   # đã là giáo viên chính, không thêm trùng
        co_teachers = cls.get("coTeachers", [])
        if any(str(ct.get("userId")) == str(uid) for ct in co_teachers):
            return False   # đã có rồi
        co_teachers.append({"userId": uid, "name": body.get("name", ""), "addedAt": _now_iso()})
        cls["coTeachers"] = co_teachers
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.delete("/api/classes/{cls_id}/co-teachers/{user_id}")
async def remove_co_teacher_endpoint(cls_id: str, user_id: str, caller: dict = Depends(require_admin)):
    def mutate(cls):
        cls["coTeachers"] = [ct for ct in cls.get("coTeachers", []) if str(ct.get("userId")) != user_id]
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.get("/api/classes/{cls_id}/exams")
async def class_exams_endpoint(cls_id: str, teacherId: str = None, caller: dict = Depends(require_auth)):
    """Đề thi thuộc lớp này — mọi giáo viên (chính hoặc co-teacher) của lớp tạo
    ra đều nằm trong danh sách; lớp khác không thấy. Dùng cho tab 'Đề thi' và
    dropdown 'Giao đề thi'."""
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls, caller["id"]):
        return JSONResponse({"error": "Không có quyền xem đề thi của lớp này"}, status_code=403)
    return db.load_exams_by_class(cls_id)


@app.post("/api/classes/{cls_id}/assignments")
async def add_assignment_endpoint(cls_id: str, request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    cls_check = db.get_class(cls_id)
    if not cls_check:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls_check, caller["id"]):
        return JSONResponse({"error": "Không có quyền giao bài/đề trong lớp này"}, status_code=403)
    exam_id   = body.get("examId") or None
    open_time = body.get("openTime")
    close_time = body.get("closeTime") or body.get("dueDate")
    try:
        max_attempts = int(body.get("maxAttempts")) if body.get("maxAttempts") else None
        if max_attempts is not None and max_attempts < 1:
            max_attempts = None
    except (TypeError, ValueError):
        max_attempts = None
    score_mode = body.get("scoreMode") if body.get("scoreMode") in ("highest", "average", "latest") else "highest"
    asgn = {
        "id": _cls_id(), "title": body.get("title", ""),
        "description": body.get("description", ""),
        "subject": body.get("subject") or None,   # bài tập/đề thi gắn với một môn của lớp
        # dueDate giữ cho tương thích cũ; với đề thi nó = closeTime
        "dueDate": close_time or body.get("dueDate"),
        "examId": exam_id,
        "kind": "exam" if exam_id else "homework",
        "openTime": open_time,
        "closeTime": close_time,
        "duration": body.get("duration"),
        "maxAttempts": max_attempts,     # số lần làm tối đa (None = không giới hạn)
        "scoreMode": score_mode,         # highest | average | latest
        "lockScreen": bool(body.get("lockScreen", False)),   # khóa màn hình chống gian lận
        # IELTS Writing (lớp Tiếng Anh): part 1 ↔ task1, part 2 ↔ task2, None = không chấm AI
        "writingTask": body.get("writingTask") if body.get("writingTask") in ("task1", "task2") else None,
        "attachments": body.get("attachments", []),
        "createdAt": _now_iso(), "submissions": [],
    }
    def mutate(cls):
        cls.setdefault("assignments", []).append(asgn)
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    # Chỉ báo cho học sinh ĐĂNG KÝ ĐÚNG MÔN của bài tập (tránh trùng nếu học nhiều môn).
    # Mục/thành viên cũ chưa gắn subject quy về môn chính của lớp.
    primary = cls.get("subject") or (cls.get("subjects") or [None])[0]
    asgn_subject = asgn.get("subject") or primary
    notified = set()
    for m in cls.get("members", []):
        if asgn_subject and (m.get("subject") or primary) != asgn_subject:
            continue
        muid = str(m.get("userId"))
        if muid in notified:
            continue
        notified.add(muid)
        db.add_notif({
            "id": _cls_id(), "type": "assignment",
            "targetUserId": muid, "classId": cls_id,
            "className": cls.get("name", ""), "assignmentId": asgn["id"],
            "title": f"Bài tập mới: {asgn['title']}",
            "message": f"Lớp {cls.get('name','')} vừa giao bài tập mới. Hạn nộp: {asgn.get('dueDate','')}",
            "createdAt": _now_iso(), "read": False,
        })
    return asgn


@app.get("/api/classes/{cls_id}/exam-window/{exam_id}")
async def get_class_exam_window(cls_id: str, exam_id: str, studentId: str = None,
                                email: str = None, assignmentId: str = None,
                                caller: Optional[dict] = Depends(get_current_user)):
    """
    Trả về cửa sổ thời gian (mở/đóng) của một ĐỀ THI được giao trong lớp,
    để trang làm bài giới hạn theo lớp thay vì theo link công khai.
    assignmentId có giá trị → lấy đúng lần giao bài đó (một đề có thể giao nhiều lần).
    Có đăng nhập → danh tính lấy từ session (bỏ qua studentId/email tự khai).
    """
    if caller:
        studentId, email = caller["id"], caller.get("email")
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)

    is_member = _is_class_member(cls, studentId, email) if studentId is not None else None

    # Học sinh không (còn) thuộc lớp → KHÔNG cấp cửa sổ làm bài của lớp.
    if studentId is not None and not is_member:
        return {"assigned": False, "isMember": False, "className": cls.get("name", "")}

    # Có thể có nhiều lần giao cùng một đề → chọn lần phù hợp nhất:
    #   đang mở > sắp mở (gần nhất) > đã đóng (mới nhất).
    now = datetime.now(_tz.utc)

    def _parse(iso):
        try:
            return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except Exception:
            return None

    def _rank(a):
        op = _parse(a.get("openTime"))
        cl = _parse(a.get("closeTime") or a.get("dueDate"))
        created = a.get("createdAt") or ""
        if (op is None or op <= now) and (cl is None or now <= cl):
            return (3, created)                       # đang mở
        if op is not None and now < op:
            return (2, -(op.timestamp()))             # sắp mở (gần nhất)
        return (1, created)                           # đã đóng (mới nhất)

    candidates = _asgn_candidates(cls, exam_id)
    legacy_owner = _legacy_owner_id(candidates)
    if assignmentId:
        asgn = next((a for a in candidates if str(a.get("id")) == str(assignmentId)), None)
    else:
        asgn = max(candidates, key=_rank) if candidates else None
    if not asgn:
        return JSONResponse({"assigned": False, "isMember": is_member,
                             "className": cls.get("name", "")}, status_code=200)

    # Số lần học sinh đã làm LẦN GIAO BÀI NÀY (mỗi bài nộp = 1 lần) trong lớp này
    attempts_used = 0
    if studentId is not None:
        try:
            attempts_used = sum(
                1 for s in db.get_submissions(exam_id)
                if str(s.get("studentId")) == str(studentId)
                and str(s.get("classId")) == str(cls_id)
                and _sub_belongs_to_asgn(s, asgn.get("id"), legacy_owner)
            )
        except Exception:
            attempts_used = 0

    return {
        "assigned":   True,
        "isMember":   is_member,
        "classId":    cls_id,
        "className":  cls.get("name", ""),
        "assignmentId": asgn.get("id"),
        "title":      asgn.get("title") or "",
        "openTime":   asgn.get("openTime"),
        "closeTime":  asgn.get("closeTime") or asgn.get("dueDate"),
        "duration":   asgn.get("duration"),
        "maxAttempts": asgn.get("maxAttempts"),
        "scoreMode":   asgn.get("scoreMode") or "highest",
        "lockScreen":  bool(asgn.get("lockScreen", False)),
        "attemptsUsed": attempts_used,
    }


@app.delete("/api/classes/{cls_id}/assignments/{asgn_id}")
async def delete_assignment_endpoint(cls_id: str, asgn_id: str, caller: dict = Depends(require_auth)):
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa bài tập của lớp này"}, status_code=403)
    def mutate(cls):
        cls["assignments"] = [a for a in cls.get("assignments", []) if a["id"] != asgn_id]
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/assignments/{asgn_id}/submit")
async def submit_assignment_endpoint(cls_id: str, asgn_id: str, request: Request,
                                      caller: dict = Depends(require_auth)):
    body = await request.json()
    err = {}

    # Toàn bộ đọc-sửa-ghi chạy trong MỘT transaction có khóa dòng — hai học sinh
    # nộp cùng lúc không còn ghi đè mất bài của nhau.
    # Bài IELTS Writing KHÔNG tự chấm khi nộp — giáo viên bấm "Chấm AI" mới chấm
    # (bài nộp mới/nộp lại chưa có aiGrade cho đến khi giáo viên chấm).
    def mutate(cls):
        asgns = cls.get("assignments", [])
        target = next((a for a in asgns if a["id"] == asgn_id), None)
        if not target:
            err["resp"] = ("Không tìm thấy bài tập", 404)
            return False
        due = target.get("closeTime") or target.get("dueDate")
        try:
            if due and datetime.now(_tz.utc) > datetime.fromisoformat(str(due).replace("Z", "+00:00")):
                err["resp"] = ("Đã quá thời hạn nộp bài.", 403)
                return False
        except Exception:
            pass
        subs = target.get("submissions", [])
        sub = {"studentId": caller["id"], "studentName": caller.get("name", ""),
               "submittedAt": _now_iso(), "files": body.get("files", []), "note": body.get("note", "")}
        idx = next((j for j, s in enumerate(subs) if str(s.get("studentId")) == str(caller["id"])), None)
        if idx is not None: subs[idx] = sub
        else: subs.append(sub)
        target["submissions"] = subs
        cls["assignments"] = asgns

    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if "resp" in err:
        msg, status = err["resp"]
        return JSONResponse({"error": msg}, status_code=status)
    return {"ok": True}


@app.get("/api/classes/{cls_id}/assignments/{asgn_id}/submissions")
async def get_assignment_submissions(cls_id: str, asgn_id: str, teacherId: str = None,
                                      caller: dict = Depends(require_auth)):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls, caller["id"]):
        return JSONResponse({"error": "Không có quyền xem bài nộp của lớp này"}, status_code=403)
    for a in cls.get("assignments", []):
        if a["id"] == asgn_id:
            return {"submissions": a.get("submissions", []), "members": cls.get("members", [])}
    return JSONResponse({"error": "Không tìm thấy bài tập"}, status_code=404)


@app.delete("/api/classes/{cls_id}/assignments/{asgn_id}/submissions/{student_id}")
async def delete_assignment_submission(cls_id: str, asgn_id: str, student_id: str,
                                        caller: dict = Depends(require_auth)):
    """Giáo viên xóa bài nộp (file) của một học sinh cho bài tập trong lớp."""
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa bài nộp của lớp này"}, status_code=403)
    err = {}

    def mutate(cls):
        target = next((a for a in cls.get("assignments", []) if a["id"] == asgn_id), None)
        if not target:
            err["msg"] = "Không tìm thấy bài tập"
            return False
        target["submissions"] = [
            s for s in target.get("submissions", [])
            if str(s.get("studentId")) != str(student_id)
        ]
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if err:
        return JSONResponse({"error": err["msg"]}, status_code=404)
    return {"ok": True}


# ─── IELTS Writing AI grading ────────────────────────────────────────────────
# (Khôi phục từ commit aaffdbb — bị mất trong commit Big_Update b27b040 khiến
#  nộp bài Writing văng NameError và nút "Chấm AI"/bảng điểm trả 404.)

def _find_assignment(cls: dict, asgn_id: str):
    return next((a for a in cls.get("assignments", []) if a.get("id") == asgn_id), None)


def _save_ai_grade(cls_id: str, asgn_id: str, student_id: str, grade: dict) -> None:
    """Ghi kết quả chấm vào submission (khóa dòng để không ghi đè bài nộp song song)."""
    def mutate(cls):
        asgn = _find_assignment(cls, asgn_id)
        if not asgn:
            return False
        for s in asgn.get("submissions", []):
            if str(s.get("studentId")) == str(student_id):
                s["aiGrade"] = grade
                return None
        return False
    db.update_class_atomic(cls_id, mutate)


def _grade_submission_sync(cls_id: str, asgn_id: str, student_id: str) -> dict:
    """Chạy toàn bộ pipeline chấm (blocking) và lưu kết quả."""
    cls = db.get_class(cls_id)
    if not cls:
        return {"status": "error", "error": "Không tìm thấy lớp."}
    asgn = _find_assignment(cls, asgn_id)
    if not asgn:
        return {"status": "error", "error": "Không tìm thấy bài tập."}
    if not asgn.get("writingTask"):
        return {"status": "error", "error": "Bài tập này không bật chấm AI (IELTS Writing)."}
    sub = next((s for s in asgn.get("submissions", [])
                if str(s.get("studentId")) == str(student_id)), None)
    if not sub:
        return {"status": "error", "error": "Học sinh chưa nộp bài."}
    try:
        grade = ielts.run_grading(_get_groq(), asgn, sub, CLASS_DOCS_DIR)
    except Exception as e:
        grade = {"status": "error", "error": f"Lỗi khi chấm: {e}", "gradedAt": _now_iso()}
    _save_ai_grade(cls_id, asgn_id, student_id, grade)
    return grade


@app.post("/api/classes/{cls_id}/assignments/{asgn_id}/grade/{student_id}")
async def grade_submission_endpoint(cls_id: str, asgn_id: str, student_id: str,
                                     caller: dict = Depends(require_auth)):
    """Chấm (hoặc chấm lại) bài IELTS Writing của một học sinh."""
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền chấm bài của lớp này"}, status_code=403)
    _save_ai_grade(cls_id, asgn_id, student_id, {"status": "pending"})
    grade = await asyncio.to_thread(_grade_submission_sync, cls_id, asgn_id, student_id)
    if grade.get("status") == "error":
        return JSONResponse({"error": grade.get("error", "Chấm thất bại"), "aiGrade": grade}, status_code=422)
    return {"ok": True, "aiGrade": grade}


@app.get("/api/classes/{cls_id}/assignments/{asgn_id}/grades-summary")
async def grades_summary_endpoint(cls_id: str, asgn_id: str):
    """Bảng tóm tắt thống kê điểm AI từng học sinh (học sinh & giáo viên đều xem được)."""
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    asgn = _find_assignment(cls, asgn_id)
    if not asgn:
        return JSONResponse({"error": "Không tìm thấy bài tập"}, status_code=404)
    rows, bands = [], []
    for s in asgn.get("submissions", []):
        g = s.get("aiGrade") or {}
        crit = g.get("criteria") or {}
        row = {
            "studentId": s.get("studentId"), "studentName": s.get("studentName", ""),
            "submittedAt": s.get("submittedAt"), "status": g.get("status") or "none",
            "wordCount": g.get("wordCount"), "overallBand": g.get("overallBand"),
        }
        for k in ielts.CRITERIA_KEYS:
            row[k] = (crit.get(k) or {}).get("band")
        rows.append(row)
        if g.get("status") == "done" and g.get("overallBand") is not None:
            bands.append(g["overallBand"])
    rows.sort(key=lambda r: (-(r["overallBand"] or -1), r["studentName"]))
    stats = {
        "graded": len(bands), "total": len(rows),
        "avg": round(sum(bands) / len(bands), 2) if bands else None,
        "max": max(bands) if bands else None,
        "min": min(bands) if bands else None,
    }
    return {"writingTask": asgn.get("writingTask"), "criterionLabel":
            ("Task Achievement" if asgn.get("writingTask") == "task1" else "Task Response"),
            "rows": rows, "stats": stats}


# ─── End IELTS Writing AI grading ────────────────────────────────────────────


@app.post("/api/classes/{cls_id}/documents")
async def add_class_doc_endpoint(cls_id: str, request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền thêm tài liệu vào lớp này"}, status_code=403)

    def mutate(cls):
        cls.setdefault("documents", []).append(body)
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.delete("/api/classes/{cls_id}/documents/{doc_id}")
async def remove_class_doc_endpoint(cls_id: str, doc_id: str, caller: dict = Depends(require_auth)):
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền xóa tài liệu của lớp này"}, status_code=403)
    def mutate(cls):
        cls["documents"] = [d for d in cls.get("documents", []) if d.get("id") != doc_id]
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.patch("/api/classes/{cls_id}/documents/{doc_id}")
async def update_class_doc_endpoint(cls_id: str, doc_id: str, request: Request,
                                     caller: dict = Depends(require_auth)):
    """Cập nhật một vài field của 1 document đã có (vd: order khi kéo-thả sắp xếp lại
    các bước đáp án giải) — không phải thay thế toàn bộ document."""
    body = await request.json()
    cls0 = db.get_class(cls_id)
    if cls0 is None:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls0, caller["id"]):
        return JSONResponse({"error": "Không có quyền sửa tài liệu của lớp này"}, status_code=403)

    def mutate(cls):
        for d in cls.get("documents", []):
            if d.get("id") == doc_id:
                d.update(body)
                return
    cls = db.update_class_atomic(cls_id, mutate)
    if cls is None: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.get("/api/notifications")
async def get_notifications_endpoint(caller: dict = Depends(require_auth)):
    return db.get_notifs_for_user(str(caller["id"]))


@app.post("/api/notifications/read")
async def mark_notification_read(request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    db.mark_notif_read(body.get("id", ""))
    return {"ok": True}


@app.post("/api/notifications/read-all")
async def mark_all_read(caller: dict = Depends(require_auth)):
    db.mark_all_notifs_read(str(caller["id"]))
    return {"ok": True}


# ─── Điểm danh + Tiến độ học sinh + Báo cáo tổng hợp ──────────────────────────

@app.post("/api/classes/{cls_id}/attendance")
async def submit_attendance_endpoint(cls_id: str, request: Request, caller: dict = Depends(require_auth)):
    body = await request.json()
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    teacher_id = caller["id"]
    if not _is_class_teacher(cls, teacher_id):
        return JSONResponse({"error": "Không có quyền điểm danh lớp này"}, status_code=403)
    date = (body.get("date") or "").strip()
    if not date:
        return JSONResponse({"error": "Thiếu ngày điểm danh"}, status_code=400)
    records = body.get("records") or []

    session = db.upsert_attendance_session(
        _cls_id(), cls_id, cls.get("name", ""), date, teacher_id, records)

    absentees = session.get("newAbsentees") or []
    if absentees:
        for adm in db.get_super_admins():
            db.add_notif({
                # classId=None: đây là thông báo cho SUPER ADMIN, không phải học sinh của lớp
                # (super admin không phải "member" của lớp) — để trống để NotificationBell
                # không cố mở lớp qua luồng "Lớp của tôi" (chỉ dành cho học sinh) khi bấm vào.
                "id": _cls_id(), "type": "attendance",
                "targetUserId": str(adm.get("id")), "classId": None,
                "className": cls.get("name", ""), "assignmentId": "",
                "title": f"Báo cáo điểm danh lớp {cls.get('name','')} ngày {date}",
                "message": f"{len(absentees)} học sinh vắng: {', '.join(absentees)}",
                "createdAt": _now_iso(), "read": False,
            })
    return session


@app.get("/api/classes/{cls_id}/attendance")
async def get_attendance_endpoint(cls_id: str, date: str = None):
    if not date:
        return JSONResponse({"error": "Thiếu ngày"}, status_code=400)
    return db.get_attendance_session(cls_id, date)


@app.get("/api/classes/{cls_id}/attendance/history")
async def attendance_history_endpoint(cls_id: str, limit: int = 30):
    return db.list_attendance_sessions(cls_id, limit)


@app.get("/api/classes/{cls_id}/progress")
async def class_progress_endpoint(cls_id: str, caller: dict = Depends(require_auth)):
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if not _is_class_teacher(cls, caller["id"]):
        return JSONResponse({"error": "Không có quyền xem tiến độ lớp này"}, status_code=403)

    attend_stats = db.class_attendance_stats(cls_id)
    attend_detail = db.class_attendance_detail(cls_id)
    now = datetime.now(_tz.utc)

    def _parse(iso):
        try:
            return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except Exception:
            return None

    per_student = {}
    for m in cls.get("members", []):
        sid = str(m.get("userId"))
        attendance = dict(attend_stats.get(sid) or
                          {"total": 0, "coMat": 0, "vang": 0, "tre": 0, "phep": 0, "rate": None})
        attendance["detail"] = attend_detail.get(sid, [])
        per_student[sid] = {
            "studentId": sid, "studentName": m.get("name", ""),
            "attendance": attendance,
            "assignments": {"submitted": 0, "total": 0, "missed": []},
            "scoreHistory": [],
        }

    for asgn in cls.get("assignments", []):
        asgn_subject = asgn.get("subject") or cls.get("subject")
        member_ids = [str(m.get("userId")) for m in cls.get("members", [])
                      if not asgn_subject or (m.get("subject") or cls.get("subject")) == asgn_subject]
        if asgn.get("examId"):
            submitted_by = {str(s.get("studentId")): s
                            for s in db.get_submissions_for_assignment(cls_id, asgn["id"])}
        else:
            submitted_by = {str(s.get("studentId")): s for s in asgn.get("submissions", [])}
        close_dt = _parse(asgn.get("closeTime") or asgn.get("dueDate"))
        is_over = bool(close_dt and now > close_dt)
        for sid in member_ids:
            st = per_student.get(sid)
            if not st:
                continue
            st["assignments"]["total"] += 1
            sub = submitted_by.get(sid)
            if sub:
                st["assignments"]["submitted"] += 1
                score, max_score = sub.get("score"), sub.get("maxScore")
                if score is not None and max_score:
                    st["scoreHistory"].append({
                        "title": asgn.get("title", ""), "date": sub.get("submittedAt"),
                        "score": score, "maxScore": max_score,
                    })
            elif is_over:
                st["assignments"]["missed"].append({
                    "title": asgn.get("title", ""),
                    "date": asgn.get("closeTime") or asgn.get("dueDate"),
                })

    for st in per_student.values():
        st["scoreHistory"].sort(key=lambda x: x.get("date") or "")

    return {"students": list(per_student.values())}


@app.get("/api/admin/reports")
async def admin_reports_endpoint(type: str = None, classId: str = None,
                                  limit: int = 50, offset: int = 0,
                                  caller: dict = Depends(require_super_admin)):
    return db.list_reports(type_=type, class_id=classId, limit=limit, offset=offset)


_REPORT_SCAN_INTERVAL = 900  # 15 phút


async def _report_scanner_loop():
    while True:
        try:
            _scan_overdue_assignments()
        except Exception as e:
            print(f"[report-scanner] error: {e}")
        await asyncio.sleep(_REPORT_SCAN_INTERVAL)


def _scan_overdue_assignments() -> None:
    """Quét định kỳ: bài tập/đề đã quá hạn nộp → học sinh chưa nộp (bỏ bài) hoặc điểm dưới
    ngưỡng của lớp (điểm thấp) được ghi vào bảng reports + báo cho super admin. Idempotent
    qua cờ assignment['reportScanned'] + unique index (type,ref_id,student_id) trên reports."""
    now = datetime.now(_tz.utc)

    def _parse(iso):
        try:
            return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except Exception:
            return None

    for cls in db.list_all_classes():
        cls_id, class_name = cls["id"], cls.get("name", "")
        threshold = (cls.get("settings") or {}).get("lowScoreThreshold")
        if threshold is None:
            threshold = 50
        scanned_ids = set()
        for asgn in cls.get("assignments") or []:
            if asgn.get("reportScanned"):
                continue
            close_dt = _parse(asgn.get("closeTime") or asgn.get("dueDate"))
            if not close_dt or close_dt > now:
                continue
            asgn_subject = asgn.get("subject") or cls.get("subject")
            members = [m for m in cls.get("members", [])
                       if not asgn_subject or (m.get("subject") or cls.get("subject")) == asgn_subject]
            if asgn.get("examId"):
                submitted_by = {str(s.get("studentId")): s
                                for s in db.get_submissions_for_assignment(cls_id, asgn["id"])}
            else:
                submitted_by = {str(s.get("studentId")): s for s in asgn.get("submissions", [])}

            missed, low_score = [], []
            for m in members:
                sid = str(m.get("userId"))
                sub = submitted_by.get(sid)
                if not sub:
                    if db.add_report({
                        "id": _cls_id(), "type": "bo_bai", "classId": cls_id, "className": class_name,
                        "studentId": sid, "studentName": m.get("name", ""), "refId": asgn["id"],
                        "title": f"Bỏ bài: {asgn.get('title','')}",
                        "detail": f"Học sinh {m.get('name','')} không nộp bài '{asgn.get('title','')}' "
                                  f"(lớp {class_name}) đúng hạn.",
                    }):
                        missed.append(m.get("name", ""))
                else:
                    score, max_score = sub.get("score"), sub.get("maxScore")
                    if score is not None and max_score:
                        pct = score / max_score * 100
                        if pct < threshold:
                            if db.add_report({
                                "id": _cls_id(), "type": "diem_thap", "classId": cls_id, "className": class_name,
                                "studentId": sid, "studentName": m.get("name", ""), "refId": asgn["id"],
                                "title": f"Điểm thấp: {asgn.get('title','')}",
                                "detail": f"Học sinh {m.get('name','')} đạt {score}/{max_score} ({pct:.0f}%) "
                                          f"bài '{asgn.get('title','')}' (lớp {class_name}), dưới ngưỡng {threshold}%.",
                            }):
                                low_score.append(f"{m.get('name','')} ({score}/{max_score})")
            scanned_ids.add(asgn["id"])
            if missed or low_score:
                parts = []
                if missed: parts.append(f"{len(missed)} bỏ bài: {', '.join(missed)}")
                if low_score: parts.append(f"{len(low_score)} điểm thấp: {', '.join(low_score)}")
                for adm in db.get_super_admins():
                    db.add_notif({
                        # classId=None: thông báo cho super admin — xem giải thích ở notif "attendance" phía trên.
                        "id": _cls_id(), "type": "report",
                        "targetUserId": str(adm.get("id")), "classId": None,
                        "className": class_name, "assignmentId": asgn["id"],
                        "title": f"Báo cáo bài tập: {asgn.get('title','')} — lớp {class_name}",
                        "message": " · ".join(parts),
                        "createdAt": _now_iso(), "read": False,
                    })
        if scanned_ids:
            def mutate(c, ids=scanned_ids):
                for a in c.get("assignments", []):
                    if a.get("id") in ids:
                        a["reportScanned"] = True
            db.update_class_atomic(cls_id, mutate)


# ─── End Class management ─────────────────────────────────────────────────────


# ─── Class document upload ────────────────────────────────────────────────────

CLASS_DOCS_DIR = Path(__file__).parent / "class_docs"
CLASS_DOCS_DIR.mkdir(parents=True, exist_ok=True)

_MAX_CLASS_DOC_BYTES = 50 * 1024 * 1024   # 50 MB / tài liệu


@app.post("/api/class-documents/upload")
async def upload_class_document(file: UploadFile = File(...)):
    """Upload tài liệu cho lớp học."""
    original_name = file.filename or "document"
    safe_name = "".join(c if (c.isalnum() or c in "._- ") else "_" for c in original_name)
    doc_id = str(uuid.uuid4())[:8]
    filename = f"{doc_id}_{safe_name}"
    dest = CLASS_DOCS_DIR / filename
    content = await file.read()
    if len(content) > _MAX_CLASS_DOC_BYTES:
        return JSONResponse({"error": "Tài liệu quá lớn (tối đa 50 MB)."}, status_code=413)
    dest.write_bytes(content)
    mime = file.content_type or "application/octet-stream"
    return {
        "id": doc_id,
        "name": original_name,
        "filename": filename,
        "url": f"/class-docs/{filename}",
        "mimeType": mime,
        "size": len(content),
        "uploadedAt": _now_iso(),
    }


@app.delete("/api/class-documents/{filename}")
async def delete_class_document(filename: str):
    """Xóa tài liệu lớp học."""
    # Prevent path traversal
    safe = Path(filename).name
    target = CLASS_DOCS_DIR / safe
    if target.exists():
        target.unlink()
    return {"ok": True}


# ─── End Class document upload ───────────────────────────────────────────────

# ─── Submission image upload (bài làm tự luận) ───────────────────────────────

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

_IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024   # 15 MB / ảnh (ảnh chụp điện thoại)


@app.post("/api/submissions/upload")
async def upload_submission_image(file: UploadFile = File(...)):
    """Học sinh upload ảnh bài làm tự luận (chụp / thư viện / kéo thả).
    Trả về URL để lưu trong answers của bài nộp."""
    original = file.filename or "anh.jpg"
    ext = Path(original).suffix.lower()
    if ext not in _IMG_EXTS:
        ext = ".jpg"
    content = await file.read()
    if not content:
        return JSONResponse({"error": "Tệp rỗng."}, status_code=400)
    if len(content) > _MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "Ảnh quá lớn (tối đa 15 MB)."}, status_code=413)
    filename = f"{uuid.uuid4().hex[:16]}{ext}"
    (UPLOADS_DIR / filename).write_bytes(content)
    return {
        "url":  f"/uploads/{filename}",
        "name": original,
        "size": len(content),
    }


@app.delete("/api/submissions/upload/{filename}")
async def delete_submission_image(filename: str):
    """Xóa ảnh bài làm đã upload (khi học sinh bỏ ảnh trước lúc nộp)."""
    safe = Path(filename).name
    target = UPLOADS_DIR / safe
    if target.exists():
        target.unlink()
    return {"ok": True}

# ─── End submission image upload ─────────────────────────────────────────────

# ─── Exercise Solver ─────────────────────────────────────────────────────────

import re as _re
import base64 as _base64

GROQ_SOLVER_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct"

def _fix_json_escapes(s):
    """Fix LaTeX backslashes trong JSON string từ LLM.

    - Luôn giữ: \\" \\\\ \\/ và \\uXXXX (4 hex digit đúng).
    - \\b \\f \\n \\r \\t: chỉ giữ khi KHÔNG theo sau bởi chữ cái.
        VD: \\n ở cuối dòng = newline (giữ),
            \\nabla \\neq \\right \\rfloor \\text \\theta = LaTeX (double).
            \\frac \\flat \\forall \\beta \\binom = LaTeX (double).
    - Mọi trường hợp khác: double → \\\\frac \\\\sqrt \\\\lfloor ...
    """
    _keep_always = set('"\\/')
    _keep_if_not_alpha = set('bfnrt')
    result = []
    i = 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            next_ch = s[i + 1]
            if next_ch in _keep_always:
                result.append(s[i])
                result.append(next_ch)
                i += 2
            elif next_ch in _keep_if_not_alpha:
                lookahead = s[i + 2] if i + 2 < len(s) else ''
                if lookahead.isalpha():
                    # LaTeX: \\nabla \\neq \\right \\rfloor \\text \\theta → double
                    result.append('\\\\')
                    i += 1
                else:
                    # JSON whitespace không theo sau chữ cái → giữ nguyên
                    result.append(s[i])
                    result.append(next_ch)
                    i += 2
            elif next_ch == 'u':
                hex_part = s[i+2:i+6]
                if len(hex_part) == 4 and all(c in '0123456789abcdefABCDEF' for c in hex_part):
                    result.append(s[i])
                    result.append(next_ch)
                    i += 2
                else:
                    # \\url \\underbrace v.v. → double, giữ lại 'u'
                    result.append('\\\\')
                    i += 1
            else:
                # \\frac \\sqrt \\lfloor \\left \\cdot \\beta \\f \\b → double
                result.append('\\\\')
                i += 1
        else:
            result.append(s[i])
            i += 1
    return ''.join(result)


def _robust_json_loads(raw: str):
    """Multi-fallback JSON parser cho response từ AI.

    Thử theo thứ tự:
      1. json.loads trực tiếp
      2. repair_truncated_json (đóng dấu ngoặc bị cắt)
      3. ast.literal_eval  — xử lý single-quote Python-style dict
      4. Thêm dấu nháy kép quanh key chưa được quote  {key: val} → {"key": val}
      5. Kết hợp (4) + (2)
      6. Tìm block JSON lớn nhất trong text (AI hay thêm lời giải thích trước/sau)
    """
    import ast as _ast

    if not raw or not raw.strip():
        raise json.JSONDecodeError("Empty input", raw or "", 0)

    def _quote_keys(s):
        return _re.sub(
            r'(?<=[{\[,])\s*([A-Za-z_]\w*)\s*(?=\s*:(?!\s*:))',
            r'"\1"', s
        )

    # 1. Standard
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 2. Repair truncated
    try:
        return json.loads(repair_truncated_json(raw))
    except json.JSONDecodeError:
        pass

    # 3. Python literal (single-quote keys/values)
    try:
        obj = _ast.literal_eval(raw)
        if isinstance(obj, (dict, list)):
            return obj
    except Exception:
        pass

    # 4. Add double-quotes around unquoted keys
    try:
        return json.loads(_quote_keys(raw))
    except json.JSONDecodeError:
        pass

    # 5. Quote keys + repair truncated
    try:
        return json.loads(repair_truncated_json(_quote_keys(raw)))
    except json.JSONDecodeError:
        pass

    # 6. Extract largest {...} or [...] block embedded in text
    for pat in (r'\{[\s\S]*\}', r'\[[\s\S]*\]'):
        m = _re.search(pat, raw)
        if m and m.group() != raw:
            candidate = m.group()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
            try:
                return json.loads(repair_truncated_json(candidate))
            except json.JSONDecodeError:
                pass
            try:
                return json.loads(_quote_keys(candidate))
            except json.JSONDecodeError:
                pass

    raise json.JSONDecodeError("All JSON parse attempts failed", raw, 0)


def _safe_json_loads(text):
    """Parse JSON từ phản hồi AI, tự động fix LaTeX backslash."""
    text = _re.sub(r'```(?:json)?\s*', '', text).strip()
    m = _re.search(r'\{[\s\S]*\}', text)
    if not m:
        raise ValueError("Không trích xuất được JSON từ phản hồi AI")
    raw = m.group()
    try:
        return _robust_json_loads(raw)
    except (json.JSONDecodeError, Exception):
        return json.loads(_fix_json_escapes(raw))


_SOLVER_SUBJECT_LABELS = {"toan": "Toán", "ly": "Vật lý", "hoa": "Hóa học"}


def _build_solve_prompt(exercise, subject="toan"):
    label = _SOLVER_SUBJECT_LABELS.get(subject, "Toán")
    exercise_section = (
        f'Bài tập:\n"""\n{exercise}\n"""'
        if exercise
        else "(Xem hình ảnh đính kèm — đọc toàn bộ đề bài từ ảnh)"
    )
    geometry_block = ""
    if subject == "toan":
        geometry_block = """

Khi is_geometry=true, geometry_data PHẢI có đúng định dạng:
{
  "points": [{"id": "A", "x": 0.0, "y": 0.0, "z": 0.0}],
  "segments": [{"from": "A", "to": "B", "dashed": false}],
  "faces": [{"id": "f1", "points": ["A","B","C"], "style": {"fill": "#4dabf7", "opacity": 0.3, "stroke": "#1971c2"}}],
  "midpoints": [{"id": "M", "of": ["A","B"]}],
  "vectors": [],
  "labels": []
}

Quy ước tọa độ: x=ngang, y=cao (lên trên), z=sâu. Cạnh bị che dùng "dashed": true.
Đặt hình vào vùng tọa độ hợp lý, mô tả ĐÚNG hình trong đề bài."""
    is_geometry_hint = (
        "<true nếu bài liên quan đến hình không gian 3D, ngược lại false>"
        if subject == "toan" else "<luôn luôn false>"
    )
    geometry_data_hint = (
        "<object vẽ hình nếu is_geometry=true, ngược lại null>"
        if subject == "toan" else "<luôn luôn null>"
    )
    return f"""Bạn là giáo viên {label} THPT Việt Nam. Phân tích bài tập {label.lower()} và trả lời CHÍNH XÁC bằng JSON.

{exercise_section}

Trả lời bằng JSON thuần túy (không có ```json, không giải thích ngoài JSON):
{{
  "is_geometry": {is_geometry_hint},
  "geometry_data": {geometry_data_hint},
  "theory": [
    {{"title": "Tên định lý/công thức/khái niệm", "content": "Giải thích, dùng LaTeX $...$ hoặc $$...$$"}}
  ],
  "steps": [
    {{"title": "Bước N: tiêu đề", "content": "Nội dung chi tiết, dùng LaTeX cho mọi công thức"}}
  ]
}}{geometry_block}
theory: 3-5 kiến thức quan trọng. steps: 4-8 bước giải chi tiết. Dùng LaTeX cho TẤT CẢ công thức."""


def _build_verify_prompt(exercise, draft_steps, subject="toan"):
    label = _SOLVER_SUBJECT_LABELS.get(subject, "Toán")
    steps_text = json.dumps(draft_steps, ensure_ascii=False, indent=2)
    exercise_section = (
        f'Bài tập:\n"""\n{exercise}\n"""'
        if exercise
        else "(Bài tập từ hình ảnh đính kèm)"
    )
    return f"""Bạn là giáo viên {label} THPT Việt Nam. Nhiệm vụ: kiểm tra lời giải bên dưới và trả về bản đã sửa lỗi.

{exercise_section}

Lời giải cần kiểm tra:
{steps_text}

Hãy:
1. Đọc kỹ từng bước, kiểm tra tính đúng đắn của phép tính, công thức, logic.
2. Sửa bất kỳ lỗi nào (sai công thức, sai tính toán, thiếu bước, bước dư thừa).
3. Nếu không có lỗi, giữ nguyên nội dung.

Trả lời bằng JSON thuần túy (không có ```json):
{{
  "steps": [
    {{"title": "Bước N: tiêu đề", "content": "Nội dung đã kiểm tra/sửa, dùng LaTeX cho mọi công thức"}}
  ]
}}"""


def _groq_solve_sync(groq_client, exercise, img_b64, mime, subject="toan"):
    prompt_text = _build_solve_prompt(exercise, subject)
    if img_b64:
        user_content = [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
            {"type": "text", "text": prompt_text},
        ]
    else:
        user_content = prompt_text
    resp = groq_client.chat.completions.create(
        model=GROQ_SOLVER_MODEL,
        messages=[{"role": "user", "content": user_content}],
        temperature=0.2,
        max_tokens=4000,
    )
    text = resp.choices[0].message.content.strip()
    result = _safe_json_loads(text)
    gd = result.get("geometry_data")
    if not isinstance(gd, dict) or not isinstance(gd.get("points"), list):
        result["geometry_data"] = None
    return result


def _groq_verify_sync(verify_client, exercise, draft_steps, subject="toan"):
    prompt_text = _build_verify_prompt(exercise, draft_steps, subject)
    resp = verify_client.chat.completions.create(
        model=GROQ_SOLVER_MODEL,
        messages=[{"role": "user", "content": prompt_text}],
        temperature=0.1,
        max_tokens=3000,
    )
    text = resp.choices[0].message.content.strip()
    verified = _safe_json_loads(text)
    return verified.get("steps") or draft_steps


@app.post("/api/solve-exercise")
async def solve_exercise(
    exercise: str = Form(""),
    file: UploadFile = File(None),
    subject: str = Form("toan"),
):
    """GROQ call 1: giải (theory + geometry + steps) → GROQ call 2: verify & fix steps."""
    exercise = exercise.strip()
    if not exercise and file is None:
        return JSONResponse({"error": "Thiếu nội dung bài tập"}, status_code=400)
    if subject not in _SOLVER_SUBJECT_LABELS:
        subject = "toan"

    img_b64 = None
    mime = None
    if file is not None:
        img_bytes = await file.read()
        img_b64 = _base64.b64encode(img_bytes).decode()
        mime = file.content_type or "image/jpeg"

    keys = load_api_keys()
    solve_client = Groq(api_key=keys[0])
    # Dùng key khác (nếu có) cho verify để tránh rate-limit
    verify_client = Groq(api_key=keys[1] if len(keys) > 1 else keys[0])

    try:
        # Call 1: giải toàn bộ
        result = await asyncio.to_thread(_groq_solve_sync, solve_client, exercise, img_b64, mime, subject)

        draft_steps = result.get("steps") or []
        if draft_steps:
            # Call 2: verify & sửa lỗi steps (chạy song song với việc đã có theory/geo)
            verified_steps = await asyncio.to_thread(
                _groq_verify_sync, verify_client, exercise, draft_steps, subject
            )
            result["steps"] = verified_steps

        return result
    except json.JSONDecodeError as e:
        return JSONResponse({"error": f"Lỗi phân tích JSON: {e}"}, status_code=422)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ─── End Exercise Solver ──────────────────────────────────────────────────────

# ─── AI Generate Questions ────────────────────────────────────────────────────

_GEN_SECTION_PROMPTS = {
    "PHẦN I": (
        "multiple_choice",
        lambda sec, n: (
            f'Tạo đúng {n} câu trắc nghiệm Toán THPT cho {sec}. '
            'Mỗi câu có 4 đáp án A/B/C/D và duy nhất 1 đáp án đúng.\n'
            f'Cấu trúc mỗi phần tử trong mảng "questions":\n'
            f'{{"question_number":1,"section":"{sec}","question_text":"...","choices":{{"A":"...","B":"...","C":"...","D":"..."}},"answer":"A","has_figure":false,"points":0.25}}'
        ),
    ),
    "PHẦN II": (
        "true_false",
        lambda sec, n: (
            f'Tạo đúng {n} câu đúng/sai Toán THPT. '
            'Mỗi câu có đúng 4 mệnh đề (a, b, c, d), mỗi mệnh đề là đúng hoặc sai.\n'
            f'Cấu trúc mỗi phần tử:\n'
            f'{{"question_number":1,"section":"PHẦN II","question_text":"...","sub_questions":[{{"label":"a","text":"...","correct_answer":true}},{{"label":"b","text":"...","correct_answer":false}},{{"label":"c","text":"...","correct_answer":true}},{{"label":"d","text":"...","correct_answer":false}}],"has_figure":false,"points":null}}'
        ),
    ),
    "PHẦN III": (
        "short_answer",
        lambda sec, n: (
            f'Tạo đúng {n} câu trả lời ngắn Toán THPT. '
            'Mỗi câu yêu cầu điền đáp số số học cụ thể.\n'
            f'Cấu trúc mỗi phần tử:\n'
            f'{{"question_number":1,"section":"PHẦN III","question_text":"...","answer":"42","has_figure":false,"points":null}}'
        ),
    ),
    "TIẾNG ANH": (
        "multiple_choice",
        lambda sec, n: (
            f'Tạo đúng {n} câu trắc nghiệm Tiếng Anh THPT. '
            'Mỗi câu có 4 đáp án A/B/C/D và 1 đáp án đúng. Nội dung hoàn toàn bằng Tiếng Anh.\n'
            f'Cấu trúc mỗi phần tử:\n'
            f'{{"question_number":1,"section":"TIẾNG ANH","question_text":"...","choices":{{"A":"...","B":"...","C":"...","D":"..."}},"answer":"A","has_figure":false,"points":0.25}}'
        ),
    ),
    "READING": (
        "multiple_choice",
        lambda sec, n: (
            f'Tạo đúng {n} câu trắc nghiệm đọc hiểu (reading comprehension) Tiếng Anh THPT '
            'bám sát đoạn văn bài đọc đang cho. '
            'Mỗi câu có 4 đáp án A/B/C/D và 1 đáp án đúng. Nội dung hoàn toàn bằng Tiếng Anh.\n'
            f'Cấu trúc mỗi phần tử:\n'
            f'{{"question_number":1,"section":"READING","question_text":"...","choices":{{"A":"...","B":"...","C":"...","D":"..."}},"answer":"A","has_figure":false,"points":0.25}}'
        ),
    ),
}


_GEN_VISION_MODEL = "qwen/qwen3.6-27b"  # llama-4-scout bị Groq khai tử 17/07/2026
_GEN_TEXT_MODEL   = "llama-3.3-70b-versatile"


@app.post("/api/generate-questions")
async def generate_questions_api(request: Request):
    import re as _re
    body       = await request.json()
    prompt     = (body.get("prompt") or "").strip()
    section    = body.get("section", "PHẦN I")
    count      = max(1, min(10, int(body.get("count") or 5)))
    image_b64  = body.get("image_b64")   # optional base64 string (no data-URL prefix)
    image_mime = body.get("image_mime", "image/jpeg")

    if not prompt and not image_b64:
        return JSONResponse({"error": "prompt hoặc ảnh là bắt buộc"}, status_code=400)

    if not prompt:
        prompt = "Tạo câu hỏi từ hình ảnh này"

    _, fmt_fn = _GEN_SECTION_PROMPTS.get(section, _GEN_SECTION_PROMPTS["PHẦN I"])
    fmt_desc  = fmt_fn(section, count)

    is_english = section in ("TIẾNG ANH", "READING")
    latex_rule = (
        "" if is_english else
        "- LATEX bắt buộc: mọi ký hiệu toán phải trong $...$, ví dụ $x^2+1$, $\\frac{a}{b}$, $\\int_0^1 f(x)\\,dx$\n"
        "- Biến đơn lẻ cũng cần $: $x$, $n$, $a$\n"
    )
    sys_prompt = (
        f"Bạn là chuyên gia ra đề thi {'Tiếng Anh' if is_english else 'Toán'} THPT Việt Nam.\n"
        f"Yêu cầu:\n"
        f"{latex_rule}"
        f"- Đảm bảo đáp án chính xác, có cơ sở\n"
        f"- Viết câu hỏi rõ ràng, đúng ngữ pháp\n\n"
        f"{fmt_desc}\n\n"
        f"Trả về CHỈ JSON hợp lệ: {{\"questions\": [...]}}"
    )

    try:
        keys = load_api_keys()

        if image_b64:
            # Vision path: ảnh + prompt gộp vào 1 message user
            messages = [{
                "role": "user",
                "content": [
                    {"type": "image_url",
                     "image_url": {"url": f"data:{image_mime};base64,{image_b64}"}},
                    {"type": "text",
                     "text": f"{sys_prompt}\n\nYêu cầu cụ thể: {prompt}"},
                ],
            }]
            model = _GEN_VISION_MODEL
        else:
            # Text path
            messages = [
                {"role": "system", "content": sys_prompt},
                {"role": "user",   "content": prompt},
            ]
            model = _GEN_TEXT_MODEL

        # Xoay vòng qua các key dự phòng nếu key hiện tại bị rate-limit (429)
        resp = None
        last_err = None
        for key in keys:
            try:
                resp = Groq(api_key=key).chat.completions.create(
                    model=model, messages=messages, max_tokens=4096, temperature=0.7,
                )
                break
            except Exception as e:
                last_err = e
                err_str = str(e)
                if "429" in err_str or "rate_limit" in err_str.lower():
                    continue
                raise
        if resp is None:
            raise last_err

        raw_full = resp.choices[0].message.content or ""
        raw_full = raw_full.strip()
        # Strip markdown fences
        raw_full = _re.sub(r"^```(?:json)?\s*", "", raw_full).strip()
        raw_full = _re.sub(r"\s*```$", "", raw_full).strip()

        if not raw_full:
            return JSONResponse(
                {"error": "AI trả về phản hồi rỗng", "questions": []}, status_code=500
            )

        def _try_parse_text(text: str):
            """Thử parse JSON từ text bằng nhiều chiến lược, trả về dict hoặc None."""
            if not text or not text.strip():
                return None
            for s in (text, sanitize_json_escapes(text), _fix_json_escapes(text)):
                try:
                    obj = _robust_json_loads(s)
                    # Chuẩn hóa list → dict với key "questions"
                    if isinstance(obj, list):
                        return {"questions": obj}
                    if isinstance(obj, dict):
                        return obj
                except Exception:
                    pass
            return None

        # Thử lần lượt các vùng trích xuất
        data = None

        # A. Full text nguyên bản
        data = _try_parse_text(raw_full)

        # B. Từ ký tự { hoặc [ đầu tiên trở đi
        if data is None:
            m = _re.search(r'[{\[]', raw_full)
            if m:
                data = _try_parse_text(raw_full[m.start():])

        # C. Block {...} lớn nhất (tìm từ phải sang trái để lấy outermost)
        if data is None:
            # Tìm vị trí { cuối cùng đóng được thành JSON hợp lệ
            for m in _re.finditer(r'\{', raw_full):
                candidate = raw_full[m.start():]
                result = _try_parse_text(candidate)
                if result is not None:
                    data = result
                    break

        # D. Block [...] lớn nhất
        if data is None:
            m = _re.search(r'\[[\s\S]*\]', raw_full)
            if m:
                data = _try_parse_text(m.group())

        if data is None:
            preview = raw_full[:200].replace("\n", " ")
            return JSONResponse(
                {"error": f"Không parse được JSON từ phản hồi AI. Preview: {preview!r}",
                 "questions": []},
                status_code=500,
            )

        questions = data.get("questions", []) if isinstance(data, dict) else []
        for i, q in enumerate(questions):
            q["question_number"] = i + 1
            q.setdefault("section",    section)
            q.setdefault("has_figure", False)
        return JSONResponse({"questions": questions})
    except Exception as e:
        return JSONResponse({"error": str(e), "questions": []}, status_code=500)


# Phục vụ ảnh đã trích xuất: /images/p1_img1.jpeg
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/class-docs", StaticFiles(directory=str(CLASS_DOCS_DIR)), name="class-docs")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

THPT_TOPIC_LIST = [
    'Tập xác định','Tính đơn điệu','Cực trị','Giá trị lớn nhất, nhỏ nhất','Tiệm cận',
    'Đồ thị hàm số','Tương giao đồ thị','Bài toán thực tế về hàm số',
    'Hàm mũ, hàm logarit','Phương trình mũ','Phương trình logarit',
    'Bất phương trình mũ','Bất phương trình logarit','Ứng dụng tăng trưởng, lãi kép',
    'Nguyên hàm','Tích phân','Diện tích hình phẳng','Thể tích khối tròn xoay','Ứng dụng thực tế',
    'Phép toán số phức','Môđun','Biểu diễn hình học','Phương trình số phức',
    'Dãy số','Cấp số cộng','Cấp số nhân','Tổng cấp số',
    'Quy tắc đếm','Hoán vị','Chỉnh hợp','Tổ hợp','Nhị thức Newton',
    'Xác suất cổ điển','Xác suất có điều kiện',
    'Thu thập và xử lý dữ liệu','Bảng tần số','Biểu đồ','Trung bình','Trung vị',
    'Tứ phân vị','Độ lệch chuẩn','Phương sai',
    'Vector','Phép cộng, trừ','Tích vô hướng','Góc giữa hai vector','Ứng dụng vector',
    'Quan hệ song song','Quan hệ vuông góc','Góc','Khoảng cách',
    'Khối đa diện','Hình chóp','Hình lăng trụ','Thể tích',
    'Điểm','Đường thẳng','Mặt phẳng','Mặt cầu','Vị trí tương đối',
    'Phương trình bậc nhất','Phương trình bậc hai','Hệ phương trình','Phương trình quy về bậc hai',
    'Bất phương trình','Hệ bất phương trình','Bất đẳng thức cơ bản','Ứng dụng bất đẳng thức',
]
THCS_TOPIC_LIST = [
    'Phép tính','Lũy thừa','Chia hết','Ước và bội','Số nguyên tố','ƯCLN, BCNN',
    'Giá trị tuyệt đối','So sánh','Ứng dụng',
    'Rút gọn','Quy đồng','Các phép tính','Tỉ số',
    'Số vô tỉ','Căn bậc hai','Biến đổi căn thức','Căn bậc ba',
    'Đơn thức','Đa thức','Thu gọn','Giá trị biểu thức',
    'Hằng đẳng thức đáng nhớ','Phân tích đa thức thành nhân tử','Biến đổi',
    'Phương trình bậc nhất một ẩn','Phương trình tích',
    'Phương trình chứa ẩn ở mẫu','Giải bài toán bằng cách lập phương trình',
    'Hệ phương trình bậc nhất hai ẩn','Phương pháp thế','Phương pháp cộng','Bài toán thực tế',
    'Bất phương trình bậc nhất','Biểu diễn nghiệm','Giải bài toán',
    'Đại lượng tỉ lệ thuận','Đại lượng tỉ lệ nghịch','Hàm số','Đồ thị hàm số','Hàm số bậc nhất',
    'Thu thập dữ liệu','Bảng thống kê','Trung bình cộng','Mốt',
    'Xác suất thực nghiệm','Xác suất đơn giản',
    'Hai góc đối đỉnh','Hai đường thẳng song song','Góc tạo bởi cát tuyến','Góc trong tam giác',
    'Các trường hợp bằng nhau','Tam giác cân','Tam giác đều','Tam giác vuông',
    'Đường trung tuyến','Đường cao','Đường phân giác','Đường trung trực',
    'Hình thang','Hình bình hành','Hình chữ nhật','Hình thoi','Hình vuông',
    'Dây cung','Tiếp tuyến','Góc ở tâm','Góc nội tiếp','Cung','Tứ giác nội tiếp',
    'Tam giác đồng dạng','Định lý Thales','Hệ quả Thales',
    'Bất đẳng thức tam giác','Quan hệ cạnh – góc','Đường trung bình',
    'Hình hộp chữ nhật','Hình lập phương','Hình lăng trụ đứng',
    'Hình trụ','Hình nón','Hình cầu',
    'Hình chữ nhật','Hình bình hành','Hình tròn','Hình quạt',
    'Đường thẳng vuông góc','Song song','Góc giữa các đường',
    'Chuyển động','Năng suất','Công việc','Lãi suất','Hình học thực tế','Thống kê thực tế',
]

# ── VẬT LÝ ──────────────────────────────────────────────────────────────────────
LY_THPT_TOPIC_LIST = [
    'Chuyển động thẳng','Chuyển động biến đổi đều','Chuyển động rơi tự do',
    'Chuyển động tròn đều','Đồ thị chuyển động',
    'Ba định luật Newton','Các loại lực','Lực ma sát','Lực đàn hồi',
    'Lực hấp dẫn','Lực hướng tâm','Cân bằng lực',
    'Công','Công suất','Động năng','Thế năng','Cơ năng',
    'Định luật bảo toàn năng lượng','Hiệu suất',
    'Động lượng','Xung lượng','Va chạm','Định luật bảo toàn động lượng',
    'Dao động điều hòa','Con lắc lò xo','Con lắc đơn','Pha dao động',
    'Năng lượng dao động','Dao động tắt dần','Dao động cưỡng bức','Cộng hưởng',
    'Sóng cơ','Bước sóng','Tần số','Giao thoa','Sóng dừng','Sóng âm','Hiệu ứng Doppler',
    'Nội năng','Chất khí','Phương trình trạng thái','Các quá trình nhiệt',
    'Nguyên lý nhiệt động lực học',
    'Điện tích','Định luật Coulomb','Điện trường','Cường độ điện trường',
    'Điện thế','Hiệu điện thế','Tụ điện',
    'Dòng điện','Định luật Ohm','Ghép điện trở','Suất điện động',
    'Công của dòng điện','Công suất điện',
    'Nam châm','Từ trường','Cảm ứng từ','Lực từ','Lực Lorentz',
    'Từ thông','Định luật Faraday','Định luật Lenz','Suất điện động cảm ứng',
    'Mạch RLC','Cộng hưởng điện','Công suất AC','Hệ số công suất',
    'Máy biến áp','Truyền tải điện năng',
    'Phản xạ','Khúc xạ','Thấu kính','Mắt','Dụng cụ quang',
    'Giao thoa ánh sáng','Nhiễu xạ','Tán sắc',
    'Photon','Hiệu ứng quang điện','Quang phổ','Laser',
    'Cấu tạo hạt nhân','Độ hụt khối','Năng lượng liên kết','Phóng xạ',
    'Phản ứng hạt nhân','Phân hạch','Nhiệt hạch',
    'Sai số','Đồ thị','Thí nghiệm','Phân tích kết quả',
]
LY_THCS_TOPIC_LIST = [
    'Đơn vị đo (SI)','Đo chiều dài','Đo khối lượng','Đo thời gian',
    'Đo nhiệt độ','Sai số đo','Dụng cụ đo',
    'Chuyển động và đứng yên','Quãng đường','Tốc độ','Vận tốc','Đồ thị chuyển động (cơ bản)',
    'Khái niệm lực','Biểu diễn lực','Hợp lực','Cân bằng lực',
    'Lực ma sát','Lực đàn hồi','Trọng lực','Áp suất',
    'Công cơ học','Công suất','Cơ năng','Động năng','Thế năng',
    'Chuyển hóa năng lượng','Hiệu suất',
    'Nhiệt năng','Nhiệt lượng','Dẫn nhiệt','Đối lưu','Bức xạ nhiệt',
    'Nở vì nhiệt','Sự nóng chảy','Sự đông đặc','Bay hơi','Ngưng tụ','Sôi',
    'Nguồn âm','Độ cao của âm','Độ to của âm','Môi trường truyền âm',
    'Phản xạ âm','Chống ô nhiễm tiếng ồn',
    'Nguồn sáng','Tia sáng','Bóng tối','Nhật thực, nguyệt thực',
    'Phản xạ ánh sáng','Gương phẳng','Gương cầu lồi','Gương cầu lõm',
    'Khúc xạ ánh sáng','Thấu kính hội tụ','Thấu kính phân kỳ','Mắt','Kính lúp',
    'Điện tích','Dòng điện','Nguồn điện','Mạch điện','Cường độ dòng điện',
    'Hiệu điện thế','Điện trở','Định luật Ôm (mức cơ bản)','Công suất điện',
    'Điện năng','An toàn điện',
    'Nam châm','Từ trường','Đường sức từ','Từ trường của dòng điện','Nam châm điện',
    'Cảm ứng điện từ (giới thiệu)','Máy phát điện','Động cơ điện','Máy biến áp (giới thiệu)',
    'Các dạng năng lượng','Năng lượng tái tạo','Tiết kiệm năng lượng',
]

# ── HÓA HỌC ─────────────────────────────────────────────────────────────────────
HOA_THPT_TOPIC_LIST = [
    'Thành phần nguyên tử','Đồng vị','Cấu hình electron','Electron hóa trị','Số oxi hóa',
    'Ô nguyên tố','Chu kỳ','Nhóm','Quy luật biến đổi','Bán kính nguyên tử',
    'Độ âm điện','Năng lượng ion hóa',
    'Liên kết ion','Liên kết cộng hóa trị','Liên kết kim loại',
    'Liên kết hiđro','Lewis','Hình học phân tử',
    'Phản ứng oxi hóa – khử','Cân bằng phương trình','Nhiệt hóa học','Entanpi (mức cơ bản)',
    'Tốc độ phản ứng','Các yếu tố ảnh hưởng','Cân bằng hóa học','Nguyên lý Le Chatelier',
    'Chất điện li','Axit','Bazơ','Muối','pH','Thủy phân muối','Chuẩn độ axit – bazơ',
    'Pin điện','Điện phân','Ăn mòn kim loại','Bảo vệ kim loại',
    'Tính chất vật lí','Tính chất hóa học','Dãy hoạt động hóa học','Điều chế kim loại',
    'Hợp kim','Kim loại kiềm','Kim loại kiềm thổ','Nhôm','Sắt','Crom',
    'Halogen','Oxi','Lưu huỳnh','Nitơ','Photpho','Cacbon','Silic','Một số hợp chất quan trọng',
    'Đặc điểm hợp chất hữu cơ','Đồng đẳng','Đồng phân','Danh pháp','Công thức cấu tạo',
    'Ankan','Anken','Ankin','Aren (Benzen)',
    'Dẫn xuất halogen','Ancol','Phenol','Andehit','Xeton','Axit cacboxylic','Este',
    'Amin','Amino axit','Peptit','Protein',
    'Glucozơ','Fructozơ','Saccarozơ','Tinh bột','Xenlulozơ',
    'Trùng hợp','Trùng ngưng','Chất dẻo','Cao su','Tơ',
    'Phân bón','Hóa học môi trường','Hóa học xanh','Vật liệu mới','Năng lượng',
    'Mol','Hiệu suất phản ứng','Nồng độ dung dịch','Bảo toàn khối lượng',
    'Bảo toàn nguyên tố','Bảo toàn electron','Bài toán hỗn hợp','Bài toán khí','Bài toán dung dịch',
]
HOA_THCS_TOPIC_LIST = [
    'Chất','Tính chất của chất','Chất tinh khiết','Hỗn hợp','Tách chất',
    'Hiện tượng vật lí','Hiện tượng hóa học',
    'Nguyên tử','Cấu tạo nguyên tử','Nguyên tố hóa học','Ký hiệu hóa học',
    'Nguyên tử khối','Phân tử','Phân tử khối',
    'Hóa trị','Lập công thức hóa học','Tính theo công thức hóa học','Ý nghĩa của công thức hóa học',
    'Phương trình hóa học','Cân bằng phương trình','Định luật bảo toàn khối lượng',
    'Các loại phản ứng hóa học',
    'Mol','Khối lượng mol','Thể tích mol chất khí',
    'Chuyển đổi giữa mol – khối lượng – thể tích','Tính theo phương trình hóa học',
    'Tính chất của oxi','Điều chế oxi','Không khí','Ozon','Sự cháy','Sự oxi hóa',
    'Hiđro','Điều chế hiđro','Phản ứng oxi hóa – khử (mức cơ bản)','Nước','Vai trò của nước',
    'Dung môi','Chất tan','Độ tan','Nồng độ phần trăm','Nồng độ mol','Pha chế dung dịch',
    'Axit','Bazơ','Muối','Thang pH','Chỉ thị màu','Phản ứng trung hòa','Phản ứng trao đổi',
    'Tính chất vật lí','Tính chất hóa học','Dãy hoạt động hóa học','Điều chế kim loại',
    'Hợp kim','Ăn mòn kim loại',
    'Tính chất của phi kim','Clo','Cacbon','Silic','Một số hợp chất quan trọng',
    'Hợp chất hữu cơ','Metan','Etilen','Axetilen','Benzen','Nhiên liệu',
]

# Tra cứu danh sách chủ đề theo môn + cấp học, kèm tên môn hiển thị trong prompt.
SUBJECT_TOPIC_LISTS = {
    'toan': {'thpt': THPT_TOPIC_LIST,     'thcs': THCS_TOPIC_LIST,     'name': 'toán'},
    'ly':   {'thpt': LY_THPT_TOPIC_LIST,  'thcs': LY_THCS_TOPIC_LIST,  'name': 'vật lí'},
    'hoa':  {'thpt': HOA_THPT_TOPIC_LIST, 'thcs': HOA_THCS_TOPIC_LIST, 'name': 'hóa học'},
}


def _topic_list_for(subject: str, grade: str):
    """(danh sách chủ đề, tên môn) cho phân loại. Mặc định về Toán khi môn lạ."""
    conf = SUBJECT_TOPIC_LISTS.get(subject) or SUBJECT_TOPIC_LISTS['toan']
    topics = conf['thcs'] if grade == 'thcs' else conf['thpt']
    return topics, conf['name']


_GROQ_CLIENT_CACHE = None

def _get_groq():
    global _GROQ_CLIENT_CACHE
    if _GROQ_CLIENT_CACHE is None:
        keys = load_api_keys()
        _GROQ_CLIENT_CACHE = Groq(api_key=keys[0])
    return _GROQ_CLIENT_CACHE


@app.post("/api/classify-question")
async def classify_question(request: Request):
    """AI phân loại chủ đề + độ khó cho 1 câu hỏi."""
    import random
    body = await request.json()
    text    = (body.get("question_text") or "").strip()[:700]
    grade   = body.get("grade", "thpt")
    subject = body.get("subject", "toan")
    if not text:
        return {"topic_label": None, "level_label": None}

    topic_list, subject_name = _topic_list_for(subject, grade)
    topics_str = "\n".join(f"- {t}" for t in topic_list)
    level_name = "THPT" if grade == "thpt" else "THCS"

    prompt = f"""Phân loại câu hỏi {subject_name} {level_name} sau theo chuẩn 4 mức độ nhận thức của Bộ GD&ĐT Việt Nam:

Câu hỏi: {text}

Danh sách chủ đề hợp lệ:
{topics_str}

Mức độ nhận thức (chọn đúng tên):
- Nhận biết: nhớ công thức, định nghĩa, nhận diện khái niệm
- Thông hiểu: hiểu bản chất, áp dụng trực tiếp công thức
- Vận dụng: kết hợp nhiều kiến thức để giải
- Vận dụng cao: bài toán mới, nhiều bước suy luận, cần tư duy sâu

Trả về JSON ĐÚNG ĐỊNH DẠNG, không giải thích thêm:
{{"topic_label": "<tên chủ đề đúng y chang danh sách>", "level_label": "<Nhận biết|Thông hiểu|Vận dụng|Vận dụng cao>"}}"""

    try:
        groq = _get_groq()
        resp = groq.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=80,
        )
        raw = resp.choices[0].message.content.strip()
        # strip markdown fences if present
        raw = raw.strip("```json").strip("```").strip()
        data = json.loads(raw)
        return {
            "topic_label": data.get("topic_label") or None,
            "level_label": data.get("level_label") or None,
        }
    except Exception as e:
        return JSONResponse({"topic_label": None, "level_label": None, "error": str(e)}, status_code=200)


@app.get("/api/questions/bank")
async def get_questions_bank(
    topic: str   = None,
    level: str   = None,
    subject: str = None,
    limit: int   = 10,
):
    """Lấy ngẫu nhiên câu hỏi từ ngân hàng (toàn bộ exams đã lưu) theo nhãn.
    Lọc theo môn nếu có (đề cũ chưa gắn môn được coi là Toán)."""
    import random as _random
    data = db.load_exams()
    pool = []
    for exam in data.values():
        if subject and (exam.get("subject") or "toan") != subject:
            continue
        exam_title = exam.get("title", "")
        for sec_name, sec_data in (exam.get("sections") or {}).items():
            for q in (sec_data.get("questions") or []):
                if topic and q.get("topic_label") != topic:
                    continue
                if level and q.get("level_label") != level:
                    continue
                pool.append({
                    **q,
                    "_exam_id":    exam.get("id", ""),
                    "_exam_title": exam_title,
                    "_section":    sec_name,
                })
    _random.shuffle(pool)
    return {"questions": pool[:limit], "total_available": len(pool)}


# Phục vụ frontend SPA (production build)
if FRONTEND_DIST.exists():
    @app.get("/")
    async def serve_root():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Trả về file tĩnh nếu tồn tại, ngược lại trả về index.html (SPA routing)."""
        candidate = FRONTEND_DIST / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

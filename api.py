"""
FastAPI server: nhận upload PDF → trích xuất câu hỏi qua GROQ Vision → stream tiến trình SSE.

Chạy: uvicorn api:app --reload --port 8000
"""

import asyncio
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path
from typing import AsyncGenerator

import fitz
from fastapi import BackgroundTasks, FastAPI, File, Form, Request, UploadFile
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
    extract_embedded_images,
    extract_page,
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

# task_id → {"status": pending|running|done|error, "progress": [...], "result": ..., "error": ...}
TASKS: dict[str, dict] = {}

app = FastAPI(title="Hoc Toan API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def _startup():
    db.init_db()


_CLASSIFY_BATCH = 15   # câu mỗi lần gọi Groq

def _classify_inplace(groq_client, questions: list, task: dict) -> None:
    """Phân loại topic + difficulty cho toàn bộ questions (sửa in-place). Non-fatal."""
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
            topics_str = "\n".join(f"- {t}" for t in THPT_TOPIC_LIST)
            prompt = (
                f"Phân loại {len(batch)} câu hỏi toán THPT theo 4 mức độ nhận thức của Bộ GD&ĐT Việt Nam. "
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


def _run_extraction(task_id: str, pdf_path: Path, original_name: str = "") -> None:
    """Chạy trong thread pool; cập nhật TASKS[task_id] theo thời gian thực."""
    task = TASKS[task_id]
    task["status"] = "running"
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
        section_header_page, section_q_start_page, page_active_sections, detected_sections = scan_pdf_layout(doc)
        q_starts = scan_question_starts(doc, section_q_start_page, section_header_page)
        detected_counts = auto_detect_section_counts(doc, section_q_start_page, section_header_page)

        all_questions: list[dict] = []
        last_q_per_section: dict[str, int] = {}

        for i in range(doc.page_count):
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

        # Dedup: với mỗi (section, q_num) giữ bản cuối cùng (đầy đủ nhất)
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

        # ── Auto-classify topics & difficulty ────────────────────────────
        all_qs_flat = [q for sec_data in result["sections"].values() for q in sec_data["questions"]]
        if all_qs_flat:
            task["progress"].append({"type": "classifying", "done": 0, "total": len(all_qs_flat)})
            _classify_inplace(client, all_qs_flat, task)

        task["result"] = result
        task["status"] = "done"
        task["progress"].append({"type": "done", "total_questions": len(clean_questions)})

    except Exception as exc:
        task["status"] = "error"
        task["error"] = str(exc)
        task["progress"].append({"type": "error", "message": str(exc)})
    finally:
        pdf_path.unlink(missing_ok=True)


@app.post("/api/extract")
async def extract(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Nhận PDF upload, bắt đầu trích xuất nền, trả về task_id."""
    task_id = str(uuid.uuid4())
    TASKS[task_id] = {"status": "pending", "progress": [], "result": None, "error": None}

    original_name = file.filename or "upload.pdf"
    content = await file.read()
    suffix = Path(original_name).suffix or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(content)
    tmp.close()

    background_tasks.add_task(_run_extraction, task_id, Path(tmp.name), original_name)
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
                elif n_right == total - 2: pts = ppq * 0.2
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
    return _round2(m)


def _recompute_submissions(exam_id: str, exam: dict) -> int:
    """Chấm lại toàn bộ bài nộp theo đáp án hiện tại của đề. Trả về số bài đã đổi điểm."""
    max_score = _calc_max_score(exam)
    updated = 0
    for sub in db.get_submissions(exam_id):
        new_score = _calc_score(exam, sub.get("answers") or {})
        if sub.get("score") != new_score or sub.get("maxScore") != max_score:
            db.update_submission_score(sub["id"], new_score, max_score)
            updated += 1
    return updated


@app.post("/api/exams/{exam_id}")
async def upsert_exam(exam_id: str, request: Request):
    """Lưu hoặc cập nhật một đề thi lên server. Nếu đáp án đổi → chấm lại bài đã nộp."""
    body = await request.json()
    existing = db.get_exam(exam_id) or {}
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
async def get_exam(exam_id: str):
    """Lấy đề thi theo ID (không trả về submissions)."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return exam


def _exam_assignment(cls_id, exam_id):
    """Lấy assignment (đề thi) phù hợp nhất của một lớp cho đề exam_id."""
    cls = db.get_class(cls_id) if cls_id else None
    if not cls:
        return None, None
    cands = [a for a in cls.get("assignments", []) if a.get("examId") == exam_id]
    if not cands:
        return cls, None
    cands.sort(key=lambda a: a.get("createdAt") or "", reverse=True)
    return cls, cands[0]


@app.post("/api/exams/{exam_id}/submit")
async def submit_exam(exam_id: str, request: Request):
    """Học sinh nộp bài thi."""
    body = await request.json()
    if not db.get_exam(exam_id):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)

    # Nếu nộp qua LỚP: kiểm tra cửa sổ thời gian & số lần làm tối đa.
    cls_id = body.get("classId")
    if cls_id:
        _, asgn = _exam_assignment(cls_id, exam_id)
        if asgn:
            now = datetime.now(_tz.utc)
            close = asgn.get("closeTime") or asgn.get("dueDate")
            try:
                if close and now > datetime.fromisoformat(str(close).replace("Z", "+00:00")):
                    return JSONResponse({"error": "Đã quá thời hạn làm bài."}, status_code=403)
            except Exception:
                pass
            max_attempts = asgn.get("maxAttempts")
            if max_attempts:
                used = sum(
                    1 for s in db.get_submissions(exam_id)
                    if str(s.get("studentId")) == str(body.get("studentId"))
                    and str(s.get("classId")) == str(cls_id)
                )
                if used >= int(max_attempts):
                    return JSONResponse(
                        {"error": f"Bạn đã làm đủ {max_attempts} lần cho phép."},
                        status_code=403)

    submission = {
        "submittedAt": body.get("submittedAt"),
        "startedAt":   body.get("startedAt"),
        "timeSpent":   body.get("timeSpent"),   # giây làm bài
        "violationCount": body.get("violationCount"),   # số lần vi phạm khóa màn hình
        "studentName":  body.get("studentName", "Ẩn danh"),
        "studentId":    body.get("studentId"),
        "answers":      body.get("answers", {}),
        "score":        body.get("score"),
        "maxScore":     body.get("maxScore"),
        "className":    body.get("className"),
        "classId":      body.get("classId"),
    }
    idx = db.add_submission(exam_id, submission)
    return {"ok": True, "submissionIndex": idx}


@app.get("/api/exams/{exam_id}/submissions")
async def get_submissions(exam_id: str):
    """Giáo viên xem danh sách bài nộp."""
    exam = db.get_exam(exam_id)
    if not exam:
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    subs = db.get_submissions(exam_id)
    return {
        "submissions":     subs,
        "resultsRevealed": exam.get("resultsRevealed", False),
        "hideResults":     (exam.get("settings") or {}).get("hideResults", False),
        "classes":         exam.get("classes", []),
    }


@app.delete("/api/exams/{exam_id}/submissions/{sub_id}")
async def delete_one_submission(exam_id: str, sub_id: str):
    """Giáo viên xóa MỘT bài nộp (một lần làm) theo id — dùng cho link công khai."""
    if not db.delete_submission(sub_id):
        return JSONResponse({"error": "Không tìm thấy bài nộp"}, status_code=404)
    return {"ok": True}


@app.post("/api/exams/{exam_id}/submissions/delete-student")
async def delete_student_submissions(exam_id: str, request: Request):
    """Giáo viên xóa TẤT CẢ bài làm của một học sinh cho đề này.
    Truyền classId để giới hạn trong một lớp; bỏ trống = bài nộp qua link công khai."""
    body = await request.json()
    student_id = body.get("studentId")
    class_id   = body.get("classId") or None
    if student_id is None:
        return JSONResponse({"error": "Thiếu studentId"}, status_code=400)
    n = db.delete_submissions_for_student(exam_id, student_id, class_id)
    return {"ok": True, "deleted": n}


@app.post("/api/exams/{exam_id}/reveal")
async def reveal_results(exam_id: str):
    """Giáo viên công bố kết quả."""
    if not db.update_exam_field(exam_id, "resultsRevealed", True):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.post("/api/exams/{exam_id}/hide-results")
async def hide_results_endpoint(exam_id: str):
    """Giáo viên ẩn kết quả lại."""
    if not db.update_exam_field(exam_id, "resultsRevealed", False):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.post("/api/exams/{exam_id}/toggle-public")
async def toggle_public(exam_id: str, request: Request):
    """Giáo viên bật/tắt chế độ công khai đề thi."""
    body = await request.json()
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
async def save_practice_settings(exam_id: str, request: Request):
    """Giáo viên lưu cài đặt chế độ luyện tập."""
    body = await request.json()
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
async def admin_stats():
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
async def admin_all_exams():
    """Danh sách tất cả đề thi (kèm submission count) cho super admin."""
    return db.load_exams_meta()


@app.delete("/api/admin/exams/{exam_id}")
async def admin_delete_exam(exam_id: str):
    """Super admin xoá đề thi."""
    if not db.delete_exam(exam_id):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True}


@app.post("/api/admin/exams/{exam_id}/feature")
async def admin_feature_exam(exam_id: str, request: Request):
    """Super admin đánh dấu/bỏ đánh dấu đề thi nổi bật."""
    body = await request.json()
    val = bool(body.get("featured", False))
    if not db.update_exam_field(exam_id, "featured", val):
        return JSONResponse({"error": "Không tìm thấy đề thi"}, status_code=404)
    return {"ok": True, "featured": val}


@app.get("/api/admin/config")
async def admin_get_config():
    """Lấy cấu hình hệ thống."""
    return db.load_config()


@app.post("/api/admin/config")
async def admin_save_config(request: Request):
    """Lưu cấu hình hệ thống."""
    body = await request.json()
    cfg = db.load_config()
    cfg.update(body)
    db.save_config(cfg)
    return {"ok": True, "config": cfg}

@app.post("/api/admin/super-admins")
async def create_super_admin(request: Request):
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
        "password":     password,
        "name":         name,
        "role":         "super_admin",
        "avatar":       name[0].upper() if name else "S",
        "isRegistered": True,
    }
    user = db.add_user(new_user)
    return {"ok": True, "action": "created", "user": user}


@app.get("/api/admin/super-admins")
async def list_super_admins():
    """Danh sách tất cả super_admin."""
    return db.get_super_admins()


@app.delete("/api/admin/super-admins/{user_id}")
async def remove_super_admin(user_id: str):
    """Hạ cấp super_admin xuống giao_vien."""
    updated = db.set_super_admin(user_id, enable=False)
    if not updated:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return {"ok": True, "user": updated}




# ─── End Super Admin endpoints ────────────────────────────────────────────────


# ─── User management ──────────────────────────────────────────────────────────


@app.post("/api/auth/login")
async def api_login(request: Request):
    body     = await request.json()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    user     = db.get_user_by_email(email, pwd=True)
    if not user or user.get("password") != password:
        return JSONResponse({"error": "Email hoặc mật khẩu không đúng."}, status_code=401)
    return {k: v for k, v in user.items() if k != "password"}


GOOGLE_CLIENT_ID = "281468345667-tb1nqlo78f06blu5m1t7qapd08ruc916.apps.googleusercontent.com"  

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

    # 4. Trả về user (bỏ password)
    return {k: v for k, v in user.items() if k != "password"}




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
        "password":     password,
        "name":         name,
        "role":         "khach",
        "avatar":       name[0].upper() if name else "?",
        "isRegistered": True,
    }
    return db.add_user(new_user)
@app.get("/api/auth/me")
async def api_get_me(userId: str):
    """Lấy thông tin user mới nhất từ DB (để sync role sau khi admin thay đổi)."""
    user = db.get_user_by_id(userId)
    if not user:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return {k: v for k, v in user.items() if k != "password"}

@app.get("/api/admin/users")
async def admin_list_users():
    """Admin xem toàn bộ người dùng (không trả password)."""
    return db.load_users()


@app.get("/api/users/search")
async def search_users(q: str = "", role: str = ""):
    """Tìm kiếm người dùng theo query & role."""
    return db.search_users(q=q.strip(), role=role)


@app.put("/api/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, request: Request):
    body     = await request.json()
    new_role = body.get("role")
    if not new_role:
        return JSONResponse({"error": "Thiếu role."}, status_code=400)
    updated = db.update_user_role(user_id, new_role)
    if not updated:
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return updated


@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: str):
    if not db.delete_user(user_id):
        return JSONResponse({"error": "Không tìm thấy người dùng."}, status_code=404)
    return {"ok": True}


@app.put("/api/admin/users/{user_id}/password")
async def admin_reset_user_password(user_id: str, request: Request):
    body         = await request.json()
    new_password = (body.get("password") or "").strip()
    if len(new_password) < 6:
        return JSONResponse({"error": "Mật khẩu tối thiểu 6 ký tự."}, status_code=400)
    if not db.update_user_password(user_id, new_password):
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


@app.post("/api/classes")
async def create_class_endpoint(request: Request):
    body = await request.json()
    cid = _cls_id()
    cls = {
        "id": cid, "name": body.get("name", ""),
        "description": body.get("description", ""),
        "teacherId": body.get("teacherId"), "teacherName": body.get("teacherName", ""),
        "createdAt": body.get("createdAt", _now_iso()),
        "joinCode": _join_code(), "joinPassword": body.get("joinPassword") or None,
        "members": [], "assignments": [], "documents": [],
    }
    db.upsert_class(cid, cls)
    return cls


@app.get("/api/classes")
async def list_classes(teacherId: str = None, studentId: str = None, email: str = None):
    if teacherId:
        return db.list_classes_by_teacher(teacherId)
    if studentId:
        return db.list_classes_by_student(studentId, email)
    return []


@app.get("/api/students/pending")
async def student_pending(studentId: str = None, email: str = None):
    """
    Danh sách bài/đề HỌC SINH CHƯA HOÀN THÀNH, tính trực tiếp từ DB:
      - Bài tập nộp file: chưa nộp & chưa quá hạn.
      - Đề thi: chưa làm lần nào (đếm bài nộp của ĐỀ theo lớp) & chưa đóng.
    """
    if not studentId:
        return {"count": 0, "items": []}

    now = datetime.now(_tz.utc)

    def _parse(iso):
        try:
            return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        except Exception:
            return None

    items = []
    for cls in db.list_classes_by_student(studentId, email):
        cid = cls.get("id")
        for a in cls.get("assignments", []):
            close = _parse(a.get("closeTime") or a.get("dueDate"))
            if a.get("examId"):
                if close and now > close:
                    continue                                  # đã đóng
                used = sum(
                    1 for s in db.get_submissions(a["examId"])
                    if str(s.get("studentId")) == str(studentId)
                    and str(s.get("classId")) == str(cid)
                )
                if used > 0:
                    continue                                  # đã làm rồi
            else:
                if any(str(s.get("studentId")) == str(studentId) for s in a.get("submissions", [])):
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
async def join_class_by_code(request: Request):
    body = await request.json()
    code = (body.get("code") or "").strip().upper()
    password = body.get("password") or None
    uid = body.get("userId"); uname = body.get("userName", ""); uemail = body.get("userEmail", "")
    cls = db.get_class_by_code(code)
    if not cls:
        return JSONResponse({"error": "Mã lớp không hợp lệ."}, status_code=404)
    if str(cls.get("teacherId")) == str(uid):
        return JSONResponse({"error": "Bạn là giáo viên của lớp này, không thể tham gia với tư cách học sinh."}, status_code=403)
    if cls.get("joinPassword") and cls["joinPassword"] != password:
        return JSONResponse({"error": "Sai mật khẩu."}, status_code=401)
    members = cls.get("members", [])
    if not any(str(m.get("userId")) == str(uid) for m in members):
        members.append({"userId": uid, "name": uname, "email": uemail, "addedAt": _now_iso()})
        cls["members"] = members
        db.upsert_class(cls["id"], cls)
    return {"ok": True, "classId": cls["id"], "className": cls["name"]}


@app.get("/api/classes/{cls_id}")
async def get_class_endpoint(cls_id: str):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return cls


@app.put("/api/classes/{cls_id}")
async def update_class_endpoint(cls_id: str, request: Request):
    body = await request.json()
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    for k in ("name", "description", "joinPassword"):
        if k in body: cls[k] = body[k]
    db.upsert_class(cls_id, cls)
    return cls


@app.delete("/api/classes/{cls_id}")
async def delete_class_endpoint(cls_id: str):
    if not db.delete_class(cls_id):
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/members")
async def add_member_endpoint(cls_id: str, request: Request):
    body = await request.json()
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    if str(cls.get("teacherId")) == str(body.get("userId")):
        return JSONResponse({"error": "Không thể thêm giáo viên của lớp vào danh sách học sinh."}, status_code=403)
    members = cls.get("members", [])
    if not any(str(m.get("userId")) == str(body.get("userId")) for m in members):
        members.append({"userId": body.get("userId"), "name": body.get("name", ""),
                        "email": body.get("email", ""), "addedAt": _now_iso()})
        cls["members"] = members
        db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.delete("/api/classes/{cls_id}/members/{user_id}")
async def remove_member_endpoint(cls_id: str, user_id: str):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    cls["members"] = [m for m in cls.get("members", []) if str(m.get("userId")) != user_id]
    db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/assignments")
async def add_assignment_endpoint(cls_id: str, request: Request):
    body = await request.json()
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
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
        "attachments": body.get("attachments", []),
        "createdAt": _now_iso(), "submissions": [],
    }
    cls.setdefault("assignments", []).append(asgn)
    db.upsert_class(cls_id, cls)
    for m in cls.get("members", []):
        db.add_notif({
            "id": _cls_id(), "type": "assignment",
            "targetUserId": str(m.get("userId")), "classId": cls_id,
            "className": cls.get("name", ""), "assignmentId": asgn["id"],
            "title": f"Bài tập mới: {asgn['title']}",
            "message": f"Lớp {cls.get('name','')} vừa giao bài tập mới. Hạn nộp: {asgn.get('dueDate','')}",
            "createdAt": _now_iso(), "read": False,
        })
    return asgn


@app.get("/api/classes/{cls_id}/exam-window/{exam_id}")
async def get_class_exam_window(cls_id: str, exam_id: str, studentId: str = None, email: str = None):
    """
    Trả về cửa sổ thời gian (mở/đóng) của một ĐỀ THI được giao trong lớp,
    để trang làm bài giới hạn theo lớp thay vì theo link công khai.
    """
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)

    if studentId is not None and not email:
        u = db.get_user_by_id(str(studentId))
        email = (u or {}).get("email")
    em = (email or "").strip().lower()
    is_member = any(
        str(m.get("userId")) == str(studentId)
        or (em and (m.get("email") or "").strip().lower() == em)
        for m in cls.get("members", [])
    ) if studentId is not None else None

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

    candidates = [a for a in cls.get("assignments", []) if a.get("examId") == exam_id]
    asgn = max(candidates, key=_rank) if candidates else None
    if not asgn:
        return JSONResponse({"assigned": False, "isMember": is_member,
                             "className": cls.get("name", "")}, status_code=200)

    # Số lần học sinh đã làm (mỗi bài nộp = 1 lần) trong lớp này
    attempts_used = 0
    if studentId is not None:
        try:
            attempts_used = sum(
                1 for s in db.get_submissions(exam_id)
                if str(s.get("studentId")) == str(studentId)
                and str(s.get("classId")) == str(cls_id)
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
async def delete_assignment_endpoint(cls_id: str, asgn_id: str):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    cls["assignments"] = [a for a in cls.get("assignments", []) if a["id"] != asgn_id]
    db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/assignments/{asgn_id}/submit")
async def submit_assignment_endpoint(cls_id: str, asgn_id: str, request: Request):
    body = await request.json()
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    asgns = cls.get("assignments", [])
    # Quá hạn nộp → không cho nộp file nữa
    target = next((a for a in asgns if a["id"] == asgn_id), None)
    if target:
        due = target.get("closeTime") or target.get("dueDate")
        try:
            if due and datetime.now(_tz.utc) > datetime.fromisoformat(str(due).replace("Z", "+00:00")):
                return JSONResponse({"error": "Đã quá thời hạn nộp bài."}, status_code=403)
        except Exception:
            pass
    for i, a in enumerate(asgns):
        if a["id"] == asgn_id:
            subs = a.get("submissions", [])
            sub = {"studentId": body.get("studentId"), "studentName": body.get("studentName", ""),
                   "submittedAt": _now_iso(), "files": body.get("files", []), "note": body.get("note", "")}
            idx = next((j for j, s in enumerate(subs) if str(s.get("studentId")) == str(body.get("studentId"))), None)
            if idx is not None: subs[idx] = sub
            else: subs.append(sub)
            a["submissions"] = subs; asgns[i] = a; break
    cls["assignments"] = asgns
    db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.get("/api/classes/{cls_id}/assignments/{asgn_id}/submissions")
async def get_assignment_submissions(cls_id: str, asgn_id: str):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    for a in cls.get("assignments", []):
        if a["id"] == asgn_id:
            return {"submissions": a.get("submissions", []), "members": cls.get("members", [])}
    return JSONResponse({"error": "Không tìm thấy bài tập"}, status_code=404)


@app.delete("/api/classes/{cls_id}/assignments/{asgn_id}/submissions/{student_id}")
async def delete_assignment_submission(cls_id: str, asgn_id: str, student_id: str):
    """Giáo viên xóa bài nộp (file) của một học sinh cho bài tập trong lớp."""
    cls = db.get_class(cls_id)
    if not cls:
        return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    asgns = cls.get("assignments", [])
    found = False
    for i, a in enumerate(asgns):
        if a["id"] == asgn_id:
            a["submissions"] = [
                s for s in a.get("submissions", [])
                if str(s.get("studentId")) != str(student_id)
            ]
            asgns[i] = a
            found = True
            break
    if not found:
        return JSONResponse({"error": "Không tìm thấy bài tập"}, status_code=404)
    cls["assignments"] = asgns
    db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.post("/api/classes/{cls_id}/documents")
async def add_class_doc_endpoint(cls_id: str, request: Request):
    body = await request.json()
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    cls.setdefault("documents", []).append(body)
    db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.delete("/api/classes/{cls_id}/documents/{doc_id}")
async def remove_class_doc_endpoint(cls_id: str, doc_id: str):
    cls = db.get_class(cls_id)
    if not cls: return JSONResponse({"error": "Không tìm thấy lớp"}, status_code=404)
    cls["documents"] = [d for d in cls.get("documents", []) if d.get("id") != doc_id]
    db.upsert_class(cls_id, cls)
    return {"ok": True}


@app.get("/api/notifications")
async def get_notifications_endpoint(userId: str):
    return db.get_notifs_for_user(userId)


@app.post("/api/notifications/read")
async def mark_notification_read(request: Request):
    body = await request.json()
    db.mark_notif_read(body.get("id", ""))
    return {"ok": True}


@app.post("/api/notifications/read-all")
async def mark_all_read(request: Request):
    body = await request.json()
    db.mark_all_notifs_read(str(body.get("userId", "")))
    return {"ok": True}


# ─── End Class management ─────────────────────────────────────────────────────


# ─── Class document upload ────────────────────────────────────────────────────

CLASS_DOCS_DIR = Path(__file__).parent / "class_docs"
CLASS_DOCS_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/api/class-documents/upload")
async def upload_class_document(file: UploadFile = File(...)):
    """Upload tài liệu cho lớp học."""
    original_name = file.filename or "document"
    safe_name = "".join(c if (c.isalnum() or c in "._- ") else "_" for c in original_name)
    doc_id = str(uuid.uuid4())[:8]
    filename = f"{doc_id}_{safe_name}"
    dest = CLASS_DOCS_DIR / filename
    content = await file.read()
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

# ─── Exercise Solver ─────────────────────────────────────────────────────────

import re as _re
import base64 as _base64

GROQ_SOLVER_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

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


def _build_solve_prompt(exercise):
    exercise_section = (
        f'Bài tập:\n"""\n{exercise}\n"""'
        if exercise
        else "(Xem hình ảnh đính kèm — đọc toàn bộ đề bài từ ảnh)"
    )
    return f"""Bạn là giáo viên Toán THPT Việt Nam. Phân tích bài tập toán và trả lời CHÍNH XÁC bằng JSON.

{exercise_section}

Trả lời bằng JSON thuần túy (không có ```json, không giải thích ngoài JSON):
{{
  "is_geometry": <true nếu bài liên quan đến hình không gian 3D, ngược lại false>,
  "geometry_data": <object vẽ hình nếu is_geometry=true, ngược lại null>,
  "theory": [
    {{"title": "Tên định lý/công thức", "content": "Giải thích, dùng LaTeX $...$ hoặc $$...$$"}}
  ],
  "steps": [
    {{"title": "Bước N: tiêu đề", "content": "Nội dung chi tiết, dùng LaTeX cho mọi công thức"}}
  ]
}}

Khi is_geometry=true, geometry_data PHẢI có đúng định dạng:
{{
  "points": [{{"id": "A", "x": 0.0, "y": 0.0, "z": 0.0}}],
  "segments": [{{"from": "A", "to": "B", "dashed": false}}],
  "faces": [{{"id": "f1", "points": ["A","B","C"], "style": {{"fill": "#4dabf7", "opacity": 0.3, "stroke": "#1971c2"}}}}],
  "midpoints": [{{"id": "M", "of": ["A","B"]}}],
  "vectors": [],
  "labels": []
}}

Quy ước tọa độ: x=ngang, y=cao (lên trên), z=sâu. Cạnh bị che dùng "dashed": true.
Đặt hình vào vùng tọa độ hợp lý, mô tả ĐÚNG hình trong đề bài.
theory: 3-5 kiến thức quan trọng. steps: 4-8 bước giải chi tiết. Dùng LaTeX cho TẤT CẢ công thức."""


def _build_verify_prompt(exercise, draft_steps):
    steps_text = json.dumps(draft_steps, ensure_ascii=False, indent=2)
    exercise_section = (
        f'Bài tập:\n"""\n{exercise}\n"""'
        if exercise
        else "(Bài tập từ hình ảnh đính kèm)"
    )
    return f"""Bạn là giáo viên Toán THPT Việt Nam. Nhiệm vụ: kiểm tra lời giải bên dưới và trả về bản đã sửa lỗi.

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


def _groq_solve_sync(groq_client, exercise, img_b64, mime):
    prompt_text = _build_solve_prompt(exercise)
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


def _groq_verify_sync(verify_client, exercise, draft_steps):
    prompt_text = _build_verify_prompt(exercise, draft_steps)
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
):
    """GROQ call 1: giải (theory + geometry + steps) → GROQ call 2: verify & fix steps."""
    exercise = exercise.strip()
    if not exercise and file is None:
        return JSONResponse({"error": "Thiếu nội dung bài tập"}, status_code=400)

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
        result = await asyncio.to_thread(_groq_solve_sync, solve_client, exercise, img_b64, mime)

        draft_steps = result.get("steps") or []
        if draft_steps:
            # Call 2: verify & sửa lỗi steps (chạy song song với việc đã có theory/geo)
            verified_steps = await asyncio.to_thread(
                _groq_verify_sync, verify_client, exercise, draft_steps
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


_GEN_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
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
        keys   = load_api_keys()
        client = Groq(api_key=keys[0])

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

        resp = client.chat.completions.create(
            model=model, messages=messages, max_tokens=4096, temperature=0.7,
        )
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
    text  = (body.get("question_text") or "").strip()[:700]
    grade = body.get("grade", "thpt")
    if not text:
        return {"topic_label": None, "level_label": None}

    topic_list = THPT_TOPIC_LIST if grade == "thpt" else THCS_TOPIC_LIST
    topics_str = "\n".join(f"- {t}" for t in topic_list)
    level_name = "THPT" if grade == "thpt" else "THCS"

    prompt = f"""Phân loại câu hỏi toán {level_name} sau theo chuẩn 4 mức độ nhận thức của Bộ GD&ĐT Việt Nam:

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
    topic: str  = None,
    level: str  = None,
    limit: int  = 10,
):
    """Lấy ngẫu nhiên câu hỏi từ ngân hàng (toàn bộ exams đã lưu) theo nhãn."""
    import random as _random
    data = db.load_exams()
    pool = []
    for exam in data.values():
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

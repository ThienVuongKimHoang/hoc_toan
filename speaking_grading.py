"""
Chấm bài IELTS Speaking (Task 1 + Task 2, có phân loại học sinh Yếu/Ổn) bằng Groq.

Pipeline:
  1. Task 1 (mọi học sinh): đọc kịch bản .docx đã nộp → chấm ngữ pháp/từ vựng bằng
     llama-3.3-70b-versatile, chỉ lỗi, viết lại một bản kịch bản hoàn thiện hơn
     ("improvedText") → sinh audio đọc mẫu bản đã sửa bằng Groq TTS (Orpheus).
  2. Task 2 (chỉ học sinh nhãn "on"): file ghi âm đã nộp → Groq Whisper transcribe →
     chấm ngữ pháp/từ vựng từ transcript, đồng thời đối chiếu transcript với chính
     kịch bản .docx đã nộp ở Task 1 để phát hiện chỗ đọc/phát âm sai.

Dùng lại các hàm thuần không phụ thuộc đặc thù IELTS/Speaking từ ielts_grading.py
và listening_grading.py (đọc docx, resolve path, JSON parsing, clamp/rounding band,
định vị lỗi trong text, speech-to-text, định vị segment theo thời gian) thay vì
viết lại.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ielts_grading import (
    _clamp_band,
    _docx_text,
    _overall_band,
    _resolve_path,
    _robust_json,
    locate_corrections,
)
from listening_grading import (
    _locate_segments,
    _pick_audio_file,
    transcribe_audio,
)

# Model chấm điểm (text) — dùng chung với IELTS Writing / Chấm nói
GRADER_MODEL = "llama-3.3-70b-versatile"
# Model + giọng đọc TTS (Groq/Orpheus) để sinh audio đọc mẫu bản Task 1 đã sửa
TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE = "troy"
_TTS_MAX_CHARS = 4000   # giới hạn an toàn độ dài input cho TTS

CRITERIA_KEYS = ["grammar", "vocabulary"]

_DOCX_EXT = ".docx"


def _pick_docx_file(files: list) -> Optional[dict]:
    """Chọn file kịch bản .docx đầu tiên trong danh sách file đã nộp."""
    for f in files or []:
        mime = str(f.get("mimeType") or "")
        name = str(f.get("name") or f.get("filename") or "")
        if "wordprocessingml" in mime or Path(name).suffix.lower() == _DOCX_EXT:
            return f
    return None


def generate_audio(client, text: str, dest_dir: Path) -> Optional[dict]:
    """
    Sinh audio đọc mẫu bằng Groq TTS (Orpheus). Trả về metadata cùng hình dạng với
    response của /api/class-documents/upload để frontend phát bằng <audio src=...>
    giống mọi file khác. Lỗi TTS không được ném ra ngoài — chỉ trả None (không có
    audio mẫu), không làm hỏng phần còn lại của kết quả chấm.
    """
    text = (text or "").strip()
    if not text:
        return None
    try:
        resp = client.audio.speech.create(
            model=TTS_MODEL, voice=TTS_VOICE,
            input=text[:_TTS_MAX_CHARS], response_format="wav",
        )
        file_id = uuid.uuid4().hex[:8]
        filename = f"{file_id}_task1_mau_doc.wav"
        dest = dest_dir / filename
        resp.write_to_file(dest)
        return {
            "id": file_id, "name": "Bản đọc mẫu (AI).wav", "filename": filename,
            "url": f"/class-docs/{filename}", "mimeType": "audio/wav",
            "size": dest.stat().st_size,
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return None


def grade_task1_script(client, questions_text: str, script_text: str) -> dict:
    """Chấm kịch bản Task 1 (ngữ pháp/từ vựng) + viết lại bản hoàn thiện hơn."""
    word_count = len(script_text.split())

    prompt = f"""You are an English teacher grading a student's WRITTEN SCRIPT prepared for an IELTS Speaking exercise (Task 1: the student writes out a planned spoken answer before recording it). Grade STRICTLY based on grammar and vocabulary usage, using the IELTS band scale (0-9, in 0.5 steps) as a reference scale for consistency — this is NOT an official IELTS Speaking assessment, only grammar/vocabulary quality of the written script.

=== SPEAKING QUESTION(S) GIVEN TO THE STUDENT ===
{questions_text or "(not provided)"}

=== STUDENT'S WRITTEN SCRIPT ({word_count} words) ===
{script_text}

=== INSTRUCTIONS ===
- Assign a band (0-9, in 0.5 steps) for each of 2 criteria: "grammar", "vocabulary".
- "comment" fields, "feedback", "strengths", "improvements" and "explain" MUST be written in VIETNAMESE (tiếng Việt) so the student understands.
- "feedback": nhận xét tổng quan chi tiết 4-8 câu.
- "corrections": 3-8 lỗi tiêu biểu nhất. MỖI lỗi gồm:
  - "error": trích dẫn NGUYÊN VĂN (copy chính xác từng ký tự) một cụm ngắn (2-8 từ) LẤY TỪ ĐÚNG kịch bản ở trên chứa lỗi đó — bắt buộc phải tìm thấy y hệt trong kịch bản.
  - "fix": cụm đã sửa đúng.
  - "explain": giải thích ngắn gọn bằng tiếng Việt tại sao sai.
  - "type": "grammar" (ngữ pháp) hoặc "vocab" (từ vựng/collocation).
- "improvedText": viết lại TOÀN BỘ kịch bản bằng tiếng Anh, giữ nguyên ý và độ dài tương đương, sửa hết lỗi ngữ pháp/từ vựng, câu văn tự nhiên hơn phù hợp văn nói band 7-8.

Return ONLY valid JSON with exactly this structure:
{{
  "criteria": {{
    "grammar": {{"band": 6.0, "comment": "..."}},
    "vocabulary": {{"band": 6.0, "comment": "..."}}
  }},
  "feedback": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "corrections": [{{"error": "...", "fix": "...", "explain": "...", "type": "grammar"}}],
  "improvedText": "..."
}}"""

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
        "scriptText": script_text,
        "wordCount": word_count,
        "questionsText": questions_text or "",
        "criteria": criteria,
        "overallBand": _overall_band([criteria[k]["band"] for k in CRITERIA_KEYS]),
        "feedback": str(data.get("feedback") or ""),
        "strengths": [str(s) for s in (data.get("strengths") or [])],
        "improvements": [str(s) for s in (data.get("improvements") or [])],
        "corrections": locate_corrections(script_text, [
            {"error": str(c.get("error") or ""), "fix": str(c.get("fix") or ""),
             "explain": str(c.get("explain") or ""), "type": str(c.get("type") or "")}
            for c in (data.get("corrections") or []) if isinstance(c, dict)
        ]),
        "improvedText": str(data.get("improvedText") or "").strip(),
    }


def grade_task2_speech(client, questions_text: str, script_text: str, transcript: str) -> dict:
    """Chấm bài nói Task 2 từ transcript + đối chiếu phát âm với kịch bản Task 1."""
    word_count = len(transcript.split())

    prompt = f"""You are an English teacher grading a student's SPOKEN English (Task 2 of an IELTS Speaking exercise), transcribed from an audio recording via speech-to-text. Grade STRICTLY based on grammar and vocabulary usage, using the IELTS band scale (0-9, in 0.5 steps) as a reference scale for consistency — this is NOT an official IELTS Speaking assessment.

You are ALSO given the student's WRITTEN SCRIPT (prepared beforehand for Task 1) so you can compare it against the transcript of their actual spoken recording, to spot likely mispronunciation/misreading — places where the transcript differs from the script in a way that suggests the student read a word wrong, NOT just natural paraphrasing or ad-libbing.

=== SPEAKING QUESTION(S) FOR TASK 2 ===
{questions_text or "(not provided)"}

=== STUDENT'S WRITTEN SCRIPT (prepared answer) ===
{script_text}

=== TRANSCRIPT OF STUDENT'S ACTUAL SPEECH ({word_count} words) ===
{transcript}

=== INSTRUCTIONS ===
- Assign a band (0-9, in 0.5 steps) for "grammar" and "vocabulary" based on the TRANSCRIPT (the actual speech), not the script.
- This is a raw speech-to-text transcript: ignore missing punctuation, filler words (um, uh) and minor disfluencies — do not penalize those as grammar errors.
- "comment", "feedback", "strengths", "improvements", "explain", "note" MUST be written in VIETNAMESE (tiếng Việt).
- "feedback": nhận xét tổng quan chi tiết 4-8 câu.
- "corrections": 3-8 lỗi ngữ pháp/từ vựng tiêu biểu nhất TRONG TRANSCRIPT. MỖI lỗi gồm:
  - "error": trích dẫn NGUYÊN VĂN (2-8 từ) LẤY TỪ ĐÚNG transcript ở trên.
  - "fix": cụm đã sửa đúng.
  - "explain": giải thích ngắn gọn bằng tiếng Việt.
  - "type": "grammar" hoặc "vocab".
- "pronunciationNotes": tối đa 8 mục — những chỗ transcript khác với script theo cách gợi ý học sinh đọc/phát âm SAI (KHÔNG tính khác biệt do học sinh diễn đạt lại tự nhiên bằng từ đồng nghĩa). MỖI mục gồm:
  - "script": cụm tương ứng trong kịch bản viết.
  - "spoken": cụm tương ứng đã nhận dạng được trong transcript.
  - "note": giải thích ngắn bằng tiếng Việt vì sao nghi ngờ đọc/phát âm sai.

Return ONLY valid JSON with exactly this structure:
{{
  "criteria": {{
    "grammar": {{"band": 6.0, "comment": "..."}},
    "vocabulary": {{"band": 6.0, "comment": "..."}}
  }},
  "feedback": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "corrections": [{{"error": "...", "fix": "...", "explain": "...", "type": "grammar"}}],
  "pronunciationNotes": [{{"script": "...", "spoken": "...", "note": "..."}}]
}}"""

    data = None
    last_err = None
    for attempt, use_json_mode in enumerate((True, False, False)):
        try:
            kwargs = {"response_format": {"type": "json_object"}} if use_json_mode else {}
            resp = client.chat.completions.create(
                model=GRADER_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2 if attempt == 0 else 0.4,
                max_tokens=3000,
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
        "criteria": criteria,
        "feedback": str(data.get("feedback") or ""),
        "strengths": [str(s) for s in (data.get("strengths") or [])],
        "improvements": [str(s) for s in (data.get("improvements") or [])],
        "corrections": [
            {"error": str(c.get("error") or ""), "fix": str(c.get("fix") or ""),
             "explain": str(c.get("explain") or ""), "type": str(c.get("type") or "")}
            for c in (data.get("corrections") or []) if isinstance(c, dict)
        ],
        "pronunciationNotes": [
            {"script": str(n.get("script") or ""), "spoken": str(n.get("spoken") or ""),
             "note": str(n.get("note") or "")}
            for n in (data.get("pronunciationNotes") or []) if isinstance(n, dict)
        ],
    }


def _apply_task_edit(base: dict, patch: dict, text_key: str) -> dict:
    """Áp bản sửa tay cho một phần (task1 hoặc task2) — dùng lại clamp/overall/locate như IELTS Writing."""
    text = base.get(text_key, "")

    crit_in = patch.get("criteria") or {}
    existing_crit = base.get("criteria") or {}
    criteria = {}
    for key in CRITERIA_KEYS:
        c = crit_in.get(key) or existing_crit.get(key) or {}
        criteria[key] = {"band": _clamp_band(c.get("band")), "comment": str(c.get("comment") or "")}

    corrections_in = patch.get("corrections")
    if corrections_in is None:
        corrections_in = base.get("corrections") or []
    corrections = locate_corrections(text, [
        {"error": str(c.get("error") or ""), "fix": str(c.get("fix") or ""),
         "explain": str(c.get("explain") or ""), "type": str(c.get("type") or ""),
         "start": c.get("start"), "end": c.get("end")}
        for c in corrections_in if isinstance(c, dict) and str(c.get("error") or "").strip()
    ])

    result = dict(base)
    result.update({
        "criteria": criteria,
        "overallBand": _overall_band([criteria[k]["band"] for k in CRITERIA_KEYS]),
        "feedback": str(patch["feedback"]) if patch.get("feedback") is not None else base.get("feedback", ""),
        "strengths": [str(s) for s in patch["strengths"]] if patch.get("strengths") is not None else (base.get("strengths") or []),
        "improvements": [str(s) for s in patch["improvements"]] if patch.get("improvements") is not None else (base.get("improvements") or []),
        "corrections": corrections,
    })
    if patch.get("improvedText") is not None:
        result["improvedText"] = str(patch["improvedText"])
    if patch.get("pronunciationNotes") is not None:
        result["pronunciationNotes"] = [
            {"script": str(n.get("script") or ""), "spoken": str(n.get("spoken") or ""), "note": str(n.get("note") or "")}
            for n in patch["pronunciationNotes"] if isinstance(n, dict)
        ]
    return result


def apply_manual_edit(existing: dict, patch: dict, editor_id) -> dict:
    """
    Giáo viên sửa tay kết quả chấm Speaking đã có (status == "done").
    patch có thể chứa "task1" và/hoặc "task2" (mỗi phần chỉ gồm những khoá muốn đổi).
    """
    task1 = _apply_task_edit(existing.get("task1") or {}, patch.get("task1") or {}, "scriptText") \
        if "task1" in patch else (existing.get("task1") or {})
    task2_existing = existing.get("task2")
    task2 = task2_existing
    if "task2" in patch and task2_existing:
        task2 = _apply_task_edit(task2_existing, patch.get("task2") or {}, "transcript")

    bands = [b for b in (task1.get("overallBand"), (task2 or {}).get("overallBand")) if b is not None]

    updated = dict(existing)
    updated.update({
        "task1": task1,
        "task2": task2,
        "overallBand": _overall_band(bands) if bands else existing.get("overallBand"),
        "editedBy": editor_id,
        "editedAt": datetime.now(timezone.utc).isoformat(),
    })
    return updated


def run_grading(client, assignment: dict, submission: dict, docs_dir: Path, student_label: str) -> dict:
    """
    Pipeline đầy đủ: kịch bản .docx (Task 1, mọi học sinh) → chấm + sinh audio mẫu;
    nếu student_label == "on": thêm file ghi âm (Task 2) → transcript → chấm + đối
    chiếu phát âm với kịch bản.
    """
    now_iso = lambda: datetime.now(timezone.utc).isoformat()
    files = submission.get("files") or []

    docx_meta = _pick_docx_file(files)
    if not docx_meta:
        return {"status": "error", "error": "Không tìm thấy file kịch bản (.docx) trong bài nộp.", "gradedAt": now_iso()}
    docx_path = _resolve_path(docx_meta, docs_dir)
    if docx_path is None:
        return {"status": "error", "error": "Không đọc được file kịch bản đã nộp.", "gradedAt": now_iso()}
    script_text = _docx_text(docx_path)
    if len(script_text.split()) < 15:
        return {"status": "error", "error": "Kịch bản quá ngắn hoặc không đọc được nội dung file .docx.", "gradedAt": now_iso()}

    speaking_cfg = assignment.get("speaking") or {}
    task1_questions = "\n".join(speaking_cfg.get("task1Questions") or [])
    task2_questions = "\n".join(speaking_cfg.get("task2Questions") or [])

    try:
        task1 = grade_task1_script(client, task1_questions, script_text)
    except Exception as e:
        return {"status": "error", "error": f"Lỗi khi chấm Task 1: {e}", "gradedAt": now_iso()}

    task1["audioFile"] = generate_audio(client, task1.get("improvedText", ""), docs_dir)

    result = {
        "status": "done", "gradedAt": now_iso(), "model": GRADER_MODEL,
        "studentLabel": student_label, "task1": task1, "task2": None,
        "overallBand": task1["overallBand"],
    }

    if student_label != "on":
        return result

    audio_meta = _pick_audio_file(files)
    if not audio_meta:
        result["task2"] = {"status": "error", "error": "Không tìm thấy file ghi âm Task 2 trong bài nộp."}
        return result
    audio_path = _resolve_path(audio_meta, docs_dir)
    if audio_path is None:
        result["task2"] = {"status": "error", "error": "Không đọc được file ghi âm Task 2 đã nộp."}
        return result

    try:
        stt = transcribe_audio(client, audio_path)
    except Exception as e:
        result["task2"] = {"status": "error", "error": f"Lỗi khi chuyển giọng nói thành văn bản: {e}"}
        return result

    transcript = stt["text"]
    if len(transcript.split()) < 5:
        result["task2"] = {"status": "error", "error": "Bản ghi âm Task 2 quá ngắn hoặc không nghe rõ để chấm."}
        return result

    try:
        task2_graded = grade_task2_speech(client, task2_questions, script_text, transcript)
    except Exception as e:
        result["task2"] = {"status": "error", "error": f"Lỗi khi chấm Task 2: {e}"}
        return result

    task2_criteria = task2_graded["criteria"]
    task2 = {
        "status": "done",
        "transcript": transcript,
        "wordCount": len(transcript.split()),
        "durationSec": stt.get("duration"),
        "audioUrl": audio_meta.get("url"),
        "audioName": audio_meta.get("name"),
        "segments": _locate_segments(transcript, stt["segments"]),
        "criteria": task2_criteria,
        "overallBand": _overall_band([task2_criteria[k]["band"] for k in CRITERIA_KEYS]),
        "feedback": task2_graded["feedback"],
        "strengths": task2_graded["strengths"],
        "improvements": task2_graded["improvements"],
        "corrections": locate_corrections(transcript, task2_graded["corrections"]),
        "pronunciationNotes": task2_graded.get("pronunciationNotes") or [],
    }
    result["task2"] = task2
    result["overallBand"] = _overall_band([task1["overallBand"], task2["overallBand"]])
    return result

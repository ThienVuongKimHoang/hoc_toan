"""
Chấm bài nói tiếng Anh — nhận file ghi âm, dùng Groq Whisper chuyển thành
văn bản (transcript), rồi chấm ngữ pháp + từ vựng bằng openai/gpt-oss-120b.

Pipeline:
  1. Lấy file ghi âm từ bài nộp của học sinh (submission["files"]).
  2. Speech-to-text bằng Groq Whisper (whisper-large-v3), lấy transcript +
     segments (kèm mốc thời gian) để đồng bộ audio ↔ văn bản ở frontend.
  3. Chấm bằng openai/gpt-oss-120b theo 2 tiêu chí: ngữ pháp, từ vựng
     (thang band IELTS 0-9 để đồng bộ UI với IELTS Writing).

Dùng lại các hàm thuần không phụ thuộc đặc thù IELTS từ ielts_grading.py
(path resolve, JSON parsing, clamp/rounding band, định vị lỗi trong text)
thay vì viết lại.
"""

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ielts_grading import (
    _clamp_band,
    _normalize_ws,
    _overall_band,
    _resolve_path,
    _robust_json,
    locate_corrections,
)

# Model chấm điểm (text) — dùng chung với IELTS Writing
GRADER_MODEL = "openai/gpt-oss-120b"
# Model speech-to-text — ưu tiên độ chính xác (job chạy nền, không cần nhanh)
STT_MODEL = "whisper-large-v3"

CRITERIA_KEYS = ["grammar", "vocabulary"]

_AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".aac", ".flac", ".mp4"}
_MAX_AUDIO_BYTES = 25 * 1024 * 1024   # giới hạn của Groq audio API


def _pick_audio_file(files: list) -> Optional[dict]:
    """Chọn file ghi âm đầu tiên trong danh sách file đã nộp."""
    for f in files or []:
        mime = str(f.get("mimeType") or "")
        name = str(f.get("name") or f.get("filename") or "")
        if mime.startswith("audio/") or Path(name).suffix.lower() in _AUDIO_EXTS:
            return f
    return None


def transcribe_audio(client, path: Path) -> dict:
    """Speech-to-text bằng Groq Whisper. Trả {"text", "segments", "duration"}."""
    with open(path, "rb") as fh:
        resp = client.audio.transcriptions.create(
            model=STT_MODEL,
            file=(path.name, fh.read()),
            language="en",
            response_format="verbose_json",
        )
    data = resp.model_dump() if hasattr(resp, "model_dump") else dict(resp)
    return {
        "text": str(data.get("text") or "").strip(),
        "segments": data.get("segments") or [],
        "duration": data.get("duration"),
    }


def _locate_segments(transcript: str, segments: list) -> list[dict]:
    """Gán charStart/charEnd cho từng segment Whisper để đồng bộ audio ↔ text."""
    out = []
    cursor = 0
    for seg in segments:
        text = str(seg.get("text") or "").strip()
        start = end = None
        if text:
            idx = transcript.find(text, cursor)
            if idx == -1:
                norm = re.escape(_normalize_ws(text)).replace(r"\ ", r"\s+")
                m = re.search(norm, transcript[cursor:], re.IGNORECASE)
                if m:
                    idx = cursor + m.start()
            if idx != -1:
                start, end = idx, idx + len(text)
                cursor = end
        out.append({
            "text": text,
            "start": seg.get("start"),
            "end": seg.get("end"),
            "charStart": start,
            "charEnd": end,
        })
    return out


def grade_listening(client, context_text: str, transcript: str) -> dict:
    """Chấm ngữ pháp + từ vựng theo transcript. Trả criteria/feedback/corrections thô."""
    word_count = len(transcript.split())

    prompt = f"""You are an English teacher grading a student's SPOKEN English, transcribed from an audio recording via speech-to-text. Grade STRICTLY based on grammar and vocabulary usage, using the IELTS band scale (0-9, in 0.5 steps) as a reference scale for consistency — this is NOT an official IELTS Speaking assessment, only grammar/vocabulary quality.

=== TASK CONTEXT (title/instructions given to the student, may be empty) ===
{context_text or "(not provided)"}

=== TRANSCRIPT OF STUDENT'S SPEECH ({word_count} words) ===
{transcript}

=== INSTRUCTIONS ===
- Assign a band (0-9, in 0.5 steps) for each of 2 criteria:
  - "grammar": accuracy and range of grammatical structures used.
  - "vocabulary": range, accuracy and appropriateness of vocabulary used.
- Be aware this is a raw speech-to-text transcript: ignore missing punctuation,
  filler words (um, uh) and minor disfluencies typical of spoken language —
  do not penalize those as grammar errors. Focus on actual grammar/word-choice mistakes.
- "comment" fields, "feedback", "strengths", "improvements" and "explain" MUST be written in VIETNAMESE (tiếng Việt) so the student understands. Quote English phrases from the transcript where relevant.
- "feedback": nhận xét tổng quan chi tiết 4-8 câu.
- "corrections": 3-8 lỗi tiêu biểu nhất. MỖI lỗi gồm:
  - "error": trích dẫn NGUYÊN VĂN (copy chính xác từng ký tự, không diễn giải lại) một cụm ngắn (2-8 từ) LẤY TỪ ĐÚNG transcript ở trên chứa lỗi đó — bắt buộc phải tìm thấy y hệt trong transcript.
  - "fix": cụm đã sửa đúng, thay thế cho "error".
  - "explain": giải thích ngắn gọn bằng tiếng Việt tại sao sai.
  - "type": "grammar" (ngữ pháp) hoặc "vocab" (từ vựng/collocation).

Return ONLY valid JSON with exactly this structure:
{{
  "criteria": {{
    "grammar": {{"band": 6.0, "comment": "..."}},
    "vocabulary": {{"band": 6.0, "comment": "..."}}
  }},
  "feedback": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "corrections": [{{"error": "...", "fix": "...", "explain": "...", "type": "grammar"}}]
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
                max_tokens=2500,
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
    }


def apply_manual_edit(existing: dict, patch: dict, editor_id) -> dict:
    """Áp bản sửa tay của giáo viên lên kết quả chấm nói đã có (status == 'done')."""
    transcript = existing.get("transcript", "")

    crit_in = patch.get("criteria") or {}
    existing_crit = existing.get("criteria") or {}
    criteria = {}
    for key in CRITERIA_KEYS:
        c = crit_in.get(key) or existing_crit.get(key) or {}
        criteria[key] = {"band": _clamp_band(c.get("band")), "comment": str(c.get("comment") or "")}

    corrections_in = patch.get("corrections")
    if corrections_in is None:
        corrections_in = existing.get("corrections") or []
    corrections = locate_corrections(transcript, [
        {"error": str(c.get("error") or ""), "fix": str(c.get("fix") or ""),
         "explain": str(c.get("explain") or ""), "type": str(c.get("type") or ""),
         "start": c.get("start"), "end": c.get("end")}
        for c in corrections_in if isinstance(c, dict) and str(c.get("error") or "").strip()
    ])

    updated = dict(existing)
    updated.update({
        "criteria": criteria,
        "overallBand": _overall_band([criteria[k]["band"] for k in CRITERIA_KEYS]),
        "feedback": str(patch["feedback"]) if patch.get("feedback") is not None else existing.get("feedback", ""),
        "strengths": [str(s) for s in patch["strengths"]] if patch.get("strengths") is not None else (existing.get("strengths") or []),
        "improvements": [str(s) for s in patch["improvements"]] if patch.get("improvements") is not None else (existing.get("improvements") or []),
        "corrections": corrections,
        "editedBy": editor_id,
        "editedAt": datetime.now(timezone.utc).isoformat(),
    })
    return updated


def run_grading(client, assignment: dict, submission: dict, docs_dir: Path) -> dict:
    """Pipeline đầy đủ: file ghi âm đã nộp → transcript → chấm ngữ pháp/từ vựng."""
    now_iso = lambda: datetime.now(timezone.utc).isoformat()

    audio_meta = _pick_audio_file(submission.get("files") or [])
    if not audio_meta:
        return {"status": "error", "error": "Không tìm thấy file ghi âm trong bài nộp.", "gradedAt": now_iso()}

    path = _resolve_path(audio_meta, docs_dir)
    if path is None:
        return {"status": "error", "error": "Không đọc được file ghi âm đã nộp.", "gradedAt": now_iso()}

    if path.stat().st_size > _MAX_AUDIO_BYTES:
        return {"status": "error", "error": "File ghi âm quá lớn (tối đa 25 MB).", "gradedAt": now_iso()}

    try:
        stt = transcribe_audio(client, path)
    except Exception as e:
        return {"status": "error", "error": f"Lỗi khi chuyển giọng nói thành văn bản: {e}", "gradedAt": now_iso()}

    transcript = stt["text"]
    if len(transcript.split()) < 5:
        return {"status": "error", "error": "Bản ghi âm quá ngắn hoặc không nghe rõ để chấm.", "gradedAt": now_iso()}

    context_text = "\n".join(
        t for t in (assignment.get("title"), assignment.get("description")) if t
    ).strip()

    result = grade_listening(client, context_text, transcript)

    return {
        "status": "done",
        "gradedAt": now_iso(),
        "model": GRADER_MODEL,
        "sttModel": STT_MODEL,
        "wordCount": len(transcript.split()),
        "durationSec": stt.get("duration"),
        "audioUrl": audio_meta.get("url"),
        "audioName": audio_meta.get("name"),
        "transcript": transcript,
        "segments": _locate_segments(transcript, stt["segments"]),
        "criteria": result["criteria"],
        "overallBand": _overall_band([result["criteria"][k]["band"] for k in CRITERIA_KEYS]),
        "feedback": result["feedback"],
        "strengths": result["strengths"],
        "improvements": result["improvements"],
        "corrections": locate_corrections(transcript, result["corrections"]),
    }

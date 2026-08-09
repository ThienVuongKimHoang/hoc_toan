"""
Vocab practice AI ("Ôn luyện IELTS" — thử nghiệm riêng tư 1 tài khoản):
sinh câu ví dụ qua Groq. Logic thuần (prompt/parse), được port từ
hoc_tap/backend/vocab.py — không tự tạo Groq client ở đây, client đã xoay
vòng key được truyền vào từ api.py (theo cách ielts_grading.run_grading
nhận client làm tham số thay vì tự khởi tạo).
"""
from __future__ import annotations

import json
import re

TEXT_MODEL = "llama-3.1-8b-instant"

EXAMPLES_PROMPT = """Create 3 example sentences using the English word "{word}" (Vietnamese: {vietnamese}).
Return this exact JSON structure:
{{
  "examples": [
    {{"english": "sentence 1", "vietnamese": "bản dịch 1"}},
    {{"english": "sentence 2", "vietnamese": "bản dịch 2"}},
    {{"english": "sentence 3", "vietnamese": "bản dịch 3"}}
  ]
}}
Use B1-B2 level English. Make sentences natural and memorable."""


def parse_llm_json(raw: str) -> dict:
    """Bỏ code-fence markdown rồi parse JSON. Ném ValueError nếu hỏng (route bọc lại thành 502)."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", (raw or "").strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError("Không thể phân tích phản hồi từ AI.") from e

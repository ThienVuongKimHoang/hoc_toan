"""
mission_coins.py — công thức tính Xu thưởng nhiệm vụ (bài tập/đề đã chấm).

Module thuần (không import database) — chỉ nhận số liệu và trả về kết quả,
để api.py lo phần đọc/ghi DB. Quy tắc lấy theo tài liệu "CƠ CHẾ XU THƯỞNG
THEO ĐIỂM – TIẾN BỘ – CHUỖI NỖ LỰC":

  Tổng Xu = Hoàn thành(5) + Theo điểm(0-100) + Vượt mốc(0-200)
          + Duy trì điểm cao(0-25) + Chuỗi nỗ lực(0-30)
"""

import math
from typing import Optional

# Mốc điểm & thưởng vượt mốc, từ cao xuống thấp (chỉ mốc cao nhất vừa vượt được thưởng).
_MILESTONE_TIERS = [(10, 200), (9, 100), (8, 50), (7, 20)]

# Thưởng duy trì điểm cao (giữ ≥7 điểm N tuần liên tiếp).
_MAINTAIN_TABLE = {2: 5, 3: 10, 4: 15, 5: 20}
_MAINTAIN_MAX_STREAK, _MAINTAIN_MAX_XU = 6, 25

# Thưởng chuỗi nỗ lực (nộp đúng hạn N tuần liên tiếp).
_EFFORT_TABLE = {2: 3, 3: 7, 4: 12, 5: 18, 6: 25}
_EFFORT_MAX_STREAK, _EFFORT_MAX_XU = 7, 30


def is_eligible(assignment: dict) -> bool:
    """Bài tập/đề có thể tính Xu: đề thi (examId) hoặc homework IELTS Writing
    có chấm điểm (writingTask). Homework nộp file thường không có điểm số → loại."""
    return bool(assignment.get("examId")) or bool(assignment.get("writingTask"))


def sort_eligible(assignments: list) -> list:
    """Danh sách bài đủ điều kiện tính Xu trong 1 lớp, xếp theo thứ tự "tuần"
    (dueDate/closeTime tăng dần) — đây là toàn bộ khái niệm "tuần" của hệ thống."""
    elig = [a for a in (assignments or []) if is_eligible(a)]
    return sorted(elig, key=lambda a: (
        a.get("closeTime") or a.get("dueDate") or "",
        a.get("createdAt") or "",
        a.get("id") or "",
    ))


def normalize(raw_score, max_score) -> float:
    """Quy điểm về thang 0-10. Đề thi truyền max_score thật; homework IELTS
    truyền max_score=9 (thang band) — cùng một công thức cho cả 2 loại."""
    if raw_score is None or not max_score:
        return 0.0
    return (float(raw_score) / float(max_score)) * 10.0


def bracket_xu(score10: float) -> int:
    """Xu theo điểm (mục 2): <5→0, [5,6)→5, [6,7)→10, [7,8)→20, [8,9)→35, [9,10)→60, =10→100."""
    if score10 >= 10:
        return 100
    if score10 >= 9:
        return 60
    if score10 >= 8:
        return 35
    if score10 >= 7:
        return 20
    if score10 >= 6:
        return 10
    if score10 >= 5:
        return 5
    return 0


def milestone_xu(prev_score: Optional[float], score10: float) -> int:
    """Thưởng vượt mốc (mục 3-5): so điểm bài trước với bài hiện tại, chỉ thưởng
    mốc CAO NHẤT vừa vượt qua trong lần này."""
    p = prev_score if prev_score is not None else -math.inf
    for tier, bonus in _MILESTONE_TIERS:
        if p < tier <= score10:
            return bonus
    return 0


def maintain_xu(high_score_streak: int) -> int:
    """Thưởng duy trì điểm cao (mục 6): độ dài chuỗi ≥7 điểm liên tiếp."""
    if high_score_streak >= _MAINTAIN_MAX_STREAK:
        return _MAINTAIN_MAX_XU
    return _MAINTAIN_TABLE.get(high_score_streak, 0)


def effort_xu(effort_streak: int) -> int:
    """Thưởng chuỗi nỗ lực (mục 7): độ dài chuỗi nộp đúng hạn liên tiếp."""
    if effort_streak >= _EFFORT_MAX_STREAK:
        return _EFFORT_MAX_XU
    return _EFFORT_TABLE.get(effort_streak, 0)


def compute_award(prev_score: Optional[float], prev_high_streak: int, prev_effort_streak: int,
                   score10: float, on_time: bool) -> dict:
    """Tính toàn bộ breakdown Xu cho 1 lần chấm bài. Nộp trễ (on_time=False) →
    0 Xu và làm đứt cả 2 chuỗi (coi như bỏ bài)."""
    if not on_time:
        return {
            "completionXu": 0, "bracketXu": 0, "milestoneXu": 0,
            "maintainXu": 0, "effortXu": 0, "totalXu": 0,
            "highScoreStreak": 0, "effortStreak": 0,
        }

    completion = 5
    bracket = bracket_xu(score10)
    milestone = milestone_xu(prev_score, score10)

    high_streak = prev_high_streak + 1 if score10 >= 7 else 0
    maintain = maintain_xu(high_streak)

    eff_streak = prev_effort_streak + 1
    effort = effort_xu(eff_streak)

    total = completion + bracket + milestone + maintain + effort
    return {
        "completionXu": completion, "bracketXu": bracket, "milestoneXu": milestone,
        "maintainXu": maintain, "effortXu": effort, "totalXu": total,
        "highScoreStreak": high_streak, "effortStreak": eff_streak,
    }


def next_milestone_info(score10: float) -> Optional[dict]:
    """Mốc điểm gần nhất chưa đạt (để hiển thị thanh tiến độ) — None nếu đã đạt mốc cao nhất."""
    for tier, bonus in sorted(_MILESTONE_TIERS):
        if score10 < tier:
            return {"tier": tier, "bonus": bonus, "pointsAway": round(tier - score10, 2)}
    return None

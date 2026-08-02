#!/usr/bin/env python3
"""
QA bot: mô phỏng luồng sử dụng thật của Trung tâm Ánh Sáng để smoke-test nhanh
sau khi deploy — tạo lớp, thêm học sinh, tạo đề thi (có kèm ảnh trong đáp án
trắc nghiệm), rồi một học sinh ĐĂNG NHẬP QUA GIAO DIỆN THẬT và làm bài như
người dùng bình thường.

Các bước setup (đăng ký tài khoản, tạo lớp, thêm thành viên, tạo đề) gọi thẳng
API cho nhanh/ổn định; riêng bước "làm bài" luôn đi qua trình duyệt thật
(Playwright) — bấm đăng nhập, chọn đáp án, bấm nộp bài — vì đó là phần cần
kiểm tra trải nghiệm thật của người dùng.

── Cài đặt ──────────────────────────────────────────────────────────────────
    pip install requests playwright
    playwright install chromium

── Chạy ─────────────────────────────────────────────────────────────────────
    python3 scripts/qa_bot.py
    BOT_CLEANUP=1 python3 scripts/qa_bot.py                 # tự xoá dữ liệu sau khi chạy
    BOT_BASE_URL=http://localhost:3000 python3 scripts/qa_bot.py

── Cấu hình qua biến môi trường (KHÔNG hardcode credentials trong file này) ──
    BOT_BASE_URL           URL gốc trang web. Mặc định: xem DEFAULT_BASE_URL bên dưới.
    BOT_CLEANUP            "1" để tự xoá lớp/đề/tài khoản bot tạo ra sau khi chạy xong.
                            Không đặt (mặc định) → để lại toàn bộ, bot in ra link/mã để
                            bạn tự đăng nhập kiểm tra.
    BOT_NUM_STUDENTS        Số học sinh mô phỏng (mặc định 1).
    BOT_TEACHER_EMAIL / BOT_TEACHER_PASSWORD
        Tái sử dụng MỘT TÀI KHOẢN GIÁO VIÊN CÓ SẴN thay vì tạo mới. Khuyên dùng
        nếu chạy nhiều lần — tránh phải cấp quyền super-admin cho bot.
    BOT_SUPERADMIN_EMAIL / BOT_SUPERADMIN_PASSWORD
        Chỉ cần khi KHÔNG đặt BOT_TEACHER_EMAIL — bot tự đăng ký một tài khoản
        giáo viên mới rồi dùng quyền super-admin này để nâng quyền tài khoản đó
        lên "giao_vien" qua API chính thức (PUT /api/admin/users/{id}/role) —
        không đụng trực tiếp vào database. Super-admin cũng được dùng (nếu có)
        để xoá tài khoản học sinh/giáo viên bot tạo lúc BOT_CLEANUP=1; thiếu nó
        thì các tài khoản đó không tự xoá được (bot sẽ báo rõ trong phần "cần
        kiểm tra thủ công").

Không đặt CẢ HAI (BOT_TEACHER_EMAIL và BOT_SUPERADMIN_EMAIL) → bot dừng ngay
từ đầu với lỗi rõ ràng, KHÔNG tự ý dùng quyền root/DB để né việc này.
"""

import json
import os
import random
import string
import sys
from datetime import datetime, timedelta, timezone

import requests
from playwright.sync_api import sync_playwright

DEFAULT_BASE_URL = "http://42.96.13.193:3000"
BASE_URL = os.environ.get("BOT_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
CLEANUP = os.environ.get("BOT_CLEANUP", "").strip().lower() in ("1", "true", "yes")
NUM_STUDENTS = max(1, int(os.environ.get("BOT_NUM_STUDENTS", "1")))

TEACHER_EMAIL = os.environ.get("BOT_TEACHER_EMAIL")
TEACHER_PASSWORD = os.environ.get("BOT_TEACHER_PASSWORD")
SUPERADMIN_EMAIL = os.environ.get("BOT_SUPERADMIN_EMAIL")
SUPERADMIN_PASSWORD = os.environ.get("BOT_SUPERADMIN_PASSWORD")

RUN_TAG = datetime.now().strftime("%y%m%d%H%M%S") + "".join(random.choices(string.ascii_lowercase, k=4))
BOT_PASSWORD = "QaBot!" + RUN_TAG

# Ảnh PNG 1x1 nhúng sẵn — dùng để test luôn tính năng "chèn ảnh vào đáp án trắc
# nghiệm" xuyên suốt lúc tạo đề → lưu → học sinh làm bài (không cần file ảnh rời).
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

report = {"steps": [], "credentials": {}, "created": {}, "manual_check": []}


def log(step, ok, detail="", fatal=True):
    mark = "✅" if ok else ("❌" if fatal else "⚠️ ")
    print(f"{mark} {step}" + (f" — {detail}" if detail else ""))
    report["steps"].append({"step": step, "ok": ok, "detail": detail})
    if not ok and fatal:
        print("\n=== BOT DỪNG SỚM — xem báo cáo bên dưới ===")
        print_report()
        sys.exit(1)


def api(method, path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, f"{BASE_URL}{path}", headers=headers, timeout=30, **kw)


def gen_id(n=8):
    # Khớp genId() phía frontend (examStore.js) / _cls_id() phía backend: chuỗi ngẫu nhiên.
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


# ── 1. Giáo viên ──────────────────────────────────────────────────────────
def ensure_teacher():
    if TEACHER_EMAIL and TEACHER_PASSWORD:
        r = api("POST", "/api/auth/login", json={"email": TEACHER_EMAIL, "password": TEACHER_PASSWORD})
        log("Đăng nhập giáo viên có sẵn (BOT_TEACHER_EMAIL)", r.ok, r.text[:200] if not r.ok else TEACHER_EMAIL)
        report["credentials"]["teacher"] = {"email": TEACHER_EMAIL, "password": "(tài khoản có sẵn, không tạo mới)"}
        report["created"]["teacher_is_reused"] = True
        return r.json()

    if not (SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD):
        log("Xác định tài khoản giáo viên", False,
            "Cần đặt BOT_TEACHER_EMAIL/BOT_TEACHER_PASSWORD (tái sử dụng tài khoản có "
            "sẵn) HOẶC BOT_SUPERADMIN_EMAIL/BOT_SUPERADMIN_PASSWORD (để bot tự tạo + "
            "nâng quyền tài khoản mới qua API). Xem hướng dẫn ở đầu file.")

    email = f"qa-bot-teacher-{RUN_TAG}@example.com"
    r = api("POST", "/api/auth/register", json={
        "name": f"QA Bot Teacher {RUN_TAG}", "email": email, "password": BOT_PASSWORD})
    log("Đăng ký tài khoản giáo viên bot", r.ok, r.text[:200] if not r.ok else email)
    new_user = r.json()

    r = api("POST", "/api/auth/login", json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD})
    log("Đăng nhập super admin (để nâng quyền tài khoản bot)", r.ok, r.text[:200] if not r.ok else "ok")
    admin_token = r.json()["token"]

    r = api("PUT", f"/api/admin/users/{new_user['id']}/role", token=admin_token, json={"role": "giao_vien"})
    log("Nâng quyền tài khoản bot → giáo_viên", r.ok, r.text[:200] if not r.ok else "ok")

    r = api("POST", "/api/auth/login", json={"email": email, "password": BOT_PASSWORD})
    log("Đăng nhập lại với quyền giáo viên", r.ok, r.text[:200] if not r.ok else "ok")
    user = r.json()
    report["credentials"]["teacher"] = {"email": email, "password": BOT_PASSWORD}
    report["created"]["teacher_id"] = user["id"]
    report["created"]["teacher_is_reused"] = False
    return user


# ── 2. Lớp học ────────────────────────────────────────────────────────────
def create_class(teacher):
    name = f"QA Bot Class {RUN_TAG}"
    r = api("POST", "/api/classes", token=teacher["token"],
            json={"name": name, "subject": "toan", "grade": "thpt"})
    log("Tạo lớp học", r.ok, r.text[:200] if not r.ok else name)
    cls = r.json()
    report["created"]["class_id"] = cls["id"]
    report["created"]["class_join_code"] = cls["joinCode"]
    print(f"   → Mã tham gia lớp: {cls['joinCode']}   (link: {BASE_URL}/#join/{cls['joinCode']})")
    return cls


# ── 3. Thêm thành viên (học sinh tự đăng ký + tham gia bằng mã lớp) ────────
def register_and_join_students(cls, n):
    students = []
    for i in range(n):
        email = f"qa-bot-student-{RUN_TAG}-{i}@example.com"
        r = api("POST", "/api/auth/register", json={
            "name": f"QA Bot Student {RUN_TAG}-{i}", "email": email,
            "password": BOT_PASSWORD, "grade": "thpt"})
        log(f"Đăng ký học sinh #{i + 1}", r.ok, r.text[:200] if not r.ok else email)
        student = r.json()

        r = api("POST", "/api/classes/join", token=student["token"], json={"code": cls["joinCode"]})
        log(f"Học sinh #{i + 1} tham gia lớp bằng mã", r.ok, r.text[:200] if not r.ok else cls["joinCode"])

        students.append({"email": email, "password": BOT_PASSWORD, **student})
    report["credentials"]["students"] = [{"email": s["email"], "password": s["password"]} for s in students]
    report["created"]["student_ids"] = [s["id"] for s in students]
    return students


# ── 4. Đề thi (gọi thẳng API — không qua UI, theo yêu cầu) ─────────────────
def build_questions():
    return [
        {
            "question_number": 1, "section": "PHẦN I",
            "question_text": "Đạo hàm của $y = x^2$ là:",
            "choices": {"A": "$y' = x$", "B": "$y' = 2x$", "C": "$y' = 2$", "D": "$y' = x^2$"},
            "answer": "B", "points": 0.25, "has_figure": False,
        },
        {
            # Đáp án B kèm ảnh — test xuyên suốt tính năng "chèn ảnh vào đáp án trắc
            # nghiệm" (marker [img:id] + mảng images) đến tận lúc học sinh làm bài.
            "question_number": 2, "section": "PHẦN I",
            "question_text": "Hình nào dưới đây là đồ thị của hàm số $y = x^2$?",
            "choices": {
                "A": "Đường thẳng",
                "B": "Đường thẳng\n[img:qa-bot-demo-img]",
                "C": "Đường tròn",
                "D": "Đường elip",
            },
            "answer": "B", "points": 0.25, "has_figure": False,
            "images": [{
                "id": "qa-bot-demo-img",
                "dataUrl": f"data:image/png;base64,{TINY_PNG_B64}",
                "name": "qa-bot-demo.png",
            }],
        },
        {
            "question_number": 3, "section": "PHẦN I",
            "question_text": "$\\lim_{x \\to 0} \\frac{\\sin x}{x}$ bằng:",
            "choices": {"A": "0", "B": "1", "C": "$\\infty$", "D": "Không xác định"},
            "answer": "B", "points": 0.25, "has_figure": False,
        },
    ]


def create_exam(teacher, cls):
    exam_id = gen_id()
    title = f"QA Bot Exam {RUN_TAG}"
    exam = {
        "id": exam_id,
        "title": title,
        "createdBy": teacher["id"],
        "classId": cls["id"],
        "subject": "toan",
        "grade": "thpt",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": "QA bot (API)",
        "totalQuestions": 3,
        "sections": {
            "PHẦN I": {"questions": build_questions(), "points_per_q": 0.25},
            "PHẦN II": {"questions": [], "points_per_q": 1.0},
            "PHẦN III": {"questions": [], "points_per_q": 0.5},
            "TỰ LUẬN": {"questions": [], "points_per_q": 1.0},
        },
        "published": True,
        "settings": {"duration": 30, "closeTime": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()},
    }
    r = api("POST", f"/api/exams/{exam_id}", token=teacher["token"],
            json={**exam, "teacherId": teacher["id"]})
    log("Tạo đề thi (API, 3 câu PHẦN I, 1 câu có ảnh trong đáp án B)", r.ok, r.text[:200] if not r.ok else title)
    report["created"]["exam_id"] = exam_id
    report["created"]["exam_title"] = title
    return exam


# ── 5. Giao đề thi cho lớp ──────────────────────────────────────────────────
def assign_exam(teacher, cls, exam):
    close_time = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r = api("POST", f"/api/classes/{cls['id']}/assignments", token=teacher["token"], json={
        "title": exam["title"], "examId": exam["id"], "subject": "toan",
        "duration": 30, "closeTime": close_time, "scoreMode": "highest",
    })
    log("Giao đề thi cho lớp", r.ok, r.text[:200] if not r.ok else "ok")
    asgn = r.json()
    report["created"]["assignment_id"] = asgn["id"]
    return asgn


# ── 6. Học sinh làm bài — QUA GIAO DIỆN THẬT (Playwright) ──────────────────
def take_exam_as_student_ui(student, exam, cls, asgn):
    take_link = f"{BASE_URL}/#take/{exam['id']}/{cls['id']}/{asgn['id']}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1024, "height": 1200})
        page.on("dialog", lambda d: d.accept())  # confirm() "Nộp bài?"

        page.goto(BASE_URL + "/")
        page.get_by_text("Đăng nhập", exact=True).first.click()
        page.wait_for_selector('input[type="email"]', timeout=10000)
        page.locator('input[type="email"]').fill(student["email"])
        page.locator('input[type="password"]').fill(student["password"])
        # .btn-login (không dùng get_by_role name="Đăng nhập" — trùng với tab
        # "Đăng nhập"/"Đăng ký" phía trên form, sẽ khớp 2 phần tử).
        page.locator("button.btn-login").click()
        page.wait_for_timeout(1000)
        log("Học sinh đăng nhập qua giao diện", True)

        # ".et-locked" bọc CẢ màn hình "Đang tải…" (chưa xong) LẪN các màn hình lỗi
        # cuối cùng (etl-title) — chỉ chờ ".question-card" (đề đã hiện) hoặc
        # ".etl-title" (trạng thái lỗi/cuối, vd "Không tìm thấy đề thi") mới coi là
        # đã dừng loading. Vừa giao đề (assign_exam) xong có thể cần một nhịp để
        # cửa sổ làm bài (getExamWindow) sẵn sàng — thử tối đa 3 lần.
        found = False
        for attempt in range(3):
            page.goto(take_link)
            try:
                page.wait_for_selector(".question-card, .etl-title", timeout=10000)
                found = True
                break
            except Exception:
                page.wait_for_timeout(1500)
        if not found or not page.locator(".question-card").count():
            snippet = page.inner_text("body")[:500]
            log("Vào trang làm bài", False, f"Không thấy câu hỏi sau {attempt + 1} lần thử — nội dung trang: {snippet}")

        # Chọn đúng ĐÁP ÁN THẬT của từng câu (không phải bấm bừa ô đầu tiên) — để
        # điểm hiển thị cuối cùng phản ánh đúng việc chấm điểm có hoạt động đúng
        # không, thay vì luôn ra 0đ.
        answers = [q["answer"] for q in build_questions()]
        cards = page.locator(".question-card")
        n = cards.count()
        for i in range(n):
            idx = ord(answers[i]) - ord("A")  # A=0, B=1, C=2, D=3 (đề không bật trộn đáp án)
            cards.nth(i).locator(".choice-btn").nth(idx).click()
        log(f"Học sinh chọn đáp án ĐÚNG cho {n} câu", n > 0)

        page.get_by_text("Nộp bài", exact=False).first.click()
        page.wait_for_selector(".etl-score-num, .etl-hide-msg", timeout=15000)
        page.screenshot(path=f"/tmp/qa_bot_result_{RUN_TAG}.png")

        if page.locator(".etl-score-num").count():
            score_text = page.locator(".etl-score-num").first.inner_text()
            log("Nộp bài thành công", True, f"Điểm hiển thị: {score_text.strip()}")
            report["created"]["student_score_shown"] = score_text.strip()
        else:
            log("Nộp bài thành công", True, "(kết quả bị ẩn theo cài đặt đề — không đọc được điểm)")

        report["created"]["screenshot"] = f"/tmp/qa_bot_result_{RUN_TAG}.png"
        report["manual_check"].append(
            f"Xem lại giao diện làm bài + câu 2 (đáp án B có ảnh) qua ảnh chụp: "
            f"/tmp/qa_bot_result_{RUN_TAG}.png, hoặc đăng nhập học sinh và mở {take_link}"
        )
        browser.close()


# ── Dọn dẹp ─────────────────────────────────────────────────────────────────
def cleanup(teacher, cls, exam):
    admin_token = None
    if SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD:
        r = api("POST", "/api/auth/login", json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD})
        if r.ok:
            admin_token = r.json()["token"]

    r = api("DELETE", f"/api/exams/{exam['id']}", token=teacher["token"])
    log("Xoá đề thi (kèm lần giao bài)", r.ok, r.text[:200] if not r.ok else "ok", fatal=False)

    r = api("DELETE", f"/api/classes/{cls['id']}", token=teacher["token"])
    log("Xoá lớp học", r.ok, r.text[:200] if not r.ok else "ok", fatal=False)

    if admin_token:
        for uid in report["created"].get("student_ids", []):
            r = api("DELETE", f"/api/admin/users/{uid}", token=admin_token)
            log(f"Xoá tài khoản học sinh {uid}", r.ok, r.text[:200] if not r.ok else "ok", fatal=False)
        if not report["created"].get("teacher_is_reused", True):
            tid = report["created"].get("teacher_id")
            if tid:
                r = api("DELETE", f"/api/admin/users/{tid}", token=admin_token)
                log(f"Xoá tài khoản giáo viên bot {tid}", r.ok, r.text[:200] if not r.ok else "ok", fatal=False)
    else:
        emails = [s["email"] for s in report["credentials"].get("students", [])]
        report["manual_check"].append(
            "Không có BOT_SUPERADMIN_EMAIL/PASSWORD nên KHÔNG tự xoá được các tài khoản "
            "giáo viên/học sinh bot tạo ra — xoá thủ công qua trang Super Admin nếu cần: "
            + ", ".join(emails)
        )


def print_report():
    print("\n" + "=" * 70)
    print("BÁO CÁO QA BOT")
    print("=" * 70)
    print(f"Server: {BASE_URL}")
    print(f"Mã lần chạy: {RUN_TAG}")
    ok_steps = sum(1 for s in report["steps"] if s["ok"])
    print(f"Các bước: {ok_steps}/{len(report['steps'])} thành công")
    for s in report["steps"]:
        if not s["ok"]:
            print(f"  ❌ {s['step']}: {s['detail']}")

    print("\n-- Thông tin tạo ra --")
    print(json.dumps(report["created"], ensure_ascii=False, indent=2))

    print("\n-- Tài khoản (để bạn tự đăng nhập kiểm tra) --")
    print(json.dumps(report["credentials"], ensure_ascii=False, indent=2))

    if report["manual_check"]:
        print("\n-- Cần bạn kiểm tra thủ công --")
        for m in report["manual_check"]:
            print(f"  • {m}")
    print("=" * 70)


def main():
    teacher = ensure_teacher()
    cls = create_class(teacher)
    students = register_and_join_students(cls, NUM_STUDENTS)
    exam = create_exam(teacher, cls)
    asgn = assign_exam(teacher, cls, exam)
    take_exam_as_student_ui(students[0], exam, cls, asgn)

    if CLEANUP:
        cleanup(teacher, cls, exam)
    else:
        report["manual_check"].append(
            f"BOT_CLEANUP không bật — lớp/đề/tài khoản vẫn còn trên server để bạn kiểm tra. "
            f"Chạy lại với BOT_CLEANUP=1 (và set BOT_SUPERADMIN_EMAIL/PASSWORD nếu muốn xoá "
            f"luôn cả tài khoản) khi muốn dọn."
        )

    print_report()


if __name__ == "__main__":
    main()

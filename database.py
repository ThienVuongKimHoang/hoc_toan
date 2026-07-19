"""
database.py — PostgreSQL storage.

Connection: DATABASE_URL env var
Default: postgresql://hoc_toan:hoc_toan123@localhost:5433/hoc_toan
Migrates existing JSON files on first run (only if tables are empty).
"""

import hashlib
import hmac as _hmac
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

# ── Connection ─────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://hoc_toan:hoc_toan123@localhost:5433/hoc_toan",
)

_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 20, DATABASE_URL)
    return _pool


class _C:
    """Context manager: borrow/return a connection from the pool."""
    def __enter__(self):
        self.conn = _get_pool().getconn()
        return self.conn
    def __exit__(self, *_):
        _get_pool().putconn(self.conn)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Password hashing (PBKDF2, stdlib — không thêm dependency) ─────────────────

_PWD_PREFIX = "pbkdf2$"


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", (plain or "").encode(), salt.encode(), 100_000)
    return f"{_PWD_PREFIX}{salt}${dk.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    """So khớp mật khẩu. Hỗ trợ cả bản ghi cũ còn plaintext (sẽ được nâng cấp dần)."""
    if not stored:
        return False
    if stored.startswith(_PWD_PREFIX):
        try:
            _, salt, hexhash = stored.split("$", 2)
        except ValueError:
            return False
        dk = hashlib.pbkdf2_hmac("sha256", (plain or "").encode(), salt.encode(), 100_000)
        return _hmac.compare_digest(dk.hex(), hexhash)
    return _hmac.compare_digest(stored, plain or "")


def is_hashed(stored: str) -> bool:
    return bool(stored) and stored.startswith(_PWD_PREFIX)


# ── Schema ─────────────────────────────────────────────────────────────────────

_DDL = """
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password      VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL DEFAULT '',
    role          VARCHAR(50)  NOT NULL DEFAULT 'khach',
    avatar        VARCHAR(20)  DEFAULT '',
    is_registered BOOLEAN      DEFAULT FALSE,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ALTER COLUMN avatar TYPE VARCHAR(500);
-- Cấp độ (khối lớp) học sinh chọn khi đăng ký: '1'..'12'. GV/Admin để trống.
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade VARCHAR(20);


CREATE TABLE IF NOT EXISTS exams (
    id                VARCHAR(100)  PRIMARY KEY,
    title             VARCHAR(1000) DEFAULT '',
    created_by        VARCHAR(255),
    created_at        TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ,
    source            VARCHAR(500)  DEFAULT '',
    total_questions   INT           DEFAULT 0,
    sections          JSONB         DEFAULT '{}',
    published         BOOLEAN       DEFAULT FALSE,
    is_public         BOOLEAN       DEFAULT FALSE,
    featured          BOOLEAN       DEFAULT FALSE,
    results_revealed  BOOLEAN       DEFAULT FALSE,
    settings          JSONB,
    practice_settings JSONB,
    classes_data      JSONB         DEFAULT '[]'
);
-- Môn học của đề (toan | ly | hoa | anh | van…) — quyết định bộ nhãn chủ đề khi soạn/sửa
ALTER TABLE exams ADD COLUMN IF NOT EXISTS subject VARCHAR(20);

CREATE TABLE IF NOT EXISTS submissions (
    id           SERIAL       PRIMARY KEY,
    exam_id      VARCHAR(100) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ,
    student_name VARCHAR(255) DEFAULT 'Ẩn danh',
    student_id   VARCHAR(255),
    answers      JSONB        DEFAULT '{}',
    score        FLOAT,
    max_score    FLOAT,
    class_name   VARCHAR(255),
    class_id     VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_sub_exam ON submissions(exam_id);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_spent INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS violation_count INTEGER;
-- Mỗi bài nộp gắn với MỘT lần giao bài (assignment) — phân biệt khi cùng một đề
-- được giao nhiều lần trong một lớp. NULL = bài nộp cũ / qua link công khai.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS assignment_id VARCHAR(50);
-- Điểm chấm tay cho câu tự luận (GV nhập): { "TL_1": 1.5, ... }. Cộng vào score.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS manual_scores JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS classes (
    id            VARCHAR(50)  PRIMARY KEY,
    name          VARCHAR(255) DEFAULT '',
    description   TEXT         DEFAULT '',
    teacher_id    VARCHAR(100),
    teacher_name  VARCHAR(255) DEFAULT '',
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    join_code     VARCHAR(20),
    join_password VARCHAR(255),
    subject       VARCHAR(20),
    members       JSONB        DEFAULT '[]',
    assignments   JSONB        DEFAULT '[]',
    documents     JSONB        DEFAULT '[]'
);
-- Migration cho DB tạo trước khi cột subject tồn tại (CREATE IF NOT EXISTS
-- không thêm cột mới vào bảng cũ)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS subject VARCHAR(20);
-- Lớp = khối/cấp (Lớp 5, 6, 7…): grade là cấp độ, subjects là danh sách môn.
-- 'subject' đơn cũ được giữ lại để tương thích & backfill vào 'subjects'.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade VARCHAR(20);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]';
-- Lớp có thể có nhiều giáo viên phụ trách (co-teacher) ngoài teacher_id chính.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS co_teachers JSONB DEFAULT '[]';
-- Lịch học cố định: [{"dayOfWeek":1-7 (1=Thứ2..6=Thứ7,7=CN), "startTime":"19:30", "endTime":"21:00"}]
ALTER TABLE classes ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]';
-- Cấu hình riêng của lớp, vd ngưỡng điểm thấp để cảnh báo: {"lowScoreThreshold": 50}
ALTER TABLE classes ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id           VARCHAR(50)  PRIMARY KEY,
    class_id     VARCHAR(50)  NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    class_name   VARCHAR(255) DEFAULT '',
    session_date DATE         NOT NULL,
    opened_by    VARCHAR(100),
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attend_sess_unique ON attendance_sessions(class_id, session_date);

CREATE TABLE IF NOT EXISTS attendance_records (
    id           SERIAL       PRIMARY KEY,
    session_id   VARCHAR(50)  NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id   VARCHAR(100) NOT NULL,
    student_name VARCHAR(255) DEFAULT '',
    status       VARCHAR(20)  NOT NULL DEFAULT 'co_mat',  -- co_mat|vang|tre|phep
    note         VARCHAR(500) DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_attend_rec_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attend_rec_student ON attendance_records(student_id);

-- Báo cáo tổng hợp toàn hệ thống: vắng học, bỏ bài, điểm thấp — Super Admin xem chung 1 bảng.
CREATE TABLE IF NOT EXISTS reports (
    id           VARCHAR(50)  PRIMARY KEY,
    type         VARCHAR(30)  NOT NULL,  -- vang_hoc | bo_bai | diem_thap
    class_id     VARCHAR(50)  REFERENCES classes(id) ON DELETE CASCADE,
    class_name   VARCHAR(255) DEFAULT '',
    student_id   VARCHAR(100),
    student_name VARCHAR(255) DEFAULT '',
    ref_id       VARCHAR(100),           -- session id (vang_hoc) hoặc assignment id (bo_bai/diem_thap)
    title        VARCHAR(500) DEFAULT '',
    detail       TEXT         DEFAULT '',
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_type  ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_class ON reports(class_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_dedupe ON reports(type, ref_id, student_id);

CREATE TABLE IF NOT EXISTS notifications (
    id             VARCHAR(50)  PRIMARY KEY,
    type           VARCHAR(50)  DEFAULT '',
    target_user_id VARCHAR(100),
    class_id       VARCHAR(50),
    class_name     VARCHAR(255) DEFAULT '',
    assignment_id  VARCHAR(50)  DEFAULT '',
    title          VARCHAR(500) DEFAULT '',
    message        TEXT         DEFAULT '',
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    read           BOOLEAN      DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(target_user_id);

CREATE TABLE IF NOT EXISTS admin_config (
    key   VARCHAR(100) PRIMARY KEY,
    value JSONB        DEFAULT 'null'
);
"""

# ── Init + migrate ─────────────────────────────────────────────────────────────

def init_db():
    """Create tables then migrate from JSON files if they're empty."""
    with _C() as conn:
        with conn.cursor() as cur:
            # Phát hiện DB cũ chưa có classes.subject TRƯỚC khi chạy DDL
            # (DDL sẽ tự thêm cột; các lớp cũ được gán mặc định 'toan' một lần)
            cur.execute("""SELECT EXISTS (SELECT 1 FROM information_schema.tables
                                          WHERE table_name = 'classes')
                                  AND NOT EXISTS (
                                      SELECT 1 FROM information_schema.columns
                                      WHERE table_name = 'classes'
                                        AND column_name = 'subject')""")
            backfill_subject = cur.fetchone()[0]
            cur.execute(_DDL)
            if backfill_subject:
                cur.execute("UPDATE classes SET subject = 'toan' WHERE subject IS NULL")
                print(f"[DB] Đã thêm cột classes.subject, gán 'toan' cho {cur.rowcount} lớp cũ")
            # Backfill subjects[] từ subject đơn cho các lớp cũ (idempotent):
            # lớp nào subjects rỗng mà có subject thì đưa subject vào mảng.
            cur.execute("""
                UPDATE classes
                   SET subjects = to_jsonb(ARRAY[subject])
                 WHERE subject IS NOT NULL
                   AND (subjects IS NULL OR subjects = '[]'::jsonb)
            """)
            if cur.rowcount:
                print(f"[DB] Backfill classes.subjects cho {cur.rowcount} lớp cũ")
        conn.commit()
    _migrate_users()
    _migrate_exams()
    _migrate_classes()
    _migrate_notifs()
    _migrate_config()
    _migrate_password_hashes()
    _ensure_super_admin()


def _migrate_password_hashes() -> None:
    """Hash mọi mật khẩu còn lưu plaintext (chạy một lần, an toàn khi chạy lại)."""
    with _C() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, password FROM users WHERE password <> '' AND password NOT LIKE %s",
                    (_PWD_PREFIX + "%",))
                rows = cur.fetchall()
                for uid, pwd in rows:
                    cur.execute("UPDATE users SET password=%s WHERE id=%s",
                                (hash_password(pwd), uid))
            conn.commit()
            if rows:
                print(f"[DB] Đã hash mật khẩu cho {len(rows)} tài khoản")
        except Exception as e:
            conn.rollback()
            print(f"[DB] _migrate_password_hashes error: {e}")


_BASE = Path(__file__).parent



def _migrate_users():
    f = _BASE / "users.json"
    if not f.exists():
        return
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users")
            if cur.fetchone()[0] > 0:
                return
        try:
            users = json.loads(f.read_text(encoding="utf-8"))
            with conn.cursor() as cur:
                for u in users:
                    cur.execute(
                        """INSERT INTO users(id,email,password,name,role,avatar,is_registered,created_at)
                           VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (int(u["id"]), u.get("email", ""), u.get("password", ""),
                         u.get("name", ""), u.get("role", "khach"), u.get("avatar", ""),
                         bool(u.get("isRegistered", False)), u.get("createdAt")),
                    )
            conn.commit()
            print(f"[DB] Migrated {len(users)} users from users.json")
        except Exception as e:
            conn.rollback()
            print(f"[DB] migrate_users error: {e}")


def _migrate_exams():
    f = _BASE / "exams.json"
    if not f.exists():
        return
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM exams")
            if cur.fetchone()[0] > 0:
                return
        try:
            exams = json.loads(f.read_text(encoding="utf-8"))
            with conn.cursor() as cur:
                for eid, exam in exams.items():
                    subs = exam.pop("submissions", [])
                    cur.execute(
                        """INSERT INTO exams(id,title,created_by,created_at,updated_at,source,
                                total_questions,sections,published,is_public,featured,
                                results_revealed,settings,practice_settings,classes_data)
                           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                           ON CONFLICT DO NOTHING""",
                        (eid, exam.get("title", ""), str(exam.get("createdBy", "")),
                         exam.get("createdAt"), exam.get("updatedAt"),
                         exam.get("source", ""), exam.get("totalQuestions", 0),
                         json.dumps(exam.get("sections") or {}, ensure_ascii=False),
                         bool(exam.get("published", False)), bool(exam.get("isPublic", False)),
                         bool(exam.get("featured", False)), bool(exam.get("resultsRevealed", False)),
                         json.dumps(exam.get("settings"), ensure_ascii=False) if exam.get("settings") is not None else None,
                         json.dumps(exam.get("practiceSettings"), ensure_ascii=False) if exam.get("practiceSettings") is not None else None,
                         json.dumps(exam.get("classes") or [], ensure_ascii=False)),
                    )
                    for sub in subs:
                        cur.execute(
                            """INSERT INTO submissions(exam_id,submitted_at,student_name,student_id,
                                    answers,score,max_score,class_name,class_id)
                               VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                            (eid, sub.get("submittedAt"),
                             sub.get("studentName", "Ẩn danh"), str(sub.get("studentId", "")),
                             json.dumps(sub.get("answers") or {}, ensure_ascii=False),
                             sub.get("score"), sub.get("maxScore"),
                             sub.get("className"), sub.get("classId")),
                        )
            conn.commit()
            print(f"[DB] Migrated {len(exams)} exams from exams.json")
        except Exception as e:
            conn.rollback()
            print(f"[DB] migrate_exams error: {e}")


def _migrate_classes():
    f = _BASE / "classes.json"
    if not f.exists():
        return
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM classes")
            if cur.fetchone()[0] > 0:
                return
        try:
            classes = json.loads(f.read_text(encoding="utf-8"))
            with conn.cursor() as cur:
                for cid, cls in classes.items():
                    cur.execute(
                        """INSERT INTO classes(id,name,description,teacher_id,teacher_name,
                                created_at,join_code,join_password,members,assignments,documents)
                           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (cid, cls.get("name", ""), cls.get("description", ""),
                         str(cls.get("teacherId", "")), cls.get("teacherName", ""),
                         cls.get("createdAt"), cls.get("joinCode"), cls.get("joinPassword"),
                         json.dumps(cls.get("members") or [], ensure_ascii=False),
                         json.dumps(cls.get("assignments") or [], ensure_ascii=False),
                         json.dumps(cls.get("documents") or [], ensure_ascii=False)),
                    )
            conn.commit()
            print(f"[DB] Migrated {len(classes)} classes from classes.json")
        except Exception as e:
            conn.rollback()
            print(f"[DB] migrate_classes error: {e}")


def _migrate_notifs():
    f = _BASE / "notifications.json"
    if not f.exists():
        return
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM notifications")
            if cur.fetchone()[0] > 0:
                return
        try:
            notifs = json.loads(f.read_text(encoding="utf-8"))
            with conn.cursor() as cur:
                for n in notifs:
                    cur.execute(
                        """INSERT INTO notifications(id,type,target_user_id,class_id,class_name,
                                assignment_id,title,message,created_at,read)
                           VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                        (n.get("id", ""), n.get("type", ""), str(n.get("targetUserId", "")),
                         n.get("classId"), n.get("className", ""),
                         n.get("assignmentId", ""), n.get("title", ""), n.get("message", ""),
                         n.get("createdAt"), bool(n.get("read", False))),
                    )
            conn.commit()
            print(f"[DB] Migrated {len(notifs)} notifications")
        except Exception as e:
            conn.rollback()
            print(f"[DB] migrate_notifs error: {e}")


def _migrate_config():
    f = _BASE / "admin_config.json"
    if not f.exists():
        return
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM admin_config")
            if cur.fetchone()[0] > 0:
                return
        try:
            cfg = json.loads(f.read_text(encoding="utf-8"))
            with conn.cursor() as cur:
                for k, v in cfg.items():
                    cur.execute(
                        "INSERT INTO admin_config(key,value) VALUES(%s,%s) ON CONFLICT DO NOTHING",
                        (k, json.dumps(v, ensure_ascii=False)),
                    )
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"[DB] migrate_config error: {e}")

def _ensure_super_admin() -> None:
    """Tạo tài khoản super_admin mặc định nếu chưa có ai có role này.
    KHÔNG chiếm/nâng quyền tài khoản có sẵn trùng email — tránh việc một người
    dùng thường đăng ký admin@gmail.com rồi bỗng thành super_admin sau restart."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users WHERE role='super_admin'")
            if cur.fetchone()[0] > 0:
                return   # đã có super_admin rồi, bỏ qua
            cur.execute("SELECT 1 FROM users WHERE LOWER(email)=LOWER(%s)", ('admin@gmail.com',))
            if cur.fetchone():
                print("[DB] CẢNH BÁO: không còn super_admin nào, nhưng email admin@gmail.com "
                      "đã thuộc về người dùng khác — không tự nâng quyền. "
                      "Hãy tạo super_admin thủ công qua /api/admin/super-admins.")
                return
        try:
            uid = int(datetime.now(timezone.utc).timestamp() * 1000)
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO users(id,email,password,name,role,avatar,is_registered,created_at)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,NOW())
                    ON CONFLICT(email) DO NOTHING
                """, (uid, 'admin@gmail.com', hash_password('123456'),
                      'Super Admin', 'super_admin', 'S', True))
            conn.commit()
            print("[DB] Created default super_admin: admin@gmail.com / 123456")
        except Exception as e:
            conn.rollback()
            print(f"[DB] _ensure_super_admin error: {e}")


# ── Super admin ────────────────────────────────────────────────────────────────

def get_super_admins() -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE role='super_admin' ORDER BY id")
            rows = cur.fetchall()
    return [_user_from_row(dict(r)) for r in rows]


def set_super_admin(uid: str, enable: bool) -> Optional[dict]:
    new_role = "super_admin" if enable else "giao_vien"
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE users SET role=%s WHERE id=%s RETURNING *",
                (new_role, int(uid)),
            )
            row = cur.fetchone()
        conn.commit()
    return _user_from_row(dict(row)) if row else None


def is_super_admin(uid: str) -> bool:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM users WHERE id=%s", (int(uid),))
            row = cur.fetchone()
    return row is not None and row[0] == "super_admin"
# ── Exams ──────────────────────────────────────────────────────────────────────

def _exam_from_row(row: dict) -> dict:
    r = dict(row)
    return {
        "id":               r["id"],
        "title":            r["title"] or "",
        "createdBy":        r["created_by"],
        "subject":          r.get("subject"),
        "createdAt":        r["created_at"].isoformat() if r.get("created_at") else None,
        "updatedAt":        r["updated_at"].isoformat() if r.get("updated_at") else None,
        "source":           r["source"] or "",
        "totalQuestions":   r["total_questions"] or 0,
        "sections":         r["sections"] or {},
        "published":        bool(r["published"]),
        "isPublic":         bool(r["is_public"]),
        "featured":         bool(r["featured"]),
        "resultsRevealed":  bool(r["results_revealed"]),
        "settings":         r["settings"],
        "practiceSettings": r["practice_settings"],
        "classes":          r["classes_data"] or [],
    }


def _sub_from_row(row: dict) -> dict:
    r = dict(row)
    return {
        "id":          r["id"],
        "submittedAt": r["submitted_at"].isoformat() if r.get("submitted_at") else None,
        "startedAt":   r["started_at"].isoformat() if r.get("started_at") else None,
        "timeSpent":   r.get("time_spent"),
        "violationCount": r.get("violation_count"),
        "studentName": r["student_name"] or "Ẩn danh",
        "studentId":   r["student_id"],
        "answers":     r["answers"] or {},
        "score":       r["score"],
        "maxScore":    r["max_score"],
        "className":   r["class_name"],
        "classId":     r["class_id"],
        "assignmentId": r.get("assignment_id"),
        "manualScores": r.get("manual_scores") or {},
    }


def get_exam(exam_id: str) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM exams WHERE id=%s", (exam_id,))
            row = cur.fetchone()
    return _exam_from_row(dict(row)) if row else None


def get_submissions(exam_id: str) -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM submissions WHERE exam_id=%s ORDER BY id", (exam_id,))
            rows = cur.fetchall()
    return [_sub_from_row(dict(r)) for r in rows]


def load_exams() -> dict:
    """Load all exams + their submissions (for stats/public listing)."""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM exams")
            erows = cur.fetchall()
            cur.execute("SELECT * FROM submissions")
            srows = cur.fetchall()
    sub_map: dict[str, list] = {}
    for s in srows:
        eid = s["exam_id"]
        sub_map.setdefault(eid, []).append(_sub_from_row(dict(s)))
    result = {}
    for r in erows:
        exam = _exam_from_row(dict(r))
        exam["submissions"] = sub_map.get(exam["id"], [])
        result[exam["id"]] = exam
    return result


def load_exams_meta() -> list:
    """Metadata + submission count per exam (no sections JSONB)."""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT e.id, e.title, e.source, e.total_questions, e.published,
                       e.is_public, e.featured, e.created_by, e.created_at, e.settings,
                       COALESCE(s.cnt, 0) AS submission_count
                FROM exams e
                LEFT JOIN (
                    SELECT exam_id, COUNT(*) AS cnt FROM submissions GROUP BY exam_id
                ) s ON s.exam_id = e.id
                ORDER BY e.created_at DESC NULLS LAST
            """)
            rows = cur.fetchall()
    result = []
    for r in rows:
        rd = dict(r)
        result.append({
            "id":              rd["id"],
            "title":           rd["title"] or "",
            "source":          rd["source"] or "",
            "totalQuestions":  rd["total_questions"] or 0,
            "published":       bool(rd["published"]),
            "isPublic":        bool(rd["is_public"]),
            "featured":        bool(rd["featured"]),
            "createdBy":       rd["created_by"],
            "createdAt":       rd["created_at"].isoformat() if rd.get("created_at") else None,
            "submissionCount": int(rd["submission_count"]),
            "settings": {
                "duration":  (rd["settings"] or {}).get("duration"),
                "openTime":  (rd["settings"] or {}).get("openTime"),
                "closeTime": (rd["settings"] or {}).get("closeTime"),
            },
        })
    return result


def load_exams_by_creator(uid: str) -> list:
    """Đề thi của một giáo viên: đủ metadata cho trang 'Đề thi của tôi'
    (không kèm sections cho nhẹ), kèm số bài nộp."""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT e.id, e.title, e.source, e.total_questions, e.published,
                       e.is_public, e.featured, e.results_revealed, e.created_by,
                       e.subject, e.created_at, e.updated_at, e.settings,
                       e.practice_settings, e.classes_data,
                       COALESCE(s.cnt, 0) AS submission_count
                FROM exams e
                LEFT JOIN (
                    SELECT exam_id, COUNT(*) AS cnt FROM submissions GROUP BY exam_id
                ) s ON s.exam_id = e.id
                WHERE e.created_by = %s
                ORDER BY e.created_at DESC NULLS LAST
            """, (str(uid),))
            rows = cur.fetchall()
    out = []
    for r in rows:
        rd = dict(r)
        out.append({
            "id":               rd["id"],
            "title":            rd["title"] or "",
            "source":           rd["source"] or "",
            "totalQuestions":   rd["total_questions"] or 0,
            "published":        bool(rd["published"]),
            "isPublic":         bool(rd["is_public"]),
            "featured":         bool(rd["featured"]),
            "resultsRevealed":  bool(rd["results_revealed"]),
            "createdBy":        rd["created_by"],
            "subject":          rd.get("subject"),
            "createdAt":        rd["created_at"].isoformat() if rd.get("created_at") else None,
            "updatedAt":        rd["updated_at"].isoformat() if rd.get("updated_at") else None,
            "settings":         rd["settings"],
            "practiceSettings": rd["practice_settings"],
            "classes":          rd["classes_data"] or [],
            "submissionCount":  int(rd["submission_count"]),
        })
    return out


def upsert_exam(exam_id: str, exam: dict) -> None:
    """Save/update one exam. Submissions are preserved (separate table)."""
    exam.pop("submissions", None)
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO exams(id,title,created_by,subject,created_at,updated_at,source,
                    total_questions,sections,published,is_public,featured,
                    results_revealed,settings,practice_settings,classes_data)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(id) DO UPDATE SET
                    title=EXCLUDED.title, created_by=EXCLUDED.created_by,
                    subject=COALESCE(EXCLUDED.subject, exams.subject),
                    updated_at=EXCLUDED.updated_at, source=EXCLUDED.source,
                    total_questions=EXCLUDED.total_questions, sections=EXCLUDED.sections,
                    published=EXCLUDED.published, is_public=EXCLUDED.is_public,
                    featured=EXCLUDED.featured, results_revealed=EXCLUDED.results_revealed,
                    settings=EXCLUDED.settings, practice_settings=EXCLUDED.practice_settings,
                    classes_data=EXCLUDED.classes_data
            """, (
                exam_id, exam.get("title", ""), str(exam.get("createdBy", "")),
                exam.get("subject") or None,
                exam.get("createdAt"), exam.get("updatedAt"), exam.get("source", ""),
                exam.get("totalQuestions", 0),
                json.dumps(exam.get("sections") or {}, ensure_ascii=False),
                bool(exam.get("published", False)), bool(exam.get("isPublic", False)),
                bool(exam.get("featured", False)), bool(exam.get("resultsRevealed", False)),
                json.dumps(exam.get("settings"), ensure_ascii=False) if exam.get("settings") is not None else None,
                json.dumps(exam.get("practiceSettings"), ensure_ascii=False) if exam.get("practiceSettings") is not None else None,
                json.dumps(exam.get("classes") or [], ensure_ascii=False),
            ))
        conn.commit()


def add_submission_guarded(exam_id: str, sub: dict, max_attempts=None, legacy_owner=None):
    """Thêm bài nộp; nếu max_attempts đặt, ĐẾM số lần đã làm trong cùng transaction
    (khóa advisory theo đề+lớp+học sinh) để hai request song song không lách giới hạn.
    Trả về (True, index) khi nhận, (False, số_lần_đã_dùng) khi đã hết lượt."""
    class_id   = sub.get("classId")
    student_id = str(sub.get("studentId", ""))
    asgn_id    = sub.get("assignmentId")
    with _C() as conn:
        try:
            with conn.cursor() as cur:
                if max_attempts and class_id:
                    key = f"submit|{exam_id}|{class_id}|{student_id}"
                    cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 42))", (key,))
                    if asgn_id:
                        # Bài cũ chưa gắn assignment_id tính cho lần giao bài sớm nhất
                        cur.execute("""
                            SELECT COUNT(*) FROM submissions
                            WHERE exam_id=%s AND student_id=%s AND class_id=%s
                              AND (assignment_id=%s OR (assignment_id IS NULL AND %s))
                        """, (exam_id, student_id, str(class_id), str(asgn_id),
                              legacy_owner is not None and str(asgn_id) == str(legacy_owner)))
                    else:
                        cur.execute("""
                            SELECT COUNT(*) FROM submissions
                            WHERE exam_id=%s AND student_id=%s AND class_id=%s
                        """, (exam_id, student_id, str(class_id)))
                    used = cur.fetchone()[0]
                    if used >= int(max_attempts):
                        conn.rollback()
                        return False, used
                cur.execute("""
                    INSERT INTO submissions(exam_id,submitted_at,started_at,time_spent,violation_count,
                        student_name,student_id,answers,score,max_score,class_name,class_id,assignment_id)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
                """, (
                    exam_id, sub.get("submittedAt"),
                    sub.get("startedAt"), sub.get("timeSpent"), sub.get("violationCount"),
                    sub.get("studentName", "Ẩn danh"), student_id,
                    json.dumps(sub.get("answers") or {}, ensure_ascii=False),
                    sub.get("score"), sub.get("maxScore"),
                    sub.get("className"), sub.get("classId"),
                    asgn_id or None,
                ))
                new_id = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM submissions WHERE exam_id=%s AND id<=%s",
                            (exam_id, new_id))
                idx = cur.fetchone()[0] - 1
            conn.commit()
            return True, idx
        except Exception:
            conn.rollback()
            raise


def add_submission(exam_id: str, sub: dict) -> int:
    """Insert a submission, return its 0-based index."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO submissions(exam_id,submitted_at,started_at,time_spent,violation_count,student_name,student_id,
                    answers,score,max_score,class_name,class_id,assignment_id,manual_scores)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                exam_id, sub.get("submittedAt"),
                sub.get("startedAt"), sub.get("timeSpent"), sub.get("violationCount"),
                sub.get("studentName", "Ẩn danh"), str(sub.get("studentId", "")),
                json.dumps(sub.get("answers") or {}, ensure_ascii=False),
                sub.get("score"), sub.get("maxScore"),
                sub.get("className"), sub.get("classId"),
                sub.get("assignmentId") or None,
                json.dumps(sub.get("manualScores") or {}, ensure_ascii=False),
            ))
            new_id = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM submissions WHERE exam_id=%s AND id<=%s",
                (exam_id, new_id),
            )
            idx = cur.fetchone()[0] - 1
        conn.commit()
    return idx


def update_submission_score(sub_id, score, max_score) -> bool:
    """Cập nhật điểm & điểm tối đa của 1 bài nộp (dùng khi chấm lại theo đáp án mới)."""
    try:
        sid = int(sub_id)
    except (TypeError, ValueError):
        return False
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE submissions SET score=%s, max_score=%s WHERE id=%s RETURNING id",
                (score, max_score, sid),
            )
            row = cur.fetchone()
        conn.commit()
    return row is not None


def update_submission_grade(sub_id, manual_scores: dict, score) -> bool:
    """Lưu điểm chấm tay câu tự luận + điểm tổng đã cộng cho 1 bài nộp."""
    try:
        sid = int(sub_id)
    except (TypeError, ValueError):
        return False
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE submissions SET manual_scores=%s, score=%s WHERE id=%s RETURNING id",
                (json.dumps(manual_scores or {}, ensure_ascii=False), score, sid),
            )
            row = cur.fetchone()
        conn.commit()
    return row is not None


def delete_submission(sub_id) -> bool:
    """Xóa 1 bài nộp theo id. Trả về False nếu không tìm thấy."""
    try:
        sid = int(sub_id)
    except (TypeError, ValueError):
        return False
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM submissions WHERE id=%s RETURNING id", (sid,))
            deleted = cur.fetchone()
        conn.commit()
    return deleted is not None


def delete_submissions_for_student(exam_id: str, student_id, class_id=None,
                                   assignment_id=None, include_legacy=True) -> int:
    """Xóa TẤT CẢ bài nộp (mọi lần làm) của một học sinh cho một đề.
    - class_id có giá trị: chỉ xóa bài nộp trong lớp đó.
    - class_id None: chỉ xóa bài nộp qua link công khai (class_id IS NULL).
    - assignment_id có giá trị: chỉ xóa bài nộp của lần giao bài đó;
      include_legacy=True thì gom cả bài nộp cũ chưa gắn assignment_id.
    Trả về số dòng đã xóa."""
    q = "DELETE FROM submissions WHERE exam_id=%s AND student_id=%s"
    params = [exam_id, str(student_id)]
    if class_id:
        q += " AND class_id=%s"
        params.append(str(class_id))
    else:
        q += " AND class_id IS NULL"
    if assignment_id:
        if include_legacy:
            q += " AND (assignment_id=%s OR assignment_id IS NULL)"
        else:
            q += " AND assignment_id=%s"
        params.append(str(assignment_id))
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute(q, params)
            n = cur.rowcount
        conn.commit()
    return n


def update_exam_field(exam_id: str, camel_field: str, value) -> bool:
    """Update one field on an exam. Returns False if not found."""
    _map = {
        "resultsRevealed":  "results_revealed",
        "isPublic":         "is_public",
        "featured":         "featured",
        "published":        "published",
        "practiceSettings": "practice_settings",
        "settings":         "settings",
        "classes":          "classes_data",
    }
    col = _map.get(camel_field, camel_field)
    if col in ("practice_settings", "settings", "classes_data"):
        value = json.dumps(value, ensure_ascii=False)
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE exams SET {col}=%s WHERE id=%s RETURNING id", (value, exam_id))
            found = cur.fetchone() is not None
        conn.commit()
    return found


def delete_exam(exam_id: str) -> bool:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM exams WHERE id=%s RETURNING id", (exam_id,))
            found = cur.fetchone() is not None
        conn.commit()
    if found:
        try:
            strip_exam_assignments(exam_id)
        except Exception as e:
            print(f"[DB] strip_exam_assignments({exam_id}) error: {e}")
    return found


def strip_exam_assignments(exam_id: str) -> int:
    """Gỡ mọi lần giao bài tham chiếu đề exam_id khỏi tất cả lớp (khi xóa đề)
    để học sinh không còn thấy bài tập trỏ vào đề đã mất. Trả về số lớp bị sửa."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE classes SET assignments = COALESCE(
                    (SELECT jsonb_agg(a) FROM jsonb_array_elements(assignments) a
                     WHERE a->>'examId' IS DISTINCT FROM %s), '[]'::jsonb)
                WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(assignments) a
                              WHERE a->>'examId' = %s)
            """, (exam_id, exam_id))
            n = cur.rowcount
        conn.commit()
    return n


# ── Users ──────────────────────────────────────────────────────────────────────

def _user_from_row(row: dict, pwd: bool = False) -> dict:
    r = dict(row)
    d = {
        "id":           r["id"],
        "email":        r["email"],
        "name":         r["name"] or "",
        "role":         r["role"],
        "avatar":       r["avatar"] or "",
        "google_id":    r.get("google_id"),   # ADD THIS
        "grade":        r.get("grade") or None,   # cấp độ (khối lớp) của học sinh
        "isRegistered": bool(r["is_registered"]),
        "createdAt":    r["created_at"].isoformat() if r.get("created_at") else None,
    }
    if pwd:
        d["password"] = r["password"]
    return d

def get_user_by_email(email: str, pwd: bool = False) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE LOWER(email)=LOWER(%s)", (email,))
            row = cur.fetchone()
    return _user_from_row(dict(row), pwd=pwd) if row else None


def get_user_by_id(uid: str, pwd: bool = False) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE id=%s", (int(uid),))
            row = cur.fetchone()
    return _user_from_row(dict(row), pwd=pwd) if row else None


def add_user(user: dict) -> dict:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO users(id,email,password,name,role,avatar,grade,is_registered,created_at)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,NOW()) RETURNING *
            """, (int(user["id"]), user.get("email", ""), user.get("password", ""),
                  user.get("name", ""), user.get("role", "khach"), user.get("avatar", ""),
                  user.get("grade") or None,
                  bool(user.get("isRegistered", False))))
            row = cur.fetchone()
        conn.commit()
    return _user_from_row(dict(row))


def load_users() -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users ORDER BY id")
            rows = cur.fetchall()
    return [_user_from_row(dict(r)) for r in rows]


def update_user_role(uid: str, role: str) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("UPDATE users SET role=%s WHERE id=%s RETURNING *", (role, int(uid)))
            row = cur.fetchone()
        conn.commit()
    return _user_from_row(dict(row)) if row else None


def delete_user(uid: str) -> bool:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id=%s RETURNING id", (int(uid),))
            found = cur.fetchone() is not None
        conn.commit()
    return found


def update_user_password(uid: str, password: str) -> bool:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET password=%s WHERE id=%s RETURNING id", (password, int(uid)))
            found = cur.fetchone() is not None
        conn.commit()
    return found


def search_users(q: str = "", role: str = "", grade: str = "") -> list:
    where, params = [], []
    if role:
        where.append("role=%s")
        params.append(role)
    if grade:
        where.append("grade=%s")
        params.append(grade)
    if q:
        where.append("(LOWER(name) LIKE %s OR LOWER(email) LIKE %s)")
        params += [f"%{q.lower()}%", f"%{q.lower()}%"]
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT * FROM users {clause} ORDER BY name LIMIT 50", params)
            rows = cur.fetchall()
    return [_user_from_row(dict(r)) for r in rows]


# ── Classes ────────────────────────────────────────────────────────────────────

def _cls_from_row(row: dict) -> dict:
    r = dict(row)
    return {
        "id":           r["id"],
        "name":         r["name"] or "",
        "description":  r["description"] or "",
        "teacherId":    r["teacher_id"],
        "teacherName":  r["teacher_name"] or "",
        "createdAt":    r["created_at"].isoformat() if r.get("created_at") else None,
        "joinCode":     r["join_code"],
        "joinPassword": r["join_password"],
        "subject":      r.get("subject") or None,
        "grade":        r.get("grade") or None,
        # subjects[] là danh sách môn của lớp; fallback về [subject] cho lớp cũ.
        "subjects":     (r.get("subjects") or ([r["subject"]] if r.get("subject") else [])),
        "members":      r["members"] or [],
        "assignments":  r["assignments"] or [],
        "documents":    r["documents"] or [],
        "coTeachers":   r.get("co_teachers") or [],
        "schedule":     r.get("schedule") or [],
        "settings":     r.get("settings") or {},
    }


def get_class(cid: str) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes WHERE id=%s", (cid,))
            row = cur.fetchone()
    return _cls_from_row(dict(row)) if row else None


def get_class_by_code(code: str) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes WHERE join_code=%s", (code,))
            row = cur.fetchone()
    return _cls_from_row(dict(row)) if row else None


def list_classes_by_teacher(teacher_id: str) -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM classes WHERE teacher_id=%s ORDER BY created_at DESC",
                (str(teacher_id),),
            )
            rows = cur.fetchall()
    return [_cls_from_row(dict(r)) for r in rows]


def list_all_classes() -> list:
    """Toàn bộ lớp (dùng cho migration/tác vụ nội bộ)."""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes ORDER BY created_at DESC")
            rows = cur.fetchall()
    return [_cls_from_row(dict(r)) for r in rows]


def list_classes_by_teacher_or_coteacher(user_id: str) -> list:
    """Lớp mà user là GIÁO VIÊN CHÍNH hoặc GIÁO VIÊN PHỤ (co-teacher)."""
    uid = str(user_id)
    out = []
    for cls in list_all_classes():
        if str(cls.get("teacherId")) == uid:
            out.append(cls)
            continue
        if any(str(ct.get("userId")) == uid for ct in cls.get("coTeachers") or []):
            out.append(cls)
    return out


def list_classes_by_student(student_id: str, email: str = None) -> list:
    """
    Lớp mà học sinh thuộc về. Khớp theo userId HOẶC email (email là định danh
    ổn định — phòng khi id tài khoản thay đổi). Nếu khớp bằng email nhưng userId
    đã lệch thì TỰ SỬA userId của thành viên về id hiện tại để đồng bộ về sau.
    """
    sid = str(student_id)
    if not email:
        u = get_user_by_id(sid)
        email = (u or {}).get("email")
    em = (email or "").strip().lower()

    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes ORDER BY created_at DESC")
            rows = cur.fetchall()

    out = []
    old_ids = set()
    for r in rows:
        members = r["members"] or []
        matched = healed = False
        for m in members:
            mid = str(m.get("userId"))
            memail = (m.get("email") or "").strip().lower()
            if mid == sid:
                matched = True
            elif em and memail and memail == em:
                matched = True
                if mid != sid:
                    old_ids.add(mid)             # nhớ id cũ để chuyển thông báo
                m["userId"] = student_id          # đồng bộ lại id
                healed = True
        if matched:
            cls = _cls_from_row(dict(r))
            if healed:
                cls["members"] = members
                try:
                    # Chỉ UPDATE cột members của dòng còn tồn tại — không upsert cả
                    # dòng, tránh hồi sinh lớp vừa bị xóa hoặc ghi đè thay đổi khác.
                    update_class_members(cls["id"], members)
                except Exception:
                    pass
            out.append(cls)

    # Chuyển thông báo cũ sang id hiện tại để chuông hiển thị đúng
    for oid in old_ids:
        try:
            retarget_notifs(oid, student_id)
        except Exception:
            pass
    return out


def upsert_class(cid: str, cls: dict) -> None:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO classes(id,name,description,teacher_id,teacher_name,
                    created_at,join_code,join_password,subject,grade,subjects,members,assignments,documents,co_teachers,schedule,settings)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(id) DO UPDATE SET
                    name=EXCLUDED.name, description=EXCLUDED.description,
                    teacher_id=EXCLUDED.teacher_id, teacher_name=EXCLUDED.teacher_name,
                    join_code=EXCLUDED.join_code, join_password=EXCLUDED.join_password,
                    subject=EXCLUDED.subject, grade=EXCLUDED.grade, subjects=EXCLUDED.subjects,
                    members=EXCLUDED.members, assignments=EXCLUDED.assignments,
                    documents=EXCLUDED.documents, co_teachers=EXCLUDED.co_teachers,
                    schedule=EXCLUDED.schedule, settings=EXCLUDED.settings
            """, (
                cid, cls.get("name", ""), cls.get("description", ""),
                str(cls.get("teacherId", "")), cls.get("teacherName", ""),
                cls.get("createdAt"), cls.get("joinCode"), cls.get("joinPassword"),
                cls.get("subject") or None, cls.get("grade") or None,
                json.dumps(cls.get("subjects") or [], ensure_ascii=False),
                json.dumps(cls.get("members") or [], ensure_ascii=False),
                json.dumps(cls.get("assignments") or [], ensure_ascii=False),
                json.dumps(cls.get("documents") or [], ensure_ascii=False),
                json.dumps(cls.get("coTeachers") or [], ensure_ascii=False),
                json.dumps(cls.get("schedule") or [], ensure_ascii=False),
                json.dumps(cls.get("settings") or {}, ensure_ascii=False),
            ))
        conn.commit()


def update_class_atomic(cid: str, mutate) -> Optional[dict]:
    """Đọc lớp với khóa dòng (SELECT ... FOR UPDATE), gọi mutate(cls) sửa tại chỗ,
    rồi ghi lại trong CÙNG transaction — hai request song song không còn ghi đè
    lẫn nhau (vd: hai học sinh nộp bài tập file cùng lúc làm mất một bài).
    mutate trả False → hủy, không ghi. Trả về cls sau mutate, None nếu lớp không tồn tại."""
    with _C() as conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM classes WHERE id=%s FOR UPDATE", (cid,))
                row = cur.fetchone()
                if not row:
                    conn.rollback()
                    return None
                cls = _cls_from_row(dict(row))
                if mutate(cls) is False:
                    conn.rollback()
                    return cls
                cur.execute("""
                    UPDATE classes SET
                        name=%s, description=%s, teacher_id=%s, teacher_name=%s,
                        join_code=%s, join_password=%s, subject=%s, grade=%s, subjects=%s,
                        members=%s, assignments=%s, documents=%s, co_teachers=%s,
                        schedule=%s, settings=%s
                    WHERE id=%s
                """, (
                    cls.get("name", ""), cls.get("description", ""),
                    str(cls.get("teacherId", "")), cls.get("teacherName", ""),
                    cls.get("joinCode"), cls.get("joinPassword"), cls.get("subject") or None,
                    cls.get("grade") or None,
                    json.dumps(cls.get("subjects") or [], ensure_ascii=False),
                    json.dumps(cls.get("members") or [], ensure_ascii=False),
                    json.dumps(cls.get("assignments") or [], ensure_ascii=False),
                    json.dumps(cls.get("documents") or [], ensure_ascii=False),
                    json.dumps(cls.get("coTeachers") or [], ensure_ascii=False),
                    json.dumps(cls.get("schedule") or [], ensure_ascii=False),
                    json.dumps(cls.get("settings") or {}, ensure_ascii=False),
                    cid,
                ))
            conn.commit()
            return cls
        except Exception:
            conn.rollback()
            raise


def update_class_members(cid: str, members: list) -> bool:
    """Chỉ cập nhật danh sách thành viên của một lớp CÒN TỒN TẠI (không insert)."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE classes SET members=%s WHERE id=%s RETURNING id",
                (json.dumps(members or [], ensure_ascii=False), cid),
            )
            found = cur.fetchone() is not None
        conn.commit()
    return found


def delete_class(cid: str) -> bool:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM classes WHERE id=%s RETURNING id", (cid,))
            found = cur.fetchone() is not None
            if found:
                # Dọn thông báo của lớp để học sinh không còn thấy/đi vào lớp đã xóa
                cur.execute("DELETE FROM notifications WHERE class_id=%s", (cid,))
        conn.commit()
    return found


# ── Attendance + Reports ─────────────────────────────────────────────────────

def _attend_session_from_row(row: dict, records: list = None) -> dict:
    r = dict(row)
    return {
        "id":        r["id"],
        "classId":   r["class_id"],
        "className": r["class_name"] or "",
        "date":      r["session_date"].isoformat() if r.get("session_date") else None,
        "openedBy":  r.get("opened_by"),
        "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
        "updatedAt": r["updated_at"].isoformat() if r.get("updated_at") else None,
        "records":   records or [],
    }


def _attend_record_from_row(row: dict) -> dict:
    r = dict(row)
    return {
        "studentId":   r["student_id"],
        "studentName": r["student_name"] or "",
        "status":      r["status"] or "co_mat",
        "note":        r.get("note") or "",
    }


def upsert_attendance_session(session_id: str, cls_id: str, class_name: str,
                               session_date: str, opened_by, records: list) -> dict:
    """Tạo/ghi đè điểm danh 1 buổi (1 lớp/1 ngày, unique theo class_id+session_date).
    Ghi đè: xoá records + report vắng cũ của buổi đó rồi chèn lại theo dữ liệu mới —
    cho phép giáo viên sửa lại điểm danh trong ngày mà không tạo báo cáo trùng."""
    with _C() as conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO attendance_sessions(id,class_id,class_name,session_date,opened_by,updated_at)
                    VALUES(%s,%s,%s,%s,%s,NOW())
                    ON CONFLICT(class_id, session_date) DO UPDATE SET
                        opened_by=EXCLUDED.opened_by, updated_at=NOW()
                    RETURNING *
                """, (session_id, cls_id, class_name, session_date,
                      str(opened_by) if opened_by is not None else None))
                srow = dict(cur.fetchone())
                sid = srow["id"]
                cur.execute("DELETE FROM attendance_records WHERE session_id=%s", (sid,))
                for rec in records:
                    cur.execute("""
                        INSERT INTO attendance_records(session_id,student_id,student_name,status,note)
                        VALUES(%s,%s,%s,%s,%s)
                    """, (sid, str(rec.get("studentId")), rec.get("studentName", ""),
                          rec.get("status") or "co_mat", rec.get("note", "")))
                # Chỉ trạng thái "vắng" (không phép) mới sinh báo cáo — xoá cũ, chèn lại theo dữ liệu mới nhất.
                cur.execute("DELETE FROM reports WHERE type='vang_hoc' AND ref_id=%s", (sid,))
                new_absentees = []
                for rec in records:
                    if (rec.get("status") or "co_mat") != "vang":
                        continue
                    rid = secrets.token_hex(8)
                    student_name = rec.get("studentName", "")
                    cur.execute("""
                        INSERT INTO reports(id,type,class_id,class_name,student_id,student_name,ref_id,title,detail)
                        VALUES(%s,'vang_hoc',%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (type, ref_id, student_id) DO NOTHING
                    """, (rid, cls_id, class_name, str(rec.get("studentId")), student_name, sid,
                          f"Vắng học ngày {session_date}",
                          f"Học sinh {student_name} vắng buổi học ngày {session_date} của lớp {class_name}"))
                    new_absentees.append(student_name)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    out_records = [{"studentId": rec.get("studentId"), "studentName": rec.get("studentName", ""),
                     "status": rec.get("status") or "co_mat", "note": rec.get("note", "")} for rec in records]
    result = _attend_session_from_row(srow, out_records)
    result["newAbsentees"] = new_absentees
    return result


def get_attendance_session(cls_id: str, session_date: str) -> Optional[dict]:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM attendance_sessions WHERE class_id=%s AND session_date=%s",
                        (cls_id, session_date))
            srow = cur.fetchone()
            if not srow:
                return None
            cur.execute("SELECT * FROM attendance_records WHERE session_id=%s ORDER BY id", (srow["id"],))
            rrows = cur.fetchall()
    return _attend_session_from_row(dict(srow), [_attend_record_from_row(dict(r)) for r in rrows])


def list_attendance_sessions(cls_id: str, limit: int = 30) -> list:
    """Lịch sử điểm danh của lớp, mỗi buổi kèm số lượng theo từng trạng thái."""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.*,
                       COUNT(*) FILTER (WHERE r.status='co_mat') AS co_mat_count,
                       COUNT(*) FILTER (WHERE r.status='vang')   AS vang_count,
                       COUNT(*) FILTER (WHERE r.status='tre')    AS tre_count,
                       COUNT(*) FILTER (WHERE r.status='phep')   AS phep_count
                FROM attendance_sessions s
                LEFT JOIN attendance_records r ON r.session_id = s.id
                WHERE s.class_id=%s
                GROUP BY s.id
                ORDER BY s.session_date DESC
                LIMIT %s
            """, (cls_id, limit))
            rows = cur.fetchall()
    out = []
    for r in rows:
        d = dict(r)
        sess = _attend_session_from_row(d)
        sess["counts"] = {"coMat": d["co_mat_count"], "vang": d["vang_count"],
                           "tre": d["tre_count"], "phep": d["phep_count"]}
        out.append(sess)
    return out


def class_attendance_stats(cls_id: str) -> dict:
    """% chuyên cần từng học sinh trong lớp: {studentId: {total,coMat,vang,tre,phep,rate}}."""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT r.student_id,
                       COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE r.status='co_mat') AS co_mat,
                       COUNT(*) FILTER (WHERE r.status='vang')   AS vang,
                       COUNT(*) FILTER (WHERE r.status='tre')    AS tre,
                       COUNT(*) FILTER (WHERE r.status='phep')   AS phep
                FROM attendance_records r
                JOIN attendance_sessions s ON s.id = r.session_id
                WHERE s.class_id=%s
                GROUP BY r.student_id
            """, (cls_id,))
            rows = cur.fetchall()
    out = {}
    for r in rows:
        d = dict(r)
        total = d["total"] or 0
        out[d["student_id"]] = {
            "total": total, "coMat": d["co_mat"], "vang": d["vang"], "tre": d["tre"], "phep": d["phep"],
            "rate": round((d["co_mat"] + d["tre"]) / total * 100, 1) if total else None,
        }
    return out


def get_submissions_for_assignment(cls_id: str, asgn_id: str) -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM submissions WHERE class_id=%s AND assignment_id=%s ORDER BY submitted_at",
                (cls_id, asgn_id),
            )
            rows = cur.fetchall()
    return [_sub_from_row(dict(r)) for r in rows]


def _report_from_row(row: dict) -> dict:
    r = dict(row)
    return {
        "id":          r["id"],
        "type":        r["type"] or "",
        "classId":     r.get("class_id"),
        "className":   r["class_name"] or "",
        "studentId":   r.get("student_id"),
        "studentName": r["student_name"] or "",
        "refId":       r.get("ref_id"),
        "title":       r["title"] or "",
        "detail":      r["detail"] or "",
        "createdAt":   r["created_at"].isoformat() if r.get("created_at") else None,
    }


def add_report(r: dict) -> bool:
    """Ghi 1 dòng báo cáo (bỏ bài/điểm thấp — vắng học dùng upsert_attendance_session).
    Trả True nếu vừa chèn mới, False nếu đã tồn tại (idempotent theo type+refId+studentId)."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO reports(id,type,class_id,class_name,student_id,student_name,ref_id,title,detail)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (type, ref_id, student_id) DO NOTHING
                RETURNING id
            """, (
                r.get("id", ""), r.get("type", ""), r.get("classId"), r.get("className", ""),
                str(r.get("studentId", "")), r.get("studentName", ""), r.get("refId"),
                r.get("title", ""), r.get("detail", ""),
            ))
            inserted = cur.fetchone() is not None
        conn.commit()
    return inserted


def list_reports(type_: str = None, class_id: str = None, limit: int = 50, offset: int = 0) -> dict:
    where, params = [], []
    if type_:
        where.append("type=%s"); params.append(type_)
    if class_id:
        where.append("class_id=%s"); params.append(class_id)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT COUNT(*) AS cnt FROM reports {clause}", params)
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"SELECT * FROM reports {clause} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                params + [limit, offset],
            )
            rows = cur.fetchall()
    return {"rows": [_report_from_row(dict(r)) for r in rows], "total": total}


def update_user(uid: str, fields: dict) -> Optional[dict]:
    """Update arbitrary user fields. Supported keys: name, avatar, role, password, google_id."""
    _map = {
        "name":      "name",
        "avatar":    "avatar",
        "role":      "role",
        "password":  "password",
        "google_id": "google_id",
        "grade":     "grade",
    }
    allowed = {_map[k]: v for k, v in fields.items() if k in _map}
    if not allowed:
        return get_user_by_id(uid)

    set_clause = ", ".join(f"{col}=%s" for col in allowed)
    params = list(allowed.values()) + [int(uid)]

    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"UPDATE users SET {set_clause} WHERE id=%s RETURNING *",
                params,
            )
            row = cur.fetchone()
        conn.commit()
    return _user_from_row(dict(row)) if row else None
# ── Notifications ──────────────────────────────────────────────────────────────

def _notif_from_row(row: dict) -> dict:
    r = dict(row)
    return {
        "id":           r["id"],
        "type":         r["type"] or "",
        "targetUserId": r["target_user_id"],
        "classId":      r["class_id"],
        "className":    r["class_name"] or "",
        "assignmentId": r["assignment_id"] or "",
        "title":        r["title"] or "",
        "message":      r["message"] or "",
        "createdAt":    r["created_at"].isoformat() if r.get("created_at") else None,
        "read":         bool(r["read"]),
    }


def get_notifs_for_user(uid: str, limit: int = 50) -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM notifications WHERE target_user_id=%s ORDER BY created_at DESC LIMIT %s",
                (str(uid), limit),
            )
            rows = cur.fetchall()
    return [_notif_from_row(dict(r)) for r in rows]


def add_notif(n: dict) -> None:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO notifications(id,type,target_user_id,class_id,class_name,
                    assignment_id,title,message,created_at,read)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING
            """, (
                n.get("id", ""), n.get("type", ""), str(n.get("targetUserId", "")),
                n.get("classId"), n.get("className", ""), n.get("assignmentId", ""),
                n.get("title", ""), n.get("message", ""), n.get("createdAt"),
                bool(n.get("read", False)),
            ))
        conn.commit()


def mark_notif_read(nid: str) -> None:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE notifications SET read=TRUE WHERE id=%s", (nid,))
        conn.commit()


def mark_all_notifs_read(uid: str) -> None:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE notifications SET read=TRUE WHERE target_user_id=%s", (str(uid),))
        conn.commit()


def retarget_notifs(old_uid: str, new_uid: str) -> None:
    """Chuyển thông báo từ id cũ sang id mới (khi học sinh bị lệch id, đã đồng bộ lại)."""
    if str(old_uid) == str(new_uid):
        return
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notifications SET target_user_id=%s WHERE target_user_id=%s",
                (str(new_uid), str(old_uid)),
            )
        conn.commit()


# ── Admin config ───────────────────────────────────────────────────────────────

def load_config() -> dict:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT key, value FROM admin_config")
            rows = cur.fetchall()
    return {r["key"]: r["value"] for r in rows}


def save_config(cfg: dict) -> None:
    with _C() as conn:
        with conn.cursor() as cur:
            for k, v in cfg.items():
                cur.execute("""
                    INSERT INTO admin_config(key,value) VALUES(%s,%s)
                    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value
                """, (k, json.dumps(v, ensure_ascii=False)))
        conn.commit()
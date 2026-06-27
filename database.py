"""
database.py — PostgreSQL storage.

Connection: DATABASE_URL env var
Default: postgresql://hoc_toan:hoc_toan123@localhost:5433/hoc_toan
Migrates existing JSON files on first run (only if tables are empty).
"""

import json
import os
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

CREATE TABLE IF NOT EXISTS classes (
    id            VARCHAR(50)  PRIMARY KEY,
    name          VARCHAR(255) DEFAULT '',
    description   TEXT         DEFAULT '',
    teacher_id    VARCHAR(100),
    teacher_name  VARCHAR(255) DEFAULT '',
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    join_code     VARCHAR(20),
    join_password VARCHAR(255),
    members       JSONB        DEFAULT '[]',
    assignments   JSONB        DEFAULT '[]',
    documents     JSONB        DEFAULT '[]'
);

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
            cur.execute(_DDL)
        conn.commit()
    _migrate_users()
    _migrate_exams()
    _migrate_classes()
    _migrate_notifs()
    _migrate_config()
    _ensure_super_admin() 


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
    """Tạo tài khoản super_admin mặc định nếu chưa có ai có role này."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users WHERE role='super_admin'")
            if cur.fetchone()[0] > 0:
                return   # đã có super_admin rồi, bỏ qua
        try:
            uid = int(datetime.now(timezone.utc).timestamp() * 1000)
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO users(id,email,password,name,role,avatar,is_registered,created_at)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,NOW())
                    ON CONFLICT(email) DO UPDATE SET role='super_admin'
                """, (uid, 'admin@gmail.com', '123456', 'Super Admin', 'super_admin', 'S', True))
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
        "submittedAt": r["submitted_at"].isoformat() if r.get("submitted_at") else None,
        "studentName": r["student_name"] or "Ẩn danh",
        "studentId":   r["student_id"],
        "answers":     r["answers"] or {},
        "score":       r["score"],
        "maxScore":    r["max_score"],
        "className":   r["class_name"],
        "classId":     r["class_id"],
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


def upsert_exam(exam_id: str, exam: dict) -> None:
    """Save/update one exam. Submissions are preserved (separate table)."""
    exam.pop("submissions", None)
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO exams(id,title,created_by,created_at,updated_at,source,
                    total_questions,sections,published,is_public,featured,
                    results_revealed,settings,practice_settings,classes_data)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(id) DO UPDATE SET
                    title=EXCLUDED.title, created_by=EXCLUDED.created_by,
                    updated_at=EXCLUDED.updated_at, source=EXCLUDED.source,
                    total_questions=EXCLUDED.total_questions, sections=EXCLUDED.sections,
                    published=EXCLUDED.published, is_public=EXCLUDED.is_public,
                    featured=EXCLUDED.featured, results_revealed=EXCLUDED.results_revealed,
                    settings=EXCLUDED.settings, practice_settings=EXCLUDED.practice_settings,
                    classes_data=EXCLUDED.classes_data
            """, (
                exam_id, exam.get("title", ""), str(exam.get("createdBy", "")),
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


def add_submission(exam_id: str, sub: dict) -> int:
    """Insert a submission, return its 0-based index."""
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO submissions(exam_id,submitted_at,student_name,student_id,
                    answers,score,max_score,class_name,class_id)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                exam_id, sub.get("submittedAt"),
                sub.get("studentName", "Ẩn danh"), str(sub.get("studentId", "")),
                json.dumps(sub.get("answers") or {}, ensure_ascii=False),
                sub.get("score"), sub.get("maxScore"),
                sub.get("className"), sub.get("classId"),
            ))
            new_id = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM submissions WHERE exam_id=%s AND id<=%s",
                (exam_id, new_id),
            )
            idx = cur.fetchone()[0] - 1
        conn.commit()
    return idx


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
    return found


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
                INSERT INTO users(id,email,password,name,role,avatar,is_registered,created_at)
                VALUES(%s,%s,%s,%s,%s,%s,%s,NOW()) RETURNING *
            """, (int(user["id"]), user.get("email", ""), user.get("password", ""),
                  user.get("name", ""), user.get("role", "khach"), user.get("avatar", ""),
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


def search_users(q: str = "", role: str = "") -> list:
    where, params = [], []
    if role:
        where.append("role=%s")
        params.append(role)
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
        "members":      r["members"] or [],
        "assignments":  r["assignments"] or [],
        "documents":    r["documents"] or [],
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


def list_classes_by_student(student_id: str) -> list:
    with _C() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes ORDER BY created_at DESC")
            rows = cur.fetchall()
    sid = str(student_id)
    return [
        _cls_from_row(dict(r)) for r in rows
        if any(str(m.get("userId")) == sid for m in (r["members"] or []))
    ]


def upsert_class(cid: str, cls: dict) -> None:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO classes(id,name,description,teacher_id,teacher_name,
                    created_at,join_code,join_password,members,assignments,documents)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(id) DO UPDATE SET
                    name=EXCLUDED.name, description=EXCLUDED.description,
                    teacher_id=EXCLUDED.teacher_id, teacher_name=EXCLUDED.teacher_name,
                    join_code=EXCLUDED.join_code, join_password=EXCLUDED.join_password,
                    members=EXCLUDED.members, assignments=EXCLUDED.assignments,
                    documents=EXCLUDED.documents
            """, (
                cid, cls.get("name", ""), cls.get("description", ""),
                str(cls.get("teacherId", "")), cls.get("teacherName", ""),
                cls.get("createdAt"), cls.get("joinCode"), cls.get("joinPassword"),
                json.dumps(cls.get("members") or [], ensure_ascii=False),
                json.dumps(cls.get("assignments") or [], ensure_ascii=False),
                json.dumps(cls.get("documents") or [], ensure_ascii=False),
            ))
        conn.commit()


def delete_class(cid: str) -> bool:
    with _C() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM classes WHERE id=%s RETURNING id", (cid,))
            found = cur.fetchone() is not None
        conn.commit()
    return found

def update_user(uid: str, fields: dict) -> Optional[dict]:
    """Update arbitrary user fields. Supported keys: name, avatar, role, password, google_id."""
    _map = {
        "name":      "name",
        "avatar":    "avatar",
        "role":      "role",
        "password":  "password",
        "google_id": "google_id",
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
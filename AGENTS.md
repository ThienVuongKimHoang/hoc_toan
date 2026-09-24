# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

**Trung tâm Ánh Sáng** — a full-stack web app for a Vietnamese tutoring center (luyện thi THPT / IELTS). Core capability: a teacher uploads an exam **PDF → questions are extracted by Groq Vision (LLM) → served as an online exam**. Students take exams, get auto-graded, join classes, and receive assignments. There is also a CMS-driven public landing page, an IELTS-writing grader, and misc tools (exercise solver, 3D geometry viewer).

Language: code comments, UI, and domain terms are in **Vietnamese**. Keep that convention.

## Stack

- **Backend**: FastAPI (Python 3.11), single big module `api.py` (~2600 lines, ~90 routes). Persistence via `database.py` on **PostgreSQL 16** (psycopg2 pool). LLM via **Groq** SDK (Vision + text). Auth via **Google OAuth** + email/password. PDF parsing via PyMuPDF (`fitz`).
- **Frontend**: React 18 + **Vite 6**, plain JS (no TypeScript), **no router library** — custom hash-based routing. Math rendering via KaTeX / react-katex.
- **No test suite** is configured (no pytest/vitest/jest). Do not assume `npm test` exists.

## Commands

Run from the repo root unless noted.

```bash
# Full stack (postgres + backend :8000 + frontend :3000)
docker compose up --build

# Backend dev (needs Postgres running + .env with Groq keys)
export DATABASE_URL=postgresql://hoc_toan:hoc_toan123@localhost:5432/hoc_toan
uvicorn api:app --reload --port 8000

# Frontend dev (Vite on :5173, proxies /api,/images,/class-docs,/uploads → :8000)
cd frontend && npm install && npm run dev

# Frontend production build / preview
cd frontend && npm run build        # outputs to frontend/dist
cd frontend && npm run preview

# Run the PDF extraction pipeline standalone (outside the API)
python3 src/extract_questions.py --pdf path/to/exam.pdf --out output.json
```

`.env` (repo root) holds `GROQ_API_KEY` plus `GROQ_API_KEY_FALLBACK*` (rotated on rate-limit) and `OPENAI_API_KEY`. The frontend dev server **requires the backend up** because `vite.config.js` proxies API calls to `:8000`.

## Backend architecture

- **`api.py`** — the entire API in one file. On startup it inserts `src/` onto `sys.path` and imports the extraction pipeline. All DB access goes through `database.py`; `api.py` holds no SQL. Route families (prefix `/api`):
  - `auth/*` — Google + email/password login, register, `auth/me`.
  - `extract`, `progress/{task_id}`, `result/{task_id}` — **PDF→questions is async**: POST a PDF, poll/stream progress by task id, then fetch the result. Also `generate-questions`, `classify-question`, `solve-exercise`, `questions/bank`.
  - `exams/*` — CRUD, submit, grade, reveal/hide results, toggle public, practice settings/verify.
  - `classes/*` — classes, members, join-by-code, assignments, submissions, grades-summary, class documents.
  - `admin/*` — users, roles, super-admins, exams, config, server stats (psutil).
  - `site-content` / `site-register` — the homepage CMS content and the landing-page lead form.
  - `notifications/*`.
  - `GET /{full_path:path}` — SPA fallback that serves the built frontend.
- **`database.py`** — `ThreadedConnectionPool`; `init_db()` creates tables and runs idempotent `_migrate_*` steps. Tables: **users, exams, submissions, classes, notifications, admin_config**. Password hashing + `verify_password`; `_ensure_super_admin()` guarantees a super admin exists. The root `*.json` files (`exams.json`, `users.json`, `classes.json`, `notifications.json`) are the legacy pre-Postgres store that migrations import from — treat Postgres as the source of truth.
- **`src/`** — the extraction pipeline. `extract_questions.py` encodes the **Vietnamese THPT exam structure**: PHẦN I (12 multiple-choice, 0.25đ), PHẦN II (4 true/false groups a–d), PHẦN III (6 short-answer). `extract_english.py` handles English/reading exams; `pdf_filter.py` pre-filters PDFs. `ielts_grading.py` grades IELTS writing. Runtime artifacts land in `src/output/` and `class_docs/` / `uploads/` (mounted as Docker volumes).

## Frontend architecture

- Entry `src/main.jsx` → `src/App.jsx`. **Routing is hash-based** via `parseHash()` in `App.jsx` (no react-router). App state is `view` + `examId/classId/assignmentId/openClassId`, kept in sync with `window.location.hash` on `hashchange`. Examples: `#take/<examId>/<classId>/<assignmentId>`, `#lobby/<examId>`, `#practice/<id>`, `#results/<id>`, `#classes`, `#my-classes`, `#admin`, `#tools/solver`, `#tools/geo3d`.
- `src/pages/` — one component per view (HomePage, LoginPage, ExamTakePage, ExamLobbyPage, CreateExamPage, ClassManagementPage, MyClassesPage, SuperAdminPage, StudyPage, …).
- `src/store/` — thin `fetch` wrappers around the API (`classStore`, `examStore`, `notificationStore`). Note `examStore` still has some `localStorage` helpers; the server is authoritative.
- `src/auth/mockUsers.js` — `ROLES` + `ROLE_META` and the client session. **Roles are Vietnamese strings**: `khach` (guest), `hoc_sinh` (student), `giao_vien` (teacher), `admin`, `super_admin`; admin-level = `admin || super_admin`. The logged-in user is persisted in `localStorage` (`USER_KEY` in App.jsx) and gates views in `App.jsx` via `AccessDenied`.
- Math is rendered through `components/MathText.jsx` (react-katex). KaTeX fonts are bundled by Vite.

## Data model note

An exam is `{ id, title, createdBy, sections[], submissions[], settings, practiceSettings, published, isPublic, resultsRevealed, ... }` where `sections` hold the questions in the PHẦN I/II/III structure above. This shape is shared between the extraction pipeline output, the DB row (`database.py` `_exam_from_row`), and the frontend — keep the three in sync when changing it.

## Conventions & gotchas

- **HomePage** (`frontend/src/pages/HomePage.jsx`) is a self-contained CMS landing page: all copy/images/prices come from `GET /api/site-content` (edited by super admin in `SiteContentTab.jsx`). Its visual theme is the **"Academic Navy + Gold"** design system, driven by the `C` design-token object at the top of the file — change colors there, not scattered hex values. Icons are inline SVG (no emoji-as-icon).
- The site logo is `frontend/public/img/logo.png`, served at `/img/logo.png` and used in `Header.jsx` and `LoginPage.jsx`.
- Groq requests rotate through the fallback API keys on rate-limit; keep that behavior when touching `load_api_keys` / `src/extract_questions.py`.

"""
Vẽ hình không gian bằng AI (trang #tools/geo3d).

Học sinh khối 11-12 đưa ảnh đề bài hoặc gõ đề bài, Groq Vision trả về "cảnh" JSON,
frontend Geo3DViewer vẽ ra hình 3D xoay được.

Module này chỉ chứa LOGIC THUẦN — dựng prompt và kiểm tra cảnh trả về. Không tự tạo
Groq client (api.py truyền client đã xoay vòng key vào), không đụng database. Nhờ vậy
`validate_geo3d_scene` nạp được trong vài chục ms và test được bằng một script rời,
đúng theo cách vocab_ai.py và ielts_grading.py đang làm.

Định dạng cảnh là hợp đồng dùng chung với renderScene() trong
frontend/src/components/Geo3DViewer.jsx — sửa bên nào cũng phải sửa bên kia.
Bản kiểm tra song song phía trình duyệt nằm ở frontend/src/utils/geo3dScene.js.
"""
from __future__ import annotations

import math
import re

GEO3D_MAX_IMAGE_BYTES = 8 * 1024 * 1024   # 8 MB; base64 hoá lên ~11 MB khi gửi Groq

# Gọi lại Groq đúng MỘT lần khi cảnh trả về không hợp lệ, kèm cảnh báo làm gợi ý sửa.
GEO3D_RETRY_ON_INVALID = True

# ── Giới hạn: vừa chặn model "phát điên", vừa giữ canvas còn vẽ kịp ──
MAX_POINTS    = 40
MAX_MIDPOINTS = 20
MAX_SEGMENTS  = 80
MAX_FACES     = 12
MAX_VECTORS   = 20
MAX_LABELS    = 40
MAX_ID_LEN    = 8
MAX_LABEL_LEN = 40
MAX_COORD     = 1000.0    # toạ độ hợp lý là ±10; 1000 chỉ để chặn rác
MIN_EXTENT    = 1e-6      # bé hơn nữa thì bb.range sụp về 0.1 và hình văng khỏi khung

_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

_DEFAULT_FACE_STYLE = {
    "fill": "#74c0fc", "opacity": 0.3, "stroke": "#1971c2", "strokeWidth": 1.5,
}

SCENE_KEYS = ("points", "segments", "midpoints", "faces", "vectors", "labels")


def empty_scene() -> dict:
    """Cảnh rỗng đủ sáu khoá — frontend khỏi phải `|| []` ở mọi chỗ."""
    return {k: [] for k in SCENE_KEYS}


# ────────────────────────────── Prompt ──────────────────────────────

# Ví dụ few-shot lấy nguyên từ PRESETS[2] "Thiết diện S-G-B" trong Geo3DViewer.jsx.
# Chọn preset này vì nó là mẫu giàu nhất: dùng cả midpoint, mặt tô màu, cạnh nhấn và
# nhãn đặt tay trong cùng một object. Sáu preset cũ đã bỏ khỏi giao diện nhưng giữ lại
# ở đây làm ví dụ dạy model.
_FEW_SHOT = """{
  "scene": {
    "points": [
      {"id":"A","x":-1,"y":0,"z":-1}, {"id":"B","x":1,"y":0,"z":-1},
      {"id":"C","x":1,"y":0,"z":1},   {"id":"D","x":-1,"y":0,"z":1},
      {"id":"S","x":0,"y":2.5,"z":0}
    ],
    "segments": [
      {"from":"A","to":"B"}, {"from":"B","to":"C"},
      {"from":"C","to":"D","dashed":true}, {"from":"D","to":"A","dashed":true},
      {"from":"S","to":"A"}, {"from":"S","to":"B"}, {"from":"S","to":"C"},
      {"from":"S","to":"D","dashed":true},
      {"from":"S","to":"G","highlight":true}, {"from":"G","to":"B","highlight":true}
    ],
    "midpoints": [{"id":"G","of":["A","D"]}],
    "faces": [{"id":"td","points":["S","G","B"],
               "style":{"fill":"#4dabf7","opacity":0.35,"stroke":"#1971c2"}}],
    "vectors": [],
    "labels": [{"point":"G","text":"G"}]
  },
  "note": "Hình chóp S.ABCD đáy hình vuông, thiết diện qua S, G, B."
}"""


def build_geo3d_prompt(prompt_text: str, has_image: bool, retry_hint: str = "") -> str:
    """Dựng prompt cho Groq Vision.

    `retry_hint`: khi cảnh lần đầu không qua được validate_geo3d_scene, nhét các cảnh
    báo vào đây rồi gọi lại một lần — rẻ và nâng tỉ lệ thành công rõ rệt với model 17B.
    """
    source = (
        "Đọc HÌNH ẢNH đề bài đính kèm" if has_image
        else "Đọc đề bài bằng chữ dưới đây"
    )
    extra = (prompt_text or "").strip()
    de_bai = f"\nĐỀ BÀI:\n{extra}\n" if extra else "\n"

    hint = ""
    if retry_hint:
        hint = (
            "\n\nLẦN TRƯỚC BẠN TRẢ VỀ CẢNH KHÔNG HỢP LỆ. Sửa đúng những lỗi sau:\n"
            + retry_hint
        )

    return f"""Bạn là giáo viên Toán THPT Việt Nam, chuyên dựng hình không gian.
{source} rồi dựng lại hình đó dưới dạng JSON để máy vẽ ra hình 3D.
{de_bai}
CHỈ trả về JSON thuần, không kèm giải thích, không bọc trong dấu ``` :
{{"scene": {{...}}, "note": "<một câu tiếng Việt mô tả hình>"}}

"scene" gồm đúng sáu mảng sau:
- "points"    — id, x, y, z, color?, size?
- "segments"  — from, to, dashed?, highlight?, color?, width?
- "midpoints" — id, of: ["A","B"]   (trung điểm, KHÔNG khai lại trong "points")
- "faces"     — id, points: ["A","B","C"], style: {{fill, opacity, stroke}}
- "vectors"   — from, to, color?, label?
- "labels"    — point, text?, dx?, dy?, color?, size?

QUY ƯỚC TRỤC — RẤT QUAN TRỌNG:
x = ngang, y = CAO (hướng LÊN TRÊN), z = sâu.
Mặt đáy nằm ngang thì mọi đỉnh đáy có CÙNG một giá trị y (thường y = 0), còn đỉnh
trên có y > 0. Ví dụ: hình chóp S.ABCD có A, B, C, D đều ở y = 0 và S ở y = 2.5.
ĐỪNG dùng z làm trục cao — ở đây z là chiều sâu.

BẮT BUỘC:
- Mọi "text" và "label" là CHỮ THUẦN. Tuyệt đối KHÔNG dùng LaTeX, không ký hiệu $.
  Viết "AB = a căn 2", không viết "$AB = a\\sqrt{{2}}$".
- Cạnh bị hình che khuất khi nhìn từ phía trước-chếch phải: đặt "dashed": true.
- Mọi id trong from/to/of/faces.points PHẢI có trong "points" hoặc "midpoints".
- id ngắn gọn, tối đa {MAX_ID_LEN} ký tự: A, B, S, M, A'. Không trùng nhau.
- Toạ độ là số thực trong khoảng -10 đến 10. Đặt hình cân đối quanh gốc.
- Tối đa {MAX_POINTS} điểm, {MAX_SEGMENTS} đoạn thẳng, {MAX_FACES} mặt.
- Màu ghi dạng #rrggbb.
- Khối chuẩn (chóp, lăng trụ, hộp) thì đặt ở toạ độ đẹp, đừng tính toán phức tạp.
- Nếu đề yêu cầu thiết diện hoặc mặt phẳng cắt: cho vào "faces" và tô màu nhạt.

Nếu đề bài KHÔNG phải hình không gian hoặc thiếu dữ kiện để dựng, trả về:
{{"scene": null, "note": "<lý do ngắn gọn bằng tiếng Việt>"}}

VÍ DỤ một kết quả đúng:
{_FEW_SHOT}{hint}"""


# ──────────────────────── Kiểm tra cảnh trả về ────────────────────────

def _finite_num(v):
    """Số thực dùng được cho canvas, hoặc None.

    Chặn ba thứ hay làm hỏng hình:
    - bool: trong Python `isinstance(True, int)` là True, nên True sẽ lọt thành 1.
    - NaN / vô cực: lọt vào bb thì range thành NaN và canvas TRẮNG TRƠN, không báo gì.
    - số khổng lồ: hình co về một chấm.
    """
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
    elif isinstance(v, str):
        try:
            f = float(v.strip())
        except (ValueError, AttributeError):
            return None
    else:
        return None
    if not math.isfinite(f) or abs(f) > MAX_COORD:
        return None
    return f


def _clean_id(v):
    if not isinstance(v, str):
        return None
    s = v.strip()
    if not s or len(s) > MAX_ID_LEN:
        return None
    return s


def _color(v, fallback):
    return v if isinstance(v, str) and _HEX_COLOR_RE.match(v) else fallback


def _as_list(raw, key, warns):
    v = raw.get(key)
    if v is None:
        return []
    if not isinstance(v, list):
        warns.append(f'"{key}" không phải danh sách — đã bỏ qua.')
        return []
    return v


def _cap(items, limit, key, warns):
    if len(items) > limit:
        warns.append(f'"{key}" có {len(items)} phần tử, chỉ giữ {limit} phần tử đầu.')
        return items[:limit]
    return items


def validate_geo3d_scene(raw):
    """Làm sạch cảnh do AI trả về → (scene, warnings). Ném ValueError nếu không còn gì vẽ.

    Thay cho hai dòng kiểm tra quá lỏng của /api/solve-exercise. Mỗi luật ở đây ứng với
    một cách hỏng THẬT của renderScene: id không tồn tại thì cạnh biến mất im lặng,
    toạ độ NaN thì canvas trắng, mặt dưới 3 điểm thì bị bỏ qua không báo.
    """
    warns: list[str] = []

    # Model hay phân vân giữa {"scene": {...}} và cảnh trần — nhận cả hai.
    if isinstance(raw, dict) and isinstance(raw.get("scene"), dict):
        raw = raw["scene"]
    if not isinstance(raw, dict):
        raise ValueError("AI không trả về dữ liệu hình.")

    out = empty_scene()

    # ── points ──
    seen_ids: set[str] = set()
    for p in _cap(_as_list(raw, "points", warns), MAX_POINTS, "points", warns):
        if not isinstance(p, dict):
            continue
        pid = _clean_id(p.get("id"))
        if not pid:
            continue
        if pid in seen_ids:
            warns.append(f'Điểm "{pid}" bị khai trùng — chỉ giữ lần đầu.')
            continue
        x, y, z = _finite_num(p.get("x")), _finite_num(p.get("y")), _finite_num(p.get("z"))
        if x is None or y is None or z is None:
            warns.append(f'Điểm "{pid}" có toạ độ không hợp lệ — đã bỏ.')
            continue
        pt = {"id": pid, "x": x, "y": y, "z": z}
        if _color(p.get("color"), None):
            pt["color"] = p["color"]
        size = _finite_num(p.get("size"))
        if size is not None:
            pt["size"] = max(1.0, min(size, 20.0))
        out["points"].append(pt)
        seen_ids.add(pid)

    # ── midpoints ──
    # Giải theo ĐÚNG thứ tự khai báo và bỏ tham chiếu tiến, khớp cách ptMap duyệt mảng
    # bên Geo3DViewer.jsx — nếu ở đây sắp xếp topo thì backend và frontend lệch nhau.
    known = set(seen_ids)
    for mp in _cap(_as_list(raw, "midpoints", warns), MAX_MIDPOINTS, "midpoints", warns):
        if not isinstance(mp, dict):
            continue
        mid = _clean_id(mp.get("id"))
        if not mid:
            continue
        if mid in known:
            warns.append(f'Trung điểm "{mid}" trùng tên với điểm đã có — đã bỏ.')
            continue
        of = mp.get("of")
        if not isinstance(of, list) or len(of) != 2:
            warns.append(f'Trung điểm "{mid}" thiếu cặp điểm gốc — đã bỏ.')
            continue
        a, b = _clean_id(of[0]), _clean_id(of[1])
        if not a or not b or a not in known or b not in known:
            missing = [str(v) for v in (of[0], of[1]) if _clean_id(v) not in known]
            warns.append(f'Trung điểm "{mid}" trỏ tới điểm chưa có: {", ".join(missing)} — đã bỏ.')
            continue
        out["midpoints"].append({"id": mid, "of": [a, b]})
        known.add(mid)

    # ── segments / vectors ──
    def _pair_list(key, limit, extra):
        for it in _cap(_as_list(raw, key, warns), limit, key, warns):
            if not isinstance(it, dict):
                continue
            a, b = _clean_id(it.get("from")), _clean_id(it.get("to"))
            miss = [str(it.get(k)) for k, v in (("from", a), ("to", b)) if not v or v not in known]
            if miss:
                warns.append(f'Bỏ 1 phần tử "{key}" trỏ tới điểm không tồn tại: {", ".join(miss)}.')
                continue
            if a == b:
                warns.append(f'Bỏ 1 phần tử "{key}" có hai đầu trùng nhau ("{a}").')
                continue
            out[key].append(extra(it, a, b))

    def _seg(it, a, b):
        s = {"from": a, "to": b}
        if it.get("dashed"):
            s["dashed"] = True
        if it.get("highlight"):
            s["highlight"] = True
        if _color(it.get("color"), None):
            s["color"] = it["color"]
        w = _finite_num(it.get("width"))
        if w is not None:
            s["width"] = max(0.5, min(w, 8.0))
        return s

    def _vec(it, a, b):
        v = {"from": a, "to": b}
        if _color(it.get("color"), None):
            v["color"] = it["color"]
        if it.get("label") is not None:
            v["label"] = str(it["label"]).replace("$", "").strip()[:MAX_LABEL_LEN]
        return v

    _pair_list("segments", MAX_SEGMENTS, _seg)
    _pair_list("vectors", MAX_VECTORS, _vec)

    # ── faces ──
    for f in _cap(_as_list(raw, "faces", warns), MAX_FACES, "faces", warns):
        if not isinstance(f, dict):
            continue
        pts_raw = f.get("points")
        if not isinstance(pts_raw, list):
            continue
        pts, missing = [], []
        for v in pts_raw:
            cid = _clean_id(v)
            if not cid or cid not in known:
                missing.append(str(v))
                continue
            if not pts or pts[-1] != cid:   # bỏ lặp liền kề
                pts.append(cid)
        if missing:
            # Không âm thầm hạ tứ giác xuống tam giác — bỏ hẳn mặt và nói rõ.
            warns.append(f'Bỏ 1 mặt vì trỏ tới điểm không tồn tại: {", ".join(missing)}.')
            continue
        if len(pts) < 3:
            warns.append("Bỏ 1 mặt vì có dưới 3 điểm.")
            continue
        st = f.get("style") if isinstance(f.get("style"), dict) else {}
        op = _finite_num(st.get("opacity"))
        sw = _finite_num(st.get("strokeWidth"))
        out["faces"].append({
            "id": _clean_id(f.get("id")) or f"f{len(out['faces']) + 1}",
            "points": pts,
            "style": {
                "fill":        _color(st.get("fill"), _DEFAULT_FACE_STYLE["fill"]),
                "opacity":     _DEFAULT_FACE_STYLE["opacity"] if op is None else max(0.0, min(op, 1.0)),
                "stroke":      _color(st.get("stroke"), _DEFAULT_FACE_STYLE["stroke"]),
                "strokeWidth": _DEFAULT_FACE_STYLE["strokeWidth"] if sw is None else max(0.5, min(sw, 8.0)),
            },
        })

    # ── labels ──
    for l in _cap(_as_list(raw, "labels", warns), MAX_LABELS, "labels", warns):
        if not isinstance(l, dict):
            continue
        # renderScene chấp nhận cả `id` lẫn `point` — chuẩn hoá về `point`.
        target = _clean_id(l.get("point")) or _clean_id(l.get("id"))
        if not target or target not in known:
            warns.append(f'Bỏ 1 nhãn trỏ tới điểm không tồn tại: {l.get("point") or l.get("id")}.')
            continue
        item = {"point": target}
        if l.get("text") is not None:
            # Cắt ký tự $ để LaTeX không lọt ra canvas (canvas vẽ bằng fillText).
            item["text"] = str(l["text"]).replace("$", "").strip()[:MAX_LABEL_LEN]
        for k in ("dx", "dy"):
            v = _finite_num(l.get(k))
            if v is not None:
                item[k] = max(-200.0, min(v, 200.0))
        size = _finite_num(l.get("size"))
        if size is not None:
            item["size"] = max(8.0, min(size, 32.0))
        if _color(l.get("color"), None):
            item["color"] = l["color"]
        out["labels"].append(item)

    # ── Cổng chặn cuối ──
    # Thiếu những thứ này thì học sinh nhận một khung xám và tưởng app hỏng.
    if len(out["points"]) < 2:
        raise ValueError("Hình không có đủ điểm để vẽ.")
    if not out["segments"] and not out["faces"]:
        raise ValueError("Hình không có cạnh hoặc mặt nào để vẽ.")

    # Mọi điểm chồng lên nhau: bb.range sụp về 0.1 và tỉ lệ vẽ văng khỏi khung.
    xs = [p["x"] for p in out["points"]]
    ys = [p["y"] for p in out["points"]]
    zs = [p["z"] for p in out["points"]]
    if max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)) < MIN_EXTENT:
        raise ValueError("Các điểm của hình trùng nhau nên không vẽ được.")

    return out, warns

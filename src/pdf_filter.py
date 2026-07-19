"""
Lọc hình ảnh trong PDF bình thường (có text đọc được):
- Trích text từng trang bằng PyMuPDF
- Với mỗi ảnh nhúng: GROQ Vision tóm tắt + đánh giá liên quan đến text xung quanh
- Loại bỏ ảnh không liên quan (logo, trang trí, watermark...)

Chạy:
  python3 pdf_filter.py --pdf path/to/file.pdf --out output/
  python3 pdf_filter.py --pdf file.pdf --threshold 0.4  # ngưỡng relevance (0-1)
"""

import base64
import json
import os
import re
import sys
import time
import argparse
from pathlib import Path

import fitz  # PyMuPDF
from groq import Groq
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).parent.parent
VISION_MODEL = "qwen/qwen3.6-27b"  # llama-4-scout bị Groq khai tử 17/07/2026
TEXT_MODEL   = "llama-3.3-70b-versatile"   # model text-only nhanh hơn, tiết kiệm token
IMAGE_DPI    = 150   # DPI render ảnh nhúng (đủ để nhận dạng nội dung)
CONTEXT_CHARS = 800  # số ký tự text xung quanh ảnh để đánh giá relevance
DEFAULT_THRESHOLD = 0.35  # relevance score tối thiểu để giữ ảnh (0–1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_clients() -> tuple:
    """Trả về (primary_client, [fallback_clients])"""
    load_dotenv(ROOT_DIR / ".env")
    keys = [os.getenv(v) for v in ("GROQ_API_KEY", "GROQ_API_KEY_FALLBACK") if os.getenv(v)]
    if not keys:
        sys.exit("Không tìm thấy GROQ_API_KEY trong .env")
    clients = [Groq(api_key=k) for k in keys]
    return clients[0], clients[1:]


def call_api(client: Groq, fallbacks: list, **kwargs) -> str:
    """Gọi GROQ với fallback key khi rate limit."""
    all_clients = [client] + fallbacks
    for attempt in range(len(all_clients) * 2):
        cur = all_clients[attempt % len(all_clients)]
        try:
            resp = cur.chat.completions.create(**kwargs)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            err = str(e)
            if "429" in err or "rate_limit" in err.lower():
                if (attempt + 1) < len(all_clients):
                    print(f"  [RL] key {attempt+1} → key {attempt+2}", end=" ", flush=True)
                    continue
                wait = 65
                m = re.search(r"try again in (\d+)m([\d.]+)s", err)
                if m:
                    wait = int(m.group(1)) * 60 + float(m.group(2)) + 5
                print(f"  [RL] chờ {wait:.0f}s...", end=" ", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("Rate limit: đã thử tất cả keys.")


def image_to_base64(doc: fitz.Document, xref: int) -> tuple:
    """Trả về (base64_string, mime_type)."""
    img = doc.extract_image(xref)
    ext = img["ext"].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "gif": "image/gif",
            "webp": "image/webp"}.get(ext, "image/png")
    return base64.b64encode(img["image"]).decode(), mime


def get_page_text(page: fitz.Page) -> str:
    """Trích text thuần từ trang, normalize whitespace."""
    text = page.get_text("text")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def get_image_bbox_text(page: fitz.Page, xref: int, context_chars: int) -> str:
    """
    Lấy text gần nhất quanh vị trí ảnh trên trang
    (text phía trên + phía dưới vùng chứa ảnh).
    """
    # Tìm vị trí ảnh trên trang
    img_rects = []
    for img_info in page.get_images(full=True):
        if img_info[0] == xref:
            # Lấy bbox từ các block
            for block in page.get_text("dict")["blocks"]:
                if block.get("type") == 1:  # image block
                    img_rects.append(fitz.Rect(block["bbox"]))

    full_text = get_page_text(page)

    if not img_rects:
        # Không xác định vị trí → dùng toàn bộ text trang, cắt ngắn
        half = context_chars // 2
        return full_text[:half * 2] if len(full_text) <= context_chars else full_text[:context_chars]

    # Lấy centroid y của ảnh để tìm text trên/dưới
    img_y = sum(r.y1 + r.y0 for r in img_rects) / (2 * len(img_rects))
    blocks = page.get_text("dict")["blocks"]
    text_above, text_below = [], []
    for b in blocks:
        if b.get("type") != 0:
            continue
        by = (b["bbox"][1] + b["bbox"][3]) / 2
        t = " ".join(s["text"] for line in b.get("lines", []) for s in line.get("spans", []))
        if by < img_y:
            text_above.append(t)
        else:
            text_below.append(t)

    above = " ".join(text_above)[-context_chars // 2:]
    below = " ".join(text_below)[:context_chars // 2:]
    return (above + " " + below).strip() or full_text[:context_chars]


# ---------------------------------------------------------------------------
# Core: tóm tắt + đánh giá relevance
# ---------------------------------------------------------------------------

EVAL_PROMPT = """Bạn nhận được một hình ảnh từ tài liệu PDF và đoạn văn bản xung quanh vị trí hình.

Đoạn văn bản xung quanh:
\"\"\"
{context}
\"\"\"

Hãy trả về JSON (chỉ JSON, không text khác):
{{
  "summary": "mô tả ngắn gọn nội dung hình ảnh (1-2 câu)",
  "relevant": true hoặc false,
  "relevance_score": 0.0 đến 1.0,
  "reason": "lý do ngắn gọn tại sao liên quan hoặc không liên quan"
}}

Quy tắc đánh giá:
- relevant = true nếu hình ảnh minh họa, bổ sung hoặc trực tiếp liên quan đến nội dung văn bản
- relevant = false nếu là logo, ảnh trang trí, watermark, header/footer, biểu tượng không liên quan
- relevance_score: 0.0 = hoàn toàn không liên quan, 1.0 = rất liên quan
"""


def evaluate_image(client: Groq, fallbacks: list,
                   img_b64: str, mime: str, context_text: str) -> dict:
    """Gọi GROQ Vision để tóm tắt ảnh và đánh giá relevance."""
    prompt = EVAL_PROMPT.format(context=context_text[:CONTEXT_CHARS])
    raw = call_api(
        client, fallbacks,
        model=VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url",
                 "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                {"type": "text", "text": prompt},
            ]
        }],
        max_tokens=512,
        temperature=0.1,
        reasoning_effort="none",
    )

    # Clean và parse JSON
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    if not raw.lstrip().startswith("{"):
        m = re.search(r"\{", raw)
        if m:
            raw = raw[m.start():]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: trích các field bằng regex
        def extract_field(pattern, default):
            m = re.search(pattern, raw, re.IGNORECASE | re.DOTALL)
            return m.group(1).strip() if m else default

        score_str = extract_field(r'"relevance_score"\s*:\s*([\d.]+)', "0")
        relevant_str = extract_field(r'"relevant"\s*:\s*(true|false)', "false")
        return {
            "summary": extract_field(r'"summary"\s*:\s*"([^"]+)"', "Không xác định"),
            "relevant": relevant_str.lower() == "true",
            "relevance_score": float(score_str),
            "reason": extract_field(r'"reason"\s*:\s*"([^"]+)"', ""),
        }


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------

def process_pdf(pdf_path: Path, out_dir: Path,
                threshold: float = DEFAULT_THRESHOLD,
                verbose: bool = True) -> dict:
    """
    Xử lý PDF: trích text + lọc ảnh theo relevance.

    Trả về dict kết quả với từng trang và danh sách ảnh được giữ lại.
    """
    client, fallbacks = load_clients()
    doc = fitz.open(str(pdf_path))

    out_dir.mkdir(parents=True, exist_ok=True)
    img_dir = out_dir / "images"
    img_dir.mkdir(exist_ok=True)

    result = {
        "source": pdf_path.name,
        "pages": [],
        "images_kept": 0,
        "images_removed": 0,
    }

    # xrefs đã xử lý để tránh trùng lặp ảnh xuất hiện nhiều trang
    processed_xrefs: set = set()

    for page_idx in range(doc.page_count):
        page = doc[page_idx]
        page_text = get_page_text(page)
        images_on_page = page.get_images(full=True)

        page_result = {
            "page": page_idx + 1,
            "text": page_text,
            "images": [],
        }

        if verbose:
            print(f"Trang {page_idx+1}/{doc.page_count} "
                  f"({len(images_on_page)} ảnh, {len(page_text)} ký tự text)",
                  end=" → ", flush=True)

        kept = 0
        for img_info in images_on_page:
            xref = img_info[0]
            if xref in processed_xrefs:
                continue
            processed_xrefs.add(xref)

            try:
                img_b64, mime = image_to_base64(doc, xref)
            except Exception:
                continue

            # Bỏ qua ảnh quá nhỏ (icon, bullet, ký hiệu nhỏ < 50px mỗi chiều)
            raw_img = doc.extract_image(xref)
            w, h = raw_img.get("width", 0), raw_img.get("height", 0)
            if w < 50 or h < 50:
                continue

            context = get_image_bbox_text(page, xref, CONTEXT_CHARS)
            eval_result = evaluate_image(client, fallbacks, img_b64, mime, context)

            score = float(eval_result.get("relevance_score", 0))
            relevant = eval_result.get("relevant", False) or score >= threshold

            img_record = {
                "xref": xref,
                "size": [w, h],
                "summary": eval_result.get("summary", ""),
                "relevant": relevant,
                "relevance_score": round(score, 2),
                "reason": eval_result.get("reason", ""),
                "path": None,
            }

            if relevant:
                # Lưu ảnh ra file
                ext = raw_img.get("ext", "png")
                fname = f"p{page_idx+1}_x{xref}.{ext}"
                (img_dir / fname).write_bytes(raw_img["image"])
                img_record["path"] = f"images/{fname}"
                kept += 1
                result["images_kept"] += 1
            else:
                result["images_removed"] += 1

            page_result["images"].append(img_record)

        result["pages"].append(page_result)
        if verbose:
            removed = len(page_result["images"]) - kept
            print(f"giữ {kept}, bỏ {removed}")

    # Lưu kết quả JSON
    out_json = out_dir / "filtered.json"
    out_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if verbose:
        print(f"\nTổng: giữ {result['images_kept']} ảnh, "
              f"loại {result['images_removed']} ảnh → {out_json}")

    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Lọc ảnh trong PDF: giữ ảnh liên quan text, bỏ ảnh trang trí"
    )
    parser.add_argument("--pdf", type=Path, required=True, help="Đường dẫn file PDF")
    parser.add_argument("--out", type=Path, default=None,
                        help="Thư mục output (mặc định: output/<tên file>/)")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD,
                        help=f"Ngưỡng relevance score (0–1, mặc định {DEFAULT_THRESHOLD})")
    parser.add_argument("--quiet", action="store_true", help="Tắt log từng trang")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.exit(f"Không tìm thấy file: {args.pdf}")

    out_dir = args.out or (Path(__file__).parent / "output" / args.pdf.stem)
    process_pdf(args.pdf, out_dir, threshold=args.threshold, verbose=not args.quiet)


if __name__ == "__main__":
    main()

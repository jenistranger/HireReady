import os
import io
import re
import html as html_lib
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
import httpx
from dotenv import load_dotenv
from fpdf import FPDF
from pypdf import PdfReader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

try:
    from weasyprint import HTML as WeasyHTML
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("resume_tailor")

OPENROUTER_API_KEY = os.getenv("openrouter_api_key")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-3.1-flash-lite"
FONT_DIR = "/usr/share/fonts/truetype/dejavu/"

SYSTEM_PROMPT = """Ты — профессиональный HR-консультант и эксперт по составлению резюме с многолетним опытом. Твоя задача — переработать резюме кандидата так, чтобы оно максимально соответствовало конкретной вакансии.

Правила переработки резюме:
1. СОХРАНЯЙ ФАКТЫ: Не придумывай опыт, компании, должности, даты или навыки которых нет в оригинале. Все факты должны быть правдивыми.
2. КЛЮЧЕВЫЕ СЛОВА: Органично вплети ключевые слова и фразы из описания вакансии в резюме — в описании обязанностей, навыках, достижениях.
3. РЕЛЕВАНТНОСТЬ: Переставь акценты — выдели вперёд тот опыт и навыки, которые наиболее важны для этой вакансии. Убирай или сокращай опыт и разделы, нерелевантные для данной позиции.
4. ФОРМУЛИРОВКИ: Переформулируй описания опыта, используя язык вакансии. Добавь конкретику там, где это возможно на основе имеющихся данных.
5. СТРУКТУРА: Сохрани логическую структуру резюме. При необходимости перегруппируй секции для лучшего соответствия.
6. ЯЗЫК: Пиши на том же языке, что и оригинальное резюме (русский или английский), профессионально и чётко.
7. ФОРМАТ: Верни готовое резюме в виде чистого текста, без комментариев и пояснений. Только само резюме.

ЗАПРЕЩЕНО:
- Добавлять раздел «Цель», «Objective», «О себе» или любой другой вводный раздел с целью кандидата — если его не было в оригинале.
- Добавлять вводные фразы типа «Вот переработанное резюме:» — сразу начинай с имени или первой строки резюме.
- Придумывать данные, которых нет в оригинале."""

# ── CSS templates ──────────────────────────────────────────────────

_MODERN_CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "DejaVu Sans", sans-serif; color: #1e1e1e; font-size: 10pt; }
.resume-header {
  padding: 26px 32px 22px 38px;
  background: #0f172a;
  border-left: 6px solid #38bdf8;
}
.name { font-size: 21pt; font-weight: bold; color: #f1f5f9; line-height: 1.2; }
.subtitle { font-size: 10pt; color: #94a3b8; margin-top: 5px; line-height: 1.5; }
.resume-body { padding: 16px 32px 24px; }
.section-title {
  font-size: 7.5pt; font-weight: bold; text-transform: uppercase;
  letter-spacing: 1.4px; color: #0284c7; margin-top: 14px; margin-bottom: 2px;
}
.section-rule { height: 1.5px; background: #e2e8f0; margin-bottom: 7px; }
.bullet { display: flex; gap: 7px; align-items: flex-start; margin: 2px 0; line-height: 1.45; }
.dot { color: #38bdf8; flex-shrink: 0; font-size: 11pt; }
.bullet-text { color: #1e293b; }
.text { color: #1e293b; margin: 2px 0; line-height: 1.45; }
.muted { color: #64748b; margin: 2px 0; line-height: 1.45; }
"""

_CORPORATE_CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "DejaVu Sans", sans-serif; color: #1e1e1e; font-size: 10pt; }
.resume-header {
  padding: 28px 36px 20px;
  background: #f8fafc;
  border-bottom: 3px solid #1e3a5f;
}
.name { font-size: 23pt; font-weight: bold; color: #1e3a5f; line-height: 1.2; }
.subtitle { font-size: 10pt; color: #4b5563; margin-top: 5px; line-height: 1.5; }
.resume-body { padding: 16px 36px 28px; }
.section-title {
  font-size: 7.5pt; font-weight: bold; text-transform: uppercase;
  letter-spacing: 2px; color: #1e3a5f; margin-top: 16px; margin-bottom: 3px;
}
.section-rule { height: 1px; background: #1e3a5f; opacity: 0.25; margin-bottom: 7px; }
.bullet { display: flex; gap: 8px; align-items: flex-start; margin: 3px 0; line-height: 1.45; }
.dot { color: #1e3a5f; flex-shrink: 0; }
.bullet-text { color: #1e1e1e; }
.text { color: #1e1e1e; margin: 2px 0; line-height: 1.45; }
.muted { color: #6b7280; margin: 3px 0; line-height: 1.45; }
"""


def _parse_resume(text: str) -> dict:
    lines = text.split("\n")
    header_lines, i = [], 0
    while i < len(lines) and lines[i].strip():
        header_lines.append(lines[i].strip())
        i += 1
    return {
        "name": header_lines[0] if header_lines else "",
        "subtitles": header_lines[1:],
        "body_lines": lines[i:],
    }


def _render_body_html(body_lines: list) -> str:
    parts = []
    for line in body_lines:
        s = line.strip()
        if not s:
            continue
        is_section = s.endswith(":") and len(s) < 80 and s[0] not in ("*", "-", "•")
        is_bullet  = len(s) > 2 and s[0] in ("*", "-", "•") and s[1] == " "
        if is_section:
            t = html_lib.escape(s[:-1])
            parts.append(f'<div class="section-title">{t}</div><div class="section-rule"></div>')
        elif is_bullet:
            t = html_lib.escape(s[2:].strip())
            parts.append(f'<div class="bullet"><span class="dot">•</span><span class="bullet-text">{t}</span></div>')
        elif s.startswith("—") or s.startswith("–"):
            parts.append(f'<div class="muted">{html_lib.escape(s)}</div>')
        else:
            parts.append(f'<div class="text">{html_lib.escape(s)}</div>')
    return "\n".join(parts)


def build_pdf_weasyprint(text: str, template: str) -> bytes:
    r = _parse_resume(text)
    name = html_lib.escape(r["name"])
    subtitles_html = "".join(
        f'<div class="subtitle">{html_lib.escape(s)}</div>' for s in r["subtitles"]
    )
    body_html = _render_body_html(r["body_lines"])
    css = _MODERN_CSS if template == "modern" else _CORPORATE_CSS
    full_html = (
        f'<!DOCTYPE html><html><head><meta charset="utf-8">'
        f'<style>{css}</style></head><body>'
        f'<div class="resume-header"><div class="name">{name}</div>{subtitles_html}</div>'
        f'<div class="resume-body">{body_html}</div>'
        f'</body></html>'
    )
    return WeasyHTML(string=full_html).write_pdf()


def build_pdf(text: str) -> bytes:
    lines = text.split("\n")

    header_lines, i = [], 0
    while i < len(lines) and lines[i].strip():
        header_lines.append(lines[i].strip())
        i += 1
    body_lines = lines[i:]

    name = header_lines[0] if header_lines else "Резюме"
    subtitles = header_lines[1:]

    DARK = (30, 58, 95)
    WHITE = (255, 255, 255)
    INK = (30, 30, 30)
    GRAY = (100, 100, 100)
    LH = 5.5

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_margins(0, 0, 0)

    pdf.add_font("DV", "",  FONT_DIR + "DejaVuSans.ttf")
    pdf.add_font("DV", "B", FONT_DIR + "DejaVuSans-Bold.ttf")

    header_h = 16 + len(subtitles) * 7 + 14
    pdf.set_fill_color(*DARK)
    pdf.rect(0, 0, 210, header_h, "F")

    pdf.set_fill_color(80, 130, 180)
    pdf.rect(0, 0, 5, header_h, "F")

    pdf.set_text_color(*WHITE)
    pdf.set_font("DV", "B", 21)
    pdf.set_xy(14, 13)
    pdf.cell(0, 9, name)

    pdf.set_font("DV", "", 11)
    pdf.set_text_color(190, 210, 235)
    y = 25
    for sub in subtitles:
        pdf.set_xy(14, y)
        pdf.cell(0, 6, sub)
        y += 7

    pdf.set_y(header_h + 8)
    pdf.set_text_color(*INK)

    for line in body_lines:
        s = line.strip()
        if not s:
            continue

        is_section = s.endswith(":") and len(s) < 80 and s[0] not in ("*", "-", "•")
        is_bullet  = len(s) > 2 and s[0] in ("*", "-", "•") and s[1] == " "

        if is_section:
            pdf.ln(5)
            pdf.set_font("DV", "B", 8.5)
            pdf.set_text_color(*DARK)
            pdf.set_x(14)
            pdf.cell(0, 5, s[:-1].upper(), new_x="LMARGIN", new_y="NEXT")
            y_rule = pdf.get_y()
            pdf.set_draw_color(*DARK)
            pdf.set_line_width(0.25)
            pdf.line(14, y_rule, 196, y_rule)
            pdf.ln(4)
            pdf.set_text_color(*INK)

        elif is_bullet:
            content = s[2:].strip()
            pdf.set_font("DV", "", 10.5)
            y0 = pdf.get_y()
            pdf.set_text_color(80, 130, 180)
            pdf.set_xy(14, y0)
            pdf.cell(7, LH, "•")
            pdf.set_text_color(*INK)
            pdf.set_xy(21, y0)
            pdf.multi_cell(175, LH, content)
            pdf.ln(0.5)

        else:
            pdf.set_font("DV", "", 10.5)
            pdf.set_text_color(*GRAY if s.startswith("—") or s.startswith("–") else INK)
            pdf.set_x(14)
            pdf.multi_cell(182, LH, s)
            pdf.ln(0.5)

    return bytes(pdf.output())


# ── App setup ──────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=[])

app = FastAPI(title="Resume Tailor")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

if os.getenv("DEV_MODE") == "1":
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["POST", "GET", "OPTIONS"],
        allow_headers=["Content-Type"],
    )


@app.on_event("startup")
async def startup_check():
    if not OPENROUTER_API_KEY:
        logger.error(
            "OPENROUTER_API_KEY is not set. "
            "Add openrouter_api_key=... to your .env file and restart."
        )
    else:
        logger.info("Resume Tailor started. Model: %s", MODEL)


# ── Models ─────────────────────────────────────────────────────────

class TailorRequest(BaseModel):
    resume: str
    job_description: str

    @field_validator("resume")
    @classmethod
    def resume_size(cls, v: str) -> str:
        if len(v.encode()) > 15_000:
            raise ValueError("Резюме слишком большое (максимум 15 KB)")
        return v

    @field_validator("job_description")
    @classmethod
    def job_size(cls, v: str) -> str:
        if len(v.encode()) > 25_000:
            raise ValueError("Описание вакансии слишком большое (максимум 25 KB)")
        return v


class TailorResponse(BaseModel):
    tailored_resume: str


class PdfRequest(BaseModel):
    text: str
    template: str = "default"


class UrlRequest(BaseModel):
    url: str


# ── Endpoints ──────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL, "api_key_set": bool(OPENROUTER_API_KEY)}


@app.post("/api/tailor", response_model=TailorResponse)
@limiter.limit("5/minute")
async def tailor_resume(request: Request, body: TailorRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="API ключ не настроен")
    if not body.resume.strip():
        raise HTTPException(status_code=400, detail="Резюме не может быть пустым")
    if not body.job_description.strip():
        raise HTTPException(status_code=400, detail="Описание вакансии не может быть пустым")

    user_message = f"""Переработай резюме под данную вакансию.

РЕЗЮМЕ КАНДИДАТА:
{body.resume}

ОПИСАНИЕ ВАКАНСИИ:
{body.job_description}"""

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.4,
        "max_tokens": 4096,
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Resume Tailor",
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Ошибка API: {e.response.status_code} — {e.response.text}")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Превышено время ожидания ответа от AI")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Ошибка соединения: {str(e)}")

    data = resp.json()
    try:
        tailored = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Некорректный ответ от AI")

    logger.info(
        "Tailor done. Input: %d chars, output: %d chars",
        len(body.resume) + len(body.job_description),
        len(tailored),
    )
    return TailorResponse(tailored_resume=tailored)


@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    content = await file.read()
    try:
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")
    return {"text": text}


@app.post("/api/fetch-url")
@limiter.limit("10/minute")
async def fetch_url(request: Request, body: UrlRequest):
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(
                body.url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ResumeTailor/1.0)"},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"HTTP {e.response.status_code} from URL")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    html = resp.text
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return {"text": text[:5000]}


@app.post("/api/pdf")
@limiter.limit("20/minute")
async def export_pdf(request: Request, body: PdfRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Текст пустой")
    try:
        if body.template in ("modern", "corporate"):
            if not WEASYPRINT_AVAILABLE:
                raise HTTPException(status_code=501, detail="WeasyPrint не установлен")
            pdf_bytes = build_pdf_weasyprint(body.text, body.template)
        else:
            pdf_bytes = build_pdf(body.text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации PDF: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=resume.pdf"},
    )


# StaticFiles монтируется последним — иначе перехватит /api/*
app.mount("/", StaticFiles(directory="/app/static", html=True), name="static")

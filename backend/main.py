import os
import io
import re
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv
from fpdf import FPDF
from pypdf import PdfReader

load_dotenv()

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

app = FastAPI(title="Resume Tailor")


class TailorRequest(BaseModel):
    resume: str
    job_description: str


class TailorResponse(BaseModel):
    tailored_resume: str


class PdfRequest(BaseModel):
    text: str


def build_pdf(text: str) -> bytes:
    lines = text.split("\n")

    # Parse header block (everything before first blank line)
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
    LH = 5.5   # base line height mm

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_margins(0, 0, 0)

    pdf.add_font("DV", "",  FONT_DIR + "DejaVuSans.ttf")
    pdf.add_font("DV", "B", FONT_DIR + "DejaVuSans-Bold.ttf")

    # ── Header background ──────────────────────────────────────
    header_h = 16 + len(subtitles) * 7 + 14
    pdf.set_fill_color(*DARK)
    pdf.rect(0, 0, 210, header_h, "F")

    # Left accent stripe
    pdf.set_fill_color(255, 255, 255)
    pdf.set_fill_color(80, 130, 180)
    pdf.rect(0, 0, 5, header_h, "F")

    # Name
    pdf.set_text_color(*WHITE)
    pdf.set_font("DV", "B", 21)
    pdf.set_xy(14, 13)
    pdf.cell(0, 9, name)

    # Subtitle lines
    pdf.set_font("DV", "", 11)
    pdf.set_text_color(190, 210, 235)
    y = 25
    for sub in subtitles:
        pdf.set_xy(14, y)
        pdf.cell(0, 6, sub)
        y += 7

    # ── Body ───────────────────────────────────────────────────
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
            # Rule
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
            # Bullet glyph
            pdf.set_text_color(80, 130, 180)
            pdf.set_xy(14, y0)
            pdf.cell(7, LH, "•")
            # Content (may wrap)
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


@app.post("/api/tailor", response_model=TailorResponse)
async def tailor_resume(request: TailorRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="API ключ не настроен")
    if not request.resume.strip():
        raise HTTPException(status_code=400, detail="Резюме не может быть пустым")
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Описание вакансии не может быть пустым")

    user_message = f"""Переработай резюме под данную вакансию.

РЕЗЮМЕ КАНДИДАТА:
{request.resume}

ОПИСАНИЕ ВАКАНСИИ:
{request.job_description}"""

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


class UrlRequest(BaseModel):
    url: str


@app.post("/api/fetch-url")
async def fetch_url(request: UrlRequest):
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(
                request.url,
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
async def export_pdf(request: PdfRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Текст пустой")
    try:
        pdf_bytes = build_pdf(request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации PDF: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=resume.pdf"},
    )


# StaticFiles монтируется последним — иначе перехватит /api/*
app.mount("/", StaticFiles(directory="/app/static", html=True), name="static")

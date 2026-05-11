import os
import io
import re
import socket
import ipaddress
import logging
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
import httpx
from dotenv import load_dotenv
from pypdf import PdfReader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from latex import compile_pdf, TEMPLATES as LATEX_TEMPLATES, LatexCompileError

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("resume_tailor")

OPENROUTER_API_KEY = os.getenv("openrouter_api_key")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-2.0-flash-001"
MAX_PDF_SIZE = 5 * 1024 * 1024  # 5 MB

SYSTEM_PROMPT = """Ты — профессиональный HR-консультант и эксперт по составлению резюме. Твоя задача — переработать резюме кандидата под конкретную вакансию.

ПРАВИЛА:

1. СОХРАНЯЙ ФАКТЫ. Не придумывай опыт, компании, должности, даты, метрики или навыки которых нет в оригинале. Все факты должны быть правдивыми.

2. ATS-ОПТИМИЗАЦИЯ. Вплети ключевые слова из вакансии в первые три секции (SUMMARY, последний опыт работы, SKILLS). Используй точную терминологию вакансии.

3. ACTION VERBS. Каждый bullet начинай с глагола действия: "запустил", "спроектировал", "увеличил", "настроил", "руководил" (RU) или "Launched", "Designed", "Increased", "Built" (EN).

4. МЕТРИКИ. Сохраняй любые числа из оригинала (%, размеры команды, объёмы данных, выручку). Никогда не выдумывай метрики, которых нет.

5. РЕЛЕВАНТНОСТЬ. Опыт работы — в обратном хронологическом порядке (новый сверху). Bullets под каждой работой переставь так, чтобы наиболее релевантные вакансии шли первыми.

6. ЯЗЫК. Пиши на том же языке, что и оригинальное резюме.

7. ДЛИНА. Summary не больше 3 строк. Каждый bullet не больше 2 строк. Всё резюме помещается на одну страницу A4 (~ 600 слов).

ФОРМАТ ВЫВОДА — СТРОГО СЛЕДУЙ ЭТОЙ СТРУКТУРЕ:

Имя Фамилия
Должность одной строкой
Контакт1 · Контакт2 · Контакт3

## SUMMARY
2-3 строки, заточенных под вакансию.

## EXPERIENCE

### Должность · Компания
2022 — настоящее · Москва
* Достижение с глаголом действия
* Ещё одно достижение

### Прошлая должность · Прошлая компания
2020 — 2022 · Удалённо
* Bullet
* Bullet

## EDUCATION

### Степень · Учреждение
2018 — 2020

## SKILLS
**Языки программирования:** Python, Go, TypeScript
**Фреймворки:** FastAPI, React, Django

## PROJECTS
(только если есть в оригинале)

### Название проекта
Краткое описание · github.com/x
* Bullet (опционально)

## LANGUAGES
(только если есть в оригинале)
Русский (родной), Английский (C1)

ЗАПРЕЩЕНО:
- Добавлять секции "Цель", "Objective", "О себе", если их не было в оригинале.
- Вводные фразы ("Вот переработанное резюме:") — сразу начинай с имени.
- Markdown-обёртку ```...``` — выводи только текст резюме.
- Менять порядок секций (SUMMARY → EXPERIENCE → EDUCATION → SKILLS → PROJECTS → LANGUAGES).
- Опускать `## ` перед секциями или `### ` перед записями.
- Придумывать факты, метрики, навыки или опыт.

Возвращай только текст резюме в указанном формате."""


SYSTEM_PROMPT_IMPROVE = """Ты — профессиональный HR-консультант и эксперт по составлению резюме. Твоя задача — улучшить резюме кандидата без привязки к конкретной вакансии.

ПРАВИЛА:

1. СОХРАНЯЙ ФАКТЫ. Не придумывай опыт, компании, должности, даты, метрики или навыки которых нет в оригинале. Все факты должны быть правдивыми. Если поле пустое — оставь пустым, не выдумывай.

2. ПЕРЕПИСЫВАЙ В ACTION VERBS. Каждый bullet начинай с глагола действия: "запустил", "спроектировал", "увеличил", "настроил", "руководил" (RU) или "Launched", "Designed", "Increased", "Built" (EN). Убирай слабые формулировки ("отвечал за", "занимался", "помогал").

3. СОХРАНЯЙ МЕТРИКИ. Все числа из оригинала (%, размеры команды, объёмы данных, выручку) переноси без изменений. НИКОГДА не выдумывай метрики.

4. СТРУКТУРА. Если оригинал плохо структурирован, разбей опыт по работам с заголовками, добавь секции SUMMARY и SKILLS если их нет (на основе того, что уже есть в резюме). Не добавляй секции "Цель", "Objective".

5. ГРАММАТИКА И СТИЛЬ. Исправляй опечатки, пунктуацию, согласование. Делай формулировки лаконичнее. Убирай "воду".

6. ЯЗЫК. Пиши на том же языке, что и оригинальное резюме.

7. ДЛИНА. Summary не больше 3 строк. Каждый bullet не больше 2 строк. Всё резюме помещается на одну страницу A4 (~ 600 слов).

ФОРМАТ ВЫВОДА — СТРОГО СЛЕДУЙ ЭТОЙ СТРУКТУРЕ:

Имя Фамилия
Должность одной строкой
Контакт1 · Контакт2 · Контакт3

## SUMMARY
2-3 строки.

## EXPERIENCE

### Должность · Компания
2022 — настоящее · Москва
* Достижение с глаголом действия
* Ещё одно достижение

## EDUCATION

### Степень · Учреждение
2018 — 2020

## SKILLS
**Категория:** значения через запятую

ЗАПРЕЩЕНО:
- Вводные фразы ("Вот улучшенное резюме:") — сразу начинай с имени.
- Markdown-обёртку ```...``` — выводи только текст резюме.
- Придумывать факты, метрики, навыки или опыт.

Возвращай только текст резюме в указанном формате."""


# ── Parser ─────────────────────────────────────────────────────────

_ENTRY_SECTIONS = {"EXPERIENCE", "WORK", "WORK EXPERIENCE", "EDUCATION", "PROJECTS",
                   "ОПЫТ", "ОПЫТ РАБОТЫ", "ОБРАЗОВАНИЕ", "ПРОЕКТЫ"}
_KV_SECTIONS = {"SKILLS", "TECHNOLOGIES", "TECH STACK", "НАВЫКИ", "СТЕК", "ТЕХНОЛОГИИ"}


def _section_type(title: str) -> str:
    t = title.strip().upper()
    if t in _ENTRY_SECTIONS:
        return "entries"
    if t in _KV_SECTIONS:
        return "kv"
    return "text"


def parse_resume(text: str) -> dict:
    """Parses structured-Markdown resume into rich data dict."""
    lines = text.split("\n")
    i = 0

    # Header: lines before first '## SECTION'
    header_lines = []
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith("## "):
            break
        if s and not s.startswith("```"):
            header_lines.append(s)
        i += 1

    name = header_lines[0] if header_lines else ""
    headline = header_lines[1] if len(header_lines) > 1 else ""
    contacts: list[str] = []
    for line in header_lines[2:]:
        parts = re.split(r"\s*[·•|]\s*", line)
        contacts.extend(p.strip() for p in parts if p.strip())

    sections: list[dict] = []
    current_title = None
    current_buf: list[str] = []

    def flush():
        if current_title is None:
            return
        section = {"title": current_title, "type": _section_type(current_title)}
        if section["type"] == "entries":
            section["entries"] = _parse_entries(current_buf)
        elif section["type"] == "kv":
            section["items"] = _parse_kv(current_buf)
        else:
            section["content"] = "\n".join(l for l in current_buf if l.strip()).strip()
        sections.append(section)

    while i < len(lines):
        s = lines[i].strip()
        if s.startswith("## "):
            flush()
            current_title = s[3:].strip()
            current_buf = []
        elif current_title is not None:
            current_buf.append(s)
        i += 1
    flush()

    return {
        "header": {"name": name, "headline": headline, "contacts": contacts},
        "sections": sections,
    }


def _parse_entries(buf: list[str]) -> list[dict]:
    entries: list[dict] = []
    cur: dict | None = None
    for line in buf:
        s = line.strip()
        if not s:
            continue
        if s.startswith("### "):
            if cur:
                entries.append(cur)
            title_text = s[4:].strip()
            parts = re.split(r"\s*·\s*", title_text, maxsplit=1)
            cur = {
                "title": parts[0],
                "subtitle": parts[1] if len(parts) > 1 else "",
                "period": "",
                "location": "",
                "bullets": [],
                "description": "",
            }
        elif cur is not None:
            if s.startswith(("* ", "- ", "• ")):
                cur["bullets"].append(s[2:].strip())
            elif not cur["period"] and not cur["bullets"]:
                parts = re.split(r"\s*·\s*", s, maxsplit=1)
                cur["period"] = parts[0]
                cur["location"] = parts[1] if len(parts) > 1 else ""
            else:
                cur["description"] += (" " if cur["description"] else "") + s
    if cur:
        entries.append(cur)
    return entries


def _parse_kv(buf: list[str]) -> list[dict]:
    items: list[dict] = []
    inline: list[str] = []
    for line in buf:
        s = line.strip()
        if not s:
            continue
        m = re.match(r"^\*\*\s*([^*]+?)\s*\*\*\s*:?\s*(.*)$", s)
        if m:
            items.append({"label": m.group(1).strip(" :"), "value": m.group(2).strip()})
        else:
            inline.append(s)
    if not items and inline:
        items.append({"label": "", "value": " ".join(inline)})
    return items


# ── PDF build (LaTeX) ──────────────────────────────────────────────

def build_pdf(text: str, template: str) -> bytes:
    if template not in LATEX_TEMPLATES:
        template = LATEX_TEMPLATES[0]
    data = parse_resume(text)
    return compile_pdf(data, template)


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
        logger.error("OPENROUTER_API_KEY is not set. Add openrouter_api_key=... to your .env file.")
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


class ImproveRequest(BaseModel):
    resume: str

    @field_validator("resume")
    @classmethod
    def resume_size(cls, v: str) -> str:
        if len(v.encode()) > 15_000:
            raise ValueError("Резюме слишком большое (максимум 15 KB)")
        return v


class ImproveResponse(BaseModel):
    improved_resume: str


class PdfRequest(BaseModel):
    text: str
    template: str = "awesome"
    inline: bool = False


class UrlRequest(BaseModel):
    url: str


# ── SSRF helper ────────────────────────────────────────────────────

def _is_safe_url(url: str) -> tuple[bool, str]:
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Неверный URL"
    if parsed.scheme not in ("http", "https"):
        return False, "Только http(s) ссылки"
    host = parsed.hostname
    if not host:
        return False, "URL без хоста"
    try:
        addrs = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False, "Не удалось разрезолвить хост"
    for family, *_, sockaddr in addrs:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False, "Приватные/служебные адреса запрещены"
    return True, ""


async def _call_openrouter(system_prompt: str, user_message: str) -> str:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
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
        out = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Некорректный ответ от AI")

    out = re.sub(r"^```[a-z]*\n", "", out.strip())
    out = re.sub(r"\n```$", "", out)
    return out


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

    user_message = (
        f"Переработай резюме под данную вакансию.\n\n"
        f"РЕЗЮМЕ КАНДИДАТА:\n{body.resume}\n\n"
        f"ОПИСАНИЕ ВАКАНСИИ:\n{body.job_description}"
    )
    tailored = await _call_openrouter(SYSTEM_PROMPT, user_message)

    logger.info(
        "Tailor done. Input: %d chars, output: %d chars",
        len(body.resume) + len(body.job_description),
        len(tailored),
    )
    return TailorResponse(tailored_resume=tailored)


@app.post("/api/improve", response_model=ImproveResponse)
@limiter.limit("5/minute")
async def improve_resume(request: Request, body: ImproveRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="API ключ не настроен")
    if not body.resume.strip():
        raise HTTPException(status_code=400, detail="Резюме не может быть пустым")

    user_message = (
        f"Улучши это резюме: исправь грамматику, перепиши в action verbs, "
        f"приведи к чистой структуре. Не выдумывай фактов.\n\n"
        f"РЕЗЮМЕ КАНДИДАТА:\n{body.resume}"
    )
    improved = await _call_openrouter(SYSTEM_PROMPT_IMPROVE, user_message)

    logger.info("Improve done. Input: %d chars, output: %d chars", len(body.resume), len(improved))
    return ImproveResponse(improved_resume=improved)


@app.post("/api/extract-pdf")
@limiter.limit("10/minute")
async def extract_pdf(request: Request, file: UploadFile = File(...)):
    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Принимаются только PDF файлы")
    content = await file.read()
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 5 MB)")
    if not content[:4] == b"%PDF":
        raise HTTPException(status_code=400, detail="Файл не похож на PDF")
    try:
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось прочитать PDF: {e}")
    return {"text": text}


@app.post("/api/fetch-url")
@limiter.limit("10/minute")
async def fetch_url(request: Request, body: UrlRequest):
    ok, reason = _is_safe_url(body.url)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            resp = await client.get(
                body.url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ResumeTailor/1.0)"},
            )
            # Manually follow up to 3 redirects, validating each
            redirects = 0
            while resp.is_redirect and redirects < 3:
                next_url = resp.headers.get("location")
                if not next_url:
                    break
                ok, reason = _is_safe_url(next_url)
                if not ok:
                    raise HTTPException(status_code=400, detail=f"Редирект на {reason}")
                resp = await client.get(next_url)
                redirects += 1
            resp.raise_for_status()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"HTTP {e.response.status_code} from URL")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось загрузить URL: {e}")

    html = resp.text
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return {"text": text[:5000]}


@app.post("/api/pdf")
@limiter.limit("60/minute")
async def export_pdf(request: Request, body: PdfRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Текст пустой")
    try:
        pdf_bytes = build_pdf(body.text, body.template)
    except LatexCompileError as e:
        logger.error("LaTeX compile error: %s", e)
        raise HTTPException(status_code=500, detail="Не удалось скомпилировать PDF (LaTeX)")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации PDF: {e}")
    disposition = "inline; filename=resume.pdf" if body.inline else "attachment; filename=resume.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
        },
    )


# StaticFiles монтируется последним — иначе перехватит /api/*
import os as _os
_static_dir = "/app/static" if _os.path.isdir("/app/static") else _os.path.join(_os.path.dirname(__file__), "static")
if _os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")

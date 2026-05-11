import os
import io
import re
import socket
import ipaddress
import html as html_lib
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


# ── 6 шаблонов ─────────────────────────────────────────────────────

_BASE_CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-body, 'DejaVu Sans', sans-serif); color: var(--text); font-size: 10pt; line-height: 1.45; }
.resume { width: 210mm; min-height: 297mm; }
.resume-header { padding: var(--header-padding, 22px 28px); background: var(--header-bg); }
.resume-name { font-family: var(--font-title, inherit); font-size: var(--name-size, 22pt); font-weight: bold; color: var(--name-color); line-height: 1.15; }
.resume-headline { font-size: 11pt; color: var(--headline-color); margin-top: 4px; font-style: var(--headline-style, normal); }
.resume-contacts { font-size: 9pt; color: var(--contacts-color); margin-top: 6px; }
.resume-body { padding: 16px 28px 24px; }
.resume-section { margin-top: 14px; }
.resume-section:first-child { margin-top: 4px; }
.section-title { font-family: var(--font-section, inherit); font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: var(--section-tracking, 1.4px); color: var(--section-color); padding-bottom: 3px; border-bottom: var(--section-rule, 1px solid rgba(0,0,0,0.12)); margin-bottom: 7px; }
.section-text { font-size: 10pt; color: var(--text); }
.entry { margin-top: 8px; page-break-inside: avoid; }
.entry:first-child { margin-top: 0; }
.entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.entry-title { font-size: 10.5pt; font-weight: bold; color: var(--entry-title-color); }
.entry-subtitle { font-weight: normal; color: var(--entry-subtitle-color); }
.entry-period { font-size: 9pt; color: var(--period-color); white-space: nowrap; flex-shrink: 0; font-style: var(--period-style, normal); }
.entry-location { font-size: 9pt; color: var(--muted); margin-top: 1px; }
.entry-description { font-size: 9.5pt; color: var(--text); margin-top: 3px; }
.entry-bullets { list-style: none; margin-top: 4px; }
.entry-bullets li { font-size: 9.5pt; color: var(--text); padding-left: 14px; position: relative; margin-top: 2px; }
.entry-bullets li::before { content: var(--bullet-char, '•'); position: absolute; left: 2px; color: var(--bullet-color); font-weight: bold; }
.skill-list { display: block; }
.skill-row { font-size: 9.5pt; margin-top: 3px; line-height: 1.5; }
.skill-row:first-child { margin-top: 0; }
.skill-label { font-weight: bold; color: var(--skill-label-color); margin-right: 6px; }
.skill-value { color: var(--text); }
.skill-tags { display: block; margin-top: 4px; }
.skill-tag-row { font-size: 9pt; margin-top: 4px; }
.skill-tag-row:first-child { margin-top: 0; }
.skill-tag-label { font-weight: bold; color: var(--skill-label-color); display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
.skill-tag { display: inline-block; padding: 2px 8px; margin: 2px 3px 2px 0; border-radius: 10px; background: var(--tag-bg); color: var(--tag-color); font-size: 8.5pt; }
.languages-text { font-size: 9.5pt; color: var(--text); }
"""

_TEMPLATE_VARS = {
    "default": """
        :root {
            --text: #1e1e1e; --muted: #666;
            --header-bg: #1e3a5f; --name-color: #ffffff; --headline-color: rgba(190,210,235,1); --contacts-color: rgba(190,210,235,0.92);
            --section-color: #1e3a5f; --section-rule: 1px solid rgba(30,58,95,0.25);
            --entry-title-color: #1e1e1e; --entry-subtitle-color: #1e3a5f;
            --period-color: #1e3a5f;
            --bullet-color: #5082b4; --bullet-char: '•';
            --skill-label-color: #1e3a5f;
            --tag-bg: rgba(80,130,180,0.12); --tag-color: #1e3a5f;
        }
    """,
    "modern": """
        :root {
            --text: #1e293b; --muted: #64748b;
            --header-bg: #0f172a; --name-color: #f1f5f9; --headline-color: #94a3b8; --contacts-color: #cbd5e1;
            --header-padding: 26px 32px 22px 38px;
            --section-color: #0284c7; --section-rule: 1.5px solid #e2e8f0; --section-tracking: 1.6px;
            --entry-title-color: #1e293b; --entry-subtitle-color: #0284c7;
            --period-color: #0284c7;
            --bullet-color: #38bdf8; --bullet-char: '▸';
            --skill-label-color: #0284c7;
            --tag-bg: rgba(56,189,248,0.14); --tag-color: #0c4a6e;
        }
        .resume-header { border-left: 6px solid #38bdf8; }
    """,
    "corporate": """
        :root {
            --text: #1e1e1e; --muted: #6b7280;
            --header-bg: #f8fafc; --name-color: #1e3a5f; --headline-color: #4b5563; --contacts-color: #6b7280;
            --section-color: #1e3a5f; --section-rule: 1px solid rgba(30,58,95,0.4); --section-tracking: 2px;
            --entry-title-color: #1e3a5f; --entry-subtitle-color: #4b5563;
            --period-color: #4b5563; --period-style: italic;
            --bullet-color: #1e3a5f; --bullet-char: '■';
            --skill-label-color: #1e3a5f;
            --tag-bg: rgba(30,58,95,0.08); --tag-color: #1e3a5f;
        }
        .resume-header { border-bottom: 3px solid #1e3a5f; }
    """,
    "minimal": """
        :root {
            --text: #111111; --muted: #6b6b6b;
            --header-bg: #ffffff; --name-color: #111111; --headline-color: #444444; --contacts-color: #555555;
            --header-padding: 28px 28px 14px;
            --name-size: 24pt;
            --section-color: #111111; --section-rule: 1px solid #cccccc; --section-tracking: 2.4px;
            --entry-title-color: #111111; --entry-subtitle-color: #444444;
            --period-color: #6b6b6b; --period-style: italic;
            --bullet-color: #444444; --bullet-char: '·';
            --skill-label-color: #111111;
            --tag-bg: #f0f0f0; --tag-color: #111111;
        }
        .resume-header { border-bottom: 1px solid #111111; }
        .resume-name { letter-spacing: -0.5px; }
    """,
    "technical": """
        :root {
            --text: #1f2937; --muted: #6b7280;
            --header-bg: #0d1117; --name-color: #c9d1d9; --headline-color: #58a6ff; --contacts-color: #8b949e;
            --header-padding: 22px 28px 18px;
            --font-section: 'DejaVu Sans Mono', monospace;
            --section-color: #2ea043; --section-rule: 1px dashed #2ea043; --section-tracking: 1px;
            --entry-title-color: #1f2937; --entry-subtitle-color: #2ea043;
            --period-color: #6b7280;
            --bullet-color: #2ea043; --bullet-char: '▸';
            --skill-label-color: #0969da;
            --tag-bg: #ddf4e0; --tag-color: #1a4d24;
        }
        .resume-header { border-bottom: 2px solid #2ea043; }
        .section-title::before { content: '# '; color: #58a6ff; font-weight: normal; }
    """,
    "creative": """
        :root {
            --text: #2d1b4e; --muted: #6b5b95;
            --header-bg: linear-gradient(135deg, #6b46c1 0%, #ec4899 100%); --name-color: #ffffff; --headline-color: rgba(255,255,255,0.92); --contacts-color: rgba(255,255,255,0.85);
            --header-padding: 32px 32px 26px;
            --name-size: 26pt;
            --section-color: #6b46c1; --section-rule: 2px solid #ec4899; --section-tracking: 1.6px;
            --entry-title-color: #2d1b4e; --entry-subtitle-color: #ec4899;
            --period-color: #ec4899;
            --bullet-color: #6b46c1; --bullet-char: '◆';
            --skill-label-color: #6b46c1;
            --tag-bg: linear-gradient(135deg, rgba(107,70,193,0.15) 0%, rgba(236,72,153,0.15) 100%); --tag-color: #6b46c1;
        }
        .resume-header { background: linear-gradient(135deg, #6b46c1 0%, #ec4899 100%); }
        .skill-tag { border: 1px solid rgba(107,70,193,0.3); font-weight: 600; }
    """,
}


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


# ── HTML Render ────────────────────────────────────────────────────

_TAG_TEMPLATES = {"technical", "creative"}


def _esc(s: str) -> str:
    return html_lib.escape(s or "")


def _render_entry(e: dict) -> str:
    title_html = f'<span class="entry-title">{_esc(e["title"])}'
    if e["subtitle"]:
        title_html += f'<span class="entry-subtitle"> · {_esc(e["subtitle"])}</span>'
    title_html += "</span>"
    period_html = f'<span class="entry-period">{_esc(e["period"])}</span>' if e["period"] else ""
    location_html = f'<div class="entry-location">{_esc(e["location"])}</div>' if e["location"] else ""
    desc_html = f'<div class="entry-description">{_esc(e["description"])}</div>' if e["description"] else ""
    bullets_html = ""
    if e["bullets"]:
        items = "".join(f"<li>{_esc(b)}</li>" for b in e["bullets"])
        bullets_html = f'<ul class="entry-bullets">{items}</ul>'
    return (
        f'<div class="entry">'
        f'<div class="entry-header">{title_html}{period_html}</div>'
        f'{location_html}{desc_html}{bullets_html}'
        f'</div>'
    )


def _render_kv_inline(items: list[dict]) -> str:
    rows = []
    for it in items:
        if it["label"]:
            rows.append(
                f'<div class="skill-row">'
                f'<span class="skill-label">{_esc(it["label"])}:</span>'
                f'<span class="skill-value">{_esc(it["value"])}</span>'
                f'</div>'
            )
        else:
            rows.append(f'<div class="skill-row"><span class="skill-value">{_esc(it["value"])}</span></div>')
    return f'<div class="skill-list">{"".join(rows)}</div>'


def _render_kv_tags(items: list[dict]) -> str:
    rows = []
    for it in items:
        tags_html = "".join(
            f'<span class="skill-tag">{_esc(v.strip())}</span>'
            for v in (it["value"] or "").split(",")
            if v.strip()
        )
        if it["label"]:
            rows.append(
                f'<div class="skill-tag-row">'
                f'<span class="skill-tag-label">{_esc(it["label"])}</span>'
                f'{tags_html}'
                f'</div>'
            )
        else:
            rows.append(f'<div class="skill-tag-row">{tags_html}</div>')
    return f'<div class="skill-tags">{"".join(rows)}</div>'


def render_html(data: dict, template: str) -> str:
    h = data["header"]
    name_html = f'<div class="resume-name">{_esc(h["name"])}</div>'
    headline_html = (
        f'<div class="resume-headline">{_esc(h["headline"])}</div>'
        if h["headline"] else ""
    )
    contacts_html = ""
    if h["contacts"]:
        contacts_html = (
            '<div class="resume-contacts">'
            + " · ".join(_esc(c) for c in h["contacts"])
            + "</div>"
        )

    sections_html_parts = []
    for sec in data["sections"]:
        title = _esc(sec["title"])
        if sec["type"] == "entries":
            inner = "".join(_render_entry(e) for e in sec.get("entries", []))
        elif sec["type"] == "kv":
            if template in _TAG_TEMPLATES:
                inner = _render_kv_tags(sec.get("items", []))
            else:
                inner = _render_kv_inline(sec.get("items", []))
        else:
            inner = f'<div class="section-text">{_esc(sec.get("content", ""))}</div>'
        section_id = sec["title"].lower().replace(" ", "-")
        sections_html_parts.append(
            f'<section class="resume-section" data-section="{section_id}">'
            f'<h2 class="section-title">{title}</h2>'
            f'{inner}'
            f'</section>'
        )

    body_html = "".join(sections_html_parts)
    return (
        f'<div class="resume" data-template="{template}">'
        f'<header class="resume-header">{name_html}{headline_html}{contacts_html}</header>'
        f'<main class="resume-body">{body_html}</main>'
        f'</div>'
    )


def build_pdf(text: str, template: str) -> bytes:
    if not WEASYPRINT_AVAILABLE:
        raise HTTPException(status_code=501, detail="WeasyPrint не установлен")
    if template not in _TEMPLATE_VARS:
        template = "default"
    data = parse_resume(text)
    body_html = render_html(data, template)
    full_css = _BASE_CSS + _TEMPLATE_VARS[template]
    full_html = (
        f'<!DOCTYPE html><html><head><meta charset="utf-8">'
        f'<style>{full_css}</style></head><body>'
        f'{body_html}'
        f'</body></html>'
    )
    return WeasyHTML(string=full_html).write_pdf()


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


class PdfRequest(BaseModel):
    text: str
    template: str = "default"


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

    # Strip ```...``` wrapping if AI ignored the rule
    tailored = re.sub(r"^```[a-z]*\n", "", tailored.strip())
    tailored = re.sub(r"\n```$", "", tailored)

    logger.info(
        "Tailor done. Input: %d chars, output: %d chars",
        len(body.resume) + len(body.job_description),
        len(tailored),
    )
    return TailorResponse(tailored_resume=tailored)


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
@limiter.limit("20/minute")
async def export_pdf(request: Request, body: PdfRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Текст пустой")
    try:
        pdf_bytes = build_pdf(body.text, body.template)
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
import os as _os
_static_dir = "/app/static" if _os.path.isdir("/app/static") else _os.path.join(_os.path.dirname(__file__), "static")
if _os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")

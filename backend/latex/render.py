"""LaTeX → PDF rendering via tectonic (preferred) or xelatex (fallback).

Templates live in ../templates/*.tex.j2. They are rendered with a Jinja2
environment that uses non-default delimiters so braces stay free for TeX.

Public surface:
    compile_pdf(text: str, template: str) -> bytes
    TEMPLATES: list[str]
"""

import os
import shutil
import subprocess
import tempfile
import logging
import hashlib
import time
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .avatar import prepare_avatar
from .escape import latex_escape, latex_url

logger = logging.getLogger("resume_tailor.latex")

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

TEMPLATES = ["awesome", "two_column", "vivid", "classic", "engineer", "academic", "personal", "hipster"]

_DEFAULT_TEMPLATE = "awesome"

_engine_cache: Optional[list[str]] = None


class LatexCompileError(RuntimeError):
    pass


def _detect_engine() -> list[str]:
    """Return the command prefix for compiling .tex → PDF.

    Tries tectonic first (single binary, self-contained), then xelatex.
    Caches the result for the process lifetime.
    """
    global _engine_cache
    if _engine_cache is not None:
        return _engine_cache
    tectonic = shutil.which("tectonic")
    if tectonic:
        _engine_cache = [tectonic, "-X", "compile", "--keep-logs", "--outdir"]
        return _engine_cache
    xelatex = shutil.which("xelatex")
    if xelatex:
        _engine_cache = [xelatex, "-interaction=nonstopmode", "-halt-on-error", "-output-directory"]
        return _engine_cache
    raise LatexCompileError(
        "Не найден LaTeX-движок. Установи tectonic (рекомендуется) или xelatex."
    )


def _jinja_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        block_start_string="<%",
        block_end_string="%>",
        variable_start_string="<<",
        variable_end_string=">>",
        comment_start_string="<#",
        comment_end_string="#>",
        trim_blocks=True,
        lstrip_blocks=True,
        autoescape=False,
        keep_trailing_newline=True,
    )
    env.filters["tex"] = latex_escape
    env.filters["texurl"] = latex_url
    return env


_env: Optional[Environment] = None


def _get_env() -> Environment:
    global _env
    if _env is None:
        _env = _jinja_env()
    return _env


# ── Cache ──────────────────────────────────────────────────────────────────
# Tiny in-memory cache so the preview can hammer this endpoint as the user
# types without re-running tectonic for the same content. Cap is small — the
# PDF is just a few hundred KB.

_CACHE_TTL_SEC = 1800
_CACHE_MAX = 128
_pdf_cache: dict[str, tuple[float, bytes]] = {}


def _cache_key(text: str, template: str, avatar_fingerprint: str = "") -> str:
    h = hashlib.blake2s(digest_size=20)
    h.update(template.encode("utf-8"))
    h.update(b"\0")
    h.update(text.encode("utf-8"))
    h.update(b"\0")
    h.update(avatar_fingerprint.encode("utf-8"))
    return h.hexdigest()


def _cache_get(key: str) -> Optional[bytes]:
    entry = _pdf_cache.get(key)
    if not entry:
        return None
    ts, data = entry
    if time.time() - ts > _CACHE_TTL_SEC:
        _pdf_cache.pop(key, None)
        return None
    return data


def _cache_put(key: str, data: bytes) -> None:
    if len(_pdf_cache) >= _CACHE_MAX:
        oldest = min(_pdf_cache.items(), key=lambda kv: kv[1][0])[0]
        _pdf_cache.pop(oldest, None)
    _pdf_cache[key] = (time.time(), data)


# ── Render ─────────────────────────────────────────────────────────────────


def _resolve_template(name: str) -> str:
    if name in TEMPLATES:
        return name
    return _DEFAULT_TEMPLATE


def _build_context(data: dict, avatar_filename: Optional[str] = None) -> dict:
    """Normalize parsed-resume dict into something the templates can iterate
    over without conditional gymnastics in TeX."""
    header = data.get("header", {}) or {}
    sections = data.get("sections", []) or []

    by_type: dict[str, list[dict]] = {"text": [], "entries": [], "kv": []}
    summary = None
    experience = []
    education = []
    projects = []
    skills = []
    languages = None
    other_sections = []  # unrecognized text sections
    doc_lang = _document_lang(data)
    labels = _labels_for_lang(doc_lang)

    for sec in sections:
        title = (sec.get("title") or "").strip()
        upper = title.upper()
        stype = sec.get("type", "text")

        if stype == "text":
            content = (sec.get("content") or "").strip()
            if upper in ("SUMMARY", "ABOUT", "PROFILE", "О СЕБЕ", "ОБО МНЕ", "ОБОМНЕ", "ПРОФИЛЬ"):
                summary = content
            elif upper in ("LANGUAGES", "ЯЗЫКИ"):
                languages = content
            else:
                other_sections.append({"title": title, "content": content})
        elif stype == "entries":
            entries = sec.get("entries", []) or []
            if upper in ("EXPERIENCE", "WORK", "WORK EXPERIENCE", "ОПЫТ", "ОПЫТ РАБОТЫ"):
                experience = entries
            elif upper in ("EDUCATION", "ОБРАЗОВАНИЕ"):
                education = entries
            elif upper in ("PROJECTS", "ПРОЕКТЫ"):
                projects = entries
            else:
                other_sections.append({"title": title, "entries": entries})
        elif stype == "kv":
            if upper in ("SKILLS", "TECHNOLOGIES", "TECH STACK", "НАВЫКИ", "СТЕК", "ТЕХНОЛОГИИ"):
                skills = sec.get("items", []) or []
            else:
                other_sections.append({"title": title, "items": sec.get("items", []) or []})

        by_type.setdefault(stype, []).append(sec)

    # Split contacts into emails/phones/links/other for templates that want icons
    contacts = header.get("contacts", []) or []
    emails, phones, links, other_contacts = [], [], [], []
    for c in contacts:
        s = (c or "").strip()
        if not s:
            continue
        if "@" in s and " " not in s and "://" not in s:
            emails.append(s)
        elif s.startswith(("http://", "https://", "www.")):
            links.append(s)
        elif any(ch.isdigit() for ch in s) and (
            s.startswith("+") or sum(ch.isdigit() for ch in s) >= 6
        ):
            phones.append(s)
        else:
            other_contacts.append(s)

    return {
        "name": header.get("name", "") or "",
        "headline": header.get("headline", "") or "",
        "salary_expectation": header.get("salary_expectation", "") or "",
        "salary_label": header.get("salary_label", "") or (
            "Ожидаемый доход"
            if _has_cyrillic(header.get("salary_expectation", "") or "")
            else "Expected salary"
        ),
        "contacts": contacts,
        "emails": emails,
        "phones": phones,
        "links": links,
        "other_contacts": other_contacts,
        "summary": summary,
        "experience": experience,
        "education": education,
        "projects": projects,
        "skills": skills,
        "languages": languages,
        "other_sections": other_sections,
        "raw_sections": sections,
        "doc_lang": doc_lang,
        "labels": labels,
        "avatar_path": avatar_filename,
    }


def _has_cyrillic(value: str) -> bool:
    return any("а" <= ch.lower() <= "я" or ch.lower() == "ё" for ch in value or "")


def _document_lang(data: dict) -> str:
    header = data.get("header", {}) or {}
    chunks = [
        header.get("name", ""),
        header.get("headline", ""),
        header.get("salary_expectation", ""),
        " ".join(header.get("contacts", []) or []),
    ]
    for sec in data.get("sections", []) or []:
        chunks.append(sec.get("title", "") or "")
        chunks.append(sec.get("content", "") or "")
        for entry in sec.get("entries", []) or []:
            chunks.extend([
                entry.get("title", ""),
                entry.get("subtitle", ""),
                entry.get("description", ""),
                " ".join(entry.get("bullets", []) or []),
            ])
        for item in sec.get("items", []) or []:
            chunks.extend([item.get("label", ""), item.get("value", "")])
    return "ru" if _has_cyrillic("\n".join(chunks)) else "en"


def _labels_for_lang(lang: str) -> dict:
    if lang == "ru":
        return {
            "summary": "О себе",
            "profile": "О себе",
            "about": "О себе",
            "experience": "Опыт работы",
            "employment": "Опыт работы",
            "education": "Образование",
            "skills": "Навыки",
            "technical_skills": "Навыки",
            "projects": "Проекты",
            "languages": "Языки",
            "contact": "Контакты",
            "personal_details": "Контакты",
        }
    return {
        "summary": "Summary",
        "profile": "Profile",
        "about": "About",
        "experience": "Experience",
        "employment": "Employment",
        "education": "Education",
        "skills": "Skills",
        "technical_skills": "Technical Skills",
        "projects": "Projects",
        "languages": "Languages",
        "contact": "Contact",
        "personal_details": "Personal Details",
    }


def render_latex(data: dict, template: str, avatar_filename: Optional[str] = None) -> str:
    tpl_name = _resolve_template(template)
    env = _get_env()
    tpl = env.get_template(f"{tpl_name}.tex.j2")
    ctx = _build_context(data, avatar_filename=avatar_filename)
    return tpl.render(**ctx)


def _run_compiler(tex_source: str, work_dir: Path) -> Path:
    cmd_prefix = _detect_engine()
    tex_path = work_dir / "resume.tex"
    tex_path.write_text(tex_source, encoding="utf-8")

    if "tectonic" in cmd_prefix[0]:
        cmd = cmd_prefix + [str(work_dir), str(tex_path)]
    else:
        cmd = cmd_prefix + [str(work_dir), str(tex_path)]

    try:
        result = subprocess.run(
            cmd,
            cwd=str(work_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise LatexCompileError("LaTeX compile timed out (60s)")

    pdf_path = work_dir / "resume.pdf"
    if not pdf_path.exists() or pdf_path.stat().st_size < 100:
        log_tail = (result.stdout or b"").decode("utf-8", errors="replace")[-2000:]
        logger.error("LaTeX compile failed:\n%s", log_tail)
        raise LatexCompileError(
            f"LaTeX compile failed (exit {result.returncode}).\n{log_tail}"
        )
    return pdf_path


def compile_pdf(
    parsed: dict,
    template: str,
    avatar_base64: Optional[str] = None,
    avatar_shape: str = "circle",
) -> bytes:
    """Render parsed resume data through the chosen template, then compile to PDF."""
    tpl_name = _resolve_template(template)

    has_avatar = bool(avatar_base64)
    avatar_filename = None
    avatar_fingerprint = ""
    if has_avatar:
        avatar_filename = "avatar.png" if avatar_shape == "circle" else "avatar.jpg"
        fp = hashlib.blake2s(digest_size=16)
        fp.update(avatar_shape.encode("utf-8"))
        fp.update(b"\0")
        fp.update(avatar_base64.encode("ascii", errors="ignore"))
        avatar_fingerprint = fp.hexdigest()

    tex_source = render_latex(parsed, tpl_name, avatar_filename=avatar_filename)
    key = _cache_key(tex_source, tpl_name, avatar_fingerprint)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    with tempfile.TemporaryDirectory(prefix="resume-tex-") as td:
        work = Path(td)
        if has_avatar:
            # AvatarError (subclass of ValueError) propagates; main.py converts it to HTTP 400.
            prepare_avatar(avatar_base64, avatar_shape, work)
        pdf_path = _run_compiler(tex_source, work)
        pdf_bytes = pdf_path.read_bytes()
    _cache_put(key, pdf_bytes)
    return pdf_bytes

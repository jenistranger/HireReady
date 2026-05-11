import io
import sys
from pathlib import Path

# Make backend/ importable when running `pytest backend/tests/`
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
import main as app_module
from main import app, parse_resume

client = TestClient(app)


def test_health_returns_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model"] == "google/gemini-2.0-flash-001"


def test_tailor_size_limit_resume():
    huge = "x" * 16_000
    r = client.post("/api/tailor", json={"resume": huge, "job_description": "ok"})
    assert r.status_code == 422


def test_tailor_size_limit_job():
    huge = "y" * 26_000
    r = client.post("/api/tailor", json={"resume": "ok", "job_description": huge})
    assert r.status_code == 422


def test_extract_pdf_rejects_non_pdf():
    r = client.post(
        "/api/extract-pdf",
        files={"file": ("readme.md", b"# Markdown content", "text/markdown")},
    )
    assert r.status_code == 400
    assert "PDF" in r.json()["detail"]


def test_extract_pdf_rejects_size():
    big = b"%PDF-" + b"\x00" * (5 * 1024 * 1024 + 100)
    r = client.post(
        "/api/extract-pdf",
        files={"file": ("big.pdf", big, "application/pdf")},
    )
    assert r.status_code == 400
    assert "MB" in r.json()["detail"] or "большой" in r.json()["detail"]


def test_fetch_url_blocks_loopback():
    r = client.post("/api/fetch-url", json={"url": "http://127.0.0.1:8000/health"})
    assert r.status_code == 400


def test_fetch_url_blocks_private_ip():
    r = client.post("/api/fetch-url", json={"url": "http://10.0.0.1/admin"})
    assert r.status_code == 400


def test_fetch_url_blocks_link_local():
    # AWS metadata endpoint
    r = client.post("/api/fetch-url", json={"url": "http://169.254.169.254/"})
    assert r.status_code == 400


def test_fetch_url_blocks_non_http():
    r = client.post("/api/fetch-url", json={"url": "file:///etc/passwd"})
    assert r.status_code == 400


def test_parse_resume_basic():
    text = """John Doe
Senior Engineer
Moscow · john@example.com · github.com/jd

## SUMMARY
Experienced engineer with 8 years building scalable systems.

## EXPERIENCE

### Senior Engineer · TechCorp
2022 — Present · Moscow
* Led migration to microservices, cut latency by 40%
* Mentored 4 junior engineers

### Engineer · StartupCo
2020 — 2022 · Saint Petersburg
* Built analytics dashboard processing 1M events/day

## EDUCATION

### MS Computer Science · MSU
2018 — 2020

## SKILLS
**Languages:** Python, Go, TypeScript
**Tools:** Docker, Kubernetes
"""
    data = parse_resume(text)
    assert data["header"]["name"] == "John Doe"
    assert data["header"]["headline"] == "Senior Engineer"
    assert "john@example.com" in data["header"]["contacts"]
    assert "Moscow" in data["header"]["contacts"]

    titles = [s["title"] for s in data["sections"]]
    assert titles == ["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS"]

    summary = next(s for s in data["sections"] if s["title"] == "SUMMARY")
    assert summary["type"] == "text"
    assert "8 years" in summary["content"]

    experience = next(s for s in data["sections"] if s["title"] == "EXPERIENCE")
    assert experience["type"] == "entries"
    assert len(experience["entries"]) == 2
    e0 = experience["entries"][0]
    assert e0["title"] == "Senior Engineer"
    assert e0["subtitle"] == "TechCorp"
    assert e0["period"] == "2022 — Present"
    assert e0["location"] == "Moscow"
    assert len(e0["bullets"]) == 2
    assert "40%" in e0["bullets"][0]

    skills = next(s for s in data["sections"] if s["title"] == "SKILLS")
    assert skills["type"] == "kv"
    labels = [it["label"] for it in skills["items"]]
    assert "Languages" in labels
    assert "Tools" in labels


def test_parse_resume_handles_minimal():
    text = "Jane Doe\n\n## SUMMARY\nShort summary."
    data = parse_resume(text)
    assert data["header"]["name"] == "Jane Doe"
    assert data["header"]["headline"] == ""
    assert data["sections"][0]["content"] == "Short summary."


def test_improve_size_limit():
    huge = "x" * 16_000
    r = client.post("/api/improve", json={"resume": huge})
    assert r.status_code == 422


def test_improve_rejects_empty():
    # Falsy resume passes pydantic but server rejects after — but empty string
    # should still satisfy the validator (no size error), so server returns 400.
    r = client.post("/api/improve", json={"resume": "   "})
    assert r.status_code == 400
    assert "пуст" in r.json()["detail"].lower() or "empty" in r.json()["detail"].lower()


def test_latex_render_all_templates():
    """Every template should render to valid LaTeX source for the parsed data."""
    from latex.render import render_latex
    from main import LATEX_TEMPLATES

    text = (
        "Jane Doe\nEngineer\nMoscow · jane@example.com\n\n"
        "## SUMMARY\nTest summary with 50% growth.\n\n"
        "## EXPERIENCE\n\n### Eng · Co\n2022 — 2024 · Remote\n* Did stuff\n* More & cool 100%\n\n"
        "## EDUCATION\n\n### MSc · MSU\n2018 — 2020\n\n"
        "## SKILLS\n**Langs:** Python, Go\n"
    )
    data = parse_resume(text)
    for tpl in LATEX_TEMPLATES:
        tex = render_latex(data, tpl)
        assert "\\begin{document}" in tex
        assert "\\end{document}" in tex
        # User text with & and % must be escaped
        assert "100\\%" in tex or "100%" not in tex.split("\\end{document}")[0]


def test_latex_escape_dangerous_chars():
    """LaTeX-special chars in user data must be escaped, not passed through."""
    from latex.escape import latex_escape

    raw = r"a & b $ c % d # e _ f { g } h ~ i ^ j \ k"
    out = latex_escape(raw)
    for forbidden in ["& ", "$ ", "% ", "# ", "_ ", "{ ", "} "]:
        # Each special char must be prefixed by \ in the escaped output
        # (we test that the literal "& " never appears unescaped)
        assert f"\\{forbidden.strip()}" in out or forbidden.strip() not in raw
    assert r"\textbackslash" in out


def test_pdf_generation_skipped_without_engine():
    """build_pdf should compile when a LaTeX engine is available; skip otherwise."""
    import shutil
    import pytest

    if not (shutil.which("tectonic") or shutil.which("xelatex")):
        pytest.skip("No LaTeX engine available (tectonic/xelatex)")

    text = "Jane Doe\nEngineer\nMoscow\n\n## SUMMARY\nTest.\n\n## EXPERIENCE\n\n### Eng · Co\n2022 — 2024\n* Did stuff\n"
    from main import LATEX_TEMPLATES
    for tpl in LATEX_TEMPLATES:
        pdf = app_module.build_pdf(text, tpl)
        assert pdf.startswith(b"%PDF"), f"Template {tpl} did not produce PDF"
        assert len(pdf) > 500, f"Template {tpl} PDF suspiciously small"

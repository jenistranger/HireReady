# Phase X — Качество резюме + 6 шаблонов (Opus changes)

Реализация плана `delegated-bubbling-beacon`: сильнее AI-промпт, structured-markdown формат, парсер, 6 шаблонов, расширенная структурированная форма, live preview + critical fixes.

---

## 1. Backend — AI-промпт + structured-markdown формат

**Файл:** `backend/main.py`

- `SYSTEM_PROMPT` переписан под строгий structured-markdown:
  - Header: Имя / Headline / контакты через `·`
  - `## SUMMARY` — текстовая секция
  - `## EXPERIENCE` с `### Должность · Компания` + период · локация + `* bullets`
  - `## EDUCATION` — аналогично
  - `## SKILLS` — `**Категория:** значения через запятую`
  - Опциональные `## PROJECTS` / `## LANGUAGES`
- Добавлены правила: ATS-ключевые слова в первых трёх секциях, action verbs, метрики из оригинала, длина ≤ A4, никаких ```...```-обёрток.
- `MODEL = "google/gemini-2.0-flash-001"` (была сломанная `gemini-3.1-flash-lite`).

---

## 2. Backend — парсер `parse_resume`

**Файл:** `backend/main.py`

Один парсер обслуживает все 6 шаблонов. Возвращает:

```python
{
  "header": {"name": str, "headline": str, "contacts": [str]},
  "sections": [
    {"title": "SUMMARY", "type": "text", "content": str},
    {"title": "EXPERIENCE", "type": "entries", "entries": [
       {"title": str, "subtitle": str, "period": str, "location": str,
        "bullets": [str], "description": str}
    ]},
    {"title": "SKILLS", "type": "kv", "items": [{"label": str, "value": str}]},
  ]
}
```

Хелперы: `_section_type`, `_parse_entries`, `_parse_kv`. Поддержка RU/EN названий секций (`EXPERIENCE`/`ОПЫТ`, `SKILLS`/`НАВЫКИ` и т.д.).

---

## 3. Backend — 6 шаблонов (WeasyPrint)

**Файл:** `backend/main.py`

- `_BASE_CSS` — базовая раскладка через CSS variables.
- `_TEMPLATE_VARS` — словарь оверрайдов для каждого шаблона.
- `render_html(data, template)` → HTML с правильной структурой (period справа через flex, location под заголовком, bullets с маркерами).
- `_TAG_TEMPLATES = {"technical", "creative"}` — для них skills рендерятся как теги (`_render_kv_tags`), для остальных — inline (`_render_kv_inline`).
- 6 шаблонов: `default`, `modern`, `corporate`, `minimal`, `technical`, `creative`.
- `build_pdf(text, template)` — парсит, рендерит HTML, WeasyPrint → bytes. FPDF удалён, ветка `if template in (...)` убрана.

---

## 4. Backend — critical fixes

- **SSRF (`/api/fetch-url`):** проверка scheme (http/https), резолв hostname через `socket.gethostbyname`, блок `is_private/is_loopback/is_link_local/is_multicast`. AWS metadata `169.254.169.254` и `127.0.0.1` блокируются.
- **PDF upload (`/api/extract-pdf`):** проверка `content_type == application/pdf`, лимит 5 MB (`MAX_PDF_SIZE`), `@limiter.limit("10/minute")`.
- **Healthcheck Dockerfile:** добавлен `HEALTHCHECK` через `httpx.get(/health)` каждые 30s.
- **Static dir опционально:** при локальном запуске вне Docker `/app/static` отсутствует, теперь fallback на `backend/static`, mount только если папка существует — иначе тесты не могли импортировать `main`.

---

## 5. Backend — smoke tests

**Новые файлы:** `backend/tests/__init__.py`, `backend/tests/test_smoke.py`

12 тестов:
- `test_health_returns_ok` — `/health` + проверка `model`
- `test_tailor_size_limit_resume` — резюме > 15KB → 422
- `test_tailor_size_limit_job` — вакансия > 25KB → 422
- `test_extract_pdf_rejects_non_pdf` — не-PDF → 400
- `test_extract_pdf_rejects_size` — > 5MB → 400
- `test_fetch_url_blocks_loopback` — `127.0.0.1` → 400
- `test_fetch_url_blocks_private_ip` — `10.0.0.1` → 400
- `test_fetch_url_blocks_link_local` — `169.254.169.254` → 400
- `test_fetch_url_blocks_non_http` — `file://` → 400
- `test_parse_resume_basic` — полная проверка парсера: header, secs, entries, kv
- `test_parse_resume_handles_minimal` — минимальный edge case
- `test_pdf_generation_all_templates` — все 6 шаблонов генерируют валидный PDF (`%PDF` magic + > 1KB)

**Результат:** 12/12 проходит под pinned `requirements.txt` (системный Python на Kali имеет несовместимость weasyprint/pydyf, но Docker и `pip install -r requirements.txt` в venv работают).

`backend/requirements.txt`: + `pytest>=8.0.0`, `pytest-asyncio>=0.23.0`.

---

## 6. Frontend — расширенная структурированная форма

**Файл:** `frontend/src/components/StructuredResumeForm/StructuredResumeForm.jsx`

Добавлены секции (с динамическими списками add/remove):
- **Опыт работы (`experience`):** role, company, period, location, bullets (textarea, по строкам)
- **Образование (`education`):** degree, institution, period
- **Навыки (`skills`):** label (категория) + value (через запятую)

Стили в `StructuredResumeForm.module.css`: `.entryBox`, `.entryGrid` (grid 1fr 1fr), `.entryRemove` (absolute), `.bulletsTextarea`, `.subLabel`.

---

## 7. Frontend — `serializeStructuredData` → markdown

**Файл:** `frontend/src/App.jsx`

Полностью переписан. Теперь выдаёт **тот же markdown-формат**, что AI:
- Header: name / headline / contacts (location + values + links через `·`)
- `## SUMMARY`
- `## EXPERIENCE` с `### Role · Company`, период, `* bullets`
- `## EDUCATION` аналогично
- `## SKILLS` с `**Label:** value` парами

Это даёт preview live даже до запроса к AI и упрощает AI задачу (input в том же формате, что output).

---

## 8. Frontend — i18n

**Файл:** `frontend/src/i18n.js`

В `RU` и `EN` добавлены ключи в `structured`:
- Секции: `experienceTitle`, `educationTitle`, `skillsTitle`
- Поля: `role`, `company`, `period`, `locationField`, `bullets`, `degree`, `institution`, `skillLabel`, `skillValue`
- Кнопки: `addExperience`, `addEducation`, `addSkill`
- Placeholders для всех новых полей

---

## 9. Frontend — JS parser + renderer (live preview)

**Новый файл:** `frontend/src/components/ResumeRenderer/parseResume.js`

Зеркальная реализация `parse_resume` Python-парсера. Идентичный output:
- `ENTRY_SECTIONS` / `KV_SECTIONS` с RU+EN названиями
- `parseEntries` / `parseKv` хелперы
- Header → name / headline / contacts (через `·` `•` `|`)

**Полностью переписан:** `frontend/src/components/ResumeRenderer/renderResumeHtml.js`
- Использует `parseResume`.
- Эмитит HTML с классами `rv-name`, `rv-headline`, `rv-contacts`, `rv-section`, `rv-entry-header/title/subtitle/period/location/bullets`, `rv-skill-row/label/value`, `rv-skill-tag-row/label/tag`.
- `TAG_TEMPLATES = {technical, creative}` — для них skills как теги, для остальных inline.
- Принимает `template` параметр (раньше игнорировался).

**Обновлён:** `ResumeRenderer.jsx` — пробрасывает `template` в `renderResumeHtml`.

---

## 10. Frontend — 6 шаблонов CSS

**Файл:** `frontend/src/styles/resume.css`

Переписан целиком. Структура:
- `.rv-resume` имеет CSS-переменные (`--accent`, `--bg-header`, `--fg-subtle`, `--section-line`, `--tag-bg` и т.д.).
- Базовая раскладка: header с цветовой полосой слева, body с секциями, entries с `display: flex; justify-content: space-between` (period выровнен вправо), bullets `list-style: disc` с `::marker` в цвет акцента.
- Skills inline + tags (`.rv-skill-tag` — pill-style).
- Шаблон-специфичные оверрайды через `.rv-resume[data-template="..."]`:
  - **default:** navy + soft blue
  - **modern:** dark navy + cyan
  - **corporate:** light header + tracking
  - **minimal:** чёрно-белый, секции с тонкой линией, no header bar
  - **technical:** green tones, mono font для period/tags
  - **creative:** sidebar grid (`grid-template-columns: 1fr 2fr`), pink palette, skills/languages в сайдбар

---

## 11. Frontend — PreviewCard 6 кнопок

**Файл:** `frontend/src/components/PreviewCard/PreviewCard.jsx`

`TEMPLATES = ['default', 'modern', 'corporate', 'minimal', 'technical', 'creative']`

**Файл:** `frontend/src/components/PreviewCard/PreviewCard.module.css`

`.templateRow` и `.templateSelector` теперь имеют `flex-wrap: wrap` чтобы кнопки переносились на 2 строки.

---

## 12. Frontend — localStorage + canGenerate

**Файл:** `frontend/src/App.jsx`

- Язык: `useState(() => localStorage.getItem('lang') || 'ru')`, `useEffect` пишет обратно + ставит `document.documentElement.lang`.
- `canGenerate` вычисляется по факту: есть текст резюме (или непустая структурированная форма) И описание вакансии.
- `<JobCard canGenerate={canGenerate} />` → `disabled={isLoading || !canGenerate}`.

**Файл:** `frontend/src/components/JobCard/JobCard.jsx` — принимает `canGenerate`, прокидывает в disabled.

---

## 13. Прочее

- `.gitignore` дополнен: `backend/__pycache__/`, `backend/.venv/`, `backend/tests/__pycache__/`, `.pytest_cache/`.

---

## Затронутые файлы

### Backend
- `backend/main.py` — SYSTEM_PROMPT, парсер, рендер, 6 шаблонов, MODEL, SSRF, PDF MIME/limit, static optional
- `backend/requirements.txt` — +pytest, pytest-asyncio
- `backend/tests/__init__.py` — новый
- `backend/tests/test_smoke.py` — новый, 12 тестов
- `Dockerfile` — HEALTHCHECK

### Frontend
- `frontend/src/App.jsx` — serialize переписан, localStorage, canGenerate, расширенный structuredData
- `frontend/src/i18n.js` — ключи experience/education/skills + placeholders
- `frontend/src/components/StructuredResumeForm/StructuredResumeForm.jsx` — +Experience/Education/Skills секции
- `frontend/src/components/StructuredResumeForm/StructuredResumeForm.module.css` — entryBox, bulletsTextarea, subLabel
- `frontend/src/components/JobCard/JobCard.jsx` — canGenerate prop
- `frontend/src/components/PreviewCard/PreviewCard.jsx` — 6 templates
- `frontend/src/components/PreviewCard/PreviewCard.module.css` — flex-wrap
- `frontend/src/components/ResumeRenderer/ResumeRenderer.jsx` — пробрасывает template
- `frontend/src/components/ResumeRenderer/renderResumeHtml.js` — полностью переписан
- `frontend/src/components/ResumeRenderer/parseResume.js` — новый
- `frontend/src/styles/resume.css` — 6 шаблонов с CSS variables, sidebar для creative

### Конфиг
- `.gitignore` — pycache, venv

---

## Verification

```bash
# Backend tests (12/12 под pinned requirements.txt)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pytest tests/ -v

# Frontend build (✅ 180KB JS, 25KB CSS)
cd frontend && npm run build

# JS-парсер выдаёт идентичную Python-парсеру структуру (проверено через node import)
```

---

## Что НЕ входит (по плану)

- Mobile responsive
- Полные тесты + GitHub Actions (только smoke)
- Lifespan / httpx pool / threadpool / retry
- API key rotation
- Аккаунты, история, квота

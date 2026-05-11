# Phase X — LaTeX-генерация, редактируемое PDF-превью, улучшайзер, 6 новых шаблонов

Полный pivot рендера PDF: WeasyPrint (HTML/CSS) → tectonic (XeLaTeX) с шаблонами через Jinja2. Превью на фронте стало реальным PDF в `<iframe>` с дебаунсом, рядом — sidebar редактирования по блокам (Header/Summary/каждый Experience/Education/Skill), клик на блок открывает inline-форму, сохранение перерисовывает PDF. Добавлена кнопка «✨ Улучшить резюме» — отдельный AI-режим без вакансии. Все 6 старых HTML-шаблонов заменены на 6 новых LaTeX-дизайнов с поддержкой кириллицы.

---

## 1. Backend — LaTeX-инфраструктура

### 1.1 `backend/latex/` (новый пакет)

**`backend/latex/escape.py`** — экранирование пользовательского текста под LaTeX:
- Заменяет `& % $ # _ { } ~ ^ \` на безопасные TeX-эквиваленты (`\&`, `\%`, …, `\textbackslash{}`).
- XeLaTeX через fontspec нативно понимает UTF-8 (кириллица, эмодзи), поэтому имена/контакты/буллеты не требуют дополнительной транслитерации.
- `latex_url(value)` — отдельная функция для URL внутри `\href{...}{...}` (только разрешённые URL-символы).

**`backend/latex/render.py`** — компиляция:
- `_detect_engine()` — ищет `tectonic`, fallback на `xelatex` через `shutil.which`. Кешируется на жизнь процесса.
- Jinja2 environment с переопределёнными разделителями (чтобы не конфликтовало с TeX):
  - блоки: `<% ... %>` (вместо `{% %}`)
  - переменные: `<< var >>` (вместо `{{ }}`)
  - комментарии: `<# ... #>`
- Регистрируется фильтр `tex` (экранизация) и `texurl`.
- `_build_context(data)` нормализует распарсенный markdown:
  - имя, headline, контакты (с автодетекцией e-mail/телефона/ссылки/локации — для шаблонов с иконками)
  - `summary`, `experience`, `education`, `projects`, `skills`, `languages`, `other_sections`
- `render_latex(data, template)` → str: jinja2 рендерит `templates/<name>.tex.j2`.
- `compile_pdf(data, template)` → bytes: рендерит TeX, пишет в `tempfile.TemporaryDirectory`, запускает компилятор с таймаутом 60s, читает `resume.pdf`. Ошибка → `LatexCompileError` с хвостом лога.
- **In-memory кеш**: ключ = SHA1 от `(template, rendered TeX)`. TTL 5 минут, max 32 записи (LRU-ish). Чтобы превью не дёргало tectonic при каждом keystroke в EditPanel.

### 1.2 `backend/main.py`

- Удалён весь WeasyPrint-блок: `_BASE_CSS`, `_TEMPLATE_VARS`, `render_html`, `_render_entry`, `_render_kv_inline`, `_render_kv_tags`, старый `build_pdf`. Парсер `parse_resume` оставлен — он же используется в `compile_pdf`.
- Новый `build_pdf(text, template)` — тонкая обёртка: `parse_resume → compile_pdf`. Если шаблон неизвестен, fallback на первый из `LATEX_TEMPLATES`.
- `/api/pdf` теперь принимает `inline: bool` в теле. При `inline=true` отдаётся `Content-Disposition: inline` (для iframe-превью), иначе `attachment` (скачивание). Заголовок `Cache-Control: no-store` чтобы браузер не подсовывал кеш.
- Rate limit на `/api/pdf` поднят с 20/min до 60/min — иначе debounced auto-refresh упирается в лимит.
- Ловится `LatexCompileError` отдельно от прочих ошибок, в API возвращается 500 с детализированным сообщением, в лог — хвост лога tectonic.
- Хелпер `_call_openrouter(system_prompt, user_message)` вынесен из `tailor_resume`, чтобы переиспользоваться в `improve_resume`.

### 1.3 `backend/requirements.txt`

- `+jinja2>=3.1.4`
- `-weasyprint>=61.0`

### 1.4 `Dockerfile`

- Stage 2 (python:3.12-slim) дополнен:
  - `curl`, `ca-certificates`, `fontconfig`
  - `fonts-dejavu-core`, `fonts-dejavu-extra`, `fonts-liberation`, `fonts-liberation2`, `fonts-noto-core` (поддержка кириллицы для всех шаблонов через DejaVu Sans/Serif)
  - `fc-cache -f`
- Tectonic 0.15.0 скачивается с GitHub Releases, multi-arch (x86_64 + aarch64).
- `TECTONIC_CACHE_DIR=/app/.tectonic-cache`.
- **Pre-warm**: dummy-документ со всеми пакетами, которые используют шаблоны (`fontspec`, `geometry`, `xcolor`, `titlesec`, `enumitem`, `fontawesome5`, `paracol`, `hyperref`, `tcolorbox`, `tabularx`, `multicol`, `ragged2e`, `etoolbox`, `tikz`, `eso-pic`). Tectonic при первом запуске тянет ~50 пакетов и пишет в кеш — после pre-warm в Docker первый реальный PDF собирается за ~1.5s, без pre-warm 8–15s.
- `COPY backend/main.py .` → `COPY backend/ ./` (теперь копируется `latex/` и `templates/`).

---

## 2. 6 новых LaTeX-шаблонов

Все живут в `backend/templates/*.tex.j2`. Каждый — независимый `\documentclass{article}` (без общего base — у них принципиально разная геометрия и пакеты). XeLaTeX, DejaVu Sans / DejaVu Serif как основной шрифт (есть в любом Linux Docker, поддерживает кириллицу).

| ID | Стиль | Особенности |
|---|---|---|
| `awesome` | Awesome-CV-вдохновлённый | Indigo accent (#2D5BFF), большой centered name, иконки FontAwesome для контактов, тонкие линии под секциями |
| `two_column` | Двухколоночный | paracol 36/64, тёмный sidebar (#1F2D3D) с золотым акцентом (#F59E0B). Sidebar-bg через tikz + eso-pic растянут на всю высоту страницы |
| `minimal` | Минималистичный serif | DejaVu Serif, много воздуха, золотая мелкая черта-разделитель под именем, mark caps для секций |
| `bold` | Большой header-bar | Чёрный header через tikz overlay, ярко-красная плашка (#E11D48), круглые буллеты accent-цвета |
| `executive` | Классический серьёзный | Centered header, navy + grey, тонкая horizontal-rule под каждой секцией, italic для subtitle |
| `vivid` | Цветной градиент | Linear-shade purple→pink через tikz, white text на header, rounded "pill"-tags для skills через tcolorbox |

### 2.1 Контракт jinja-контекста

Шаблоны получают одно и то же:

```python
{
    "name": str, "headline": str, "contacts": [str],
    "emails": [str], "phones": [str], "links": [str], "other_contacts": [str],
    "summary": str | None,
    "experience": [Entry], "education": [Entry], "projects": [Entry],
    "skills": [KV],
    "languages": str | None,
    "other_sections": [{title, content|entries|items}],
}
```

Где `Entry = {title, subtitle, period, location, bullets, description}`, `KV = {label, value}`.

### 2.2 Нюансы, которые ловились

- **Комментарии Jinja2**: `{# comment #}` нужно писать как `<# comment #>` после переопределения разделителей. Иначе `#` пролетает в LaTeX и tex падает на `macro parameter character #'`.
- **Switch-команды без пробела**: `{\large<< var >>}` после рендера даёт `\largeFoo` — LaTeX считает это командой и падает. Везде заменено на `{\large << var >>}` или закрытие через `\color{...}` (после `}` сцепления не происходит).
- **`\MakeUppercase` в format-блоке titleformat**: ломал after-code (`\textcolor{rule}` → `\textcolor{RULE}` → undefined color). Перенесён в before-code wrap.
- **`\faMapMarkerAlt` отсутствует** в той версии fontawesome5, которую тянет tectonic. Везде используется `\faMapMarker*` (звёздная форма для solid-варианта).
- **`contacts | join(...) | tex`**: фильтр `tex` экранировал разделители, в PDF появлялся литерал `\{\}\textperiodcentered\{\}`. Заменено на `contacts | map('tex') | join('...')` — экранизация по элементу, разделитель остаётся raw.

---

## 3. Endpoint `/api/improve` (улучшение без вакансии)

`backend/main.py`:

- Новый `SYSTEM_PROMPT_IMPROVE` — переписать резюме в action verbs, исправить грамматику, привести к чистой структуре, сохранить все факты и метрики. Не таргетировать под вакансию.
- `ImproveRequest` / `ImproveResponse` модели pydantic с тем же лимитом 15 KB, что и `/api/tailor`.
- `POST /api/improve` с `@limiter.limit("5/minute")`. Использует `_call_openrouter(SYSTEM_PROMPT_IMPROVE, user_message)`.
- Smoke-тесты: `test_improve_size_limit` (резюме > 15KB → 422), `test_improve_rejects_empty` (пустое → 400).

---

## 4. Frontend — PDF-превью через iframe

### 4.1 `frontend/src/api.js`

- `+ previewPdf(text, template, {signal})` → `Blob`. Отправляет `inline: true`. Принимает `AbortSignal` для отмены через `AbortController`.
- `+ improveResume(resume)` → `string`.
- `downloadPdf` теперь явно отправляет `inline: false`.

### 4.2 `PreviewCard.jsx` (переписан)

- `useState pdfUrl, pdfError, refreshing`. `useRef abortRef, lastUrlRef`.
- `useEffect [result, template]` → debounce 800ms → `AbortController` отменяет предыдущий запрос → `api.previewPdf` → `URL.createObjectURL`. Старый blob URL ревокается. Cleanup в return снимает таймер; cleanup на unmount отменяет in-flight запрос и ревокает blob.
- Состояния отображения:
  - нет результата + не загрузка → SkeletonPaper (как было)
  - AI генерирует → spinner
  - есть result, нет pdfUrl ещё → "Рендерю PDF…"
  - есть pdfUrl → `<iframe key={template} src="blob:...#toolbar=0&navpanes=0">`
  - идёт re-render → плавающий badge "Обновляю" с пульсирующей точкой
  - ошибка → красный блок с детализированным сообщением
- `TEMPLATES = ['awesome', 'two_column', 'minimal', 'bold', 'executive', 'vivid']` — синхронизировано с бэком. `TEMPLATE_LABELS` для подписи на кнопке.

### 4.3 `PreviewCard.module.css`

- `.previewBody` — flex row, iframe + EditPanel в одну линию (на мобилке column).
- `.pdfFrame` — `width: 100%; height: 100%; border: 0`.
- `.refreshBadge` — absolute top-right с пульсирующей точкой (`@keyframes pulse`).
- A4-скелетон конвертирован на `aspect-ratio: 210/297` чтобы корректно масштабироваться.

---

## 5. Frontend — Sidebar редактирования

### 5.1 `frontend/src/utils/parseResume.js`

Перенесён сюда из `components/ResumeRenderer/parseResume.js`. Логика не менялась — это JS-зеркало python-парсера: header + sections (`text` / `entries` / `kv`).

### 5.2 `components/PreviewCard/serialize.js` (новый)

`serializeResume(data) → str` — обратное преобразование parsed-tree в structured-markdown (тот же формат, что AI и LaTeX-рендер). Используется в EditPanel при сохранении блока.

### 5.3 `components/PreviewCard/EditPanel.jsx` (новый, полная реализация)

- Парсит `result` через `useMemo(parseResume(result))`.
- Сбор плоского списка блоков:
  - **Header** (имя, headline, контакты)
  - Для каждой `text`-секции (Summary, Languages, …) — отдельный блок
  - Для каждой `entries`-секции — по блоку на каждый entry + дополнительный pseudo-блок `+ Добавить запись (Experience)`
  - Для каждой `kv`-секции — по блоку на каждый skill + `+ Добавить навык`
- Состояние `openId` — какой блок развёрнут. Клик на header блока — toggle.
- Развёрнутый блок показывает inline-форму с полями именно этого блока (`HeaderForm`, `TextForm`, `EntryForm`, `SkillForm`).
- Сохранение через `patch(mutator)`:
  - `structuredClone(parsed)` → mutator меняет нужный путь → `serializeResume(next)` → вызывается `onChange(markdown)`.
  - Из `App.jsx` это `setResult` → меняется `result` → useEffect в PreviewCard стреляет debounce → PDF перерисовывается.
- `onDelete` для entry/skill убирает элемент из массива через `splice`.
- Никаких бакендов — всё мутируется локально, AI не вызывается.

### 5.4 `components/PreviewCard/EditPanel.module.css` (новый)

- `.panel` — sidebar 280–360px справа от PDF, на узких экранах (≤980px) уходит под PDF.
- Каждый блок — карточка с border, на hover синий outline, на open — accent border + box-shadow.
- Form-поля: `.input`, `.textarea` с focus-стейтом. `.grid2` — двухколоночная сетка для polished layout пары полей (Title/Subtitle, Period/Location).
- Кнопки: `.saveBtn` (синяя primary), `.deleteBtn` (red outline).

### 5.5 i18n

В RU и EN добавлены ключи `edit.*`: title, header, name, headline, contacts, title2, subtitle, period, location, bullets, description, skillLabel, skillValue, save, delete, addEntry, addSkill, untitled, skill.

---

## 6. Frontend — кнопка «✨ Улучшить резюме»

### 6.1 `ResumeCard.jsx`

- Новые props: `onImprove`, `canImprove`, `isImproving`.
- Кнопка `.improveBtn` под основным контентом карточки (под textarea / под структурированной формой). Disabled когда нет резюме или идёт улучшение/таилоринг.
- Лейбл переключается: `t.improve.button` ↔ `t.improve.running`.

### 6.2 `ResumeCard.module.css`

- `.improveBtn` — градиентный фон (purple→pink, 8% opacity), accent border, accent text. Hover поднимает opacity до 14%.
- `.improveSparkle` — отдельный span для эмодзи ✨ (по сути просто увеличенный font-size).

### 6.3 `App.jsx`

- `+ isImproving` state.
- `+ handleImprove()` — повторяет логику `handleGenerate`, но без проверки на вакансию и вызывает `api.improveResume(resume)`.
- В `JobCard` `isLoading={isLoading || isImproving}` — пока идёт улучшение, кнопка «Сгенерировать» тоже залочена.
- `ResumeCard` получает `onImprove={handleImprove}`, `canImprove={resumeNonEmpty}`, `isImproving={isImproving}`.

### 6.4 i18n

`improve: { button, running }` в RU и EN.

---

## 7. Frontend — чистка legacy HTML-рендера

Удалены:
- `frontend/src/components/ResumeRenderer/` (ResumeRenderer.jsx + renderResumeHtml.js + parseResume.js — parseResume переехал в `utils/`)
- `frontend/src/styles/resume.css` (5 KB CSS старых HTML-шаблонов)
- Импорт `./styles/resume.css` из `main.jsx`

Заменён `ExpandModal.jsx`:
- было: `<ResumeRenderer text={result} template={template} />` — рендер HTML на лету
- стало: `useEffect` → `api.previewPdf` → `<iframe src="blob:...">`. Cleanup ревокает blob.
- `.inner` расширен (720×1000px max) — на full-screen PDF нужно больше места.

Удалены legacy-стили из `ExpandModal.module.css`: `.content`, `:global(.rv-*)` оверрайды.

---

## 8. Тесты

`backend/tests/test_smoke.py`:

Старый `test_pdf_generation_all_templates` (требовал WeasyPrint) удалён. Добавлены:

- `test_latex_render_all_templates` — все 6 шаблонов рендерят валидный LaTeX, `\begin{document}/\end{document}` присутствуют, спец-символы в данных корректно экранированы.
- `test_latex_escape_dangerous_chars` — все спец-символы `& % $ # _ { } ~ ^ \` экранируются, обратный слеш становится `\textbackslash{}`.
- `test_pdf_generation_skipped_without_engine` — если есть `tectonic` или `xelatex` в PATH, реально собирается PDF (`%PDF` magic + размер > 500 байт) для всех 6 шаблонов. Без движка тест skip.
- `test_improve_size_limit` — резюме > 15KB → 422 (validator pydantic).
- `test_improve_rejects_empty` — пустое/whitespace-only резюме → 400.

**Итого: 16 тестов, все зелёные** (`pytest tests/ -v`). Без tectonic локально на Kali 14 проходит + 2 skip; с tectonic — 16/16.

---

## 9. Архитектура потока: что происходит при изменении в EditPanel

1. Пользователь меняет, например, период работы в inline-форме блока «Senior Engineer · TechCorp» и жмёт «Сохранить».
2. `EntryForm.save()` вызывает `onSave(updated)` → `patch(mutator)` в `EditPanel.jsx`.
3. `patch`: `structuredClone(parsed)` → mutator меняет `n.sections[sIdx].entries[eIdx]` → `serializeResume(next)` собирает новый markdown.
4. `onChange(markdown)` в `EditPanel` = `setResult` в `App.jsx`.
5. `App.jsx` → `result` обновился → `PreviewCard` получает новый `result`.
6. `useEffect([result, template])` в PreviewCard → debounce 800ms → AbortController прерывает любой in-flight запрос → `api.previewPdf(result, template)` → `POST /api/pdf {text, template, inline: true}`.
7. Backend: rate-limit 60/min → `build_pdf(text, template)` → `parse_resume(text)` → `compile_pdf(data, template)` → Jinja2 рендер `templates/awesome.tex.j2` → SHA1 кеш-ключ от TeX → если в кеше — отдаётся сразу, иначе `tectonic compile` (≤60s, кеш на 5 мин) → bytes.
8. Response: `Content-Type: application/pdf, Content-Disposition: inline, Cache-Control: no-store` + bytes.
9. Фронт: `Blob` → `URL.createObjectURL` → старый blob URL ревокается → новый `pdfUrl` → `<iframe key={template} src="blob:...#toolbar=0">` (key привязан к template, чтобы при смене шаблона iframe пересоздавался, а не пытался скроллиться внутри старого PDF).
10. PDF отрисован.

При смене шаблона (клик на кнопку footer) тот же useEffect отрабатывает заново, точно так же.

---

## 10. Затронутые файлы (полный список)

### Backend
- `backend/main.py` — переписан: убран WeasyPrint, добавлены /api/improve и /api/pdf?inline, новый _call_openrouter helper, build_pdf через latex.compile_pdf
- `backend/requirements.txt` — +jinja2, -weasyprint
- `backend/tests/test_smoke.py` — заменён pdf-test, добавлены latex/improve тесты
- `backend/latex/__init__.py` — новый
- `backend/latex/escape.py` — новый
- `backend/latex/render.py` — новый (Jinja2 env, кеш, _build_context, compile_pdf)
- `backend/templates/_base.tex.j2` — fallback-плейсхолдер (минимальный шаблон)
- `backend/templates/awesome.tex.j2` — новый
- `backend/templates/two_column.tex.j2` — новый
- `backend/templates/minimal.tex.j2` — новый
- `backend/templates/bold.tex.j2` — новый
- `backend/templates/executive.tex.j2` — новый
- `backend/templates/vivid.tex.j2` — новый

### Frontend
- `frontend/src/api.js` — +previewPdf, +improveResume; downloadPdf теперь шлёт inline:false
- `frontend/src/App.jsx` — +isImproving, +handleImprove, template default → 'awesome', onResultChange прокинут в PreviewCard
- `frontend/src/main.jsx` — убран import resume.css
- `frontend/src/i18n.js` — +preview.{rendering,refreshing,previewError}, +edit.*, +improve.* в RU и EN
- `frontend/src/components/ResumeCard/ResumeCard.jsx` — +кнопка Улучшить с props
- `frontend/src/components/ResumeCard/ResumeCard.module.css` — +.improveBtn стили
- `frontend/src/components/PreviewCard/PreviewCard.jsx` — переписан целиком (iframe + debounce + EditPanel slot)
- `frontend/src/components/PreviewCard/PreviewCard.module.css` — переписан (split layout, pdfFrame, refreshBadge)
- `frontend/src/components/PreviewCard/EditPanel.jsx` — новый
- `frontend/src/components/PreviewCard/EditPanel.module.css` — новый
- `frontend/src/components/PreviewCard/serialize.js` — новый (parsed → markdown)
- `frontend/src/components/ExpandModal/ExpandModal.jsx` — переписан на iframe
- `frontend/src/components/ExpandModal/ExpandModal.module.css` — переписан под полноэкранный PDF
- `frontend/src/utils/parseResume.js` — переехал из components/ResumeRenderer/

### Удалены
- `frontend/src/components/ResumeRenderer/` (вся папка)
- `frontend/src/styles/resume.css`

### Инфраструктура
- `Dockerfile` — tectonic 0.15.0 + fonts + pre-warm + COPY backend/ ./

---

## 11. Verification

```bash
# Backend tests (16/16 при наличии tectonic; 14+2 skip без)
cd backend && pytest tests/ -v

# Frontend build
cd frontend && npm run build
#   ✓ 58 modules transformed
#   dist/assets/index-*.css ~23 KB (gzip 4.7)
#   dist/assets/index-*.js ~189 KB (gzip 59)

# Локально с tectonic в PATH — реальная сборка PDF через TestClient
python -c "
import sys; sys.path.insert(0,'backend')
from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
text = open('sample.md').read()
for tpl in ['awesome','two_column','minimal','bold','executive','vivid']:
    r = c.post('/api/pdf', json={'text': text, 'template': tpl, 'inline': True})
    print(tpl, r.status_code, len(r.content), r.content[:4])
"

# Docker
docker compose up --build
```

---

## 12. Что НЕ входило (по плану)

- ATS-score
- Drag-and-drop переупорядочивание блоков в EditPanel
- WYSIWYG-форматирование (bold/italic) внутри блока — только plain text
- LinkedIn import
- Кастомный шрифт под пользователя (Inter/EB Garamond) — пока DejaVu Sans/Serif для надёжной кириллицы
- Click прямо по PDF (вместо этого sidebar — UX тот же, реализация на порядок проще)
- Реализация resume-кеша на стороне фронта (полагаемся на backend in-memory + AbortController + debounce)

---

## 13. Известные риски

- Tectonic при первом холодном старте без pre-warm докачивает пакеты (~10s overhead) — pre-warm в Dockerfile должен это закрыть, но если на production первый запрос всё-таки попадает на cold cache, юзер увидит спиннер дольше обычного. Кеш в `TECTONIC_CACHE_DIR=/app/.tectonic-cache` сохраняется между запусками только если volume mount; на эфемерных платформах (Fly.io scratch-старт) pre-warm должен сработать.
- Pydantic-валидатор `resume_size` принимает пустую строку — серверная проверка `if not body.resume.strip()` ловит это до AI-вызова, возвращая 400.
- EditPanel мутирует структуру и пересобирает markdown — если AI выплюнул нестандартное форматирование (несколько пробелов, странные `·`), парсер потеряет нюансы и при serialize получим slightly другой markdown. На практике AI следует SYSTEM_PROMPT и формат стабилен; ручной ввод в EditPanel идёт уже через нашу строгую сериализацию.

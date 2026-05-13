# Resume Tailor

ИИ-таилоринг резюме под конкретную вакансию: вставляешь свой опыт + описание вакансии, на выходе — переработанное резюме в одном из 8 LaTeX-дизайнов с возможностью добавить фото.

## Стек

- **Backend:** FastAPI (Python 3.12), Pillow, slowapi, pypdf, Jinja2
- **PDF-рендер:** LaTeX через [Tectonic](https://tectonic-typesetting.github.io/) (single-binary, кеширует пакеты с CTAN)
- **Frontend:** React 18 + Vite, [react-easy-crop](https://github.com/ValentinH/react-easy-crop) для обрезки фото
- **ИИ:** OpenRouter API (модель настраивается в `backend/main.py`)
- **Контейнеризация:** Docker (multi-stage build, non-root user)

## Возможности

- Адаптация резюме под вакансию (`/api/tailor`) и улучшение без вакансии (`/api/improve`)
- Импорт текста: вставка вручную, выгрузка PDF, загрузка вакансии по URL
- Структурированная форма (имя, опыт работы с датами, образование, навыки по категориям) или свободный markdown-режим
- Фото с встроенным редактором: zoom + drag, переключение круг/квадрат, лимит 5 МБ (JPG/PNG/WEBP)
- 8 LaTeX-шаблонов, выбор через dropdown с описаниями + кнопкой «Применить»
- Живой PDF-превью с debounce (рендер в iframe), скачивание готового файла
- Кеши: PDF (128 слотов, TTL 30 мин) + предобработанные аватары (LRU 16 слотов) — повторные превью отдаются мгновенно
- Локализация RU / EN

## Шаблоны резюме

| Ключ | Описание |
|------|----------|
| `awesome` | Современный, акцентный цвет, иконки контактов |
| `two_column` | Тёмный sidebar и основная колонка |
| `vivid` | Градиентный хедер, скилл-пилюли |
| `classic` | Академичный, цветная полоса с именем (ModernCV-inspired) |
| `engineer` | Плотный, ATS-friendly, sans-serif (harshibar-inspired) |
| `academic` | Серьёзный serif, фото в углу шапки (CurVe-inspired) |
| `personal` | Фото слева, контрастные date-chips (Boltach-inspired) |
| `hipster` | Двухколоночный с цветными pills (simple-hipster-inspired) |

Все шаблоны поддерживают опциональное фото — на бэке Pillow перед рендером декодирует base64, центрирует и (для круга) накладывает alpha-маску.

## Запуск через Docker

```bash
# .env должен содержать ключ OpenRouter
echo 'openrouter_api_key=sk-or-v1-...' > .env

docker compose build
docker compose up -d
# Приложение: http://localhost:47821
```

## Локальный запуск (для разработки)

```bash
# Backend (требуется tectonic в $PATH)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 47821

# Frontend в другом терминале
cd frontend
npm install
npm run dev
# http://localhost:5173 — Vite проксирует /api/* на 47821
```

## API

| Endpoint | Метод | Что делает |
|----------|-------|------------|
| `/health` | GET | Health check |
| `/api/tailor` | POST | Адаптирует резюме под вакансию (OpenRouter) |
| `/api/improve` | POST | Переписывает резюме без привязки к вакансии |
| `/api/pdf` | POST | Рендерит PDF из markdown через LaTeX. Принимает `text`, `template`, `inline`, опционально `avatar_base64` + `avatar_shape` |
| `/api/extract-pdf` | POST | Извлекает текст из загруженного PDF |
| `/api/fetch-url` | POST | Скачивает текст с публичной страницы (с SSRF-защитой) |

Лимиты: `/api/tailor` 5 req/min на IP, `/api/improve` 10/min, `/api/pdf` 60/min, прочие 30/min.

## Структура

```
backend/
├── main.py                 # FastAPI, эндпоинты, парсер markdown-резюме
├── latex/
│   ├── render.py           # Jinja2 + tectonic, PDF-кеш
│   ├── avatar.py           # Pillow + in-memory LRU
│   └── escape.py           # LaTeX-эскейпинг (фильтры `tex`, `texurl`)
├── templates/
│   └── *.tex.j2            # 8 шаблонов резюме
└── tests/

frontend/
├── src/
│   ├── App.jsx
│   ├── api.js
│   ├── i18n.js             # RU + EN
│   ├── components/
│   │   ├── ResumeCard/         # Поле резюме (текст или структурированная форма)
│   │   ├── JobCard/            # Поле вакансии + URL + PDF
│   │   ├── PreviewCard/        # Превью PDF + TemplateDropdown
│   │   ├── TemplateDropdown/   # Селектор шаблона + кнопка «Применить»
│   │   ├── PhotoUpload/        # Загрузка + редактор обрезки (lazy cropper)
│   │   ├── StructuredResumeForm/
│   │   ├── ExpandModal/, InputExpandModal/, LinkModal/, ProfileModal/
│   │   ├── ErrorBanner/, Navbar/, ProTip/
│   └── utils/
│       ├── cropImage.js    # Canvas-обрезка → JPEG dataURL
│       └── parseResume.js
└── vite.config.js          # proxy /api → :47821

docker-compose.yml          # маппинг порта 47821:47821, .env
Dockerfile                  # node-build → python+tectonic runtime
.env                        # openrouter_api_key=...
```

## Порты

- **Backend:** 47821 (выбран из dynamic-диапазона, чтобы не конфликтовать с типовыми dev-сервисами)
- **Frontend (Vite dev):** 5173 (стандартный, проксирует `/api/*` на `47821`)
- В production фронт собирается в `backend/static/` и отдаётся через FastAPI StaticFiles на том же `47821`

## Производительность

- LaTeX-компиляция: 4–7 с (зависит от шаблона), повторный запрос с тем же контентом → из PDF-кеша мгновенно
- Авторепрезентация фото: Pillow первый раз ~35 мс, далее ~0.1 мс (LRU кеш по `blake2s(base64+shape)`)
- Initial JS bundle: ~63 KB gzip; `react-easy-crop` (~7 KB gzip) вынесен в отдельный chunk и подгружается только при открытии редактора фото
- Debounce превью: 800 мс с `AbortController` (предыдущий запрос отменяется при новом наборе)

## Безопасность

- Non-root пользователь в Docker (`appuser`)
- SSRF-фильтр в `/api/fetch-url` (блокировка `localhost`, RFC1918, link-local)
- Размерные лимиты: резюме 15 KB, вакансия 25 KB, PDF на вход 5 MB, аватар 5 MB
- Rate-limiting через slowapi на всех `/api/*`
- CORS включается только при `DEV_MODE=1` в `.env`

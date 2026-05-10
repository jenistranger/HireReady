# Phase 1 — Защита (выполнено)

Все задачи Фазы 1 из MVP-плана реализованы. Ниже — что сделано, в каком файле и почему.

---

## 1. Rate Limiting

**Файлы:** `backend/main.py`, `backend/requirements.txt`

Добавлена библиотека `slowapi==0.1.9`. Лимитер настроен по IP-адресу клиента (`get_remote_address`).

Лимиты по эндпоинтам:
| Эндпоинт | Лимит |
|---|---|
| `POST /api/tailor` | 5 запросов/минута |
| `POST /api/fetch-url` | 10 запросов/минута |
| `POST /api/pdf` | 20 запросов/минута |

При превышении лимита slowapi возвращает `429 Too Many Requests` с понятным сообщением.

`/api/extract-pdf` лимит не нужен — он только читает загруженный файл, без обращений к внешним API.

---

## 2. Таймер генерации (UX)

**Файлы:** `frontend/src/App.jsx`, `frontend/src/components/JobCard/JobCard.jsx`

**Проблема:** кнопка показывала "Generating..." без какого-либо индикатора времени — пользователь не знал, идёт ли процесс или завис.

**Решение:**
- В `App.jsx` добавлен `elapsed` state и `useEffect`, который запускает интервал `setInterval(1с)` пока `isLoading === true`. При окончании загрузки сбрасывается в `0`.
- Кнопка теперь показывает: `Адаптирую... 12с` (вместо "Generating...").
- Если прошло ≥30 секунд — под кнопкой появляется сообщение: _"Модель думает дольше обычного, подождите ещё немного..."_

---

## 3. Проверка API-ключа при старте

**Файл:** `backend/main.py`

Добавлен `@app.on_event("startup")` обработчик `startup_check()`.

При старте:
- Если `OPENROUTER_API_KEY` не задан — в лог пишется `ERROR` с инструкцией что делать. Сервер запускается, но при попытке вызвать `/api/tailor` вернёт `500` с человекочитаемым сообщением.
- Если ключ есть — пишется `INFO` с названием модели.

Это позволяет сразу увидеть проблему в логах Docker/Railway, не отлаживая запросы.

---

## 4. Health Check endpoint

**Файл:** `backend/main.py`

Добавлен `GET /health` — возвращает:
```json
{"status": "ok", "model": "google/gemini-3.1-flash-lite", "api_key_set": true}
```

Нужен для:
- Мониторинга (Railway, Fly.io, uptime-сервисы)
- Docker HEALTHCHECK в `docker-compose.yml`
- Быстрой проверки при деплое

---

## 5. CORS

**Файл:** `backend/main.py`

CORS-миддлвер по-прежнему включается только при `DEV_MODE=1`. В продакшне фронтенд раздаётся самим FastAPI как StaticFiles — CORS не нужен.

**Изменение:** вместо захардкоженного `["http://localhost:5173"]` теперь читается переменная окружения `ALLOWED_ORIGINS` (по умолчанию `http://localhost:5173`). Можно переопределить через `.env`:
```
ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
```

Методы сужены до `POST, GET, OPTIONS` (был `["*"]`), заголовки до `Content-Type`.

---

## 6. Лимиты тела запроса

**Файл:** `backend/main.py`

Добавлены Pydantic `field_validator` на модель `TailorRequest`:
- `resume` — максимум **15 KB** (в байтах UTF-8)
- `job_description` — максимум **25 KB**

При превышении FastAPI вернёт `422 Unprocessable Entity` с описанием ошибки. Это защищает от случайной вставки огромных документов и неконтролируемых расходов на AI-токены.

---

## 7. Структурированное логирование

**Файл:** `backend/main.py`

Добавлен `logging.basicConfig` с форматом `timestamp level name — message`. Логируются:
- Старт сервера (модель, статус ключа)
- Каждый успешный `/api/tailor` запрос: длина входа и выхода в символах

---

## Изменённые файлы

| Файл | Что изменилось |
|---|---|
| `backend/main.py` | Rate limiting, health check, startup check, CORS env var, field validators, logging |
| `backend/requirements.txt` | Добавлен `slowapi==0.1.9` |
| `frontend/src/App.jsx` | Добавлен `elapsed` state + interval |
| `frontend/src/components/JobCard/JobCard.jsx` | Таймер в кнопке, предупреждение при >30с |

---

## Как проверить

```bash
# Health check
curl http://localhost:8000/health

# Rate limit (6-й запрос вернёт 429)
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/tailor \
  -H "Content-Type: application/json" \
  -d '{"resume":"test","job_description":"test"}'; done

# Лимит тела — резюме > 15KB вернёт 422
python3 -c "print('x'*16000)" | xargs -I{} curl -s -X POST http://localhost:8000/api/tailor \
  -H "Content-Type: application/json" \
  -d "{\"resume\":\"{}\",\"job_description\":\"test\"}"
```

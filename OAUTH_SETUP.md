# Настройка OAuth через Google и Yandex

Этот документ описывает, как получить данные для `.env`, настроить вход через Google/Yandex локально и что поменять при переносе проекта на VPS с доменом `hireslop.xyz`.

## 1. Какие переменные нужны

В проекте уже есть backend-роуты:

```text
/api/auth/google/start
/api/auth/google/callback
/api/auth/yandex/start
/api/auth/yandex/callback
/api/auth/me
/api/auth/logout
```

Для их работы нужны переменные окружения:

```env
DEV_MODE=1
ALLOWED_ORIGINS=http://localhost:5173

APP_BASE_URL=http://localhost:47821
SESSION_SECRET=replace_me

GOOGLE_CLIENT_ID=replace_me
GOOGLE_CLIENT_SECRET=replace_me

YANDEX_CLIENT_ID=replace_me
YANDEX_CLIENT_SECRET=replace_me

DATABASE_URL=postgresql://hireready:hireready@postgres:5432/hireready

openrouter_api_key=replace_me
```

`APP_BASE_URL` особенно важен. Backend собирает callback URL так:

```text
APP_BASE_URL + /api/auth/<provider>/callback
```

Например для локального запуска:

```text
http://localhost:47821/api/auth/google/callback
http://localhost:47821/api/auth/yandex/callback
```

## 2. Генерация SESSION_SECRET

`SESSION_SECRET` нужен для хеширования session cookie. Его не надо получать у Google или Yandex.

Сгенерируй его сам:

```bash
openssl rand -hex 32
```

Пример:

```env
SESSION_SECRET=generated_long_hex_string
```

Важно:

- не коммить реальный `.env`;
- не менять `SESSION_SECRET` без причины;
- после смены `SESSION_SECRET` старые пользовательские сессии перестанут работать.

## 3. Локальная настройка Google OAuth

Открой Google Cloud Console:

```text
https://console.cloud.google.com/apis/credentials
```

Дальше:

1. Создай новый проект или выбери существующий.
2. Настрой OAuth consent screen / Google Auth Platform.
3. Перейди в Credentials.
4. Создай OAuth Client ID.
5. Тип приложения выбери:

```text
Web application
```

6. В Authorized redirect URIs добавь:

```text
http://localhost:47821/api/auth/google/callback
```

7. Сохрани client.
8. Скопируй:

```text
Client ID     -> GOOGLE_CLIENT_ID
Client secret -> GOOGLE_CLIENT_SECRET
```

В `.env`:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Redirect URI должен совпадать полностью. Если в Google указан один URL, а backend отправляет другой, Google вернет ошибку `redirect_uri_mismatch`.

## 4. Локальная настройка Yandex OAuth

Открой Yandex OAuth:

```text
https://oauth.yandex.com/
```

Дальше:

1. Создай новое приложение.
2. Укажи название приложения.
3. Добавь Redirect URI:

```text
http://localhost:47821/api/auth/yandex/callback
```

4. Добавь права:

```text
login:email
login:info
login:avatar
```

5. Сохрани приложение.
6. Скопируй:

```text
Client ID     -> YANDEX_CLIENT_ID
Client secret -> YANDEX_CLIENT_SECRET
```

В `.env`:

```env
YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret
```

## 5. Локальный `.env`

Для запуска через текущий `docker-compose.yml`:

```env
DEV_MODE=1
ALLOWED_ORIGINS=http://localhost:5173

APP_BASE_URL=http://localhost:47821
SESSION_SECRET=generated_long_hex_string

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret

DATABASE_URL=postgresql://hireready:hireready@postgres:5432/hireready

openrouter_api_key=your_openrouter_key
```

Запуск:

```bash
rtk docker compose build
rtk docker compose up -d
```

Открыть приложение:

```text
http://localhost:47821/app
```

Проверка:

1. Нажми вход через Google.
2. Заверши вход у Google.
3. Должен произойти возврат на `/app`.
4. В navbar/profile должен появиться пользователь.
5. Повтори то же самое для Yandex.

Health check:

```text
http://localhost:47821/health
```

Ожидаемо:

```json
{
  "status": "ok",
  "api_key_set": true,
  "db": true
}
```

## 6. Перенос на VPS с доменом hireslop.xyz

На VPS схема должна быть такой:

```text
Пользователь
  -> https://hireslop.xyz
  -> Nginx/Caddy reverse proxy
  -> app container на 127.0.0.1:47821
  -> FastAPI + frontend + PostgreSQL
```

Главное отличие от локалки: OAuth callback должен быть уже с production-доменом и HTTPS.

Production callbacks:

```text
https://hireslop.xyz/api/auth/google/callback
https://hireslop.xyz/api/auth/yandex/callback
```

Production `.env`:

```env
DEV_MODE=0
ALLOWED_ORIGINS=https://hireslop.xyz

APP_BASE_URL=https://hireslop.xyz
SESSION_SECRET=generated_strong_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret

DATABASE_URL=postgresql://hireready:hireready@postgres:5432/hireready

openrouter_api_key=your_openrouter_key
```

Если frontend и backend живут на одном домене, CORS почти не нужен. Но оставить `ALLOWED_ORIGINS=https://hireslop.xyz` нормально.

## 7. Настройка Google для VPS

В Google OAuth Client добавь Authorized redirect URI:

```text
https://hireslop.xyz/api/auth/google/callback
```

Можно оставить локальный callback для разработки:

```text
http://localhost:47821/api/auth/google/callback
```

Но лучше иметь два отдельных OAuth client:

- один для local/dev;
- один для production.

Так меньше риска случайно сломать production callback.

## 8. Настройка Yandex для VPS

В Yandex OAuth app добавь Redirect URI:

```text
https://hireslop.xyz/api/auth/yandex/callback
```

Можно оставить локальный:

```text
http://localhost:47821/api/auth/yandex/callback
```

Но для аккуратной схемы лучше завести отдельное Yandex-приложение под production.

## 9. DNS для VPS

В DNS-панели домена добавь A-запись:

```text
hireslop.xyz    A    IP_твоего_VPS
```

Если нужен `www`:

```text
www.hireslop.xyz    A    IP_твоего_VPS
```

Рекомендуемый вариант: основной домен `hireslop.xyz`, а `www.hireslop.xyz` редиректить на него.

Если приложение будет доступно и через `www`, тогда OAuth callbacks тоже должны быть добавлены:

```text
https://www.hireslop.xyz/api/auth/google/callback
https://www.hireslop.xyz/api/auth/yandex/callback
```

Но проще использовать только:

```text
https://hireslop.xyz
```

## 10. Пример Nginx-конфига

Пример файла:

```text
/etc/nginx/sites-available/hireslop.xyz
```

Конфиг:

```nginx
server {
    listen 80;
    server_name hireslop.xyz www.hireslop.xyz;

    location / {
        proxy_pass http://127.0.0.1:47821;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активировать:

```bash
sudo ln -s /etc/nginx/sites-available/hireslop.xyz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 11. HTTPS через Certbot

Установить Certbot:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

Выпустить сертификат:

```bash
sudo certbot --nginx -d hireslop.xyz -d www.hireslop.xyz
```

После этого сайт должен открываться:

```text
https://hireslop.xyz
```

И в `.env` обязательно должно быть:

```env
APP_BASE_URL=https://hireslop.xyz
DEV_MODE=0
```

Почему это важно:

- при `DEV_MODE=0` cookie ставится с `secure=True`;
- secure cookie работает только по HTTPS;
- если открыть production по `http://`, браузер не сохранит session cookie.

## 12. Запуск проекта на VPS

Пример:

```bash
git clone your_repository_url
cd HireReady
nano .env
rtk docker compose build
rtk docker compose up -d
```

Проверить контейнеры:

```bash
rtk docker compose ps
```

Посмотреть логи:

```bash
rtk docker compose logs -f app
```

Проверить health:

```text
https://hireslop.xyz/health
```

Ожидаемо:

```json
{
  "status": "ok",
  "api_key_set": true,
  "db": true
}
```

## 13. Частые ошибки

### Google/Yandex показывает redirect_uri_mismatch

Проверь, что callback в кабинете провайдера совпадает с `APP_BASE_URL`.

Для production:

```env
APP_BASE_URL=https://hireslop.xyz
```

Callbacks:

```text
https://hireslop.xyz/api/auth/google/callback
https://hireslop.xyz/api/auth/yandex/callback
```

Для локалки:

```env
APP_BASE_URL=http://localhost:47821
```

Callbacks:

```text
http://localhost:47821/api/auth/google/callback
http://localhost:47821/api/auth/yandex/callback
```

### Backend отвечает OAuth not configured

Не задан client id:

```env
GOOGLE_CLIENT_ID=...
YANDEX_CLIENT_ID=...
```

Или `.env` не попал в контейнер.

Проверь:

```bash
rtk docker compose logs -f app
```

### После входа пользователь не авторизован

Проверь:

```env
APP_BASE_URL=https://hireslop.xyz
DEV_MODE=0
SESSION_SECRET=stable_secret
```

Также проверь, что сайт открыт именно по HTTPS.

### Cookie не сохраняется в production

Скорее всего, сайт открыт по HTTP.

В production cookie ставится как secure, поэтому нужен:

```text
https://hireslop.xyz
```

### Локально работает, на VPS нет

Сравни:

```text
локально: APP_BASE_URL=http://localhost:47821
VPS:     APP_BASE_URL=https://hireslop.xyz
```

И проверь, что в Google/Yandex добавлены именно production callbacks.

## 14. Короткий чеклист

Локально:

- `.env` содержит `APP_BASE_URL=http://localhost:47821`;
- Google callback: `http://localhost:47821/api/auth/google/callback`;
- Yandex callback: `http://localhost:47821/api/auth/yandex/callback`;
- `DEV_MODE=1`;
- Postgres работает;
- `/health` показывает `"db": true`.

Production:

- DNS `hireslop.xyz` указывает на VPS;
- HTTPS выпущен через Certbot или другой ACME-клиент;
- `.env` содержит `APP_BASE_URL=https://hireslop.xyz`;
- `.env` содержит `DEV_MODE=0`;
- Google callback: `https://hireslop.xyz/api/auth/google/callback`;
- Yandex callback: `https://hireslop.xyz/api/auth/yandex/callback`;
- `SESSION_SECRET` сильный и стабильный;
- `/health` показывает `"db": true`.

## 15. Полезные ссылки

Google OAuth credentials:

```text
https://support.google.com/cloud/answer/6158849
```

Google OAuth web server flow:

```text
https://developers.google.com/identity/protocols/oauth2/web-server
```

Yandex OAuth cabinet:

```text
https://yandex.com/dev/id/doc/en/oauth-cabinet
```

Yandex app registration:

```text
https://yandex.com/dev/id/doc/en/register-client
```

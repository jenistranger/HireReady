# Phase 2 — UX-минимум + Локализация (выполнено)

---

## Обзор изменений

Добавлена полная система локализации (RU/EN) с переключателем, исправлены все англоязычные строки, улучшена обработка ошибок, добавлен шорткат Ctrl+Enter.

---

## 1. Система локализации (i18n)

**Новые файлы:** `frontend/src/i18n.js`, `frontend/src/LangContext.jsx`

### `i18n.js`
Содержит два объекта — `RU` и `EN` — со всеми строками приложения, сгруппированными по компонентам:

| Секция | Что включает |
|---|---|
| `navbar` | Profile, langBtn |
| `resume` | Заголовок, табы, placeholder, кнопки |
| `job` | Заголовок, placeholder, кнопки, текст генерации |
| `preview` | Заголовок, шаблон, скачать, копировать |
| `tip` | Совет |
| `profile` | Все поля и кнопки профиля |
| `link` | Модал вставки URL |
| `expand` | Модал предпросмотра |
| `inputExpand` | Модал расширенного ввода |
| `structured` | Все поля структурированной формы |
| `errors` | Все сообщения об ошибках |

### `LangContext.jsx`
React Context + хук `useLang()`. Каждый компонент вызывает `const t = useLang()` и использует `t.секция.ключ`. Никакого prop drilling.

---

## 2. Переключатель языка с эмодзи

**Файлы:** `frontend/src/App.jsx`, `frontend/src/components/Navbar/Navbar.jsx`, `frontend/src/styles/globals.css`

**Логика:**
- В `App.jsx` — `lang` state (default: `'ru'`), `onLangToggle` — переключает между `'ru'` и `'en'`
- `App` оборачивает всё дерево в `<LangContext.Provider value={t}>` где `t = lang === 'ru' ? RU : EN`
- Navbar получает `lang` и `onLangToggle` как props

**Кнопка:**
- Когда активен RU: показывает `🇬🇧 EN` (нажми чтобы переключить в английский)
- Когда активен EN: показывает `🇷🇺 RU` (нажми чтобы переключить в русский)

**CSS:** кнопка стала интерактивной — `cursor: pointer`, hover-эффект (граница и цвет меняются на акцентный синий).

---

## 3. Все англоязычные строки убраны

**Изменённые компоненты:**

| Компонент | Что было | Что стало |
|---|---|---|
| `ResumeCard` | "YOUR RESUME", "Free text", "Fields", "Clear", "Upload PDF" | `t.resume.*` |
| `JobCard` | "JOB VACANCY", "Clear", "Upload PDF", "Paste Link", "Generating..." | `t.job.*` |
| `PreviewCard` | "PREVIEW", "TEMPLATE", "Download PDF", "Copy Text", "Generating resume..." | `t.preview.*` |
| `ProTip` | "PRO TIP", английский текст | `t.tip.*` |
| `ProfileModal` | "PROFILE", "FIRST NAME", "LAST NAME", "Cancel", "Save Changes" и др. | `t.profile.*` |
| `LinkModal` | "Paste job posting URL", "Cancel", "Fetch", "Fetching..." | `t.link.*` |
| `ExpandModal` | "RESUME PREVIEW" | `t.expand.*` |
| `InputExpandModal` | "YOUR RESUME" / "JOB VACANCY", "Cancel", "Save" | `t.inputExpand.*` |
| `StructuredResumeForm` | "Name", "Headline", "Location", "Contacts", "+ Add contact" и др. | `t.structured.*` |
| `Navbar` | "Profile" | `t.navbar.profile` |

---

## 4. Улучшенная обработка ошибок

**Файлы:** `frontend/src/api.js`, `frontend/src/App.jsx`

### `api.js`
Рефакторинг: все функции теперь бросают ошибки с полем `err.status` (HTTP-код):
```js
async function parseError(resp) {
  const data = await resp.json()
  const err = new Error(data.detail || `Server error: ${resp.status}`)
  err.status = resp.status
  return err
}
```

Это позволяет `App.jsx` детектировать конкретные коды.

### `App.jsx` — функция `resolveError`
```js
function resolveError(e, t) {
  if (e.status === 429 || ...) return t.errors.rateLimit
  if (e.status === 504 || ...) return t.errors.timeout
  return e.message || t.errors.connectionError
}
```

Переведённые сообщения об ошибках:

| Ситуация | RU | EN |
|---|---|---|
| Нет резюме | Добавьте текст резюме или загрузите PDF. | Please add your resume text or upload a PDF. |
| Нет вакансии | Добавьте описание вакансии. | Please add the job description. |
| Rate limit (429) | Слишком много запросов. Подождите минуту. | Too many requests. Wait a minute. |
| Таймаут (504) | Превышено время ожидания. | Request timed out. |
| PDF ошибка | Не удалось прочитать PDF. Проверьте файл. | Failed to read PDF. Check your file. |
| URL ошибка | Не удалось загрузить URL. Проверьте ссылку. | Failed to fetch URL. Check the link. |

---

## 5. Шорткат Ctrl+Enter

**Файл:** `frontend/src/App.jsx`

Нажатие `Ctrl+Enter` (или `Cmd+Enter` на Mac) запускает генерацию из любого места на странице.

**Реализация через ref** — избегает stale closure:
```js
const handleGenerateRef = useRef(null)
// ...
handleGenerateRef.current = handleGenerate  // обновляется каждый рендер

useEffect(() => {
  const handler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerateRef.current?.()
    }
    // ...ESC...
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, []) // [] — один обработчик на весь срок жизни компонента
```

---

## Изменённые файлы

| Файл | Тип | Что сделано |
|---|---|---|
| `frontend/src/i18n.js` | **Новый** | Все строки RU и EN |
| `frontend/src/LangContext.jsx` | **Новый** | React Context + useLang() хук |
| `frontend/src/App.jsx` | Изменён | lang state, Context.Provider, resolveError, Ctrl+Enter |
| `frontend/src/api.js` | Изменён | parseError с err.status |
| `frontend/src/styles/globals.css` | Изменён | btn-lang интерактивность |
| `frontend/src/components/Navbar/Navbar.jsx` | Изменён | lang toggle + emoji + useLang |
| `frontend/src/components/ResumeCard/ResumeCard.jsx` | Изменён | useLang |
| `frontend/src/components/JobCard/JobCard.jsx` | Изменён | useLang |
| `frontend/src/components/PreviewCard/PreviewCard.jsx` | Изменён | useLang |
| `frontend/src/components/ProTip/ProTip.jsx` | Изменён | useLang |
| `frontend/src/components/ProfileModal/ProfileModal.jsx` | Изменён | useLang |
| `frontend/src/components/LinkModal/LinkModal.jsx` | Изменён | useLang |
| `frontend/src/components/ExpandModal/ExpandModal.jsx` | Изменён | useLang |
| `frontend/src/components/InputExpandModal/InputExpandModal.jsx` | Изменён | useLang |
| `frontend/src/components/StructuredResumeForm/StructuredResumeForm.jsx` | Изменён | useLang |

---

## Что НЕ входит в эту фазу

- **Мобильный UX** — перенесён на после Фазы 2, не блокирует лендинг и деплой
- **Favicon + title** — мелкая задача, делается во время деплоя
- **Backend ошибки** — сообщения от FastAPI всегда на русском (hardcoded в `main.py`). При переключении на EN backend-ошибки всё равно будут на RU. Принято как acceptable limitation для MVP.

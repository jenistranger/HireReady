# Repository Guidelines

## Project Structure & Module Organization

This is a resume-tailoring app with a React/Vite frontend and FastAPI backend. `frontend/src/` contains UI code; components live in `frontend/src/components/<ComponentName>/` with co-located `*.module.css` files. Shared browser helpers are in `frontend/src/utils/`. `backend/main.py` defines API routes, `backend/latex/` handles rendering and escaping, `backend/templates/*.tex.j2` contains resume templates, and `backend/tests/` contains pytest tests. Root-level `Dockerfile` and `docker-compose.yml` define the production container.

## Build, Test, and Development Commands

- `rtk docker compose build` builds the production image.
- `rtk docker compose up -d` runs the app on `http://localhost:47821`.
- From `backend/`, `rtk python -m venv .venv` creates a virtualenv.
- From `backend/`, `rtk pip install -r requirements.txt` installs API dependencies.
- From `backend/`, `rtk uvicorn main:app --reload --port 47821` starts the API.
- From `frontend/`, `rtk npm install` installs UI dependencies.
- From `frontend/`, `rtk npm run dev` starts Vite on `http://localhost:5173`.
- From `frontend/`, `rtk npm run build` creates the production bundle.
- `rtk pytest backend/tests` runs backend tests.

Local PDF generation requires `tectonic` or `xelatex` in `PATH`; tests skip full PDF compilation when no engine is available.

## Coding Style & Naming Conventions

Use ES modules and functional React components in `*.jsx`. Name components and directories in PascalCase, for example `PreviewCard/PreviewCard.jsx`. Keep component CSS co-located as `*.module.css`; shared styles belong in `frontend/src/styles/globals.css`.

Python follows PEP 8: 4-space indentation, snake_case functions, and focused modules. Keep LaTeX escaping and rendering logic inside `backend/latex/`.

## Testing Guidelines

Backend tests use `pytest` and FastAPI `TestClient`. Add tests under `backend/tests/` with `test_<behavior>` function names. Cover request validation, SSRF protections, parsing, template rendering, and PDF generation paths when changing backend behavior.

There is no frontend test runner configured. For frontend changes, run `rtk cd frontend && npm run build` and manually verify the affected flow in Vite.

## Commit & Pull Request Guidelines

Recent commits use short descriptive summaries such as `UI fixes + CV templates` and `remove node_modules, dist from tracking`. Keep subjects concise and scoped.

Pull requests should include a brief description, testing performed, linked issue if available, and screenshots for visible UI changes. Note API limit, environment, LaTeX template, or Docker changes.

## Security & Configuration Tips

Store OpenRouter credentials in `.env` as `openrouter_api_key=...`; do not commit secrets. Preserve existing request size limits, SSRF protections in `/api/fetch-url`, and rate limiting when editing backend endpoints.

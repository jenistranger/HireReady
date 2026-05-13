# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python + LaTeX runtime
FROM python:3.12-slim

WORKDIR /app

# Fonts (Cyrillic support across templates) + curl for tectonic download
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fonts-liberation \
    fonts-liberation2 \
    fonts-noto-core \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# Tectonic — single-binary LaTeX engine. Self-fetches packages on first run,
# so we pre-warm the cache below.
ENV TECTONIC_VERSION=0.15.0
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64)  target="x86_64-unknown-linux-musl" ;; \
      aarch64) target="aarch64-unknown-linux-musl" ;; \
      *) echo "Unsupported arch: $arch"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${target}.tar.gz" \
      | tar -xz -C /usr/local/bin; \
    chmod +x /usr/local/bin/tectonic; \
    tectonic --version

ENV TECTONIC_CACHE_DIR=/app/.tectonic-cache
RUN mkdir -p "$TECTONIC_CACHE_DIR"

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Pre-warm tectonic package cache so the first real compile is fast.
# We pull in every package the templates use across all 6 styles.
RUN printf '%s' '\documentclass[a4paper,11pt]{article}\
\usepackage{fontspec}\
\usepackage[a4paper,margin=18mm]{geometry}\
\usepackage{xcolor}\
\usepackage{titlesec}\
\usepackage{enumitem}\
\usepackage{fontawesome5}\
\usepackage{paracol}\
\usepackage{hyperref}\
\usepackage{tcolorbox}\
\usepackage{tabularx}\
\usepackage{multicol}\
\usepackage{ragged2e}\
\usepackage{etoolbox}\
\usepackage{graphicx}\
\setmainfont{DejaVu Sans}\
\begin{document}prewarm\end{document}' > /tmp/prewarm.tex \
    && tectonic -X compile --outdir /tmp /tmp/prewarm.tex > /tmp/prewarm.log 2>&1 \
    && rm -f /tmp/prewarm.* \
    || (echo "Pre-warm failed (continuing — runtime fetch will work)"; true)

COPY --from=frontend-builder /build/dist ./static/

RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 47821

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:47821/health', timeout=2).raise_for_status()" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "47821"]

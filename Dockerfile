FROM python:3.11-slim

# ── Variáveis de ambiente Python/pip ──────────────────────
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5

WORKDIR /app

# ── Dependências de sistema ───────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Atualiza pip ANTES de instalar dependências ───────────
# (Resolve o JSONDecodeError do pip 24.0)
RUN pip install --upgrade pip setuptools wheel

COPY requirements.txt .

# ── Instala dependências forçando índice estável ──────────
RUN pip install --no-cache-dir \
        --timeout 120 \
        --retries 5 \
        --index-url https://pypi.org/simple \
        -r requirements.txt

COPY . .

RUN mkdir -p /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


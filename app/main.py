import logging
import os
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import init_db, get_db, SessionLocal
from app.models import Spool, User
from app.auth import get_current_user
from app.seed import run_all_seeds
from app.routes import (
    dashboard, history, queue, inventory,
    auth as auth_routes, admin, telemetry,
)

# ── Logging ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("3d-print-manager")

settings = get_settings()


# ════════════════════════════════════════════════════════════
#  MIGRAÇÃO AUTOMÁTICA (apenas para SQLite legado)
# ════════════════════════════════════════════════════════════
def _sqlite_path_from_url(url: str) -> str:
    """Extrai o caminho do arquivo a partir de uma URL sqlite:///..."""
    if url.startswith("sqlite:///"):
        return url[len("sqlite:///"):]
    if url.startswith("sqlite://"):
        return url[len("sqlite://"):]
    return url


def migrate_sqlite_schema() -> None:
    """
    Migração leve idempotente: adiciona colunas novas em tabelas existentes.
    DEVE rodar ANTES de qualquer query ORM nas tabelas afetadas.
    """
    if not settings.database_url.startswith("sqlite"):
        return

    db_path = _sqlite_path_from_url(settings.database_url)
    if not os.path.isabs(db_path):
        db_path = os.path.join(os.getcwd(), db_path)

    # Garante que o diretório existe
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    # Se o arquivo ainda não existe, init_db() vai criar do zero com o schema novo
    if not os.path.exists(db_path):
        logger.info(f"📂 Banco ainda não existe ({db_path}) — será criado por init_db()")
        return

    logger.info(f"🔧 Verificando migrações em {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    migrations = {
        "budgets": [
            ("filaments_json",        "TEXT DEFAULT '[]'"),
            ("supplies_json",         "TEXT DEFAULT '[]'"),
            ("depreciation_per_hour", "REAL"),
            ("labor_per_hour",        "REAL"),
            ("user_id",               "INTEGER"),
        ],
        "settings":   [("user_id", "INTEGER")],
        "print_jobs": [("user_id", "INTEGER")],
        "spools":     [("user_id", "INTEGER")],
    }

    for tbl, cols in migrations.items():
        try:
            # Verifica se a tabela existe
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (tbl,),
            )
            if not cursor.fetchone():
                logger.info(f"   ⏭️  Tabela '{tbl}' não existe ainda — pulando")
                continue

            cursor.execute(f"PRAGMA table_info({tbl})")
            existing = {row[1] for row in cursor.fetchall()}

            for col, dtype in cols:
                if col not in existing:
                    logger.info(f"   ➕ ALTER {tbl} ADD COLUMN {col} {dtype}")
                    cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {dtype}")
        except Exception as e:
            logger.error(f"   ❌ Erro migrando {tbl}: {e}")

    conn.commit()
    conn.close()
    logger.info("✅ Migração concluída")


# ════════════════════════════════════════════════════════════
#  LIFESPAN — startup/shutdown moderno do FastAPI
# ════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicialização e finalização da aplicação."""
    logger.info(f"🚀 Iniciando {settings.app_name} (env={settings.app_env})")

    # 1️⃣ PRIMEIRO: migra schema do SQLite (se já existir)
    migrate_sqlite_schema()

    # 2️⃣ DEPOIS: cria tabelas que ainda não existem
    init_db()

    # 3️⃣ POR FIM: seed do admin e outras tabelas
    db: Session = SessionLocal()
    try:
        run_all_seeds(db)
        logger.info("👤 Seeds da aplicação verificados")
    except Exception as e:
        logger.exception("Erro ao executar seeds: %s", e)
    finally:
        db.close()

    logger.info("✅ Aplicação pronta para receber requisições.")

    yield  # ← aplicação roda aqui

    logger.info("👋 Encerrando aplicação...")


# ════════════════════════════════════════════════════════════
#  APP
# ════════════════════════════════════════════════════════════
app = FastAPI(
    title=settings.app_name,
    version="3.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS (Utilizando a lista completa de origens configurada)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Routers
app.include_router(auth_routes.router)
app.include_router(admin.router)
app.include_router(telemetry.router)
app.include_router(dashboard.router)
app.include_router(history.router)
app.include_router(queue.router)
app.include_router(inventory.router)

templates = Jinja2Templates(directory="app/templates")


# ── Páginas HTML públicas / autenticadas ───────────────────
@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("auth.html", {"request": request})


@app.get("/reset-password")
async def reset_page(request: Request):
    return templates.TemplateResponse("auth.html", {"request": request})


@app.get("/admin")
async def admin_page(request: Request):
    return templates.TemplateResponse(
        "admin.html",
        {"request": request, "active_page": "admin"},
    )


# ── API: carretéis do usuário logado ───────────────────────
@app.get("/api/spools")
async def api_spools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spools = (
        db.query(Spool)
        .filter(Spool.user_id == current_user.id, Spool.current_weight_g > 0)
        .order_by(Spool.name)
        .all()
    )
    return JSONResponse(content=[
        {
            "id": s.id,
            "name": s.name,
            "color": s.color,
            "color_hex": s.color_hex,
            "material": s.material,
            "price_per_kg": s.price_per_kg,
            "current_weight_g": round(s.current_weight_g, 1),
            "remaining_percent": s.remaining_percent,
        }
        for s in spools
    ])


# ── Healthcheck (Docker / Kubernetes) ──────────────────────
@app.get("/health")
async def healthcheck():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

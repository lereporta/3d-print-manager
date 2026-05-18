import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

# Garantir que o diretório do SQLite exista
if settings.database_url.startswith("sqlite"):
    db_file = settings.database_url.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_file)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Garante a importação dos modelos para registrá-los no metadata antes da criação
    from app import models  # noqa: F401

    # Cria apenas as tabelas que ainda não existem no banco de dados
    Base.metadata.create_all(bind=engine)

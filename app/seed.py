"""
Database Seeding — popula dados iniciais essenciais.

- Cria o primeiro administrador a partir das variáveis ADMIN_*
  caso nenhum admin exista ainda.
- Idempotente: pode rodar a cada startup sem efeitos colaterais.
"""
import logging
from sqlalchemy.orm import Session

from app.models import User
from app.auth import hash_password
from app.config import get_settings

logger = logging.getLogger("seed")


def seed_initial_admin(db: Session) -> None:
    """Cria o primeiro admin se não houver nenhum no banco."""
    settings = get_settings()

    existing_admin = db.query(User).filter(User.is_admin == True).first()  # noqa: E712
    if existing_admin:
        logger.info("✓ Admin já existe (id=%s, email=%s). Seed ignorado.",
                    existing_admin.id, existing_admin.email)
        return

    # Verifica se o e-mail do admin não está em uso por um usuário comum
    email_conflict = db.query(User).filter(User.email == settings.admin_email.lower()).first()
    if email_conflict:
        # Promove o usuário existente a admin (caso o operador tenha cadastrado manualmente antes)
        email_conflict.is_admin = True
        db.commit()
        logger.warning("⚠️  Usuário existente com e-mail %s foi promovido a admin.",
                       settings.admin_email)
        return

    admin = User(
        name=settings.admin_name,
        email=settings.admin_email.lower(),
        password_hash=hash_password(settings.admin_password),
        is_admin=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    logger.info("═══════════════════════════════════════════════════════")
    logger.info("  🌱 ADMIN CRIADO AUTOMATICAMENTE")
    logger.info("  Nome:  %s", admin.name)
    logger.info("  Email: %s", admin.email)
    logger.info("  ⚠️  ALTERE A SENHA NO PRIMEIRO LOGIN!")
    logger.info("═══════════════════════════════════════════════════════")


def run_all_seeds(db: Session) -> None:
    """Ponto de entrada único para todos os seeds."""
    seed_initial_admin(db)
    # Futuros seeds aqui (ex.: materiais padrão, presets, etc)


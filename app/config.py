"""
Configurações da aplicação carregadas via pydantic-settings.

Lê automaticamente do arquivo .env e/ou variáveis de ambiente do SO.
Variáveis de ambiente do SO têm prioridade sobre o .env (útil em Docker).
"""
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Aplicação ──
    app_name: str = "3D Print Manager"
    app_env: str = "development"
    debug: bool = True

    # ── Banco ──
    database_url: str = "sqlite:///./data/print_manager.db"

    # ── JWT ──
    jwt_secret_key: str = Field(min_length=16)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 dias

    # ── Admin Seed ──
    admin_name: str = "Administrador"
    admin_email: str = "admin@printmanager.local"
    admin_password: str = Field(min_length=6)

    # ── CORS ──
    cors_origins: str = "http://localhost,http://localhost:8000"

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_secret(cls, v: str) -> str:
        weak = {"changeme", "secret", "troque-esta-chave-por-uma-aleatoria-de-64-caracteres"}
        if v.lower() in weak or len(v) < 16:
            raise ValueError(
                "JWT_SECRET_KEY é fraca ou padrão. "
                "Gere uma chave forte: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cache do objeto Settings — lido uma única vez por processo.
    Use Depends(get_settings) em rotas que precisarem ler config.
    """
    return Settings()


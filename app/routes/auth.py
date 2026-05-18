import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, PasswordResetRequest
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    log_action,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ─────────────────────────────────────────────────
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


# ── Endpoints ───────────────────────────────────────────────
@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, user.id, "register")
    token = create_access_token(user)
    return TokenOut(
        access_token=token,
        user={"id": user.id, "name": user.name, "email": user.email, "is_admin": user.is_admin},
    )


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    log_action(db, user.id, "login")
    token = create_access_token(user)
    return TokenOut(
        access_token=token,
        user={"id": user.id, "name": user.name, "email": user.email, "is_admin": user.is_admin},
    )


@router.post("/request-password-reset")
def request_password_reset(payload: ResetRequestIn, db: Session = Depends(get_db)):
    """
    Não envia e-mail. Apenas cria um registro que o admin verá no painel.
    Sempre retorna OK (não revela se o e-mail existe).
    """
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user:
        token = secrets.token_urlsafe(32)
        req = PasswordResetRequest(
            user_id=user.id,
            reset_token=token,
            is_resolved=False,
        )
        db.add(req)
        db.commit()
        log_action(db, user.id, "request_password_reset")

    return {"message": "Se o e-mail existir, uma notificação foi enviada ao administrador."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    req = (
        db.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.reset_token == payload.token,
            PasswordResetRequest.is_resolved == False,  # noqa: E712
        )
        .first()
    )
    if not req:
        raise HTTPException(status_code=400, detail="Token inválido ou já utilizado")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user.password_hash = hash_password(payload.new_password)
    req.is_resolved = True
    db.commit()

    log_action(db, user.id, "reset_password")
    return {"message": "Senha atualizada com sucesso"}


@router.get("/me")
def me(current_user: User = Depends(__import__("app.auth", fromlist=["get_current_user"]).get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
    }


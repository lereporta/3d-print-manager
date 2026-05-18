from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    User, PasswordResetRequest, Budget, Spool, Feedback, UsageAnalytics
)
from app.auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # ── 1. Solicitações de senha não resolvidas ──
    pending = (
        db.query(PasswordResetRequest, User)
        .join(User, User.id == PasswordResetRequest.user_id)
        .filter(PasswordResetRequest.is_resolved == False)  # noqa: E712
        .order_by(PasswordResetRequest.created_at.desc())
        .all()
    )
    reset_requests = [
        {
            "id": r.id,
            "user_name": u.name,
            "user_email": u.email,
            "token": r.reset_token,
            "reset_link": f"/reset-password?token={r.reset_token}",
            "created_at": r.created_at.strftime("%d/%m/%Y %H:%M"),
        }
        for r, u in pending
    ]

    # ── 2. Métricas globais ──
    total_budgets = db.query(Budget).count()

    avg_ticket = db.query(func.avg(Budget.final_price)).scalar() or 0.0

    # Margem média (apenas onde unit_cost > 0)
    margin_query = db.query(
        func.avg(
            ((Budget.unit_price - Budget.unit_cost) / Budget.unit_price) * 100.0
        )
    ).filter(Budget.unit_cost > 0, Budget.unit_price > 0).scalar() or 0.0

    total_revenue = db.query(func.sum(Budget.final_price)).scalar() or 0.0
    total_users = db.query(User).count()

    # ── 3. Saúde do inventário (qualquer carretel < 10%) ──
    low_spools_raw = db.query(Spool, User).join(
        User, User.id == Spool.user_id, isouter=True
    ).filter(Spool.current_weight_g > 0).all()

    low_spools = []
    for s, u in low_spools_raw:
        if s.initial_weight_g > 0:
            remaining = (s.current_weight_g / s.initial_weight_g) * 100
            if remaining < 10:
                low_spools.append({
                    "id": s.id,
                    "name": s.name,
                    "material": s.material,
                    "color": s.color,
                    "remaining_percent": round(remaining, 1),
                    "current_weight_g": round(s.current_weight_g, 1),
                    "owner": u.name if u else "—",
                    "owner_email": u.email if u else "—",
                })

    # ── 4. Feedbacks ──
    feedbacks = (
        db.query(Feedback, User)
        .join(User, User.id == Feedback.user_id)
        .order_by(Feedback.timestamp.desc())
        .limit(100)
        .all()
    )
    feedback_list = [
        {
            "id": f.id,
            "user_name": u.name,
            "user_email": u.email,
            "text": f.text_content,
            "timestamp": f.timestamp.strftime("%d/%m/%Y %H:%M"),
        }
        for f, u in feedbacks
    ]

    # ── 5. Top ações (telemetria) ──
    top_actions = (
        db.query(UsageAnalytics.action_name, func.count(UsageAnalytics.id).label("count"))
        .group_by(UsageAnalytics.action_name)
        .order_by(func.count(UsageAnalytics.id).desc())
        .limit(10)
        .all()
    )
    actions_summary = [{"action": a, "count": c} for a, c in top_actions]

    # ── 6. Lista de usuários ──
    users = db.query(User).order_by(User.created_at.desc()).all()
    users_list = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "is_admin": u.is_admin,
            "created_at": u.created_at.strftime("%d/%m/%Y") if u.created_at else "",
            "budgets_count": db.query(Budget).filter(Budget.user_id == u.id).count(),
        }
        for u in users
    ]

    return {
        "reset_requests": reset_requests,
        "metrics": {
            "total_budgets": total_budgets,
            "avg_ticket": round(avg_ticket, 2),
            "avg_margin_percent": round(margin_query, 2),
            "total_revenue": round(total_revenue, 2),
            "total_users": total_users,
        },
        "low_spools": low_spools,
        "feedbacks": feedback_list,
        "top_actions": actions_summary,
        "users": users_list,
    }


@router.post("/reset-requests/{request_id}/resolve")
def resolve_reset_request(
    request_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    req = db.query(PasswordResetRequest).filter(PasswordResetRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    req.is_resolved = True
    db.commit()
    return {"ok": True}


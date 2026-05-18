from urllib.parse import urlencode

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Budget, User
from app.auth import get_current_user, log_action

router = APIRouter(prefix="/history", tags=["history"])
templates = Jinja2Templates(directory="app/templates")


# ─────────────────────────────────────────────
#  Helper: monta query string a partir do Budget
# ─────────────────────────────────────────────
def _budget_to_query(budget: Budget) -> str:
    import json

    # Fallback: se filaments_json está vazio mas existem campos legados,
    # sintetiza um filamento único a partir de piece_weight_g + filament_price_kg
    filaments_json = budget.filaments_json or "[]"
    try:
        parsed = json.loads(filaments_json)
    except (ValueError, TypeError):
        parsed = []

    if not parsed and (budget.piece_weight_g or budget.filament_price_kg):
        parsed = [{
            "id": "legacy",
            "name": "Filamento",
            "price_kg": float(budget.filament_price_kg or 0),
            "weight_g": float(budget.piece_weight_g or 0),
        }]
        filaments_json = json.dumps(parsed)

    params = {
        "piece_name": budget.piece_name or "",
        "piece_weight_g": budget.piece_weight_g or 0,
        "print_time_h": budget.print_time_h or 0,
        "manual_time_h": budget.manual_time_h or 0,
        "filament_price_kg": budget.filament_price_kg or 0,
        "risk_rate": budget.risk_rate or 0,
        "margin_percent": budget.margin_percent or 100,
        "value_multiplier": budget.value_multiplier or 1,
        "lot_quantity": budget.lot_quantity or 1,
        "filaments_json": filaments_json,
        "supplies_json": budget.supplies_json or "[]",
    }
    return urlencode(params)


# ─────────────────────────────────────────────
#  PÁGINA HTML (esqueleto — JS popula via API)
# ─────────────────────────────────────────────
@router.get("/")
async def history_page(request: Request):
    return templates.TemplateResponse(
        "history.html",
        {"request": request, "active_page": "history"},
    )


# ─────────────────────────────────────────────
#  API — lista de orçamentos do usuário
# ─────────────────────────────────────────────
@router.get("/api/list")
async def api_list_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .order_by(Budget.created_at.desc())
        .all()
    )
    return JSONResponse(content=[b.to_dict() for b in budgets])


# ─────────────────────────────────────────────
#  API — detalhe de um orçamento
# ─────────────────────────────────────────────
@router.get("/api/{budget_id}")
async def api_get_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return JSONResponse(content=budget.to_dict())


# ─────────────────────────────────────────────
#  API RELOAD — retorna a URL com query string
#  (frontend faz fetch autenticado e redireciona)
# ─────────────────────────────────────────────
@router.get("/api/reload/{budget_id}")
async def api_reload_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return JSONResponse(content={"redirect_url": f"/?{_budget_to_query(budget)}"})


# ─────────────────────────────────────────────
#  RELOAD (legado) — mantido para compatibilidade
#  ⚠️ Não funciona com JWT em localStorage via <a href>
# ─────────────────────────────────────────────
@router.get("/reload/{budget_id}")
async def reload_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return RedirectResponse(url=f"/?{_budget_to_query(budget)}", status_code=303)


# ─────────────────────────────────────────────
#  DELETE — um orçamento (JS usa fetch)
# ─────────────────────────────────────────────
@router.post("/delete/{budget_id}")
async def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    db.delete(budget)
    db.commit()
    log_action(db, current_user.id, "delete_budget")
    return JSONResponse(content={"ok": True})


# ─────────────────────────────────────────────
#  CLEAR — limpar histórico inteiro do usuário
# ─────────────────────────────────────────────
@router.post("/clear")
async def clear_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Budget).filter(Budget.user_id == current_user.id).delete()
    db.commit()
    log_action(db, current_user.id, "clear_history")
    return JSONResponse(content={"ok": True})

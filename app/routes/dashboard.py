from fastapi import APIRouter, Request, Depends, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
import json
from typing import Optional
from app.models import Budget, Settings, PrintJob, JobStatus, Spool, User
from app.auth import get_current_user, log_action

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


def _get_or_create_settings(db: Session, user_id: int) -> Settings:
    settings = db.query(Settings).filter(Settings.user_id == user_id).first()
    if not settings:
        settings = Settings(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/")
async def dashboard(request: Request, db: Session = Depends(get_db)):
    # Página HTML — autenticação via JS (não exigimos JWT aqui pois a tela
    # de auth bloqueia a renderização no frontend até validar o token)
    # Passamos valores default para o template não quebrar; os dados reais
    # são carregados via /api/dashboard pelo frontend após o login.
    try:
        total_budgets = db.query(Budget).count()
        pending_jobs = (
            db.query(PrintJob)
            .filter(PrintJob.status == JobStatus.PENDENTE.value)
            .count()
        )
        printing_jobs = (
            db.query(PrintJob)
            .filter(PrintJob.status == JobStatus.IMPRIMINDO.value)
            .count()
        )
    except Exception:
        total_budgets = 0
        pending_jobs = 0
        printing_jobs = 0

    stats = {
        "total_budgets": total_budgets,
        "pending_jobs": pending_jobs,
        "printing_jobs": printing_jobs,
    }

    # Defaults seguros (zeros). O JS preenche com dados reais via /api/dashboard.
    settings_defaults = {
        "filament_price_kg": 0.0,
        "energy_tariff": 0.0,
        "printer_consumption": 0.0,
        "depreciation_per_hour": 0.0,
        "labor_per_hour": 0.0,
        "risk_rate": 0.0,
        "machine_cost": 0.0,
    }

    roi_defaults = {
        "depreciation_total": 0.0,
        "machine_cost": 0.0,
        "roi_percent": 0.0,
    }

    user_defaults = {"id": 0, "name": "", "is_admin": False}

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "active_page": "dashboard",
            "stats": stats,
            "settings": settings_defaults,
            "roi": roi_defaults,
            "user": user_defaults,
            "recent_budgets": [],
            "spools": [],
            "spools_json": "[]",
        },
    )


@router.get("/api/dashboard")
async def api_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = _get_or_create_settings(db, current_user.id)

    recent_budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .order_by(Budget.created_at.desc())
        .limit(5)
        .all()
    )

    total_budgets = db.query(Budget).filter(Budget.user_id == current_user.id).count()
    pending_jobs = (
        db.query(PrintJob)
        .filter(PrintJob.user_id == current_user.id, PrintJob.status == JobStatus.PENDENTE.value)
        .count()
    )
    printing_jobs = (
        db.query(PrintJob)
        .filter(PrintJob.user_id == current_user.id, PrintJob.status == JobStatus.IMPRIMINDO.value)
        .count()
    )

    depreciation_total = (
        db.query(func.sum(Budget.depreciation_cost))
        .filter(Budget.user_id == current_user.id)
        .scalar() or 0.0
    )
    machine_cost = settings.machine_cost or 0.0
    roi_percent = round((depreciation_total / machine_cost) * 100, 1) if machine_cost > 0 else 0.0

    spools = (
        db.query(Spool)
        .filter(Spool.user_id == current_user.id, Spool.current_weight_g > 0)
        .order_by(Spool.name)
        .all()
    )

    return {
        "user": {"id": current_user.id, "name": current_user.name, "is_admin": current_user.is_admin},
        "settings": {
            "filament_price_kg": settings.filament_price_kg,
            "energy_tariff": settings.energy_tariff,
            "printer_consumption": settings.printer_consumption,
            "depreciation_per_hour": settings.depreciation_per_hour,
            "labor_per_hour": settings.labor_per_hour,
            "risk_rate": settings.risk_rate,
            "machine_cost": settings.machine_cost,
        },
        "recent_budgets": [b.to_dict() for b in recent_budgets],
        "spools": [
            {
                "id": s.id, "name": s.name, "color": s.color, "color_hex": s.color_hex,
                "material": s.material, "price_per_kg": s.price_per_kg,
                "current_weight_g": round(s.current_weight_g, 1),
                "remaining_percent": s.remaining_percent,
            } for s in spools
        ],
        "stats": {
            "total_budgets": total_budgets,
            "pending_jobs": pending_jobs,
            "printing_jobs": printing_jobs,
        },
        "roi": {
            "depreciation_total": round(depreciation_total, 2),
            "machine_cost": machine_cost,
            "roi_percent": roi_percent,
        },
    }


@router.post("/calculator")
async def save_budget(
    request: Request,
    piece_name: str = Form("Sem nome"),
    filament_price_kg: float = Form(0),
    piece_weight_g: float = Form(0),
    print_time_h: float = Form(0),
    manual_time_h: float = Form(0),
    depreciation_per_hour: float = Form(0),
    labor_per_hour: float = Form(0),
    risk_rate: float = Form(10.0),
    margin_percent: float = Form(100.0),
    supplies_cost: float = Form(0.0),
    value_multiplier: float = Form(1.0),
    lot_quantity: int = Form(1),
    unit_cost: float = Form(0.0),
    unit_price: float = Form(0.0),
    filaments_json: str = Form("[]"),
    supplies_json: str = Form("[]"),
    editing_budget_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = _get_or_create_settings(db, current_user.id)
    lot_qty = max(lot_quantity, 1)

    filament_cost = (piece_weight_g / 1000) * filament_price_kg
    energy_cost = print_time_h * settings.printer_consumption * settings.energy_tariff
    depreciation_cost = print_time_h * depreciation_per_hour
    labor_cost = manual_time_h * labor_per_hour
    subtotal = filament_cost + energy_cost + depreciation_cost + labor_cost + supplies_cost
    risk_cost = subtotal * (risk_rate / 100)
    total_cost = subtotal + risk_cost

    mult = max(value_multiplier, 1.0)
    final_price_lot = total_cost * (1 + margin_percent / 100) * mult

    calc_unit_cost = total_cost / lot_qty
    calc_unit_price = final_price_lot / lot_qty

    try:
        _fil = json.loads(filaments_json) if filaments_json else []
        if not isinstance(_fil, list): _fil = []
    except (json.JSONDecodeError, TypeError):
        _fil = []

    try:
        _sup = json.loads(supplies_json) if supplies_json else []
        if not isinstance(_sup, list): _sup = []
    except (json.JSONDecodeError, TypeError):
        _sup = []

    # ─── Monta dict com todos os campos calculados ───
    budget_data = dict(
        piece_name=piece_name.strip() if piece_name.strip() else "Sem nome",
        filament_price_kg=filament_price_kg,
        piece_weight_g=piece_weight_g,
        print_time_h=round(print_time_h, 4),
        manual_time_h=round(manual_time_h, 4),
        filament_cost=round(filament_cost, 2),
        energy_cost=round(energy_cost, 2),
        depreciation_cost=round(depreciation_cost, 2),
        labor_cost=round(labor_cost, 2),
        supplies_cost=round(supplies_cost, 2),
        subtotal=round(subtotal, 2),
        risk_rate=round(risk_rate, 1),
        risk_cost=round(risk_cost, 2),
        total_cost=round(total_cost, 2),
        margin_percent=round(margin_percent, 1),
        value_multiplier=round(mult, 1),
        final_price=round(calc_unit_price, 2),
        price_100=round(calc_unit_cost * 2, 2),
        price_200=round(calc_unit_cost * 3, 2),
        price_400=round(calc_unit_cost * 5, 2),
        lot_quantity=lot_qty,
        unit_cost=round(calc_unit_cost, 2),
        unit_price=round(calc_unit_price, 2),
        filaments_json=json.dumps(_fil, ensure_ascii=False),
        supplies_json=json.dumps(_sup, ensure_ascii=False),
        depreciation_per_hour=depreciation_per_hour,
        labor_per_hour=labor_per_hour,
    )

    # ─── EDIÇÃO ou CRIAÇÃO? ───
    if editing_budget_id:
        budget = db.query(Budget).filter(
            Budget.id == editing_budget_id,
            Budget.user_id == current_user.id,
        ).first()
        if budget:
            for key, value in budget_data.items():
                setattr(budget, key, value)
            db.commit()
            log_action(db, current_user.id, f"update_budget:{editing_budget_id}")
            return RedirectResponse(url="/?updated=1", status_code=303)

    # CRIAÇÃO
    budget = Budget(user_id=current_user.id, **budget_data)
    db.add(budget)
    db.commit()
    log_action(db, current_user.id, "save_budget")

    return RedirectResponse(url="/?saved=1", status_code=303)


@router.post("/settings/machine")
async def update_machine_cost(
    machine_cost: float = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = _get_or_create_settings(db, current_user.id)
    settings.machine_cost = machine_cost
    db.commit()
    return RedirectResponse(url="/?settings_saved=1", status_code=303)


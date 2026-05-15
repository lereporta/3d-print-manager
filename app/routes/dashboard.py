from fastapi import APIRouter, Request, Depends, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Budget, Settings, PrintJob, JobStatus

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
async def dashboard(request: Request, db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    recent_budgets = db.query(Budget).order_by(Budget.created_at.desc()).limit(5).all()

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

    # ROI: soma de toda depreciação acumulada nos orçamentos salvos
    depreciation_total = (
        db.query(func.sum(Budget.depreciation_cost)).scalar() or 0.0
    )
    machine_cost = settings.machine_cost if settings.machine_cost else 0.0
    if machine_cost > 0:
        roi_percent = round((depreciation_total / machine_cost) * 100, 1)
    else:
        roi_percent = 0.0

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "settings": settings,
            "recent_budgets": recent_budgets,
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
        },
    )


@router.post("/calculate")
async def save_budget(
    request: Request,
    piece_name: str = Form("Sem nome"),
    filament_price_kg: float = Form(...),
    piece_weight_g: float = Form(...),
    print_time_h: float = Form(...),
    manual_time_h: float = Form(...),
    depreciation_per_hour: float = Form(...),
    labor_per_hour: float = Form(...),
    risk_rate: float = Form(10.0),
    margin_percent: float = Form(100.0),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).first()

    filament_cost = (piece_weight_g / 1000) * filament_price_kg
    energy_cost = print_time_h * settings.printer_consumption * settings.energy_tariff
    depreciation_cost = print_time_h * depreciation_per_hour
    labor_cost = manual_time_h * labor_per_hour
    subtotal = filament_cost + energy_cost + depreciation_cost + labor_cost
    risk_cost = subtotal * (risk_rate / 100)
    total_cost = subtotal + risk_cost

    final_price = total_cost * (1 + margin_percent / 100)
    price_100 = total_cost * 2
    price_200 = total_cost * 3
    price_400 = total_cost * 5

    budget = Budget(
        piece_name=piece_name.strip() if piece_name.strip() else "Sem nome",
        filament_price_kg=filament_price_kg,
        piece_weight_g=piece_weight_g,
        print_time_h=round(print_time_h, 4),
        manual_time_h=round(manual_time_h, 4),
        filament_cost=round(filament_cost, 2),
        energy_cost=round(energy_cost, 2),
        depreciation_cost=round(depreciation_cost, 2),
        labor_cost=round(labor_cost, 2),
        subtotal=round(subtotal, 2),
        risk_rate=round(risk_rate, 1),
        risk_cost=round(risk_cost, 2),
        total_cost=round(total_cost, 2),
        margin_percent=round(margin_percent, 1),
        final_price=round(final_price, 2),
        price_100=round(price_100, 2),
        price_200=round(price_200, 2),
        price_400=round(price_400, 2),
    )
    db.add(budget)
    db.commit()

    return RedirectResponse(url="/?saved=1", status_code=303)


@router.post("/settings/machine")
async def update_machine_cost(
    machine_cost: float = Form(...),
    db: Session = Depends(get_db),
):
    settings = db.query(Settings).first()
    settings.machine_cost = machine_cost
    db.commit()
    return RedirectResponse(url="/?settings_saved=1", status_code=303)


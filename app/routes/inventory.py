from fastapi import APIRouter, Request, Depends, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Spool
from datetime import datetime, timezone
from typing import Optional

router = APIRouter(prefix="/inventory")
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
async def inventory(request: Request, db: Session = Depends(get_db)):
    spools = db.query(Spool).order_by(Spool.created_at.desc()).all()
    return templates.TemplateResponse(
        "inventory.html",
        {
            "request": request,
            "spools": spools,
        },
    )


# === API endpoint for dashboard to fetch spools as JSON ===
@router.get("/api/spools")
async def api_spools(db: Session = Depends(get_db)):
    spools = db.query(Spool).order_by(Spool.name.asc()).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "color": s.color,
            "color_hex": s.color_hex,
            "material": s.material,
            "price_per_kg": s.price_per_kg,
            "current_weight_g": s.current_weight_g,
            "initial_weight_g": s.initial_weight_g,
            "remaining_percent": s.remaining_percent,
        }
        for s in spools
    ]


@router.post("/add")
async def add_spool(
    name: str = Form(...),
    color: str = Form("Branco"),
    color_hex: str = Form("#FFFFFF"),
    material: str = Form("PLA"),
    price_per_kg: float = Form(0.0),
    initial_weight_g: float = Form(...),
    db: Session = Depends(get_db),
):
    spool = Spool(
        name=name.strip(),
        color=color.strip(),
        color_hex=color_hex,
        material=material.strip(),
        price_per_kg=price_per_kg,
        initial_weight_g=initial_weight_g,
        current_weight_g=initial_weight_g,
    )
    db.add(spool)
    db.commit()
    return RedirectResponse(url="/inventory/?added=1", status_code=303)


@router.post("/edit/{spool_id}")
async def edit_spool(
    spool_id: int,
    current_weight_g: float = Form(...),
    price_per_kg: Optional[float] = Form(None),
    db: Session = Depends(get_db),
):
    spool = db.query(Spool).filter(Spool.id == spool_id).first()
    if spool:
        spool.current_weight_g = max(0, current_weight_g)
        if price_per_kg is not None:
            spool.price_per_kg = max(0, price_per_kg)
        spool.updated_at = datetime.now(timezone.utc)
        db.commit()
    return RedirectResponse(url="/inventory/", status_code=303)


@router.post("/delete/{spool_id}")
async def delete_spool(spool_id: int, db: Session = Depends(get_db)):
    spool = db.query(Spool).filter(Spool.id == spool_id).first()
    if spool:
        db.delete(spool)
        db.commit()
    return RedirectResponse(url="/inventory/?deleted=1", status_code=303)

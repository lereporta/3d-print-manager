from fastapi import APIRouter, Request, Depends, HTTPException, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Spool, User
from app.auth import get_current_user, log_action

router = APIRouter(prefix="/inventory", tags=["inventory"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
async def inventory_page(request: Request):
    # Página HTML — os dados vêm via /inventory/api/list (AJAX + JWT)
    return templates.TemplateResponse(
        "inventory.html",
        {"request": request, "active_page": "inventory", "spools": []},
    )


@router.get("/api/list")
async def api_list_spools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spools = (
        db.query(Spool)
        .filter(Spool.user_id == current_user.id)
        .order_by(Spool.created_at.desc())
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
            "initial_weight_g": s.initial_weight_g,
            "current_weight_g": round(s.current_weight_g, 1),
            "usage_percent": s.usage_percent,
            "remaining_percent": s.remaining_percent,
            "is_low": s.is_low,
            "is_empty": s.is_empty,
        }
        for s in spools
    ])


@router.post("/add")
async def add_spool(
    name: str = Form(...),
    color: str = Form("Branco"),
    color_hex: str = Form("#FFFFFF"),
    material: str = Form("PLA"),
    price_per_kg: float = Form(0.0),
    initial_weight_g: float = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spool = Spool(
        user_id=current_user.id,
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
    db.refresh(spool)
    log_action(db, current_user.id, "add_spool")
    return JSONResponse(content={"ok": True, "id": spool.id}, status_code=201)


@router.post("/edit/{spool_id}")
@router.post("/update/{spool_id}")
async def update_spool(
    spool_id: int,
    current_weight_g: float = Form(...),
    price_per_kg: float = Form(None),
    name: str = Form(None),
    color: str = Form(None),
    color_hex: str = Form(None),
    material: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spool = (
        db.query(Spool)
        .filter(Spool.id == spool_id, Spool.user_id == current_user.id)
        .first()
    )
    if not spool:
        raise HTTPException(status_code=404, detail="Carretel não encontrado")

    if name is not None:        spool.name = name.strip()
    if color is not None:       spool.color = color.strip()
    if color_hex is not None:   spool.color_hex = color_hex
    if material is not None:    spool.material = material.strip()
    if price_per_kg is not None: spool.price_per_kg = price_per_kg
    spool.current_weight_g = max(0, min(current_weight_g, spool.initial_weight_g))

    db.commit()
    log_action(db, current_user.id, "update_spool")
    return JSONResponse(content={"ok": True})


@router.post("/delete/{spool_id}")
async def delete_spool(
    spool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spool = (
        db.query(Spool)
        .filter(Spool.id == spool_id, Spool.user_id == current_user.id)
        .first()
    )
    if not spool:
        raise HTTPException(status_code=404, detail="Carretel não encontrado")
    db.delete(spool)
    db.commit()
    log_action(db, current_user.id, "delete_spool")
    return JSONResponse(content={"ok": True})


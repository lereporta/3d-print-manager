from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.routes import dashboard, history, queue, inventory

app = FastAPI(title="3D Print Manager", version="2.0.0")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(dashboard.router)
app.include_router(history.router)
app.include_router(queue.router)
app.include_router(inventory.router)


@app.on_event("startup")
def on_startup():
    init_db()


# ── API: Lista de carretéis para seleção no dashboard ──
from fastapi.responses import JSONResponse
from app.models import Spool
from app.database import get_db
from sqlalchemy.orm import Session
from fastapi import Depends

@app.get("/api/spools")
async def api_spools(db: Session = Depends(get_db)):
    spools = db.query(Spool).filter(Spool.current_weight_g > 0).order_by(Spool.name).all()
    return JSONResponse(content=[
        {
            "id": s.id,
            "name": s.name,
            "color": s.color,
            "color_hex": s.color_hex,
            "material": s.material,
            "price_per_kg": s.price_per_kg,
            "current_weight_g": round(s.current_weight_g, 1),
            "remaining_percent": s.remaining_percent,
        }
        for s in spools
    ])

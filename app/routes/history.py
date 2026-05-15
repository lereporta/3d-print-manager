from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Budget

router = APIRouter(prefix="/history")
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
async def history(request: Request, db: Session = Depends(get_db)):
    budgets = db.query(Budget).order_by(Budget.created_at.desc()).all()
    return templates.TemplateResponse("history.html", {
        "request": request,
        "budgets": budgets,
    })


@router.post("/delete/{budget_id}")
async def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if budget:
        db.delete(budget)
        db.commit()
    return RedirectResponse(url="/history/?deleted=1", status_code=303)


@router.post("/clear")
async def clear_history(db: Session = Depends(get_db)):
    db.query(Budget).delete()
    db.commit()
    return RedirectResponse(url="/history/?cleared=1", status_code=303)


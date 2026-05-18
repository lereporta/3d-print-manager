from fastapi import APIRouter, Request, Depends, HTTPException, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PrintJob, JobStatus, JobPriority, Spool, User
from app.auth import get_current_user, log_action

router = APIRouter(prefix="/queue", tags=["queue"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/")
async def queue_page(request: Request):
    return templates.TemplateResponse(
        "queue.html",
        {"request": request, "active_page": "queue"},
    )


@router.get("/api/list")
async def api_list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = (
        db.query(PrintJob)
        .filter(PrintJob.user_id == current_user.id)
        .order_by(PrintJob.created_at.desc())
        .all()
    )
    return JSONResponse(content=[
        {
            "id": j.id,
            "job_name": j.job_name,
            "piece_weight_g": j.piece_weight_g,
            "spool_id": j.spool_id,
            "status": j.status,
            "priority": j.priority,
            "notes": j.notes,
            "created_at": j.created_at.strftime("%d/%m/%Y %H:%M") if j.created_at else "",
        }
        for j in jobs
    ])


@router.post("/add")
async def add_job(
    job_name: str = Form(...),
    piece_weight_g: float = Form(0.0),
    spool_id: int = Form(None),
    priority: str = Form(JobPriority.MEDIA.value),
    notes: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Valida que o spool (se informado) pertence ao usuário
    if spool_id:
        spool = (
            db.query(Spool)
            .filter(Spool.id == spool_id, Spool.user_id == current_user.id)
            .first()
        )
        if not spool:
            raise HTTPException(status_code=400, detail="Carretel inválido ou não pertence a você")

    job = PrintJob(
        user_id=current_user.id,
        job_name=job_name.strip(),
        piece_weight_g=piece_weight_g,
        spool_id=spool_id,
        status=JobStatus.PENDENTE.value,
        priority=priority,
        notes=notes.strip(),
    )
    db.add(job)
    db.commit()
    log_action(db, current_user.id, "add_print_job")
    return RedirectResponse(url="/queue/?added=1", status_code=303)


@router.post("/update/{job_id}")
async def update_job(
    job_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = (
        db.query(PrintJob)
        .filter(PrintJob.id == job_id, PrintJob.user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    previous_status = job.status
    job.status = status

    # Se finalizou agora, desconta o filamento do carretel
    if (
        status == JobStatus.FINALIZADO.value
        and previous_status != JobStatus.FINALIZADO.value
        and job.spool_id
        and job.piece_weight_g > 0
    ):
        spool = (
            db.query(Spool)
            .filter(Spool.id == job.spool_id, Spool.user_id == current_user.id)
            .first()
        )
        if spool:
            spool.current_weight_g = max(0, spool.current_weight_g - job.piece_weight_g)

    db.commit()
    log_action(db, current_user.id, f"job_status_{status.lower()}")
    return RedirectResponse(url="/queue/?updated=1", status_code=303)


@router.post("/delete/{job_id}")
async def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = (
        db.query(PrintJob)
        .filter(PrintJob.id == job_id, PrintJob.user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    db.delete(job)
    db.commit()
    log_action(db, current_user.id, "delete_print_job")
    return RedirectResponse(url="/queue/?deleted=1", status_code=303)


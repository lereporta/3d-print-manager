from fastapi import APIRouter, Request, Depends, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PrintJob, Spool, JobStatus, JobPriority
from datetime import datetime, timezone

router = APIRouter(prefix="/queue")
templates = Jinja2Templates(directory="app/templates")

PRIORITY_ORDER = {
    JobPriority.URGENTE.value: 0,
    JobPriority.ALTA.value: 1,
    JobPriority.MEDIA.value: 2,
    JobPriority.BAIXA.value: 3,
}


@router.get("/")
async def queue(request: Request, db: Session = Depends(get_db)):
    jobs = db.query(PrintJob).all()
    spools = db.query(Spool).filter(Spool.current_weight_g > 0).all()

    jobs.sort(
        key=lambda j: (
            0
            if j.status == JobStatus.IMPRIMINDO.value
            else (1 if j.status == JobStatus.PENDENTE.value else 2),
            PRIORITY_ORDER.get(j.priority, 99),
        )
    )

    # Build spool map for display
    spool_map = {s.id: s for s in db.query(Spool).all()}

    return templates.TemplateResponse(
        "queue.html",
        {
            "request": request,
            "jobs": jobs,
            "spools": spools,
            "spool_map": spool_map,
            "statuses": [s.value for s in JobStatus],
            "priorities": [p.value for p in JobPriority],
        },
    )


@router.post("/add")
async def add_job(
    job_name: str = Form(...),
    piece_weight_g: float = Form(0.0),
    spool_id: int = Form(0),
    priority: str = Form(JobPriority.MEDIA.value),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    job = PrintJob(
        job_name=job_name,
        piece_weight_g=piece_weight_g,
        spool_id=spool_id if spool_id > 0 else None,
        priority=priority,
        notes=notes,
    )
    db.add(job)
    db.commit()
    return RedirectResponse(url="/queue/?added=1", status_code=303)


@router.post("/update/{job_id}")
async def update_job_status(
    job_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
):
    job = db.query(PrintJob).filter(PrintJob.id == job_id).first()
    if not job:
        return RedirectResponse(url="/queue/", status_code=303)

    old_status = job.status
    job.status = status
    job.updated_at = datetime.now(timezone.utc)

    # Debitar estoque ao finalizar
    if (
        status == JobStatus.FINALIZADO.value
        and old_status != JobStatus.FINALIZADO.value
        and job.spool_id
        and job.piece_weight_g > 0
    ):
        spool = db.query(Spool).filter(Spool.id == job.spool_id).first()
        if spool:
            spool.current_weight_g = max(0, spool.current_weight_g - job.piece_weight_g)
            spool.updated_at = datetime.now(timezone.utc)

    # Reverter débito se voltou de Finalizado para outro status
    if (
        old_status == JobStatus.FINALIZADO.value
        and status != JobStatus.FINALIZADO.value
        and job.spool_id
        and job.piece_weight_g > 0
    ):
        spool = db.query(Spool).filter(Spool.id == job.spool_id).first()
        if spool:
            spool.current_weight_g = spool.current_weight_g + job.piece_weight_g
            spool.updated_at = datetime.now(timezone.utc)

    db.commit()
    return RedirectResponse(url="/queue/", status_code=303)


@router.post("/delete/{job_id}")
async def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(PrintJob).filter(PrintJob.id == job_id).first()
    if job:
        db.delete(job)
        db.commit()
    return RedirectResponse(url="/queue/?deleted=1", status_code=303)


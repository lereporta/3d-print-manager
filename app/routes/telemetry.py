from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Feedback, User
from app.auth import get_current_user, log_action

router = APIRouter(prefix="/api", tags=["telemetry"])


class FeedbackIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)


@router.post("/feedback")
def submit_feedback(
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fb = Feedback(user_id=current_user.id, text_content=payload.text.strip())
    db.add(fb)
    db.commit()
    log_action(db, current_user.id, "submit_feedback")
    return {"ok": True, "message": "Feedback registrado. Obrigado!"}


class TrackIn(BaseModel):
    action_name: str = Field(min_length=2, max_length=80)


@router.post("/track")
def track_action(
    payload: TrackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log_action(db, current_user.id, payload.action_name)
    return {"ok": True}


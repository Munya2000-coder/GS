from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.job import Job
from app.services import jobs as jobs_svc

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
def list_jobs(
    status_filter: str | None = None,
    limit: int = 100,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    q = session.query(Job)
    if status_filter:
        q = q.filter(Job.status == status_filter)
    rows = q.order_by(Job.id.desc()).limit(min(limit, 500)).all()
    return [_serialise(j) for j in rows]


@router.get("/{job_id}")
def get_job(
    job_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
    return _serialise(job)


@router.post("/{job_id}/retry")
def retry_job(
    job_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    try:
        job = jobs_svc.retry(session, job_id)
    except ValueError as ex:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(ex))
    session.commit()
    session.refresh(job)
    return _serialise(job)


def _serialise(job: Job) -> dict:
    return {
        "id": job.id,
        "job_type": job.job_type,
        "trigger_source": job.trigger_source,
        "status": job.status,
        "attempts": job.attempts,
        "owner_user_id": job.owner_user_id,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "error": job.error,
    }

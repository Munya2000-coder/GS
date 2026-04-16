"""Job record tracking for batch operations (imports, calcs, exports)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.models.job import Job, JobStatus


def enqueue(
    session: Session,
    *,
    user: AuthUser | None,
    job_type: str,
    trigger_source: str,
    payload: dict[str, Any] | None = None,
) -> Job:
    job = Job(
        job_type=job_type,
        trigger_source=trigger_source,
        owner_user_id=user.id if user else None,
        status=JobStatus.QUEUED,
        payload_json=None if payload is None else json.dumps(payload, default=str),
    )
    session.add(job)
    session.flush()
    return job


def run_sync(
    session: Session,
    *,
    user: AuthUser | None,
    job_type: str,
    trigger_source: str,
    payload: dict[str, Any] | None,
    func: Callable[[], Any],
) -> Job:
    job = enqueue(session, user=user, job_type=job_type, trigger_source=trigger_source, payload=payload)
    job.status = JobStatus.RUNNING
    job.started_at = datetime.utcnow()
    job.attempts += 1
    session.flush()
    try:
        result = func()
        job.result_json = json.dumps(result, default=str)
        job.status = JobStatus.SUCCEEDED
    except Exception as ex:
        job.error = str(ex)
        job.status = JobStatus.FAILED
        job.finished_at = datetime.utcnow()
        raise
    finally:
        job.finished_at = datetime.utcnow()
    return job


def retry(session: Session, job_id: int) -> Job:
    job = session.get(Job, job_id)
    if not job:
        raise ValueError(f"job {job_id} not found")
    if job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
        raise ValueError(f"cannot retry from status {job.status}")
    job.status = JobStatus.RETRYING
    job.error = None
    job.finished_at = None
    return job

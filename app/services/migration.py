"""Migration / go-live scaffolding (Epic 12).

The real cutover plan involves legacy ETL, parallel runs, and business
sign-off. This module provides a structured migration orchestrator that
records each step, owner, status, and reconciliation artifact so the
cutover process is itself auditable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Callable


class StepStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    VALIDATED = "validated"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class MigrationStep:
    name: str
    owner: str
    action: Callable[[], Any]
    rollback: Callable[[], Any] | None = None
    status: StepStatus = StepStatus.PENDING
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None
    result: Any = None


@dataclass
class MigrationPlan:
    name: str
    steps: list[MigrationStep] = field(default_factory=list)

    def run(self) -> None:
        completed: list[MigrationStep] = []
        for step in self.steps:
            step.status = StepStatus.RUNNING
            step.started_at = datetime.utcnow()
            try:
                step.result = step.action()
                step.status = StepStatus.VALIDATED
                completed.append(step)
            except Exception as ex:
                step.status = StepStatus.FAILED
                step.error = str(ex)
                for done in reversed(completed):
                    if done.rollback:
                        try:
                            done.rollback()
                            done.status = StepStatus.ROLLED_BACK
                        except Exception:
                            pass
                raise
            finally:
                step.finished_at = datetime.utcnow()

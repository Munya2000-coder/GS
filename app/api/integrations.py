"""Integration templates and interface registry (Epic 9)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.integration import Interface, InterfaceDirection, InterfaceRun

router = APIRouter(prefix="/integrations", tags=["integrations"])


TRANSACTION_IMPORT_TEMPLATE: dict[str, Any] = {
    "version": "2026.04",
    "description": "Standard inbound transaction feed",
    "fields": [
        {"name": "source_reference", "type": "string", "required": True, "notes": "stable unique key from source system"},
        {"name": "entity_id", "type": "integer", "required": True},
        {"name": "investor_id", "type": "integer", "required": False},
        {"name": "capital_account_id", "type": "integer", "required": False},
        {"name": "transaction_type", "type": "enum", "required": True,
         "allowed": ["capital_call", "contribution", "distribution", "recall", "management_fee",
                     "fee_offset", "expense", "nav", "realised_gain", "realised_loss",
                     "unrealised_pnl", "portfolio_cash_in", "portfolio_cash_out", "journal"]},
        {"name": "transaction_date", "type": "date", "required": True, "format": "ISO-8601"},
        {"name": "amount", "type": "decimal(20,2)", "required": True, "notes": "non-zero"},
        {"name": "currency", "type": "string(3)", "required": True, "notes": "ISO 4217"},
        {"name": "description", "type": "string(512)", "required": False},
    ],
}


class InterfaceCreate(BaseModel):
    code: str
    name: str
    direction: InterfaceDirection
    source_owner: str
    target_owner: str
    schema_version: str
    mapping_json: str
    frequency: str
    retry_policy: str = "manual"


@router.get("/templates/transactions")
def transaction_import_template(_: AuthUser = Depends(require_permission(Permission.READ))) -> dict[str, Any]:
    return TRANSACTION_IMPORT_TEMPLATE


@router.post("/interfaces", status_code=201)
def create_interface(
    payload: InterfaceCreate,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.ADMIN)),
):
    if session.query(Interface).filter(Interface.code == payload.code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "interface code exists")
    interface = Interface(**payload.model_dump())
    session.add(interface)
    session.commit()
    session.refresh(interface)
    return {"id": interface.id, "code": interface.code}


@router.get("/interfaces")
def list_interfaces(
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    rows = session.query(Interface).all()
    return [
        {"id": r.id, "code": r.code, "name": r.name, "direction": r.direction, "frequency": r.frequency}
        for r in rows
    ]


@router.get("/interfaces/{interface_id}/runs")
def list_runs(
    interface_id: int,
    session: Session = Depends(get_session),
    _: AuthUser = Depends(require_permission(Permission.READ)),
):
    runs = session.query(InterfaceRun).filter(InterfaceRun.interface_id == interface_id).all()
    return [
        {
            "id": r.id, "status": r.status, "record_count": r.record_count,
            "error": r.error_detail, "reconciliation_ok": r.reconciliation_ok,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        }
        for r in runs
    ]

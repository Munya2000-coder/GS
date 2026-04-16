"""Server-rendered HTML UI. A thin read-only view over the same domain data
the REST API exposes. Authentication uses the same `X-User-Id` header mechanism
via a cookie fallback for browser sessions."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Cookie, Depends, Form, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Role
from app.models.entity import Entity
from app.models.investor import Investor
from app.models.job import Job
from app.models.transaction import Transaction
from app.models.user import User
from app.services import dashboards
from app.services.performance import compute_metrics

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))
router = APIRouter(tags=["ui"], include_in_schema=False)


def _resolve_user(session: Session, username: str | None) -> AuthUser | None:
    if not username:
        return None
    user = session.query(User).filter(User.username == username, User.active.is_(True)).one_or_none()
    if not user:
        return None
    return AuthUser(
        id=user.id, username=user.username,
        roles={Role(r) for r in user.roles_list()},
        fund_scope=user.fund_scope_list(),
    )


def _require_session(session: Session, gs_user: str | None) -> AuthUser:
    user = _resolve_user(session, gs_user)
    if not user:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "not signed in",
            headers={"Location": "/ui/login"},
        )
    return user


@router.get("/", response_class=HTMLResponse)
def root():
    return RedirectResponse("/ui/")


@router.get("/ui/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse(request, "login.html", {})


@router.post("/ui/login")
def login(response: Response, username: str = Form(...)):
    resp = RedirectResponse("/ui/", status_code=302)
    resp.set_cookie("gs_user", username, httponly=True, samesite="lax")
    return resp


@router.post("/ui/logout")
def logout():
    resp = RedirectResponse("/ui/login", status_code=302)
    resp.delete_cookie("gs_user")
    return resp


@router.get("/ui/", response_class=HTMLResponse)
def home(
    request: Request,
    gs_user: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
):
    try:
        user = _require_session(session, gs_user)
    except HTTPException:
        return RedirectResponse("/ui/login")
    summary = dashboards.platform_summary(session)
    return templates.TemplateResponse(
        request, "home.html", {"user": user, "summary": summary},
    )


@router.get("/ui/funds", response_class=HTMLResponse)
def funds(
    request: Request,
    gs_user: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
):
    try:
        user = _require_session(session, gs_user)
    except HTTPException:
        return RedirectResponse("/ui/login")
    entities = session.query(Entity).order_by(Entity.code).all()
    return templates.TemplateResponse(
        request, "funds.html", {"user": user, "entities": entities},
    )


@router.get("/ui/funds/{entity_id}", response_class=HTMLResponse)
def fund_detail(
    entity_id: int,
    request: Request,
    gs_user: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
):
    try:
        user = _require_session(session, gs_user)
    except HTTPException:
        return RedirectResponse("/ui/login")
    entity = session.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "fund not found")
    as_of = date.today()
    metrics = compute_metrics(session, entity_id=entity_id, as_of=as_of)
    summary = dashboards.fund_summary(session, entity_id, as_of)
    recent_tx = (
        session.query(Transaction)
        .filter(Transaction.entity_id == entity_id)
        .order_by(Transaction.transaction_date.desc())
        .limit(25)
        .all()
    )
    return templates.TemplateResponse(
        request, "fund_detail.html",
        {
            "user": user, "entity": entity, "metrics": metrics,
            "summary": summary, "transactions": recent_tx, "as_of": as_of,
        },
    )


@router.get("/ui/investors", response_class=HTMLResponse)
def investors(
    request: Request,
    gs_user: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
):
    try:
        user = _require_session(session, gs_user)
    except HTTPException:
        return RedirectResponse("/ui/login")
    rows = session.query(Investor).order_by(Investor.code).all()
    return templates.TemplateResponse(
        request, "investors.html", {"user": user, "investors": rows},
    )


@router.get("/ui/operations", response_class=HTMLResponse)
def operations(
    request: Request,
    gs_user: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
):
    try:
        user = _require_session(session, gs_user)
    except HTTPException:
        return RedirectResponse("/ui/login")
    ops = dashboards.operations_dashboard(session)
    jobs = session.query(Job).order_by(Job.id.desc()).limit(20).all()
    return templates.TemplateResponse(
        request, "operations.html", {"user": user, "ops": ops, "jobs": jobs},
    )

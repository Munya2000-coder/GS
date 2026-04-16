from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import AuthUser, Permission, require_permission
from app.models.entity import Entity
from app.schemas.entity import EntityCreate, EntityOut, EntityUpdate
from app.services import audit

router = APIRouter(prefix="/entities", tags=["entities"])


@router.post("", response_model=EntityOut, status_code=201)
def create_entity(
    payload: EntityCreate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.CREATE)),
):
    if session.query(Entity).filter(Entity.code == payload.code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"entity code {payload.code} already exists")
    entity = Entity(**payload.model_dump())
    session.add(entity)
    session.flush()
    audit.log_event(
        session, actor_user_id=user.id, action="entity.create",
        object_type="entity", object_id=entity.id, after=payload.model_dump(),
    )
    session.commit()
    session.refresh(entity)
    return entity


@router.get("", response_model=list[EntityOut])
def list_entities(session: Session = Depends(get_session), _: AuthUser = Depends(require_permission(Permission.READ))):
    return session.query(Entity).order_by(Entity.code).all()


@router.get("/{entity_id}", response_model=EntityOut)
def get_entity(entity_id: int, session: Session = Depends(get_session), _: AuthUser = Depends(require_permission(Permission.READ))):
    entity = session.get(Entity, entity_id)
    if not entity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "entity not found")
    return entity


@router.patch("/{entity_id}", response_model=EntityOut)
def update_entity(
    entity_id: int,
    payload: EntityUpdate,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.EDIT)),
):
    entity = session.get(Entity, entity_id)
    if not entity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "entity not found")
    changes = payload.model_dump(exclude_unset=True)
    before = {k: getattr(entity, k) for k in changes}
    for k, v in changes.items():
        setattr(entity, k, v)
    audit.log_event(
        session, actor_user_id=user.id, action="entity.update",
        object_type="entity", object_id=entity.id, before=before, after=changes,
    )
    session.commit()
    session.refresh(entity)
    return entity


@router.delete("/{entity_id}", status_code=204)
def deactivate_entity(
    entity_id: int,
    session: Session = Depends(get_session),
    user: AuthUser = Depends(require_permission(Permission.ADMIN)),
):
    entity = session.get(Entity, entity_id)
    if not entity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "entity not found")
    if entity.has_posted_activity(session):
        raise HTTPException(status.HTTP_409_CONFLICT, "entity has posted activity; inactivate instead")
    from app.models.entity import EntityStatus
    entity.status = EntityStatus.INACTIVE
    audit.log_event(
        session, actor_user_id=user.id, action="entity.deactivate",
        object_type="entity", object_id=entity.id, privileged=True,
    )
    session.commit()

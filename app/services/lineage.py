"""Lineage graph service.

Every materially-produced artifact (journal entries, fee accruals, waterfall
results, reports) records a `LineageEdge` to its immediate input. Traversing
the edges yields the full chain from report back to source payload.
"""

from __future__ import annotations

import json
from collections import defaultdict, deque
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import LineageEdge


def record_edge(
    session: Session,
    *,
    upstream_type: str,
    upstream_id: str | int,
    downstream_type: str,
    downstream_id: str | int,
    relation: str,
    metadata: dict[str, Any] | None = None,
) -> LineageEdge:
    edge = LineageEdge(
        upstream_type=upstream_type,
        upstream_id=str(upstream_id),
        downstream_type=downstream_type,
        downstream_id=str(downstream_id),
        relation=relation,
        metadata_json=None if metadata is None else json.dumps(metadata, default=str),
    )
    session.add(edge)
    session.flush()
    return edge


def trace_upstream(
    session: Session, object_type: str, object_id: str | int, max_depth: int = 20
) -> list[dict[str, Any]]:
    """Return the transitive upstream lineage for an object."""
    seen = set()
    queue: deque[tuple[str, str, int]] = deque([(object_type, str(object_id), 0)])
    result: list[dict[str, Any]] = []
    while queue:
        t, i, depth = queue.popleft()
        if (t, i) in seen or depth >= max_depth:
            continue
        seen.add((t, i))
        edges = (
            session.query(LineageEdge)
            .filter(LineageEdge.downstream_type == t, LineageEdge.downstream_id == i)
            .all()
        )
        for edge in edges:
            result.append(
                {
                    "upstream_type": edge.upstream_type,
                    "upstream_id": edge.upstream_id,
                    "downstream_type": edge.downstream_type,
                    "downstream_id": edge.downstream_id,
                    "relation": edge.relation,
                    "depth": depth,
                }
            )
            queue.append((edge.upstream_type, edge.upstream_id, depth + 1))
    return result


def trace_downstream(
    session: Session, object_type: str, object_id: str | int, max_depth: int = 20
) -> list[dict[str, Any]]:
    seen = set()
    queue: deque[tuple[str, str, int]] = deque([(object_type, str(object_id), 0)])
    result: list[dict[str, Any]] = []
    while queue:
        t, i, depth = queue.popleft()
        if (t, i) in seen or depth >= max_depth:
            continue
        seen.add((t, i))
        edges = (
            session.query(LineageEdge)
            .filter(LineageEdge.upstream_type == t, LineageEdge.upstream_id == i)
            .all()
        )
        for edge in edges:
            result.append(
                {
                    "upstream_type": edge.upstream_type,
                    "upstream_id": edge.upstream_id,
                    "downstream_type": edge.downstream_type,
                    "downstream_id": edge.downstream_id,
                    "relation": edge.relation,
                    "depth": depth,
                }
            )
            queue.append((edge.downstream_type, edge.downstream_id, depth + 1))
    return result

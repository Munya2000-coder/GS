"""CSV and JSON export helpers."""

from __future__ import annotations

import csv
import io
from typing import Iterable


def to_csv(headers: list[str], rows: Iterable[list[object]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([("" if v is None else v) for v in row])
    return buf.getvalue()

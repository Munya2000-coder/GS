#!/usr/bin/env python3
"""Generate the BuntuFin Requirements Traceability Matrix (BFR-RTM-001).

Realises BFR-NFR-010 and URS section 27. The RTM is GENERATED from the
controlled baseline and the Functional Design Specification -- never
maintained by hand, because a hand-maintained matrix drifts from reality.

Sources
  00-urs/BFR-URS-001-baseline.md   requirement id, text, acceptance, priority
  05-fds/domain-*.md               design component, API, data, story, tests

Output
  07-traceability/rtm.csv          one row per (requirement, test case)

Once implementation begins, the Test Result, Defect Reference and Release
Version columns are populated by the CI traceability job from test markers
(@urs(...)) and route declarations (x-urs-requirements); see BFR-STD-009.

Usage:  python3 generate_rtm.py [--check]
        --check exits non-zero if any baseline requirement is missing from
        the FDS, or any P1 requirement has no test case (the CI gate).
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "00-urs" / "BFR-URS-001-baseline.md"
FDS_DIR = ROOT / "05-fds"
OUT = ROOT / "07-traceability" / "rtm.csv"

REQ_ROW = re.compile(r"^\|\s*(BFR-[A-Z]+-\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(P[123])\s*\|")
HEADING = re.compile(r"^###\s+(BFR-[A-Z]+-\d+)\s+—\s+(.+?)\s+`(P[123])`\s*$")
TC_ROW = re.compile(r"^\|\s*(TC-[A-Z]+-\d+-\d+)\s*\|\s*([A-Z]{3})\s*\|\s*(.+?)\s*\|")
STORY = re.compile(r"\*\*Story\s+`(US-[A-Z]+-\d+)`\*\*")
EPIC = re.compile(r"\*\*Epic:\*\*\s+`(EPIC-[A-Z]+)`")
CONTEXT = re.compile(r"\*\*Context:\*\*\s+(.+?)\s+·")
COMPONENT = re.compile(r"^\*\*Component:\*\*\s+(.+?)\s*$")
DATA = re.compile(r"^\*\*Data\*\*\s+—\s+(.+?)\s*$")
API_INLINE = re.compile(r"^\*\*API\*\*\s+—\s+(.+?)\s*$")
ENDPOINT = re.compile(r"`((?:GET|POST|PUT|PATCH|DELETE)\s+[^`]+)`")

DOMAIN_NAMES = {
    "GOV": "Platform governance", "USR": "User and role management",
    "ID": "Identity and KYC", "CON": "Consent and privacy",
    "OF": "Open finance", "CAT": "Transaction categorisation",
    "FP": "Financial Passport", "FPS": "Passport sharing",
    "FH": "Financial health", "PAY": "Customer payments",
    "LED": "Double-entry ledger", "SAV": "BuntuSave",
    "CIR": "BuntuCircle", "CG": "Circle governance and payouts",
    "BIZ": "BuntuBusiness", "INV": "Inventory-lite",
    "CAP": "Capital marketplace", "CAF": "Capital application lifecycle",
    "XB": "Cross-border payments", "FX": "FX and routing",
    "GOAL": "PurposePay and goals", "AML": "AML and financial crime",
    "FRD": "Fraud management", "CMP": "Complaints and disputes",
    "PRT": "Partner management", "ADM": "Administration portal",
    "NOT": "Notifications", "RPT": "Reporting and sandbox KPI",
    "REC": "Reconciliation and settlement", "NFR": "Cross-cutting non-functional",
}

TEST_TYPES = {
    "POS": "Positive functional", "NEG": "Negative functional",
    "PRM": "Permissions", "SEC": "Security", "AUD": "Audit verification",
    "API": "API contract", "INT": "Integration", "ERR": "Error handling",
    "CON": "Concurrency", "IDM": "Idempotency", "REV": "Reversal",
    "REC": "Reconciliation", "DEC": "Decimal and rounding",
}


def load_baseline() -> dict[str, dict]:
    reqs: dict[str, dict] = {}
    for line in BASELINE.read_text(encoding="utf-8").splitlines():
        m = REQ_ROW.match(line)
        if m:
            rid, text, acceptance, priority = m.groups()
            reqs[rid] = {"text": text, "acceptance": acceptance, "priority": priority}
    return reqs


def parse_fds() -> dict[str, dict]:
    """Extract one design record per requirement from the FDS domain files."""
    designs: dict[str, dict] = {}
    for path in sorted(FDS_DIR.glob("domain-*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        header = "\n".join(lines[:12])
        epic = (EPIC.search(header).group(1) if EPIC.search(header) else "")
        context = (CONTEXT.search(header).group(1) if CONTEXT.search(header) else "")

        current: dict | None = None
        section = ""
        for line in lines:
            h = HEADING.match(line)
            if h:
                rid, title, priority = h.groups()
                current = {
                    "fds_file": path.name, "epic": epic, "context": context,
                    "title": title, "priority": priority, "component": "",
                    "apis": [], "api_prose": [], "data": "", "story": "", "tests": [],
                }
                designs[rid] = current
                section = ""
                continue
            if current is None:
                continue

            if (c := COMPONENT.match(line)):
                current["component"] = c.group(1)
            if (d := DATA.match(line)):
                current["data"] = d.group(1)
            if (s := STORY.search(line)):
                current["story"] = s.group(1)

            if line.startswith("**API**"):
                section = "api"
                if (a := API_INLINE.match(line)):
                    current["apis"].extend(ENDPOINT.findall(a.group(1)))
                    current["api_prose"].append(a.group(1))
                continue
            if line.startswith("**") and not line.startswith("**API**"):
                section = ""
            if section == "api" and line.strip():
                current["apis"].extend(ENDPOINT.findall(line))
                current["api_prose"].append(line.strip().lstrip("- "))

            if (t := TC_ROW.match(line)):
                tc, cat, case = t.groups()
                current["tests"].append((tc, cat, case))
    return designs



def api_cell(d: dict | None) -> str:
    """Endpoints where declared; otherwise the design's own words about why not."""
    if not d:
        return ""
    if d["apis"]:
        return "; ".join(dict.fromkeys(d["apis"]))[:400]
    prose = " ".join(d["api_prose"]).replace("`", "").strip()
    if prose:
        return f"(no new endpoint) {prose}"[:400]
    return "(no new endpoint)"


def component_cell(d: dict | None) -> str:
    """Context plus component, without repeating the service name twice."""
    if not d:
        return ""
    context, component = d["context"], d["component"]
    if not component:
        return context
    service = re.search(r"`([a-z-]+svc)`", context)
    if service and service.group(1) in component:
        component = re.sub(r"^`" + service.group(1) + r"`\s*/\s*", "", component)
    return f"{context} / {component}".strip(" /")


def build_rows(reqs: dict[str, dict], designs: dict[str, dict]) -> list[dict]:
    rows: list[dict] = []
    for rid, req in reqs.items():
        d = designs.get(rid)
        domain = rid.split("-")[1]
        base = {
            "URS Requirement ID": rid,
            "Priority": req["priority"],
            "Requirement": req["text"],
            "Acceptance Criteria": req["acceptance"],
            "Business Process": DOMAIN_NAMES.get(domain, domain),
            "Design Component": component_cell(d),
            "Design Reference": f"05-fds/{d['fds_file']}#{rid.lower()}" if d else "MISSING",
            "Epic": d["epic"] if d else "",
            "API": api_cell(d),
            "Database Entity": d["data"].replace("`", "")[:300] if d else "",
            "User Story": d["story"] if d else "",
        }
        tests = d["tests"] if d else []
        if not tests:
            rows.append({**base, "Test Case ID": "", "Test Type": "",
                         "Test Case": "", "Test Result": "NO_TEST_DEFINED",
                         "Defect Reference": "", "Release Version": ""})
            continue
        for tc, cat, case in tests:
            rows.append({**base, "Test Case ID": tc,
                         "Test Type": TEST_TYPES.get(cat, cat), "Test Case": case,
                         "Test Result": "NOT_EXECUTED", "Defect Reference": "",
                         "Release Version": ""})
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit non-zero if traceability is incomplete (CI gate)")
    args = ap.parse_args()

    reqs = load_baseline()
    designs = parse_fds()
    rows = build_rows(reqs, designs)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = ["URS Requirement ID", "Priority", "Requirement", "Acceptance Criteria",
              "Business Process", "Epic", "Design Component", "Design Reference",
              "API", "Database Entity", "User Story", "Test Case ID", "Test Type",
              "Test Case", "Test Result", "Defect Reference", "Release Version"]
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    missing_design = sorted(r for r in reqs if r not in designs)
    orphan_design = sorted(d for d in designs if d not in reqs)
    p1_no_test = sorted(r for r, q in reqs.items()
                        if q["priority"] == "P1" and not designs.get(r, {}).get("tests"))
    no_story = sorted(r for r in reqs if not designs.get(r, {}).get("story"))

    print(f"requirements       : {len(reqs)}")
    print(f"design blocks      : {len(designs)}")
    print(f"rtm rows           : {len(rows)}")
    print(f"test cases         : {sum(len(d['tests']) for d in designs.values())}")
    print(f"missing design     : {len(missing_design)} {missing_design[:5]}")
    print(f"orphan design      : {len(orphan_design)} {orphan_design[:5]}")
    print(f"P1 without test    : {len(p1_no_test)} {p1_no_test[:5]}")
    print(f"without user story : {len(no_story)} {no_story[:5]}")
    print(f"written            : {OUT.relative_to(ROOT)}")

    if args.check and (missing_design or orphan_design or p1_no_test or no_story):
        print("TRACEABILITY GATE: FAILED", file=sys.stderr)
        return 1
    if args.check:
        print("TRACEABILITY GATE: PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

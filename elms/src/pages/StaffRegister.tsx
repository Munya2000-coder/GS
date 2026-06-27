import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, Field, Meter, Modal } from "../components/ui";
import { Icon } from "../components/Icon";
import { compliancePct } from "../lib/analytics";
import { ROLE_LABELS, daysToExpiry } from "../lib/domain";
import type { ContractType, RoleKey, Staff } from "../data/types";
import { ORG } from "../data/seed";

function expiryBadge(dateStr: string, label: string) {
  const d = daysToExpiry(dateStr);
  if (d === null) return null;
  if (d < 0) return <Badge tone="red" dot>{label} expired</Badge>;
  if (d <= 60) return <Badge tone="amber" dot>{label} {d}d</Badge>;
  return <Badge tone="green" dot>{label} ok</Badge>;
}

export function StaffRegister() {
  const { staff, computed, inspectionMode, addStaff } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [branch, setBranch] = useState<string>("all");
  const [adding, setAdding] = useState(false);

  const pctByStaff = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of staff) {
      map[s.id] = compliancePct(computed.filter((r) => r.staffId === s.id));
    }
    return map;
  }, [staff, computed]);

  const filtered = staff.filter((s) => {
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    if (q && !name.includes(q.toLowerCase()) && !s.email.includes(q.toLowerCase())) return false;
    if (role !== "all" && s.role !== role) return false;
    if (branch !== "all" && s.branch !== branch) return false;
    return true;
  });

  const roleOptions = Array.from(new Set(staff.map((s) => s.role)));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Staff Register</h1>
          <p>
            {staff.filter((s) => s.employmentStatus !== "Left").length} active staff across{" "}
            {ORG.branches.length} teams. Track roles, DBS, right-to-work and training compliance.
          </p>
        </div>
        {!inspectionMode && (
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
            Add staff member
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="card-pad row gap-12 wrap">
          <div className="topbar-search" style={{ width: 280, margin: 0 }}>
            <Icon name="search" size={16} />
            <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: 200 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select className="select" style={{ width: 180 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="all">All teams</option>
            {ORG.branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <span className="ml-auto small muted">{filtered.length} of {staff.length}</span>
        </div>
        <div className="table-wrap">
          <table className="tbl clickable">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Role</th>
                <th>Team</th>
                <th>Compliance</th>
                <th>DBS / Right to work</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const pct = pctByStaff[s.id];
                return (
                  <tr key={s.id} onClick={() => navigate(`/staff/${s.id}`)}>
                    <td>
                      <div className="cell-person">
                        <Avatar first={s.firstName} last={s.lastName} color={s.avatarColor} size="md" />
                        <div className="meta">
                          <b>{s.firstName} {s.lastName}</b>
                          <span>{s.email}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="td-strong">{s.roleLabel}</span><div className="tiny muted">{s.contractType}</div></td>
                    <td className="td-muted">{s.branch}</td>
                    <td style={{ width: 150 }}>
                      <div className="row gap-8">
                        <div style={{ flex: 1 }}><Meter value={pct} /></div>
                        <b className="mono tiny" style={{ width: 34 }}>{pct}%</b>
                      </div>
                    </td>
                    <td>
                      <div className="row gap-6 wrap">
                        {expiryBadge(s.dbsExpiry, "DBS")}
                        {expiryBadge(s.rightToWorkExpiry, "RTW")}
                      </div>
                    </td>
                    <td>
                      <Badge tone={s.employmentStatus === "Active" ? "green" : s.employmentStatus === "Onboarding" ? "blue" : "grey"}>
                        {s.employmentStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <AddStaffModal onClose={() => setAdding(false)} onAdd={addStaff} />}
    </>
  );
}

function AddStaffModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (s: Omit<Staff, "id" | "roleLabel" | "avatarColor">) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    role: "care_worker" as RoleKey,
    email: "",
    phone: "",
    startDate: "2026-07-01",
    contractType: "Full-time" as ContractType,
    branch: "North Team",
    dbsExpiry: "2029-07-01",
    rightToWorkExpiry: "2030-07-01",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.firstName && form.lastName;

  return (
    <Modal
      title="Add staff member"
      icon="staff"
      drawer
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!valid}
            onClick={() => {
              onAdd({
                ...form,
                email: form.email || `${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}@elmshealth.co.uk`,
                phone: form.phone || "+44 7700 900000",
                employmentStatus: "Onboarding",
                dbsCheckDate: "2026-06-01",
                visaExpiry: null,
                managerId: "s1",
                notes: "",
              });
              onClose();
            }}
          >
            Add to register
          </Button>
        </>
      }
    >
      <div className="col gap-16">
        <div className="row gap-12">
          <Field label="First name"><input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Last name"><input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
        </div>
        <Field label="Role">
          <select className="select" value={form.role} onChange={(e) => set("role", e.target.value)}>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== "cqc_reviewer").map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Work email" hint="Leave blank to auto-generate from name">
          <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="auto-generated" />
        </Field>
        <div className="row gap-12">
          <Field label="Contract type">
            <select className="select" value={form.contractType} onChange={(e) => set("contractType", e.target.value)}>
              {["Full-time", "Part-time", "Bank", "Live-in", "Agency"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Team">
            <select className="select" value={form.branch} onChange={(e) => set("branch", e.target.value)}>
              {ORG.branches.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
        </div>
        <div className="row gap-12">
          <Field label="Start date"><input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="DBS expiry"><input className="input" type="date" value={form.dbsExpiry} onChange={(e) => set("dbsExpiry", e.target.value)} /></Field>
        </div>
        <Field label="Right to work expiry">
          <input className="input" type="date" value={form.rightToWorkExpiry} onChange={(e) => set("rightToWorkExpiry", e.target.value)} />
        </Field>
        <div className="row gap-8 small muted" style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8 }}>
          <Icon name="zap" size={15} />
          New starters are automatically assigned the mandatory induction pathway and Care Certificate.
        </div>
      </div>
    </Modal>
  );
}

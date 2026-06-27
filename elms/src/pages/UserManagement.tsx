import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, CardHead, Kpi } from "../components/ui";

const ROLE_PERMISSIONS = [
  { role: "Registered Manager", perms: "Full access, approvals, reporting, CQC export", tone: "violet" as const },
  { role: "Compliance Lead / Admin", perms: "Manage staff, training, certificates, reminders", tone: "blue" as const },
  { role: "Training Manager", perms: "Manage matrix, bookings, reminders", tone: "green" as const },
  { role: "Staff Member", perms: "View own training, upload evidence, see due dates", tone: "grey" as const },
  { role: "Director", perms: "View dashboards and reports", tone: "amber" as const },
  { role: "CQC / External Reviewer", perms: "Read-only access to selected evidence pack", tone: "red" as const },
];

export function UserManagement() {
  const { staff, pushToast } = useStore();
  const accounts = staff.filter((s) => s.employmentStatus !== "Left");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Role-based access control. Every account maps to a permission set aligned with CQC governance.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => pushToast({ kind: "info", title: "Invite sent", body: "A set-up link has been emailed to the new user." })}>
          Invite user
        </Button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <Kpi label="Active accounts" value={accounts.length} icon="shield" tone="brand" />
        <Kpi label="Admin & managers" value={accounts.filter((s) => ["registered_manager", "compliance_lead", "training_manager"].includes(s.role)).length} icon="user" tone="violet" />
        <Kpi label="Pending invites" value={1} icon="mail" tone="amber" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)" }}>
        <Card>
          <CardHead title="Roles & permissions" sub="From the CQC permission model" icon="lock" />
          <div className="card-body col gap-10">
            {ROLE_PERMISSIONS.map((r) => (
              <div key={r.role} className="row gap-12 items-start" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <Badge tone={r.tone} dot>{r.role}</Badge>
                <span className="small muted flex-1">{r.perms}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="User accounts" sub={`${accounts.length} active`} icon="users2" />
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar first={s.firstName} last={s.lastName} color={s.avatarColor} size="sm" />
                        <div className="meta">
                          <b>{s.firstName} {s.lastName}</b>
                          <span>{s.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="small">{s.roleLabel}</td>
                    <td className="td-muted small">{s.branch}</td>
                    <td><Badge tone={s.employmentStatus === "Active" ? "green" : "blue"} dot>{s.employmentStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

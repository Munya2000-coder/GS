import { useState } from "react";
import { useStore } from "../store/store";
import { Badge, Button, Card, CardHead, Field, Tabs } from "../components/ui";
import { Icon } from "../components/Icon";
import { ORG } from "../data/seed";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: "none",
        padding: 2,
        background: on ? "var(--brand-600)" : "var(--border-strong)",
        transition: "background 0.18s",
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
        cursor: "pointer",
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-sm)" }} />
    </button>
  );
}

export function Settings() {
  const { user, pushToast } = useStore();
  const [tab, setTab] = useState<"org" | "reminders" | "notifications" | "rules">("org");
  const [toggles, setToggles] = useState({
    email: true,
    sms: true,
    inApp: true,
    autoEscalate: true,
    weeklyDigest: true,
    inductionAuto: true,
  });
  const set = (k: keyof typeof toggles) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  const reminderDays = [90, 60, 30, 7];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Configure organisation details, reminder timings, notification channels and compliance rules.</p>
        </div>
        <Button variant="primary" icon="check" onClick={() => pushToast({ kind: "success", title: "Settings saved" })}>
          Save changes
        </Button>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "org", label: "Organisation" },
            { key: "reminders", label: "Reminder timings" },
            { key: "notifications", label: "Notifications" },
            { key: "rules", label: "Compliance rules" },
          ]}
        />
      </div>

      {tab === "org" && (
        <Card>
          <CardHead title="Organisation details" icon="settings" />
          <div className="card-body grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            <Field label="Organisation name"><input className="input" defaultValue={ORG.name} /></Field>
            <Field label="CQC Provider ID"><input className="input" defaultValue={ORG.cqcId} /></Field>
            <Field label="Registered Manager"><input className="input" defaultValue={user?.name} /></Field>
            <Field label="Primary contact email"><input className="input" defaultValue="compliance@elmshealth.co.uk" /></Field>
            <Field label="Teams / branches" hint="Comma separated">
              <input className="input" defaultValue={ORG.branches.join(", ")} />
            </Field>
            <Field label="Due-soon window (Amber)" hint="Days before expiry to flag Amber">
              <input className="input" type="number" defaultValue={60} />
            </Field>
          </div>
        </Card>
      )}

      {tab === "reminders" && (
        <Card>
          <CardHead title="Reminder schedule" sub="When alerts fire before a training expiry" icon="clock" />
          <div className="card-body col gap-12">
            {reminderDays.map((d, i) => (
              <div key={d} className="row gap-12" style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span className="kpi-icon" style={{ background: "var(--brand-50)", color: "var(--brand-700)" }}>
                  <Icon name="bell" size={18} />
                </span>
                <div className="flex-1">
                  <b className="small">{d} days before expiry</b>
                  <div className="tiny muted">
                    {["Ops & Training Manager notified", "Provider booked, staff notified", "Email + SMS, manager escalation", "Final reminder, dashboard Amber"][i]}
                  </div>
                </div>
                <input className="input mono" style={{ width: 80, textAlign: "center" }} defaultValue={d} />
                <Badge tone={i < 2 ? "blue" : "amber"}>Active</Badge>
              </div>
            ))}
            <div className="row gap-8 small muted" style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8 }}>
              <Icon name="zap" size={15} /> On the expiry date, status turns Red and an escalation is sent to the Operations Manager.
            </div>
          </div>
        </Card>
      )}

      {tab === "notifications" && (
        <Card>
          <CardHead title="Notification channels" icon="bell" />
          <div className="card-body col gap-4">
            {[
              { k: "email" as const, t: "Email notifications", s: "Upcoming, booked, reminders, approvals, expiries" },
              { k: "sms" as const, t: "SMS notifications", s: "Mandatory training, bookings, final reminders, overdue" },
              { k: "inApp" as const, t: "In-system alerts", s: "Dashboard alerts, action items, pending approvals" },
              { k: "autoEscalate" as const, t: "Auto-escalation", s: "Escalate to Operations Manager when overdue" },
              { k: "weeklyDigest" as const, t: "Weekly compliance digest", s: "Monday summary to managers & directors" },
            ].map((r) => (
              <div key={r.k} className="row between" style={{ padding: "14px 4px", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <b className="small">{r.t}</b>
                  <div className="tiny muted">{r.s}</div>
                </div>
                <Toggle on={toggles[r.k]} onClick={() => set(r.k)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "rules" && (
        <Card>
          <CardHead title="Organisation-specific compliance rules" icon="shield" />
          <div className="card-body col gap-4">
            {[
              { k: "inductionAuto" as const, t: "Auto-assign induction to new starters", s: "Care Certificate + mandatory pathway on creation" },
            ].map((r) => (
              <div key={r.k} className="row between" style={{ padding: "14px 4px", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <b className="small">{r.t}</b>
                  <div className="tiny muted">{r.s}</div>
                </div>
                <Toggle on={toggles[r.k]} onClick={() => set(r.k)} />
              </div>
            ))}
            <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", marginTop: 14 }}>
              <Field label="Mandatory compliance target" hint="Used for RAG on dashboards">
                <input className="input" defaultValue="95%" />
              </Field>
              <Field label="New starter induction window" hint="Days to complete Care Certificate">
                <input className="input" type="number" defaultValue={84} />
              </Field>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { Icon } from "../components/Icon";
import { Button, Field } from "../components/ui";
import type { AppUser } from "../data/types";

const DEMO_USERS: (AppUser & { inspection?: boolean })[] = [
  { id: "u1", name: "Amara Okafor", email: "amara.okafor@elmshealth.co.uk", role: "registered_manager", roleLabel: "Registered Manager", avatarColor: "#0f766e" },
  { id: "u2", name: "Priya Sharma", email: "priya.sharma@elmshealth.co.uk", role: "training_manager", roleLabel: "Training Manager", avatarColor: "#db2777" },
  { id: "u3", name: "Fatima Ali", email: "fatima.ali@elmshealth.co.uk", role: "care_worker", roleLabel: "Care Worker", avatarColor: "#2563eb" },
  { id: "u4", name: "CQC Inspector", email: "inspector@cqc.org.uk", role: "cqc_reviewer", roleLabel: "CQC Reviewer", avatarColor: "#7c3aed", inspection: true },
];

const FEATURES = [
  { icon: "shield" as const, title: "CQC-ready evidence", body: "Inspection packs across the five Key Questions in minutes." },
  { icon: "activity" as const, title: "Live RAG compliance", body: "Green / Amber / Red status the moment training expires." },
  { icon: "bell" as const, title: "Proactive reminders", body: "90 / 60 / 30 / 7-day alerts by email, SMS and dashboard." },
];

export function Login() {
  const { login, pushToast } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("amara.okafor@elmshealth.co.uk");
  const [password, setPassword] = useState("••••••••");

  function signIn(u: (typeof DEMO_USERS)[number]) {
    login(u, u.inspection);
    pushToast({
      kind: "success",
      title: `Welcome, ${u.name.split(" ")[0]}`,
      body: u.inspection ? "Read-only inspection access granted." : `Signed in as ${u.roleLabel}.`,
    });
    navigate("/");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const match = DEMO_USERS.find((u) => u.email === email.trim().toLowerCase()) ?? DEMO_USERS[0];
    signIn(match);
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="row gap-12" style={{ marginBottom: 8 }}>
            <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 17 }}>
              EH
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>ELMS Health Solutions</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
                Training Management System
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 420 }}>
          <h1 style={{ color: "#fff", fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Stay inspection-ready, every day.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14.5, margin: "12px 0 30px" }}>
            The single source of truth for staff training, role-based compliance and CQC
            evidence — replacing fragile spreadsheets with an auditable platform.
          </p>
          {FEATURES.map((f) => (
            <div className="feature-row" key={f.title}>
              <span className="fi">
                <Icon name={f.icon} size={18} />
              </span>
              <div>
                <b>{f.title}</b>
                <span>{f.body}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 1, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          CQC Provider ID 1-101234567 · GDPR-compliant · Encrypted evidence storage
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h2 style={{ fontSize: 22 }}>Sign in</h2>
          <p className="muted" style={{ margin: "6px 0 22px", fontSize: 13.5 }}>
            Use your ELMS work account to continue.
          </p>

          <form onSubmit={submit} className="col gap-16">
            <Field label="Work email">
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </Field>
            <Field label="Password">
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
            </Field>
            <div className="row between">
              <label className="row gap-6 small muted" style={{ cursor: "pointer" }}>
                <input type="checkbox" defaultChecked /> Remember this device
              </label>
              <a href="#" onClick={(e) => e.preventDefault()} className="small">
                Forgot password?
              </a>
            </div>
            <Button variant="primary" size="lg" block type="submit" iconRight="chevronRight">
              Sign in securely
            </Button>
          </form>

          <div className="row gap-8" style={{ margin: "22px 0 12px" }}>
            <hr className="divider flex-1" />
            <span className="tiny muted">Quick demo sign-in</span>
            <hr className="divider flex-1" />
          </div>

          <div className="col gap-8">
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                className="btn"
                style={{ justifyContent: "flex-start", height: 46 }}
                onClick={() => signIn(u)}
              >
                <span className="avatar sm" style={{ background: u.avatarColor }}>
                  {u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <span style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <span style={{ display: "block", fontWeight: 600 }}>{u.name}</span>
                  <span className="tiny muted">{u.roleLabel}</span>
                </span>
                {u.inspection && (
                  <span className="badge violet" style={{ marginLeft: "auto" }}>
                    <Icon name="eye" size={11} /> Read-only
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

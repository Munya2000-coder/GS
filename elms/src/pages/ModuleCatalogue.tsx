import { useState } from "react";
import { useStore } from "../store/store";
import { Badge, Button, Card, CqcChip, Field, Modal } from "../components/ui";
import { Icon } from "../components/Icon";
import { CQC_DOMAINS, ROLE_LABELS, cqcColor } from "../lib/domain";
import { AiChip, AiThinking, useAiTask } from "../components/ai";
import { aiGenerateQuiz } from "../lib/ai";
import type {
  CqcDomain,
  DeliveryMode,
  RefreshFrequency,
  RoleKey,
  TrainingCategory,
  TrainingModule,
} from "../data/types";

const CATEGORIES: TrainingCategory[] = [
  "Mandatory Induction",
  "Mandatory Ongoing",
  "Role-Specific Training",
  "Specialist Care Training",
  "Manager / Leadership",
  "Compliance & Governance",
];

const CAT_TONE: Record<string, "green" | "blue" | "amber" | "violet" | "grey"> = {
  "Mandatory Induction": "blue",
  "Mandatory Ongoing": "green",
  "Role-Specific Training": "amber",
  "Specialist Care Training": "violet",
  "Manager / Leadership": "grey",
  "Compliance & Governance": "grey",
};

export function ModuleCatalogue() {
  const { modules, computed, addModule, toggleModuleRetired, inspectionMode } = useStore();
  const [cat, setCat] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [quizFor, setQuizFor] = useState<TrainingModule | null>(null);

  const filtered = modules.filter((m) => cat === "all" || m.category === cat);

  function usage(moduleId: string) {
    return computed.filter((r) => r.moduleId === moduleId).length;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Module Catalogue</h1>
          <p>
            Fully configurable training matrix — create, edit and retire modules, map them to CQC
            domains and assign them to roles without any software change.
          </p>
        </div>
        {!inspectionMode && (
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
            New module
          </Button>
        )}
      </div>

      <div className="row gap-8 wrap" style={{ marginBottom: 16 }}>
        <button className={`tab ${cat === "all" ? "active" : ""}`} style={{ background: cat === "all" ? "#fff" : "var(--surface-3)", border: "1px solid var(--border)" }} onClick={() => setCat("all")}>
          All ({modules.length})
        </button>
        {CATEGORIES.map((c) => {
          const n = modules.filter((m) => m.category === c).length;
          return (
            <button
              key={c}
              className="tab"
              style={{ background: cat === c ? "#fff" : "var(--surface-3)", border: "1px solid var(--border)", boxShadow: cat === c ? "var(--shadow-xs)" : "none" }}
              onClick={() => setCat(c)}
            >
              {c} ({n})
            </button>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
        {filtered.map((m) => (
          <Card key={m.id} className="card-pad" style={{ opacity: m.retired ? 0.6 : 1 }}>
            <div className="row between items-start" style={{ marginBottom: 10 }}>
              <div className="row gap-8">
                <span className="badge outline mono">{m.code}</span>
                {m.mandatory ? <Badge tone="red">Mandatory</Badge> : <Badge tone="grey">Optional</Badge>}
                {m.retired && <Badge tone="grey">Retired</Badge>}
              </div>
              {!inspectionMode && (
                <button className="icon-btn" style={{ width: 30, height: 30, border: "none", background: "transparent" }} onClick={() => toggleModuleRetired(m.id)} title={m.retired ? "Reactivate" : "Retire module"}>
                  <Icon name={m.retired ? "refresh" : "trash"} size={15} />
                </button>
              )}
            </div>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>{m.title}</h3>
            <p className="small muted" style={{ margin: "0 0 12px", minHeight: 38 }}>{m.description}</p>

            <div className="row gap-6 wrap" style={{ marginBottom: 12 }}>
              <CqcChip domain={m.cqcDomain} color={cqcColor(m.cqcDomain)} />
              <Badge tone={CAT_TONE[m.category]}>{m.category}</Badge>
            </div>

            <div className="divider" style={{ marginBottom: 10 }} />
            <div className="row between small muted">
              <span className="row gap-5"><Icon name="refresh" size={13} /> {m.refresh}</span>
              <span className="row gap-5"><Icon name="book" size={13} /> {m.delivery}</span>
            </div>
            <div className="row between small muted" style={{ marginTop: 7 }}>
              <span className="row gap-5">
                <Icon name="staff" size={13} />
                {m.appliesTo.length === 0 ? "All roles" : `${m.appliesTo.length} role${m.appliesTo.length > 1 ? "s" : ""}`}
              </span>
              <span className="row gap-5">
                <Icon name={m.evidenceRequired ? "shield" : "x"} size={13} />
                {m.evidenceRequired ? "Evidence required" : "No evidence"}
              </span>
            </div>
            <div className="row between small" style={{ marginTop: 10 }}>
              <span className="muted">{usage(m.id)} staff assigned</span>
              {m.provider && <span className="muted truncate" style={{ maxWidth: 120 }}>{m.provider}</span>}
            </div>
            <button className="btn ai-outline sm block" style={{ marginTop: 12 }} onClick={() => setQuizFor(m)}>
              <Icon name="sparkle" size={13} /> Generate knowledge check
            </button>
          </Card>
        ))}
      </div>

      {adding && <AddModuleModal onClose={() => setAdding(false)} onAdd={addModule} />}
      {quizFor && <QuizModal module={quizFor} onClose={() => setQuizFor(null)} />}
    </>
  );
}

function QuizModal({ module, onClose }: { module: TrainingModule; onClose: () => void }) {
  const { pushToast } = useStore();
  const { loading, data, run } = useAiTask(() => aiGenerateQuiz(module));
  const [picks, setPicks] = useState<Record<number, number>>({});

  return (
    <Modal
      title="AI knowledge check"
      icon="brain"
      drawer
      onClose={onClose}
      footer={
        data ? (
          <>
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" icon="send" onClick={() => { pushToast({ kind: "success", title: "Knowledge check assigned", body: `Sent to staff who completed ${module.title}.` }); onClose(); }}>
              Assign to staff
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="row gap-10" style={{ marginBottom: 16 }}>
        <span className="badge outline mono">{module.code}</span>
        <b className="flex-1">{module.title}</b>
        <AiChip />
      </div>

      {!data && !loading && (
        <div className="ai-panel" style={{ borderRadius: 10 }}>
          <div className="ai-body col gap-12" style={{ alignItems: "flex-start" }}>
            <div className="small" style={{ color: "#5b4b86" }}>
              Generate a short multiple-choice knowledge check for this module — turning the tracker into
              a lightweight learning tool. Answers are auto-marked.
            </div>
            <button className="btn ai" onClick={run}>
              <Icon name="sparkle" size={15} /> Generate questions
            </button>
          </div>
        </div>
      )}
      {loading && <AiThinking label="Writing questions for this module…" />}
      {data && (
        <div className="col gap-16">
          {data.map((q, qi) => (
            <div key={qi} className="card card-pad">
              <b className="small" style={{ display: "block", marginBottom: 10 }}>{qi + 1}. {q.q}</b>
              <div className="col gap-7">
                {q.options.map((opt, oi) => {
                  const picked = picks[qi] === oi;
                  const correct = q.answer === oi;
                  const reveal = picks[qi] !== undefined;
                  return (
                    <button
                      key={oi}
                      className="row gap-8"
                      style={{
                        textAlign: "left",
                        padding: "9px 11px",
                        borderRadius: 8,
                        border: "1px solid " + (reveal && correct ? "var(--green)" : picked ? "var(--red)" : "var(--border)"),
                        background: reveal && correct ? "var(--green-bg)" : picked && !correct ? "var(--red-bg)" : "#fff",
                        font: "inherit",
                        cursor: "pointer",
                      }}
                      onClick={() => setPicks((p) => ({ ...p, [qi]: oi }))}
                    >
                      <span style={{ width: 18, flexShrink: 0, color: reveal && correct ? "var(--green)" : picked ? "var(--red)" : "var(--muted)" }}>
                        {reveal && correct ? <Icon name="check" size={15} /> : picked ? <Icon name="x" size={15} /> : String.fromCharCode(65 + oi)}
                      </span>
                      <span className="small">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn ai-outline sm" style={{ alignSelf: "flex-start" }} onClick={run}>
            <Icon name="refresh" size={13} /> Regenerate
          </button>
        </div>
      )}
    </Modal>
  );
}

function AddModuleModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (m: Omit<TrainingModule, "id">) => void;
}) {
  const [form, setForm] = useState({
    code: "",
    title: "",
    category: "Mandatory Ongoing" as TrainingCategory,
    cqcDomain: "Safe" as CqcDomain,
    refresh: "Annual" as RefreshFrequency,
    delivery: "eLearning" as DeliveryMode,
    mandatory: true,
    evidenceRequired: true,
    provider: "ELMS Internal",
    description: "",
  });
  const [roles, setRoles] = useState<RoleKey[]>([]);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const roleKeys = Object.keys(ROLE_LABELS).filter((r) => r !== "cqc_reviewer" && r !== "director") as RoleKey[];

  return (
    <Modal
      title="Create training module"
      icon="book"
      drawer
      wide
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!form.title || !form.code}
            onClick={() => {
              onAdd({ ...form, appliesTo: roles });
              onClose();
            }}
          >
            Create module
          </Button>
        </>
      }
    >
      <div className="col gap-16">
        <div className="row gap-12">
          <div style={{ width: 130 }}>
            <Field label="Code"><input className="input" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. SG-01" /></Field>
          </div>
          <div className="flex-1">
            <Field label="Module title"><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Safeguarding Adults" /></Field>
          </div>
        </div>
        <Field label="Description">
          <textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What this module covers…" />
        </Field>
        <div className="row gap-12">
          <Field label="Category">
            <select className="select" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="CQC domain">
            <select className="select" value={form.cqcDomain} onChange={(e) => set("cqcDomain", e.target.value)}>
              {CQC_DOMAINS.map((d) => <option key={d.key} value={d.key}>{d.key}</option>)}
            </select>
          </Field>
        </div>
        <div className="row gap-12">
          <Field label="Refresh frequency">
            <select className="select" value={form.refresh} onChange={(e) => set("refresh", e.target.value)}>
              {["Once only", "Every 6 months", "Annual", "Every 2 years", "Every 3 years"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Delivery">
            <select className="select" value={form.delivery} onChange={(e) => set("delivery", e.target.value)}>
              {["eLearning", "Classroom", "External provider", "Blended"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Training provider">
          <input className="input" value={form.provider} onChange={(e) => set("provider", e.target.value)} />
        </Field>
        <Field label="Applies to roles" hint="Leave none selected to apply to all roles">
          <div className="row gap-6 wrap">
            {roleKeys.map((r) => {
              const on = roles.includes(r);
              return (
                <button
                  key={r}
                  className="badge"
                  style={{
                    cursor: "pointer",
                    background: on ? "var(--brand-700)" : "var(--surface-3)",
                    color: on ? "#fff" : "var(--ink-2)",
                    height: 28,
                  }}
                  onClick={() => setRoles((prev) => (on ? prev.filter((x) => x !== r) : [...prev, r]))}
                >
                  {ROLE_LABELS[r]}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="row gap-16">
          <label className="row gap-8 small" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={form.mandatory} onChange={(e) => set("mandatory", e.target.checked)} /> Mandatory
          </label>
          <label className="row gap-8 small" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={form.evidenceRequired} onChange={(e) => set("evidenceRequired", e.target.checked)} /> Evidence required
          </label>
        </div>
      </div>
    </Modal>
  );
}

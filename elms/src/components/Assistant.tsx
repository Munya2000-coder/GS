import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { Icon } from "./Icon";
import { AiThinking } from "./ai";
import { SUGGESTED_QUERIES, aiAnswerQuery, aiInspectionSummary, type AiAnswer } from "../lib/ai";
import { compliancePct } from "../lib/analytics";

interface Msg {
  role: "user" | "ai";
  text: string;
  answer?: AiAnswer;
}

export function Assistant() {
  const { computed, staff, inspectionMode } = useStore();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  async function ask(q: string) {
    if (!q.trim() || thinking) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setThinking(true);
    const answer = await aiAnswerQuery(q, computed, staff);
    setThinking(false);
    setMsgs((m) => [...m, { role: "ai", text: answer.text, answer }]);
  }

  async function summarise() {
    setThinking(true);
    const text = await aiInspectionSummary(computed, staff.filter((s) => s.employmentStatus !== "Left").length);
    setThinking(false);
    setMsgs((m) => [...m, { role: "ai", text }]);
  }

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(true)}>
        <Icon name="sparkle" size={19} />
        {inspectionMode ? "Ask the evidence" : "Ask AI"}
      </button>

      {open && (
        <div className="overlay right" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="drawer" style={{ maxWidth: 460 }}>
            <div className="drawer-head">
              <span className="ai-mark"><Icon name="sparkle" size={17} /></span>
              <div className="flex-1">
                <h3 style={{ fontSize: 15 }}>{inspectionMode ? "Inspection assistant" : "Compliance assistant"}</h3>
                <div className="tiny muted">
                  {inspectionMode ? "Read-only · answers grounded in the evidence pack" : "Grounded in your live training data"}
                </div>
              </div>
              <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="drawer-body" ref={bodyRef} style={{ background: "var(--surface-2)" }}>
              {msgs.length === 0 && (
                <div className="col gap-14">
                  <div className="ai-panel" style={{ borderRadius: 12 }}>
                    <div className="ai-body">
                      <div className="row gap-8" style={{ marginBottom: 6 }}>
                        <Icon name="sparkle" size={16} style={{ color: "var(--ai-1)" }} />
                        <b className="small" style={{ color: "#3a2a6b" }}>
                          {inspectionMode ? "Hello, Inspector." : "Hi! Ask me about training compliance."}
                        </b>
                      </div>
                      <div className="tiny" style={{ color: "#6b5e9b" }}>
                        I answer from the live data and cite my sources. Every answer reflects the current
                        matrix — I never invent records. Overall compliance is currently{" "}
                        <b>{compliancePct(computed)}%</b>.
                      </div>
                    </div>
                  </div>
                  <div className="section-title">Try asking</div>
                  <div className="col gap-8">
                    {(inspectionMode
                      ? ["Summarise inspection readiness", ...SUGGESTED_QUERIES.slice(0, 3)]
                      : SUGGESTED_QUERIES
                    ).map((q) => (
                      <button
                        key={q}
                        className="suggest-q"
                        onClick={() => (q.startsWith("Summarise") ? summarise() : ask(q))}
                      >
                        <Icon name="message" size={15} /> {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  <span className="who">
                    <Icon name={m.role === "ai" ? "sparkle" : "user"} size={15} />
                  </span>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className={`chat-bubble ${m.role === "user" ? "q" : ""}`}>{m.text}</div>
                    {m.answer && m.answer.rows.length > 0 && (
                      <div className="card" style={{ marginTop: 10, overflow: "hidden" }}>
                        {m.answer.rows.map((r, j) => (
                          <div
                            key={j}
                            className="row gap-10 between"
                            style={{ padding: "9px 12px", borderBottom: j < m.answer!.rows.length - 1 ? "1px solid var(--border)" : "none" }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <b className="small truncate">{r.primary}</b>
                              <div className="tiny muted truncate">{r.secondary}</div>
                            </div>
                            {r.tag && <span className={`badge ${r.tagTone}`} style={{ flexShrink: 0 }}>{r.tag}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {m.answer && (
                      <div className="row gap-4 wrap" style={{ marginTop: 8 }}>
                        {m.answer.citations.map((c) => (
                          <span className="cite" key={c}>
                            <Icon name="link" size={11} /> {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="chat-msg ai">
                  <span className="who"><Icon name="sparkle" size={15} /></span>
                  <AiThinking label="Searching the training matrix…" />
                </div>
              )}
            </div>

            <div className="drawer-foot" style={{ background: "#fff" }}>
              <div className="topbar-search" style={{ width: "100%", margin: 0 }}>
                <Icon name="message" size={16} />
                <input
                  autoFocus
                  placeholder={inspectionMode ? "Ask about the evidence…" : "Ask about compliance…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ask(input)}
                />
              </div>
              <button className="btn ai" onClick={() => ask(input)} disabled={!input.trim() || thinking}>
                <Icon name="send" size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from "react";
import type { Blueprint, BlueprintField, Citation } from "../types";
import { fmt, label, lightClass, pillClass } from "../lib";

const GROUPS: [keyof Blueprint, string][] = [
  ["fund_metadata", "Fund Metadata"],
  ["waterfall_rules", "Waterfall Mechanics"],
  ["fee_economics", "Fee Economics"],
];

function SourcePane({ cit }: { cit: Citation | null }) {
  if (!cit) return <div className="src muted">Select a field to trace it to source.</div>;
  return (
    <div className="src">
      <div className="ref">
        {cit.clause_reference || "n/a"} · Page {cit.page_number ?? "?"}
      </div>
      <mark>{cit.exact_extracted_text}</mark>
    </div>
  );
}

export default function BlueprintView({ bp }: { bp: Blueprint }) {
  const [sel, setSel] = useState<Citation | null>(null);
  const [selKey, setSelKey] = useState<string>("");

  const Field = ({ k, f }: { k: string; f: BlueprintField }) => (
    <div
      className={"field" + (selKey === k ? " sel" : "")}
      onClick={() => { setSel(f.citation); setSelKey(k); }}
    >
      <div>
        <div className="lbl">{label(k)}</div>
        <div className="val">{fmt(f.value)}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <span className={"dot " + lightClass(f.status)} />
        <span className={"pill " + pillClass(f.status)}>{Math.round(f.confidence * 100)}%</span>
      </div>
    </div>
  );

  return (
    <>
      <p className="hint">
        Click any extracted value → its <b>verbatim source clause</b> appears on the right
        (click-to-trace). Amber = needs human review.
      </p>
      <div className="split">
        <div>
          {bp.side_letter_overrides.length > 0 && (
            <div className="card">
              <h3>⚠ Side-Letter Overrides</h3>
              {bp.side_letter_overrides.map((o, i) => (
                <Field
                  key={"ov" + i}
                  k={"ov" + i}
                  f={{ ...o, value: `${o.override_type} ${o.override_value ?? ""}` }}
                />
              ))}
            </div>
          )}
          {GROUPS.map(([gk, title]) => {
            const group = bp[gk] as Record<string, BlueprintField>;
            return (
              <div className="card" key={String(gk)}>
                <h3>{title}</h3>
                {Object.entries(group).map(([fk, f]) => (
                  <Field key={String(gk) + fk} k={String(gk) + fk} f={f} />
                ))}
              </div>
            );
          })}
        </div>
        <div>
          <div className="card" style={{ position: "sticky", top: 10 }}>
            <h3>Source Evidence</h3>
            <SourcePane cit={sel} />
          </div>
        </div>
      </div>
    </>
  );
}

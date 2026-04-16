import { useState, type FormEvent } from "react";
import { TransactionImport } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import type { ImportResult } from "../api/types";

const SAMPLE = `[
  {
    "source_reference": "TX-001",
    "entity_id": 1,
    "investor_id": 1,
    "capital_account_id": 1,
    "transaction_type": "contribution",
    "transaction_date": "2024-03-31",
    "amount": "1000000.00",
    "currency": "USD",
    "description": "Initial contribution"
  }
]`;

export default function TransactionImportPage() {
  const [source, setSource] = useState("manual-upload");
  const [owner, setOwner] = useState("ops");
  const [mapping, setMapping] = useState("v1.0");
  const [fileName, setFileName] = useState("");
  const [payload, setPayload] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      let records: Record<string, unknown>[];
      try {
        records = JSON.parse(payload);
        if (!Array.isArray(records)) throw new Error("payload must be a JSON array");
      } catch (ex) {
        throw new Error(`Payload parse error: ${ex instanceof Error ? ex.message : String(ex)}`);
      }
      const res = await TransactionImport.run({
        source_system: source,
        source_owner: owner,
        mapping_version: mapping,
        file_name: fileName || undefined,
        records,
      });
      setResult(res);
    } catch (ex) {
      setError(extractError(ex));
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (file.name.endsWith(".csv")) {
        setPayload(csvToJson(text));
      } else {
        setPayload(text);
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <h1>Import Transactions</h1>

      <p className="muted" style={{ marginTop: 0 }}>
        Paste or upload a JSON array matching the transaction import template
        (see <code>/integrations/templates/transactions</code>). CSV files
        are parsed client-side. Invalid rows land in the exception queue; the
        accepted rows are created in the <span className="mono">validated</span> state
        and require approval + posting to hit the ledger.
      </p>

      <ErrorBanner error={error} />

      <form className="card" onSubmit={submit}>
        <div className="form-row inline">
          <div>
            <label>Source system</label>
            <input required value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <label>Source owner</label>
            <input required value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
        </div>
        <div className="form-row inline">
          <div>
            <label>Mapping version</label>
            <input required value={mapping} onChange={(e) => setMapping(e.target.value)} />
          </div>
          <div>
            <label>File (optional)</label>
            <input type="file" accept=".json,.csv" onChange={onFile} />
          </div>
        </div>
        <div className="form-row">
          <label>Payload (JSON array of records)</label>
          <textarea
            rows={14}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
          />
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Importing…" : "Import"}</button>
      </form>

      {result && (
        <>
          <h2>Batch #{result.batch_id}</h2>
          <div className="grid">
            <div className="card kpi"><div className="label">Accepted</div><div className="value">{result.accepted}</div></div>
            <div className="card kpi"><div className="label">Rejected</div><div className="value">{result.rejected}</div></div>
            <div className="card kpi"><div className="label">Transaction IDs</div><div className="value" style={{ fontSize: 13 }}>{result.transaction_ids.slice(0, 10).join(", ")}{result.transaction_ids.length > 10 ? "…" : ""}</div></div>
          </div>
          {result.rejected > 0 && (
            <p className="muted" style={{ marginTop: 12 }}>
              Check the Operations page exception summary for rejection details.
            </p>
          )}
        </>
      )}
    </>
  );
}

function csvToJson(csv: string): string {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return "[]";
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
  return JSON.stringify(rows, null, 2);
}

import { useEffect, useState } from "react";
import { Lpa, getUser, setUser } from "./api";
import type { Blueprint, OperatingPack } from "./types";
import BlueprintView from "./components/BlueprintView";
import PackView from "./components/PackView";

const SAMPLE_LPA = `Section 1.1 Name and Currency
The name of the Fund is GrowthSense Real Estate Fund I, L.P. The base currency of the Fund is USD. The term of the Fund is ten (10) years.

Section 3.1 Investment Mandate
The Fund shall invest primarily in United States real estate only. Non-US investments are not permitted.

Section 4.2 Preferred Return
The Limited Partners shall receive an 8% preferred return, compounded annually, on unreturned contributed capital.

Section 4.3 Carried Interest
The General Partner is entitled to carried interest of 20%, subject to a 100% GP catch-up and an 80/20 split thereafter.

Section 5.1 Management Fee
The Management Fee shall be 2.0% per annum of committed capital, payable quarterly in advance, unless otherwise determined by the General Partner in its sole discretion.

Section 8.1 Treasury
The banking relationship is with AXZ Bankers. Wire instructions are provided.

Section 12.1 Reporting
The Partnership shall deliver audited financial statements annually within 120 days after fiscal year end to the Limited Partners.

Section 14.1 Tax Reporting
Each Limited Partner shall receive a Schedule K-1 annually, with UBTI reporting.`;

const DOC_TYPES = ["lpa", "ppm", "side_letter", "subscription", "fee_letter", "tax_memo", "bank_memo", "reporting_template", "other"];

type Entity = { id: number; code: string; legal_name: string };

export default function App() {
  const [user, setU] = useState(getUser());
  const [view, setView] = useState<"upload" | "pack">("upload");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState<number | null>(null);
  const [docType, setDocType] = useState("lpa");
  const [docName, setDocName] = useState("GSRE LPA.pdf");
  const [text, setText] = useState(SAMPLE_LPA);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [pack, setPack] = useState<OperatingPack | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadEntities() {
    try {
      const es = await Lpa.listEntities();
      setEntities(es);
      if (es.length && entityId === null) setEntityId(es[0].id);
    } catch (e) { setErr(errMsg(e)); }
  }
  useEffect(() => { loadEntities(); /* eslint-disable-next-line */ }, []);

  async function createFund() {
    setErr(null);
    try {
      await Lpa.createEntity({
        code: "GSRE_" + Math.floor(Math.random() * 9000 + 1000),
        legal_name: "GrowthSense Real Estate Fund I, L.P.", short_name: "GSRE",
        entity_type: "fund", jurisdiction: "US", base_currency: "USD", reporting_currency: "USD",
      });
      await loadEntities();
    } catch (e) { setErr(errMsg(e)); }
  }

  async function uploadAndExtract() {
    if (!entityId) { setErr("Select or create a fund first."); return; }
    setBusy(true); setErr(null); setBlueprint(null);
    try {
      const doc = await Lpa.createDocument({ name: docName, document_type: docType, raw_text: text, entity_id: entityId });
      await Lpa.extract(doc.id);
      if (docType === "lpa") setBlueprint(await Lpa.blueprint(doc.id));
      else setErr(`Extracted ${docType}. Blueprint view is LPA-only; see the Operating Pack tab.`);
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  }

  async function loadPack() {
    if (!entityId) { setErr("Select a fund first."); return; }
    setBusy(true); setErr(null);
    try { setPack(await Lpa.operatingPack(entityId)); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <header>
        <h1>GrowthSense · Fund Document Intelligence Workbench</h1>
        <span className="muted" style={{ fontSize: 13 }}>POC #1</span>
        <span className="sp" />
        <span className="muted" style={{ fontSize: 12 }}>X-User-Id</span>
        <input value={user} onChange={(e) => setU(e.target.value)}
          onBlur={() => { setUser(user); loadEntities(); }} />
      </header>

      <nav>
        <button className={view === "upload" ? "active" : ""} onClick={() => setView("upload")}>1 · Upload &amp; Extract</button>
        <button className={view === "pack" ? "active" : ""} onClick={() => { setView("pack"); loadPack(); }}>2 · Operating Pack</button>
      </nav>

      <div className="wrap">
        {err && <div className="err">{err}</div>}

        <div className="card">
          <div className="row">
            <label className="muted">Fund:</label>
            <select className="text" value={entityId ?? ""} onChange={(e) => setEntityId(Number(e.target.value))}>
              {entities.length === 0 && <option value="">— none —</option>}
              {entities.map((e) => <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>)}
            </select>
            <button className="primary" onClick={createFund}>+ New demo fund</button>
          </div>
        </div>

        {view === "upload" && (
          <>
            <div className="card">
              <h3>Upload a governing document</h3>
              <div className="row">
                <input className="text" value={docName} onChange={(e) => setDocName(e.target.value)} style={{ width: 220 }} />
                <select className="text" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="primary" disabled={busy} onClick={uploadAndExtract}>
                  {busy ? "Extracting…" : "Upload & Extract"}
                </button>
              </div>
              <p className="hint">Paste document text (PDF text). Use <code>[[page]]</code> to mark page breaks. A sample LPA is pre-filled.</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            {blueprint && (
              <div className="card">
                <h3>Fund Logic Blueprint — {blueprint.document_name}</h3>
                <BlueprintView bp={blueprint} />
              </div>
            )}
          </>
        )}

        {view === "pack" && (
          pack ? <PackView pack={pack} /> :
            <div className="card muted">No pack loaded. Pick a fund and click <b>2 · Operating Pack</b> (extract at least one document first).</div>
        )}
      </div>
    </>
  );
}

function errMsg(e: unknown): string {
  const ax = e as { response?: { data?: { detail?: string } }; message?: string };
  return ax?.response?.data?.detail || ax?.message || "Request failed";
}

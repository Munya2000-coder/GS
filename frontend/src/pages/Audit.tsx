import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Audit } from "../api/endpoints";
import ErrorBanner from "../components/ErrorBanner";
import { useAsync } from "../hooks/useAsync";

export default function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [objectType, setObjectType] = useState(params.get("object_type") ?? "");
  const [objectId, setObjectId] = useState(params.get("object_id") ?? "");
  const [action, setAction] = useState("");

  const events = useAsync(
    () => Audit.events({
      object_type: objectType || undefined,
      object_id: objectId || undefined,
      action: action || undefined,
      limit: 200,
    }),
    [objectType, objectId, action]
  );

  const upstream = useAsync(
    () => (objectType && objectId ? Audit.upstream(objectType, objectId) : Promise.resolve([])),
    [objectType, objectId]
  );

  function apply(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (objectType) next.set("object_type", objectType);
    if (objectId) next.set("object_id", objectId);
    setParams(next);
  }

  return (
    <>
      <h1>Audit & Lineage</h1>

      <form className="card" style={{ marginBottom: 16 }} onSubmit={apply}>
        <div className="form-row inline">
          <div>
            <label>Object type</label>
            <input placeholder="e.g. transaction" value={objectType} onChange={(e) => setObjectType(e.target.value)} />
          </div>
          <div>
            <label>Object id</label>
            <input placeholder="e.g. 42" value={objectId} onChange={(e) => setObjectId(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label>Action filter</label>
          <input placeholder="e.g. transaction.post" value={action} onChange={(e) => setAction(e.target.value)} />
        </div>
        <button className="btn" type="submit">Search</button>
      </form>

      <ErrorBanner error={events.error || upstream.error} />

      {objectType && objectId && upstream.data && upstream.data.length > 0 && (
        <>
          <h2>Upstream lineage</h2>
          <div className="card pad-0">
            <table>
              <thead>
                <tr><th>Relation</th><th>From</th><th>To</th><th>Depth</th></tr>
              </thead>
              <tbody>
                {upstream.data.map((e: { upstream_type: string; upstream_id: string; downstream_type: string; downstream_id: string; relation: string; depth: number }, idx: number) => (
                  <tr key={idx}>
                    <td>{e.relation}</td>
                    <td className="mono">{e.upstream_type}:{e.upstream_id}</td>
                    <td className="mono">{e.downstream_type}:{e.downstream_id}</td>
                    <td>{e.depth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Events</h2>
      {events.loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>When</th><th>Actor</th><th>Action</th>
                <th>Object</th><th>Privileged</th>
              </tr>
            </thead>
            <tbody>
              {(events.data ?? []).map((e) => (
                <tr key={e.id}>
                  <td>{e.occurred_at}</td>
                  <td>{e.actor_user_id ?? "—"}</td>
                  <td className="mono">{e.action}</td>
                  <td className="mono">{e.object_type}:{e.object_id}</td>
                  <td>{e.privileged ? <span className="badge err">yes</span> : <span className="badge muted">no</span>}</td>
                </tr>
              ))}
              {events.data && events.data.length === 0 && (
                <tr><td colSpan={5}><div className="empty">No events match.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

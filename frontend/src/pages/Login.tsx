import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, extractError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ErrorBanner from "../components/ErrorBanner";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("dev-admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Probe the API with the chosen identity; /entities requires auth.
      await api.get("/entities", { headers: { "X-User-Id": username } });
      signIn(username.trim());
      navigate("/");
    } catch (ex) {
      setError(extractError(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Sign in</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Development uses header-based auth. Try <span className="mono">dev-admin</span>{" "}
          (auto-provisioned on first start) or seeded users <span className="mono">admin</span>,{" "}
          <span className="mono">alice</span>, <span className="mono">bob</span>,{" "}
          <span className="mono">charlie</span>.
        </p>
        <ErrorBanner error={error} />
        <div className="form-row">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

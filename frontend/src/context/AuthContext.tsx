import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { setUnauthorizedHandler } from "../api/client";

interface AuthState {
  username: string | null;
  signIn: (username: string) => void;
  signOut: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("gs_user"));
  const navigate = useNavigate();

  const signIn = useCallback((name: string) => {
    localStorage.setItem("gs_user", name);
    setUsername(name);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("gs_user");
    setUsername(null);
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem("gs_user");
      setUsername(null);
      navigate("/login");
    });
  }, [navigate]);

  const value = useMemo<AuthState>(() => ({ username, signIn, signOut }), [username, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import axios from "axios";
import type { Blueprint, OperatingPack, SourceDocument } from "./types";

// Dev auth is header-based (X-User-Id). Stored in localStorage, attached to
// every request — same scheme as the main GS SPA.
const USER_KEY = "gs_workbench_user";

export function getUser(): string {
  return localStorage.getItem(USER_KEY) || "admin";
}
export function setUser(u: string): void {
  localStorage.setItem(USER_KEY, u);
}

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((cfg) => {
  cfg.headers["X-User-Id"] = getUser();
  return cfg;
});

export interface CreateDocPayload {
  name: string;
  document_type: string;
  raw_text: string;
  entity_id?: number | null;
  investor_id?: number | null;
}

export const Lpa = {
  listDocuments: (entityId?: number) =>
    api.get<SourceDocument[]>("/lpa/documents", { params: entityId ? { entity_id: entityId } : {} }).then((r) => r.data),

  createDocument: (payload: CreateDocPayload) =>
    api.post<SourceDocument>("/lpa/documents", payload).then((r) => r.data),

  extract: (docId: number) =>
    api.post(`/lpa/documents/${docId}/extract`).then((r) => r.data),

  blueprint: (docId: number) =>
    api.get<Blueprint>(`/lpa/documents/${docId}/blueprint`).then((r) => r.data),

  operatingPack: (entityId: number) =>
    api.get<OperatingPack>(`/lpa/funds/${entityId}/operating-pack`).then((r) => r.data),

  listEntities: () =>
    api.get<{ id: number; code: string; legal_name: string }[]>("/entities").then((r) => r.data),

  createEntity: (body: Record<string, unknown>) =>
    api.post("/entities", body).then((r) => r.data),
};

export default api;

import { api } from "./client";
import type {
  AccountingPeriod,
  AuditEvent,
  CapitalAccount,
  CapitalCall,
  Commitment,
  Distribution,
  Entity,
  FundSummary,
  Investor,
  Job,
  OperationsDashboard,
  PerformanceMetrics,
  PlatformSummary,
  Transaction,
} from "./types";

export const Platform = {
  summary: () => api.get<PlatformSummary>("/dashboards/platform").then((r) => r.data),
  operations: () => api.get<OperationsDashboard>("/dashboards/operations").then((r) => r.data),
  fund: (entityId: number, asOf: string) =>
    api.get<FundSummary>(`/dashboards/fund/${entityId}`, { params: { as_of: asOf } }).then((r) => r.data),
};

export const Entities = {
  list: () => api.get<Entity[]>("/entities").then((r) => r.data),
  get: (id: number) => api.get<Entity>(`/entities/${id}`).then((r) => r.data),
  create: (payload: Partial<Entity>) => api.post<Entity>("/entities", payload).then((r) => r.data),
};

export const Investors = {
  list: () => api.get<Investor[]>("/investors").then((r) => r.data),
  get: (id: number) => api.get<Investor>(`/investors/${id}`).then((r) => r.data),
  create: (payload: Partial<Investor>) => api.post<Investor>("/investors", payload).then((r) => r.data),
  commitments: (investorId: number) =>
    api.get<Commitment[]>(`/investors/${investorId}/commitments`).then((r) => r.data),
  capitalAccounts: (investorId: number) =>
    api.get<CapitalAccount[]>(`/investors/${investorId}/capital-accounts`).then((r) => r.data),
};

export const Transactions = {
  list: (entityId?: number, state?: string) =>
    api.get<Transaction[]>("/transactions", {
      params: { entity_id: entityId, state },
    }).then((r) => r.data),
  approve: (id: number) => api.post<Transaction>(`/transactions/${id}/approve`).then((r) => r.data),
  post: (id: number) => api.post(`/transactions/${id}/post`).then((r) => r.data),
  import_: (payload: object) => api.post("/transactions/import", payload).then((r) => r.data),
};

export const Performance = {
  get: (entityId: number, asOf: string, investorId?: number) =>
    api.get<PerformanceMetrics>("/performance", {
      params: { entity_id: entityId, as_of: asOf, investor_id: investorId },
    }).then((r) => r.data),
};

export const CapitalCalls = {
  list: (entityId?: number) =>
    api.get<CapitalCall[]>("/capital-calls", { params: { entity_id: entityId } }).then((r) => r.data),
  get: (id: number) => api.get<CapitalCall>(`/capital-calls/${id}`).then((r) => r.data),
  create: (payload: object) => api.post<CapitalCall>("/capital-calls", payload).then((r) => r.data),
  approve: (id: number) => api.post<CapitalCall>(`/capital-calls/${id}/approve`).then((r) => r.data),
  fund: (id: number) =>
    api.post<{ funded_transaction_ids: number[]; total: string }>(`/capital-calls/${id}/fund`).then((r) => r.data),
};

export const Distributions = {
  list: (entityId?: number) =>
    api.get<Distribution[]>("/distributions", { params: { entity_id: entityId } }).then((r) => r.data),
  get: (id: number) => api.get<Distribution>(`/distributions/${id}`).then((r) => r.data),
  create: (payload: object) => api.post<Distribution>("/distributions", payload).then((r) => r.data),
  approve: (id: number) => api.post<Distribution>(`/distributions/${id}/approve`).then((r) => r.data),
  pay: (id: number) =>
    api.post<{ paid_transaction_ids: number[]; total: string }>(`/distributions/${id}/pay`).then((r) => r.data),
};

export const Periods = {
  list: (entityId: number) =>
    api.get<AccountingPeriod[]>("/periods", { params: { entity_id: entityId } }).then((r) => r.data),
  ensure: (payload: { entity_id: number; period_type: string; any_date: string }) =>
    api.post<AccountingPeriod>("/periods", payload).then((r) => r.data),
  softClose: (id: number) => api.post<AccountingPeriod>(`/periods/${id}/soft-close`).then((r) => r.data),
  close: (id: number) => api.post<AccountingPeriod>(`/periods/${id}/close`).then((r) => r.data),
  reopen: (id: number, reason: string) =>
    api.post<AccountingPeriod>(`/periods/${id}/reopen`, { reason }).then((r) => r.data),
};

export const Jobs = {
  list: () => api.get<Job[]>("/jobs").then((r) => r.data),
  retry: (id: number) => api.post<Job>(`/jobs/${id}/retry`).then((r) => r.data),
};

export const Audit = {
  events: (params: { object_type?: string; object_id?: string; action?: string; limit?: number } = {}) =>
    api.get<AuditEvent[]>("/audit/events", { params }).then((r) => r.data),
  upstream: (objectType: string, objectId: string) =>
    api.get("/audit/lineage/upstream", { params: { object_type: objectType, object_id: objectId } }).then((r) => r.data),
  downstream: (objectType: string, objectId: string) =>
    api.get("/audit/lineage/downstream", { params: { object_type: objectType, object_id: objectId } }).then((r) => r.data),
};

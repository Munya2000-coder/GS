export type EntityStatus = "setup" | "active" | "winding_down" | "closed" | "inactive";
export type EntityType = "fund" | "sub_fund" | "spv" | "blocker" | "feeder" | "co_invest" | "master" | "aiv";

export interface Entity {
  id: number;
  code: string;
  legal_name: string;
  short_name: string;
  entity_type: EntityType;
  jurisdiction: string;
  vintage_year: number | null;
  strategy: string | null;
  base_currency: string;
  reporting_currency: string;
  status: EntityStatus;
  parent_id: number | null;
}

export interface Investor {
  id: number;
  code: string;
  legal_name: string;
  short_name: string;
  domicile: string;
  status: string;
  side_letter: boolean;
  primary_email: string | null;
}

export interface Commitment {
  id: number;
  investor_id: number;
  entity_id: number;
  closing_id: string;
  closing_date: string;
  investor_class: string;
  commitment_amount: string;
  currency: string;
}

export interface CapitalAccount {
  id: number;
  code: string;
  investor_id: number;
  entity_id: number;
  investor_class: string;
  contributed: string;
  distributed: string;
  recallable: string;
  ending_nav: string;
  allocated_pnl: string;
  carry_participant: boolean;
}

export interface Transaction {
  id: number;
  batch_id: number;
  source_reference: string;
  entity_id: number;
  investor_id: number | null;
  capital_account_id: number | null;
  transaction_type: string;
  transaction_date: string;
  amount: string;
  currency: string;
  description: string | null;
  state: string;
}

export interface PerformanceMetrics {
  paid_in: string;
  distributions: string;
  nav: string;
  tvpi: string;
  dpi: string;
  rvpi: string;
  moic: string;
  pic_ratio: string;
  irr: string | null;
  as_of: string;
  cashflow_count: number;
}

export interface PlatformSummary {
  funds: { total: number; active: number };
  investors: number;
  aum: { committed: string; contributed: string; distributed: string; nav: string };
  operational: {
    open_exceptions: number;
    recon_breaks: number;
    failed_jobs: number;
    pending_approvals: number;
  };
  as_of: string;
}

export interface FundSummary {
  entity: Entity;
  commitments: { count: number; total_committed: string };
  capital_accounts: number;
  metrics: PerformanceMetrics;
  operational: {
    open_periods: number;
    approved_calls: number;
    approved_distributions: number;
  };
}

export interface CapitalCallAllocation {
  investor_id: number;
  capital_account_id: number;
  share: string;
  amount: string;
}

export interface CapitalCall {
  id: number;
  entity_id: number;
  call_number: string;
  notice_date: string;
  due_date: string;
  total_amount: string;
  currency: string;
  purpose: string;
  state: string;
  allocations: CapitalCallAllocation[];
}

export interface DistributionAllocation {
  investor_id: number;
  capital_account_id: number;
  basis: string;
  share: string;
  amount: string;
}

export interface Distribution {
  id: number;
  entity_id: number;
  distribution_number: string;
  notice_date: string;
  payment_date: string;
  total_amount: string;
  currency: string;
  purpose: string;
  recallable: boolean;
  state: string;
  allocations: DistributionAllocation[];
}

export interface AccountingPeriod {
  id: number;
  entity_id: number;
  period_type: string;
  period_start: string;
  period_end: string;
  status: string;
  reopen_reason: string | null;
}

export interface Job {
  id: number;
  job_type: string;
  trigger_source: string;
  status: string;
  attempts: number;
  owner_user_id: number | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface OperationsDashboard {
  jobs_last_7d: Record<string, number>;
  exceptions_by_code: Record<string, number>;
  exceptions_by_status: Record<string, number>;
  pending_waterfall_approvals: number;
  pending_fee_approvals: number;
}

export interface AuditEvent {
  id: number;
  occurred_at: string;
  actor_user_id: number | null;
  action: string;
  object_type: string;
  object_id: string;
  before: string | null;
  after: string | null;
  privileged: boolean;
}

export interface FeeSchedule {
  id: number;
  entity_id: number;
  investor_id: number | null;
  investor_class: string | null;
  name: string;
  basis: "commitment" | "invested_capital" | "nav" | "flat";
  annual_rate_bps: number;
  effective_from: string;
  effective_to: string | null;
  version: number;
  state: string;
}

export interface FeeAccrual {
  id: number;
  schedule_id: number;
  investor_id: number | null;
  basis_amount: string;
  applied_rate_bps: number;
  gross_fee: string;
  offset_amount: string;
  net_fee: string;
}

export interface FeeRun {
  id: number;
  entity_id: number;
  period_start: string;
  period_end: string;
  state: string;
  input_snapshot_hash: string;
  accruals: FeeAccrual[];
}

export interface WaterfallModel {
  id: number;
  entity_id: number;
  investor_class: string | null;
  name: string;
  method: "american" | "european" | "hybrid";
  preferred_return_bps: number;
  catchup_percentage_bps: number;
  carried_interest_bps: number;
  hurdle_compounding: string;
  effective_from: string;
  effective_to: string | null;
  version: number;
  state: string;
}

export interface WaterfallTier {
  tier_order: number;
  tier_name: string;
  lp_amount: string;
  gp_amount: string;
  formula_text: string;
}

export interface WaterfallRun {
  id: number;
  model_id: number;
  entity_id: number;
  as_of_date: string;
  scenario_label: string | null;
  is_scenario: boolean;
  state: string;
  input_snapshot_hash: string;
  tiers: WaterfallTier[];
}

export interface NavSnapshot {
  id: number;
  entity_id: number;
  investor_id: number | null;
  as_of: string;
  gross_asset_value: string;
  liabilities: string;
  ending_nav: string;
  currency: string;
  source_reference: string | null;
}

export interface UserRecord {
  id: number;
  username: string;
  display_name: string;
  email: string;
  roles: string[];
  fund_scope: number[] | null;
  active: boolean;
  mfa_enabled: boolean;
}

export interface Me {
  id: number;
  username: string;
  roles: string[];
  fund_scope: number[] | null;
  permissions: string[];
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
  net: string;
}

export interface TrialBalance {
  entity_id: number;
  as_of: string;
  rows: TrialBalanceRow[];
}

export interface CapitalAccountStatement {
  investor: { id: number; code: string; legal_name: string };
  entity: { id: number; code: string; legal_name: string };
  as_of: string;
  commitment: string;
  contributed: string;
  distributed: string;
  ending_nav: string;
  unfunded: string;
  allocated_pnl: string;
  transactions: Array<{
    id: number;
    date: string;
    type: string;
    amount: string;
    currency: string;
    description: string | null;
    source_reference: string;
  }>;
}

export interface ImportResult {
  batch_id: number;
  accepted: number;
  rejected: number;
  transaction_ids: number[];
  exception_ids: number[];
}

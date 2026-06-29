// Mirrors the shapes returned by the GS /lpa API (see app/api/lpa.py,
// app/services/lpa_blueprint.py, app/services/lpa_operating_pack.py).

export type TrafficLight = "green_confirmed" | "amber_review" | "red_missing";

export interface Citation {
  page_number: number | null;
  page_end?: number | null;
  clause_reference: string | null;
  exact_extracted_text: string;
  bounding_box_coordinates: number[];
}

export interface BlueprintField {
  value: string | number | boolean | null;
  confidence: number;
  status: TrafficLight;
  requires_review: boolean;
  ambiguous: boolean;
  citation: Citation | null;
}

export interface SideLetterOverride extends BlueprintField {
  investor_id: number | null;
  override_type: string | null;
  overridden_clause_type: string | null;
  override_value: string | null;
}

export interface Blueprint {
  document_id: number;
  document_name: string;
  document_type: string;
  page_count: number;
  fund_metadata: Record<string, BlueprintField>;
  waterfall_rules: Record<string, BlueprintField>;
  fee_economics: Record<string, BlueprintField>;
  side_letter_overrides: SideLetterOverride[];
  summary: {
    fields_total: number;
    confirmed_green: number;
    review_amber: number;
    overrides_flagged: number;
  };
}

export interface SourceDocument {
  id: number;
  entity_id: number | null;
  investor_id: number | null;
  name: string;
  document_type: string;
  status: string;
  page_count: number;
  content_hash: string;
}

export interface OperatingRule {
  rule_id: string;
  rule_type: string;
  source_reference: string | null;
  rule_status: string;
  plain_english_summary: string | null;
  structured_rule: Record<string, unknown>;
  evidence_required: string[];
  confidence_score: number;
  requires_human_review: boolean;
  citation: { source_reference: string | null; page_number: number | null; exact_extracted_text: string };
}

export interface OperatingPack {
  fund_id: string;
  fund_name: string;
  documents: { id: number; name: string; type: string; authority: number }[];
  fund_terms_summary: {
    field: string; value: unknown; source_reference: string | null;
    page: number | null; confidence: number | null; status: TrafficLight; review: boolean;
  }[];
  operating_rules: OperatingRule[];
  investor_obligation_matrix: Record<string, unknown>[];
  reporting_obligation_matrix: Record<string, unknown>[];
  obligation_calendar: Record<string, unknown>[];
  exception_report: { kind: string; severity: string; subject: string | null; explanation: string; action: string }[];
  summary: { documents: number; rules: number; open_exceptions: number; high_severity_exceptions: number };
}

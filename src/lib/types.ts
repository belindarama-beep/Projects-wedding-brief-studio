export type Attribution = "Arden" | "Theo" | "Family" | "Vendor";

export type SourceType =
  | "written_note"
  | "image"
  | "voice_note"
  | "structured_field";

export type Source = {
  id: string;
  project_id: string;
  type: SourceType;
  raw_content: string | null;
  file_path: string | null;
  transcribed_text: string | null;
  attribution: Attribution | null;
  added_at: string;
};

export type ExtractedCategory =
  | "atmosphere"
  | "formality"
  | "colour_material"
  | "floral_approach"
  | "guest_experience"
  | "exclusions";

export type FlagType = "contradiction" | "gap";

export type Extraction = {
  id: string;
  project_id: string;
  source_item_ids: string[];
  created_at: string;
};

export type ExtractedItem = {
  id: string;
  extraction_id: string;
  project_id: string;
  category: ExtractedCategory;
  content: string;
  source_item_ids: string[];
  created_at: string;
};

export type Flag = {
  id: string;
  extraction_id: string;
  project_id: string;
  type: FlagType;
  description: string;
  evidence: string | null;
  source_item_ids: string[];
  suggested_resolutions: string[];
  internal_only: boolean;
  created_at: string;
};

export type ResolutionMethod = "pill" | "free_text" | "kept_open";

export type Resolution = {
  id: string;
  flag_id: string;
  project_id: string;
  method: ResolutionMethod;
  content: string | null;
  resolved_by: string;
  resolved_at: string;
};

export type DirectionStatus = "draft" | "approved";

export type DirectionVersionContent = {
  central_idea: string;
  visual_direction: string;
  colour_material_direction: string;
  priority_moments: string[];
  what_to_avoid: string[];
  fixed_decisions: string[];
  flexible_decisions: string[];
  planner_notes?: string[];
  // flag_id is absent on versions approved before the internal_only
  // cross-check existed (v4 and earlier for Arden & Theo) — treat missing
  // as "can't verify against a flag," never as "safe to show."
  contradictions: { topic: string; description: string; flag_id?: string }[];
  unresolved_questions: { question: string; context: string; flag_id?: string }[];
  budget_implications: string;
};

export type DirectionDiff = {
  is_directional_shift: boolean;
  summary: string;
  changes: { area: string; before: string; after: string }[];
};

export type DirectionVersion = {
  id: string;
  project_id: string;
  version_number: number;
  content: DirectionVersionContent;
  status: DirectionStatus;
  diff_from_previous: DirectionDiff | null;
  created_at: string;
  approved_at: string | null;
};

export type Project = {
  id: string;
  couple_names: string | null;
  venue: string | null;
  wedding_date: string | null;
  guest_count: number | null;
  // numeric columns come back from PostgREST as strings to avoid float
  // precision loss — parse with Number() when formatting for display.
  budget: string | null;
  style_preset: string | null;
};

export type Planner = {
  id: string;
  business_name: string | null;
  brand_logo_url: string | null;
};

export type DocumentType = "creative_direction" | "supplier_brief";

export type BudgetTier = {
  headline: string;
  description: string;
  whats_included: string[];
};

export type BudgetTiers = {
  essential: BudgetTier;
  elevated: BudgetTier;
  signature: BudgetTier;
};

export type DocumentRow = {
  id: string;
  project_id: string;
  direction_version_id: string | null;
  document_type: DocumentType;
  template_preset: string | null;
  selected_image_ids: string[];
  // The generate-document-content edge function writes the tier object
  // directly (essential/elevated/signature at the top level) — not nested
  // under a "budget_tiers" key. Matches what's actually in the DB.
  generated_content: BudgetTiers | null;
  file_path: string | null;
  created_at: string;
};

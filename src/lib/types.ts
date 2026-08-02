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
  created_at: string;
};

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

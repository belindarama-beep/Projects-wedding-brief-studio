import type { BudgetTiers, DirectionVersionContent } from "@/lib/types";
import type { StylePresetSlug } from "./presets";

export type { BudgetTier, BudgetTiers } from "@/lib/types";

export type DocumentBaseData = {
  documentId: string;
  project: {
    coupleNames: string;
    venue: string | null;
    weddingDate: string | null;
    guestCount: number | null;
    budget: string | null;
  };
  planner: {
    businessName: string | null;
    logoUrl: string | null;
  };
  direction: {
    versionNumber: number;
    approvedAt: string | null;
    content: DirectionVersionContent;
  };
  preset: StylePresetSlug;
  budgetTiers: BudgetTiers | null;
  generatedAt: string;
};

export type CreativeDirectionDocumentData = DocumentBaseData & {
  images: { id: string; url: string; alt: string }[];
};

// The supplier brief needs no inspiration imagery — it's a functional
// scope document, not the visual-direction narrative.
export type SupplierBriefDocumentData = DocumentBaseData;

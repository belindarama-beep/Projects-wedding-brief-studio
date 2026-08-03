import type { BudgetTiers, DirectionVersionContent } from "@/lib/types";
import type { StylePresetSlug } from "./presets";

export type { BudgetTier, BudgetTiers } from "@/lib/types";

export type CreativeDirectionDocumentData = {
  documentId: string;
  project: {
    coupleNames: string;
    venue: string | null;
    weddingDate: string | null;
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
  images: { id: string; url: string; alt: string }[];
  budgetTiers: BudgetTiers | null;
  generatedAt: string;
};

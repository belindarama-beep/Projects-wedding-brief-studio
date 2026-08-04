import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import { GesturalSprig } from "../devices/GesturalSprig";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * The tier grid already does the page's functional-register work; a small
 * gestural sprig in the margin softens what would otherwise be an entirely
 * utilitarian page — never the page's central graphic.
 */
export function BudgetTiersPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner, budgetTiers } = data;

  return (
    <DocumentPage
      eyebrow="04 / Budget Tiers"
      pageNum="Page 07"
      footerLeft="Budget Tiers"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">Three honest ways to spend, not an upsell ladder.</h1>
      <p className="wbs-body">{direction.content.budget_implications}</p>

      {budgetTiers ? (
        <div className="wbs-tier-grid">
          {(["essential", "elevated", "signature"] as const).map((tier) => {
            const t = budgetTiers[tier];
            return (
              <div key={tier} className="wbs-tier-card">
                <div className="wbs-tier-name">{tier}</div>
                <div className="wbs-tier-headline">{t.headline}</div>
                <p className="wbs-tier-desc">{t.description}</p>
                <ul className="wbs-tier-list">
                  {t.whats_included.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="wbs-body" style={{ fontStyle: "italic", color: "rgba(32,26,20,.6)" }}>
          Budget tiers for this version are still being prepared.
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <HandNote>real trade-offs, not upsell copy.</HandNote>
        <GesturalSprig />
      </div>
    </DocumentPage>
  );
}

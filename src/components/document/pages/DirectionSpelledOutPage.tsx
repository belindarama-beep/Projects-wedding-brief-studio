import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import { InkSweepCircle } from "../devices/InkSweepCircle";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * Gestural register — one more beat of variety on a page that's otherwise
 * three dense lists, placed near the top so it doesn't get buried under
 * real, variable-length content.
 */
export function DirectionSpelledOutPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;
  const { fixed_decisions, flexible_decisions, what_to_avoid } = direction.content;

  return (
    <DocumentPage
      eyebrow="03 / Direction Spelled Out"
      pageNum="Page 06"
      footerLeft="Direction Spelled Out"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">Locked in, still open, and what we&apos;re leaving out.</h1>
      <p className="wbs-body">
        Some of this is decided. Some is still moving. Both are worth naming plainly.
      </p>

      <InkSweepCircle compact />

      {fixed_decisions.length > 0 && (
        <>
          <div className="wbs-section-label">Locked in</div>
          <ul className="wbs-list">
            {fixed_decisions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {flexible_decisions.length > 0 && (
        <>
          <div className="wbs-section-label">Still flexible</div>
          <ul className="wbs-list">
            {flexible_decisions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {what_to_avoid.length > 0 && (
        <>
          <div className="wbs-section-label">What to avoid</div>
          <ul className="wbs-list">
            {what_to_avoid.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}

      <HandNote>said plainly, so nothing gets papered over.</HandNote>
    </DocumentPage>
  );
}

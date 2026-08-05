import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import { FineLineArch } from "../devices/FineLineArch";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * Visual Direction — 03: the priority moments, ranked. Gestural register —
 * a quiet, list-driven page that still needs the brand mark, just not at
 * full weight.
 */
export function VisualDirectionMomentsPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;

  return (
    <DocumentPage
      eyebrow="02 / Visual Direction — cont."
      pageNum="Page 05"
      footerLeft="Priority Moments"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">The moments that carry the whole day.</h1>
      <p className="wbs-body">
        Everything above translates into a handful of moments worth protecting above
        everything else.
      </p>

      <ul className="wbs-list">
        {direction.content.priority_moments.map((moment, i) => (
          <li key={i}>{moment}</li>
        ))}
      </ul>

      <FineLineArch />

      <HandNote>the parts that mattered, kept intact.</HandNote>
    </DocumentPage>
  );
}

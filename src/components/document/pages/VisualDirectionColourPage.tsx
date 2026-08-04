import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import { ColourRail } from "../devices/ColourRail";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * Visual Direction — 02: colour & material direction. Functional register —
 * this page names several distinct colour/material decisions at once, which
 * is exactly the colour rail's job (content work, not a decorative swatch).
 */
export function VisualDirectionColourPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;

  return (
    <DocumentPage
      eyebrow="02 / Visual Direction — cont."
      pageNum="Page 04"
      footerLeft="Colour & Material"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">Colour and material, held consistently.</h1>
      <p className="wbs-body">{direction.content.colour_material_direction}</p>

      <ColourRail />

      <HandNote>the same hand, every surface.</HandNote>
    </DocumentPage>
  );
}

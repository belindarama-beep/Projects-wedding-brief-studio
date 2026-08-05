import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * Visual Direction — 02: colour & material direction. No swatch block here —
 * the Approved Record carries colour only as prose (colour_material_direction
 * is free text, no structured colour values), so a swatch rendering fixed
 * style-preset tokens would contradict whatever this page's own prose says.
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

      <HandNote>every detail speaking the same language.</HandNote>
    </DocumentPage>
  );
}

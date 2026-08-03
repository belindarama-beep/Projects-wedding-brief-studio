import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import { ArchStack } from "../ArchStack";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/** Visual Direction — 02: colour & material direction. */
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

      <div className="wbs-cover-bar" style={{ width: 220, marginTop: 8 }}>
        <span style={{ background: "var(--panel1)" }} />
        <span style={{ background: "var(--panel2)" }} />
        <span style={{ background: "var(--deepest)" }} />
        <span style={{ background: "var(--soft)" }} />
        <span style={{ background: "var(--accent)" }} />
      </div>

      <ArchStack compact showFan />

      <HandNote>the same hand, every surface.</HandNote>
    </DocumentPage>
  );
}

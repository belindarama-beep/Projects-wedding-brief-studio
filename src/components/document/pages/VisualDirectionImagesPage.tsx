import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { Callout, HandNote } from "../Callout";
import { ArchStack } from "../ArchStack";
import { ImageGrid } from "../ImageGrid";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/** Visual Direction — 01: the narrative plus the planner-selected inspiration imagery, absorbing 1 to ~5 photos. */
export function VisualDirectionImagesPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner, images } = data;

  return (
    <DocumentPage
      eyebrow="02 / Visual Direction"
      pageNum="Page 03"
      footerLeft="Visual Direction"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">The visual direction, as we understood it.</h1>
      <p className="wbs-body">{direction.content.visual_direction}</p>

      <ArchStack showFan={images.length === 0} />

      <ImageGrid images={images} />

      <Callout eyebrow="Why this reads as them">
        {direction.content.central_idea.split(".")[0]}.
      </Callout>

      <HandNote>quiet, but never plain.</HandNote>
    </DocumentPage>
  );
}

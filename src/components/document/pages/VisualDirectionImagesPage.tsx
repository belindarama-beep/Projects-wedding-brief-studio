import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { Callout, HandNote } from "../Callout";
import { EdgeComposition } from "../devices/EdgeComposition";
import { ImageGrid } from "../ImageGrid";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * Visual Direction — 01: the narrative plus the planner-selected inspiration
 * imagery, absorbing 1 to ~5 photos. Weighted register via edge composition
 * (not the arch stack — that's reserved for the central-idea page) — this
 * page needs room for narrative and images alongside real weight.
 */
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
      <EdgeComposition />

      <h1 className="wbs-headline" style={{ maxWidth: 420 }}>
        The visual direction, as we understood it.
      </h1>
      <p className="wbs-body" style={{ maxWidth: 420 }}>
        {direction.content.visual_direction}
      </p>

      <div style={{ maxWidth: 460 }}>
        <ImageGrid images={images} />
      </div>

      <Callout eyebrow="Why this reads as them">
        {direction.content.central_idea.split(".")[0]}.
      </Callout>

      <HandNote>quiet, but never plain.</HandNote>
    </DocumentPage>
  );
}

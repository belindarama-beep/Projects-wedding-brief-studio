import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { Callout, HandNote } from "../Callout";
import { ArchStack } from "../ArchStack";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

/**
 * The page carrying the central idea — the arch stack's designated spot per
 * the device legend, the document's one moment of full weighted presence
 * outside the cover itself.
 */
export function WhatWeUnderstoodPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;
  const moments = direction.content.priority_moments;

  return (
    <DocumentPage
      eyebrow="01 / What We Understood"
      pageNum="Page 02"
      footerLeft="What We Understood"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">This is what we heard, brought together.</h1>
      <p className="wbs-body">{direction.content.central_idea}</p>

      <ArchStack compact />

      {moments.length > 0 && (
        <Callout eyebrow="What matters most to you">
          {moments.slice(0, 3).join(" · ")}
        </Callout>
      )}

      <HandNote>your story, held together.</HandNote>
    </DocumentPage>
  );
}

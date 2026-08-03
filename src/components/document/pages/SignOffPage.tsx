import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SignOffPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;

  return (
    <DocumentPage
      eyebrow="06 / Sign-off"
      pageNum="Page 09"
      footerLeft="Sign-off"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">This is what &quot;us&quot; looks like on paper.</h1>
      <p className="wbs-body">
        This direction reflects everything you&apos;ve shared with us so far. If it still
        feels like you, let&apos;s carry it forward — if something&apos;s off, tell us and
        we&apos;ll adjust before anything is booked.
      </p>

      <div className="wbs-signoff-block">
        <div className="wbs-signoff-row">
          <span>Couple</span>
          <span>{project.coupleNames}</span>
        </div>
        <div className="wbs-signoff-row">
          <span>Venue</span>
          <span>{project.venue ?? "To be confirmed"}</span>
        </div>
        <div className="wbs-signoff-row">
          <span>Wedding date</span>
          <span>{formatDate(project.weddingDate)}</span>
        </div>
        <div className="wbs-signoff-row">
          <span>Direction version</span>
          <span>{direction.versionNumber}</span>
        </div>
        <div className="wbs-signoff-row">
          <span>Approved</span>
          <span>{formatDate(direction.approvedAt)}</span>
        </div>
        <div className="wbs-signoff-row">
          <span>Prepared by</span>
          <span>{planner.businessName ?? "Your planner"}</span>
        </div>
      </div>

      <HandNote>this is what &quot;us&quot; looks like on paper.</HandNote>
    </DocumentPage>
  );
}

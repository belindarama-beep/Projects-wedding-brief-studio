import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CoverPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;
  const weddingDate = formatDate(project.weddingDate);

  return (
    <DocumentPage
      eyebrow="Creative Direction"
      pageNum="Page 01"
      footerLeft={project.coupleNames}
      footerRight="Creative Direction"
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <div className="wbs-cover">
        <div className="wbs-cover-arch">
          <div className="wbs-cover-eyebrow">Approved creative direction</div>
          <div className="wbs-cover-word">{project.coupleNames}</div>
        </div>

        <p className="wbs-cover-sub">{data.direction.content.central_idea}</p>

        <div className="wbs-cover-bar">
          <span style={{ background: "var(--panel1)" }} />
          <span style={{ background: "var(--panel2)" }} />
          <span style={{ background: "var(--deepest)" }} />
          <span style={{ background: "var(--soft)" }} />
        </div>

        <div className="wbs-cover-meta">
          {project.venue ? `${project.venue}` : "Venue to be confirmed"}
          {weddingDate ? ` · ${weddingDate}` : ""}
          <br />
          Version {direction.versionNumber}
          {direction.approvedAt ? ` · approved ${formatDate(direction.approvedAt)}` : ""}
        </div>
      </div>
    </DocumentPage>
  );
}

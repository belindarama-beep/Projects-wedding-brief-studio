import { DocumentPage } from "../DocumentPage";
import { PlannerMark } from "../PlannerMark";
import { HandNote } from "../Callout";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";

export function OpenQuestionsPage({ data }: { data: CreativeDirectionDocumentData }) {
  const { project, direction, planner } = data;
  const questions = direction.content.unresolved_questions;

  return (
    <DocumentPage
      eyebrow="05 / Open Questions"
      pageNum="Page 08"
      footerLeft="Open Questions"
      footerRight={project.coupleNames}
      mark={<PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />}
    >
      <h1 className="wbs-headline">What we haven&apos;t landed on yet.</h1>
      <p className="wbs-body">
        Named plainly, so nothing gets decided by default. We&apos;ll come back to each of
        these together.
      </p>

      {questions.length > 0 ? (
        questions.map((q, i) => (
          <div key={i} className="wbs-question-card">
            <div className="wbs-question-text">{q.question}</div>
            <div className="wbs-question-context">{q.context}</div>
          </div>
        ))
      ) : (
        <p className="wbs-body" style={{ fontStyle: "italic", color: "rgba(32,26,20,.6)" }}>
          Every open question from this version has been resolved.
        </p>
      )}

      <HandNote>the open choices are still yours.</HandNote>
    </DocumentPage>
  );
}

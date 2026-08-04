import "./document.css";
import { resolveStylePreset, presetCssVars } from "@/lib/document/presets";
import { floralStylingAvoidList } from "@/lib/document/supplierBriefContent";
import { PlannerMark } from "./PlannerMark";
import { plexMono, plexSans, beauRivage } from "./fonts";
import type { SupplierBriefDocumentData } from "@/lib/document/types";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ContextItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="wbs-brief-context-label">{label}</div>
      <div className={`wbs-brief-context-value${value ? "" : " wbs-brief-unconfirmed"}`}>
        {value ?? "Not yet confirmed"}
      </div>
    </div>
  );
}

export function SupplierBriefDocument({ data }: { data: SupplierBriefDocumentData }) {
  const { project, planner, direction, budgetTiers } = data;
  const tokens = resolveStylePreset(data.preset);
  const { colour_material_direction, what_to_avoid } = direction.content;

  const avoidList = floralStylingAvoidList(what_to_avoid);
  const essential = budgetTiers?.essential ?? null;
  const guestCountLabel = project.guestCount !== null ? `${project.guestCount} guests` : null;

  return (
    <div
      className={`wbs-brief ${plexMono.variable} ${plexSans.variable} ${beauRivage.variable}`}
      style={presetCssVars(tokens)}
    >
      <div className="wbs-brief-sheet">
        <header className="wbs-brief-header">
          <div className="wbs-brief-header-top">
            <div>
              <div className="wbs-brief-eyebrow">Floral &amp; Styling Supplier Brief</div>
              <div className="wbs-brief-title">{project.coupleNames}</div>
            </div>
            <PlannerMark logoUrl={planner.logoUrl} businessName={planner.businessName} />
          </div>

          <div className="wbs-brief-context">
            <ContextItem label="Venue" value={project.venue} />
            <ContextItem label="Wedding date" value={formatDate(project.weddingDate)} />
            <ContextItem label="Guest count" value={guestCountLabel} />
          </div>
        </header>

        <div className="wbs-brief-body">
          <section className="wbs-brief-section">
            <div className="wbs-brief-section-label">Colour &amp; material direction</div>
            <p className="wbs-body" style={{ margin: 0, maxWidth: "none" }}>
              {colour_material_direction}
            </p>
          </section>

          <section className="wbs-brief-section">
            <div className="wbs-brief-section-label">Quantities &amp; must-haves</div>
            {essential ? (
              <>
                <p className="wbs-body" style={{ margin: "0 0 4px", maxWidth: "none" }}>
                  {essential.description}
                </p>
                <ul className="wbs-list" style={{ maxWidth: "none" }}>
                  {essential.whats_included.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="wbs-brief-empty">
                Quantities and must-haves are not yet available — a budget tier breakdown
                hasn&apos;t been generated for this approved direction.
              </p>
            )}
          </section>

          <section className="wbs-brief-section">
            <div className="wbs-brief-section-label">If budget tightens</div>
            <p className="wbs-brief-empty">
              No lower-tier floral fallback has been decided yet — this will show here once
              the planner and couple agree one.
            </p>
          </section>

          <section className="wbs-brief-section">
            <div className="wbs-brief-section-label">What to avoid</div>
            {avoidList.length > 0 ? (
              <ul className="wbs-list" style={{ maxWidth: "none" }}>
                {avoidList.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="wbs-brief-empty">Nothing floral/styling-specific flagged to avoid.</p>
            )}
          </section>
        </div>

        <footer className="wbs-brief-footer">
          <span>Supplier Brief · from Version {direction.versionNumber}</span>
          <span>
            {planner.businessName ?? "Your Studio"} · generated{" "}
            {formatDate(data.generatedAt) ?? data.generatedAt}
          </span>
        </footer>
      </div>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreativeDirectionDocument } from "@/components/document/CreativeDirectionDocument";
import { ExportPdfButton } from "./ExportPdfButton";
import { isStylePresetSlug, DEFAULT_STYLE_PRESET } from "@/lib/document/presets";
import type { CreativeDirectionDocumentData } from "@/lib/document/types";
import type { DirectionVersion, DocumentRow, Planner, Project, Source } from "@/lib/types";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("documents")
    .select(
      "id, project_id, direction_version_id, document_type, template_preset, selected_image_ids, generated_content, file_path, created_at",
    )
    .eq("id", id)
    .single();

  if (!doc) notFound();
  const document = doc as DocumentRow;

  const [{ data: project }, { data: direction }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, couple_names, venue, wedding_date, style_preset, planner_id")
      .eq("id", document.project_id)
      .single(),
    document.direction_version_id
      ? supabase
          .from("direction_versions")
          .select("id, project_id, version_number, content, status, diff_from_previous, created_at, approved_at")
          .eq("id", document.direction_version_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  if (!project || !direction) notFound();
  const typedDirection = direction as DirectionVersion;
  const typedProject = project as Project & { planner_id: string };

  // Referential-integrity cross-check, independent of whatever approve-direction
  // already did: never render a contradiction/open question whose source flag
  // is marked internal_only — including flags marked internal_only *after* this
  // version was approved. A flag_id missing or not found is treated as unsafe,
  // never as safe by default (older approved versions predate this field).
  const referencedFlagIds = Array.from(
    new Set(
      [
        ...typedDirection.content.contradictions.map((c) => c.flag_id),
        ...typedDirection.content.unresolved_questions.map((q) => q.flag_id),
      ].filter((flagId): flagId is string => !!flagId),
    ),
  );

  const safeFlagIds = new Set<string>();
  if (referencedFlagIds.length > 0) {
    const { data: flagRows } = await supabase
      .from("flags")
      .select("id, internal_only")
      .in("id", referencedFlagIds);
    for (const f of (flagRows ?? []) as { id: string; internal_only: boolean }[]) {
      if (!f.internal_only) safeFlagIds.add(f.id);
    }
  }

  const safeDirectionContent = {
    ...typedDirection.content,
    contradictions: typedDirection.content.contradictions.filter(
      (c) => !!c.flag_id && safeFlagIds.has(c.flag_id),
    ),
    unresolved_questions: typedDirection.content.unresolved_questions.filter(
      (q) => !!q.flag_id && safeFlagIds.has(q.flag_id),
    ),
  };

  const { data: planner } = await supabase
    .from("planners")
    .select("id, business_name, brand_logo_url")
    .eq("id", typedProject.planner_id)
    .single();

  let images: CreativeDirectionDocumentData["images"] = [];
  if (document.selected_image_ids.length > 0) {
    const { data: imageSources } = await supabase
      .from("source_items")
      .select("id, project_id, type, raw_content, file_path, transcribed_text, attribution, added_at")
      .in("id", document.selected_image_ids);

    const typedImageSources = (imageSources ?? []) as Source[];
    const orderedSources = document.selected_image_ids
      .map((imgId) => typedImageSources.find((s) => s.id === imgId))
      .filter((s): s is Source => !!s && !!s.file_path);

    if (orderedSources.length > 0) {
      const { data: signed } = await supabase.storage
        .from("source-files")
        .createSignedUrls(
          orderedSources.map((s) => s.file_path!),
          3600,
        );
      const urlByPath = Object.fromEntries(
        (signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]),
      );
      images = orderedSources
        .filter((s) => urlByPath[s.file_path!])
        .map((s) => ({
          id: s.id,
          url: urlByPath[s.file_path!],
          alt: `Inspiration image for ${typedProject.couple_names ?? "the wedding"}`,
        }));
    }
  }

  const data: CreativeDirectionDocumentData = {
    documentId: document.id,
    project: {
      coupleNames: typedProject.couple_names ?? "Untitled project",
      venue: typedProject.venue,
      weddingDate: typedProject.wedding_date,
    },
    planner: {
      businessName: (planner as Planner | null)?.business_name ?? null,
      logoUrl: (planner as Planner | null)?.brand_logo_url ?? null,
    },
    direction: {
      versionNumber: typedDirection.version_number,
      approvedAt: typedDirection.approved_at,
      content: safeDirectionContent,
    },
    preset: isStylePresetSlug(document.template_preset)
      ? document.template_preset
      : DEFAULT_STYLE_PRESET,
    images,
    budgetTiers: document.generated_content?.budget_tiers ?? null,
    generatedAt: document.created_at,
  };

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
        <a href="/project" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to project
        </a>
        <ExportPdfButton documentId={document.id} existingFilePath={document.file_path} />
      </div>
      <CreativeDirectionDocument data={data} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectView } from "@/components/CollectView";
import { ExtractionView } from "@/components/ExtractionView";
import { GenerateView } from "@/components/GenerateView";
import { ProjectDetailsSection } from "@/components/ProjectDetailsSection";
import type {
  DirectionVersion,
  Extraction,
  ExtractedItem,
  Flag,
  Project,
  Resolution,
  Source,
} from "@/lib/types";

export default async function ProjectPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, couple_names, venue, wedding_date, guest_count, budget, style_preset")
    .ilike("couple_names", "Arden & Theo")
    .single();

  if (projectError || !project) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-lg font-semibold">Arden & Theo project not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          No project named &quot;Arden &amp; Theo&quot; is visible to this
          account.
        </p>
      </main>
    );
  }

  const { data: sources, error: sourcesError } = await supabase
    .from("source_items")
    .select(
      "id, project_id, type, raw_content, file_path, transcribed_text, attribution, added_at",
    )
    .eq("project_id", project.id)
    .order("added_at", { ascending: false });

  if (sourcesError) {
    throw new Error(sourcesError.message);
  }

  const typedSources = (sources ?? []) as Source[];

  const imageSources = typedSources.filter(
    (s) => s.type === "image" && s.file_path,
  );

  let signedUrls: Record<string, string> = {};
  if (imageSources.length > 0) {
    const { data: signed } = await supabase.storage
      .from("source-files")
      .createSignedUrls(
        imageSources.map((s) => s.file_path!),
        3600,
      );
    if (signed) {
      signedUrls = Object.fromEntries(
        signed
          .filter((s) => s.signedUrl)
          .map((s) => [s.path, s.signedUrl]),
      );
    }
  }

  const { data: latestExtraction } = await supabase
    .from("extractions")
    .select("id, project_id, source_item_ids, created_at, status")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let extractedItems: ExtractedItem[] = [];
  let flags: Flag[] = [];
  let resolutions: Resolution[] = [];

  if (latestExtraction) {
    const [{ data: items }, { data: flagRows }] = await Promise.all([
      supabase
        .from("extracted_items")
        .select(
          "id, extraction_id, project_id, category, content, source_item_ids, created_at",
        )
        .eq("extraction_id", latestExtraction.id),
      supabase
        .from("flags")
        .select(
          "id, extraction_id, project_id, type, description, evidence, source_item_ids, suggested_resolutions, internal_only, created_at",
        )
        .eq("extraction_id", latestExtraction.id),
    ]);
    extractedItems = (items ?? []) as ExtractedItem[];
    flags = (flagRows ?? []) as Flag[];

    if (flags.length > 0) {
      const { data: resolutionRows } = await supabase
        .from("resolutions")
        .select("id, flag_id, project_id, method, content, resolved_by, resolved_at")
        .in(
          "flag_id",
          flags.map((f) => f.id),
        );
      resolutions = (resolutionRows ?? []) as Resolution[];
    }
  }

  // Reminder list for the internal_only interim fix: every flag ever marked
  // internal_only on this project, not just the latest extraction's — since
  // internal_only is an annotation on a flag row and flag rows don't persist
  // across Extract re-runs, this is what surfaces a topic that was correctly
  // marked before and silently reset when it was re-extracted.
  const { data: previouslyInternalOnlyRows } = await supabase
    .from("flags")
    .select("id, description")
    .eq("project_id", project.id)
    .eq("internal_only", true)
    .order("created_at", { ascending: false });

  const { data: directionVersionRows } = await supabase
    .from("direction_versions")
    .select(
      "id, project_id, version_number, content, status, diff_from_previous, created_at, approved_at",
    )
    .eq("project_id", project.id)
    .order("version_number", { ascending: false });

  const directionVersions = (directionVersionRows ?? []) as DirectionVersion[];
  const approvedVersions = directionVersions.filter((v) => v.status === "approved");

  return (
    <>
      <ProjectDetailsSection project={project} />
      <CollectView
        project={project}
        initialSources={typedSources}
        initialSignedUrls={signedUrls}
      />
      <ExtractionView
        projectId={project.id}
        initialExtraction={latestExtraction as Extraction | null}
        initialExtractedItems={extractedItems}
        initialFlags={flags}
        initialResolutions={resolutions}
        initialDirectionVersions={directionVersions}
        previouslyInternalOnly={previouslyInternalOnlyRows ?? []}
        sources={typedSources}
        signedUrls={signedUrls}
      />
      <GenerateView
        project={project as Project}
        approvedVersions={approvedVersions}
        imageSources={imageSources}
        signedUrls={signedUrls}
      />
    </>
  );
}

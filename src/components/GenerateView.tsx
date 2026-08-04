"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STYLE_PRESETS, DEFAULT_STYLE_PRESET, isStylePresetSlug } from "@/lib/document/presets";
import type { StylePresetSlug } from "@/lib/document/presets";
import type { DirectionVersion, Project, Source } from "@/lib/types";

function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (!context) return Promise.resolve(fallback);
  return context
    .clone()
    .json()
    .then((body) => body.error ?? fallback)
    .catch(() => `${fallback} (status ${context.status})`);
}

export function GenerateView({
  project,
  approvedVersions,
  imageSources,
  signedUrls,
}: {
  project: Project;
  approvedVersions: DirectionVersion[];
  imageSources: Source[];
  signedUrls: Record<string, string>;
}) {
  const router = useRouter();
  const latest = approvedVersions[0] ?? null;

  const [preset, setPreset] = useState<StylePresetSlug>(
    isStylePresetSlug(project.style_preset) ? project.style_preset : DEFAULT_STYLE_PRESET,
  );
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!latest) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-16">
        <h2 className="mb-4 text-lg font-semibold">Generate</h2>
        <p className="text-sm text-neutral-500">
          No approved direction yet — approve a version before generating the
          Creative Direction document.
        </p>
      </section>
    );
  }

  function toggleImage(id: string) {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  async function handleGenerate() {
    if (imageSources.length > 0 && selectedImageIds.length === 0) {
      const proceed = window.confirm(
        "No inspiration images are selected. The visual direction pages will render without a photo — continue anyway?",
      );
      if (!proceed) return;
    }

    setGenerating(true);
    setError(null);

    const supabase = createClient();

    const { data: contentData, error: fnError } = await supabase.functions.invoke(
      "generate-document-content",
      { body: { direction_version_id: latest!.id, document_type: "creative_direction" } },
    );

    if (fnError) {
      setError(await readFunctionError(fnError, fnError.message));
      setGenerating(false);
      return;
    }
    if (contentData?.error) {
      setError(contentData.error);
      setGenerating(false);
      return;
    }

    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        project_id: project.id,
        direction_version_id: latest!.id,
        document_type: "creative_direction",
        template_preset: preset,
        selected_image_ids: selectedImageIds,
        generated_content: contentData.content,
      })
      .select("id")
      .single();

    setGenerating(false);

    if (insertError || !doc) {
      setError(insertError?.message ?? "Could not save the generated document");
      return;
    }

    router.push(`/project/document/${doc.id}`);
  }

  async function handleGenerateSupplierBrief() {
    setGeneratingBrief(true);
    setError(null);

    const supabase = createClient();

    // Reuse whatever budget-tier content was already generated for this
    // approved direction — no new AI call. If no Creative Direction document
    // has been generated for this version yet, generated_content stays null
    // and the brief renders its honest "not yet available" state.
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("generated_content")
      .eq("project_id", project.id)
      .eq("document_type", "creative_direction")
      .eq("direction_version_id", latest!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        project_id: project.id,
        direction_version_id: latest!.id,
        document_type: "supplier_brief",
        template_preset: preset,
        selected_image_ids: [],
        generated_content: existingDoc?.generated_content ?? null,
      })
      .select("id")
      .single();

    setGeneratingBrief(false);

    if (insertError || !doc) {
      setError(insertError?.message ?? "Could not save the generated document");
      return;
    }

    router.push(`/project/document/${doc.id}`);
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pb-16">
      <h2 className="mb-1 text-lg font-semibold">Generate</h2>
      <p className="mb-6 text-xs text-neutral-400">
        Creative Direction document from version {latest.version_number}
      </p>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-neutral-600">Style preset</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STYLE_PRESETS) as StylePresetSlug[]).map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setPreset(slug)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                slug === preset
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {STYLE_PRESETS[slug].name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-1 text-sm font-medium text-neutral-600">
          Inspiration images for the visual direction pages
        </h3>
        {imageSources.length > 0 && (
          <p
            className={`mb-2 text-xs ${
              selectedImageIds.length === 0 ? "font-medium text-amber-600" : "text-neutral-400"
            }`}
          >
            {selectedImageIds.length === 0
              ? "No images selected — the visual direction pages will show no photo."
              : `${selectedImageIds.length} of ${imageSources.length} selected`}
          </p>
        )}
        {imageSources.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No images uploaded yet — add some via Collect to include them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {imageSources.map((source) => {
              const url = source.file_path ? signedUrls[source.file_path] : undefined;
              const checked = selectedImageIds.includes(source.id);
              return (
                <label
                  key={source.id}
                  className={`relative block h-24 w-24 cursor-pointer overflow-hidden rounded-md border-2 bg-neutral-100 ${
                    checked ? "border-neutral-900" : "border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="absolute right-1 top-1 z-10 h-5 w-5"
                    checked={checked}
                    onChange={() => toggleImage(source.id)}
                  />
                  {checked && (
                    <span className="absolute inset-0 z-[5] bg-neutral-900/20" aria-hidden="true" />
                  )}
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt="Inspiration"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-center text-[10px] text-neutral-400">
                      Preview unavailable
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || generatingBrief}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Creative Direction document"}
        </button>
        <button
          type="button"
          onClick={handleGenerateSupplierBrief}
          disabled={generating || generatingBrief}
          className="rounded-md border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {generatingBrief ? "Generating…" : "Generate Floral & Styling Supplier Brief"}
        </button>
      </div>
    </section>
  );
}

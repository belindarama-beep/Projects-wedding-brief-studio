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
        <h3 className="mb-2 text-sm font-medium text-neutral-600">
          Inspiration images for the visual direction pages
        </h3>
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
                  className={`relative block h-24 w-24 cursor-pointer overflow-hidden rounded-md border-2 ${
                    checked ? "border-neutral-900" : "border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="absolute right-1 top-1 z-10"
                    checked={checked}
                    onChange={() => toggleImage(source.id)}
                  />
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt="Inspiration"
                      className="h-full w-full object-cover"
                    />
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate Creative Direction document"}
      </button>
    </section>
  );
}

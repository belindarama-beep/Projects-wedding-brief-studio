"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DirectionView } from "@/components/DirectionView";
import type {
  DirectionVersion,
  Extraction,
  ExtractedItem,
  ExtractedCategory,
  Flag,
  Resolution,
  ResolutionMethod,
  Source,
} from "@/lib/types";

type BatchPlanEntry = { pool: "text" | "image"; batch_index: number; count: number };

const CATEGORY_LABELS: Record<ExtractedCategory, string> = {
  atmosphere: "Atmosphere",
  formality: "Formality",
  colour_material: "Colour & Material",
  floral_approach: "Floral Approach",
  guest_experience: "Guest Experience",
  exclusions: "Exclusions",
};

const CATEGORY_ORDER: ExtractedCategory[] = [
  "atmosphere",
  "formality",
  "colour_material",
  "floral_approach",
  "guest_experience",
  "exclusions",
];

function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (!context) return Promise.resolve(fallback);
  return context
    .clone()
    .json()
    .then((body) => body.error ?? fallback)
    .catch(() => `${fallback} (status ${context.status})`);
}

export function ExtractionView({
  projectId,
  initialExtraction,
  initialExtractedItems,
  initialFlags,
  initialResolutions,
  initialDirectionVersions,
  previouslyInternalOnly,
  sources,
  signedUrls,
}: {
  projectId: string;
  initialExtraction: Extraction | null;
  initialExtractedItems: ExtractedItem[];
  initialFlags: Flag[];
  initialResolutions: Resolution[];
  initialDirectionVersions: DirectionVersion[];
  // Every flag ever marked internal_only on this project, across all past
  // extractions — not just the current one. internal_only is an annotation
  // on a flag row, and flag rows don't persist across Extract re-runs, so
  // this is the interim, human-checked substitute for that not carrying
  // forward automatically: a reminder to re-mark the same topic if it
  // reappears under a new flag id.
  previouslyInternalOnly: { id: string; description: string }[];
  // For rendering a thumbnail next to any flag whose source_item_ids
  // includes an image — Phase 2 (flag-facts) never sees images itself, only
  // Phase 1's derived text, so this lets the planner check the model's
  // summary against the actual photo in one glance.
  sources: Source[];
  signedUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [extraction, setExtraction] = useState(initialExtraction);
  const [items, setItems] = useState(initialExtractedItems);
  const [flags, setFlags] = useState(initialFlags);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    Object.fromEntries(initialResolutions.map((r) => [r.flag_id, r])),
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const [directionVersions, setDirectionVersions] = useState(
    initialDirectionVersions,
  );
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setProgress("Planning batches...");

    const supabase = createClient();

    // Plan mode: assigns batch_index to any new source items (append-only),
    // creates the parent extraction, and returns the batch plan to drive.
    const { data: planData, error: planError } = await supabase.functions.invoke(
      "extract-facts",
      { body: { project_id: projectId } },
    );

    if (planError || planData?.error) {
      setRunning(false);
      setProgress(null);
      setError(
        planError ? await readFunctionError(planError, planError.message) : planData.error,
      );
      return;
    }

    const newExtraction = planData.extraction as Extraction;
    const batches = planData.batches as BatchPlanEntry[];
    const collectedItems: ExtractedItem[] = [];

    // Phase 1: one edge function call per batch, sequentially, so progress
    // reflects the real checkpoints the batching architecture already
    // knows — not invented granularity. If this fails partway, the
    // extraction stays 'running' (abandoned, not corrupted) rather than
    // silently completing with a partial fact set.
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      setProgress(`Processing batch ${i + 1} of ${batches.length} (${batch.pool})...`);

      const { data: batchData, error: batchError } = await supabase.functions.invoke(
        "extract-facts",
        {
          body: {
            project_id: projectId,
            extraction_id: newExtraction.id,
            pool: batch.pool,
            batch_index: batch.batch_index,
          },
        },
      );

      if (batchError || batchData?.error) {
        setRunning(false);
        setProgress(null);
        setError(
          batchError ? await readFunctionError(batchError, batchError.message) : batchData.error,
        );
        return;
      }

      collectedItems.push(...((batchData.extracted_items ?? []) as ExtractedItem[]));
    }

    // Phase 2: contradiction/gap detection over the complete combined fact
    // set from every batch, text-only.
    setProgress("Finding contradictions across everything found so far...");
    const { data: flagData, error: flagError } = await supabase.functions.invoke("flag-facts", {
      body: { project_id: projectId, extraction_id: newExtraction.id },
    });

    setRunning(false);
    setProgress(null);

    if (flagError || flagData?.error) {
      setError(flagError ? await readFunctionError(flagError, flagError.message) : flagData.error);
      return;
    }

    setExtraction({ ...newExtraction, status: "complete" });
    setItems(collectedItems);
    setFlags(flagData.flags ?? []);
    setResolutions({});
  }

  async function handleResolve(
    flag: Flag,
    method: ResolutionMethod,
    content: string | null,
  ) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("resolutions")
      .upsert(
        {
          flag_id: flag.id,
          project_id: projectId,
          method,
          content,
          resolved_by: user.id,
          // Explicit so re-resolving an already-resolved flag actually moves
          // this forward — upsert only touches columns present in the
          // payload, and the column's own `default now()` only applies to
          // the very first insert, not later updates.
          resolved_at: new Date().toISOString(),
        },
        { onConflict: "flag_id" },
      )
      .select()
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setResolutions((prev) => ({ ...prev, [flag.id]: data as Resolution }));
  }

  async function handleToggleInternalOnly(flag: Flag) {
    const supabase = createClient();
    const nextValue = !flag.internal_only;

    const { error } = await supabase
      .from("flags")
      .update({ internal_only: nextValue })
      .eq("id", flag.id);

    if (error) {
      setError(error.message);
      return;
    }

    setFlags((prev) =>
      prev.map((f) => (f.id === flag.id ? { ...f, internal_only: nextValue } : f)),
    );
  }

  async function handleApprove() {
    setApproving(true);
    setApproveError(null);

    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke(
      "approve-direction",
      { body: { project_id: projectId } },
    );

    setApproving(false);

    if (error) {
      setApproveError(await readFunctionError(error, error.message));
      return;
    }
    if (data?.error) {
      setApproveError(data.error);
      return;
    }

    setDirectionVersions((prev) => [
      data.direction_version as DirectionVersion,
      ...prev,
    ]);

    // GenerateView reads its own approvedVersions prop from the server
    // render of project/page.tsx — it has no other way to learn a new
    // version was just approved here, so without this it stays stuck
    // offering to generate from whatever was latest at page load.
    router.refresh();
  }

  const itemsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  }));

  const currentFlagIds = new Set(flags.map((f) => f.id));
  const internalOnlyReminders = previouslyInternalOnly.filter(
    (f) => !currentFlagIds.has(f.id),
  );

  return (
    <>
      <section className="mx-auto max-w-2xl px-4 pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Extraction</h2>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? progress ?? "Running extraction..." : "Run extraction"}
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!extraction && !running && (
          <p className="text-sm text-neutral-500">
            No extraction has been run yet.
          </p>
        )}

        {extraction && (
          <p className="mb-6 text-xs text-neutral-400">
            Last run{" "}
            {new Date(extraction.created_at).toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            against {extraction.source_item_ids.length} source item
            {extraction.source_item_ids.length === 1 ? "" : "s"}.
          </p>
        )}

        {flags.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-neutral-600">
              Flags ({flags.length})
            </h3>
            <ul className="flex flex-col gap-3">
              {flags.map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  resolution={resolutions[flag.id] ?? null}
                  onResolve={handleResolve}
                  onToggleInternalOnly={handleToggleInternalOnly}
                  sourceById={sourceById}
                  signedUrls={signedUrls}
                />
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <div className="mb-10 flex flex-col gap-6">
            {itemsByCategory
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.category}>
                  <h3 className="mb-2 text-sm font-medium text-neutral-600">
                    {CATEGORY_LABELS[group.category]}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
                      >
                        {item.content}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}

        {flags.length > 0 && (
          <div className="rounded-lg border border-neutral-200 p-4">
            {internalOnlyReminders.length > 0 && (
              <div className="mb-4 rounded-md border border-neutral-300 bg-neutral-50 p-3">
                <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-600">
                  Before you approve — previously marked internal-only
                </h4>
                <p className="mb-2 text-xs text-neutral-500">
                  Marked on an earlier extraction. Flags are regenerated with
                  new ids on every Extract run, so this doesn&apos;t carry
                  forward automatically yet — check whether any of the flags
                  above cover the same ground, and mark them internal-only too
                  if so, before approving.
                </p>
                <ul className="flex flex-col gap-1 text-sm text-neutral-700">
                  {internalOnlyReminders.map((f) => (
                    <li key={f.id}>&bull; {f.description}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-600">
                Approve
              </h3>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {approving
                  ? "Approving..."
                  : directionVersions.length > 0
                    ? "Approve new version"
                    : "Approve this direction"}
              </button>
            </div>
            {approveError && (
              <p className="mt-2 text-sm text-red-600">{approveError}</p>
            )}
          </div>
        )}
      </section>
      <DirectionView versions={directionVersions} />
    </>
  );
}

function FlagRow({
  flag,
  resolution,
  onResolve,
  onToggleInternalOnly,
  sourceById,
  signedUrls,
}: {
  flag: Flag;
  resolution: Resolution | null;
  onResolve: (
    flag: Flag,
    method: ResolutionMethod,
    content: string | null,
  ) => Promise<void>;
  onToggleInternalOnly: (flag: Flag) => Promise<void>;
  sourceById: Map<string, Source>;
  signedUrls: Record<string, string>;
}) {
  // Phase 2 (flag-facts) never sees images — only Phase 1's derived text —
  // so this is the mitigation for that fidelity loss: let the planner check
  // the model's summary against the actual photo directly, rather than
  // trusting a compressed textual claim about it sight unseen.
  const imageUrls = flag.source_item_ids
    .map((id) => sourceById.get(id))
    .filter((s): s is Source => !!s && s.type === "image" && !!s.file_path)
    .map((s) => signedUrls[s.file_path!])
    .filter((url): url is string => !!url);

  const [editing, setEditing] = useState(!resolution);
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingInternal, setTogglingInternal] = useState(false);

  async function save(method: ResolutionMethod, content: string | null) {
    setSaving(true);
    await onResolve(flag, method, content);
    setSaving(false);
    setEditing(false);
  }

  async function toggleInternal() {
    setTogglingInternal(true);
    await onToggleInternalOnly(flag);
    setTogglingInternal(false);
  }

  return (
    <li
      className={`rounded-lg border p-3 ${
        flag.internal_only
          ? "border-neutral-400 bg-neutral-100"
          : flag.type === "contradiction"
            ? "border-red-300 bg-red-50"
            : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-block rounded-full bg-white px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
          {flag.type}
        </span>
        <button
          type="button"
          onClick={toggleInternal}
          disabled={togglingInternal}
          className={`rounded-full px-2 py-0.5 text-xs disabled:opacity-50 ${
            flag.internal_only
              ? "bg-neutral-800 text-white"
              : "border border-neutral-300 text-neutral-500"
          }`}
        >
          {flag.internal_only ? "Internal only" : "Mark internal-only"}
        </button>
      </div>
      <p className="text-sm font-medium text-neutral-800">
        {flag.description}
      </p>
      {flag.evidence && (
        <p className="mt-1 text-sm text-neutral-600">{flag.evidence}</p>
      )}
      {imageUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {imageUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Source image cited by this flag"
              className="h-20 w-20 rounded-md object-cover"
            />
          ))}
        </div>
      )}

      {!editing && resolution && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
          <span>
            {resolution.method === "kept_open"
              ? "Kept open"
              : `Resolved: ${resolution.content}`}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-400 underline"
          >
            Change
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          {flag.suggested_resolutions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {flag.suggested_resolutions.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={saving}
                  onClick={() => save("pill", option)}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 disabled:opacity-50"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Write your own resolution..."
              className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={saving || !freeText.trim()}
              onClick={() => save("free_text", freeText.trim())}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => save("kept_open", null)}
            className="self-start text-xs text-neutral-500 underline disabled:opacity-50"
          >
            Keep open
          </button>
        </div>
      )}
    </li>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  DirectionVersion,
  Extraction,
  ExtractedItem,
  ExtractedCategory,
  Flag,
  Resolution,
  ResolutionMethod,
} from "@/lib/types";

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
  initialLatestDirectionVersion,
}: {
  projectId: string;
  initialExtraction: Extraction | null;
  initialExtractedItems: ExtractedItem[];
  initialFlags: Flag[];
  initialResolutions: Resolution[];
  initialLatestDirectionVersion: DirectionVersion | null;
}) {
  const [extraction, setExtraction] = useState(initialExtraction);
  const [items, setItems] = useState(initialExtractedItems);
  const [flags, setFlags] = useState(initialFlags);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    Object.fromEntries(initialResolutions.map((r) => [r.flag_id, r])),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [directionVersion, setDirectionVersion] = useState(
    initialLatestDirectionVersion,
  );
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("extract-facts", {
      body: { project_id: projectId },
    });

    setRunning(false);

    if (error) {
      setError(await readFunctionError(error, error.message));
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }

    setExtraction(data.extraction);
    setItems(data.extracted_items ?? []);
    setFlags(data.flags ?? []);
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

    setDirectionVersion(data.direction_version);
  }

  const itemsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  }));

  return (
    <section className="mx-auto max-w-2xl px-4 pb-16">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Extraction</h2>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? "Running extraction..." : "Run extraction"}
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
          Last run {new Date(extraction.created_at).toLocaleString()} against{" "}
          {extraction.source_item_ids.length} source item
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-600">Approve</h3>
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {approving
                ? "Approving..."
                : directionVersion?.status === "approved"
                  ? "Approve new version"
                  : "Approve this direction"}
            </button>
          </div>
          {approveError && (
            <p className="mb-2 text-sm text-red-600">{approveError}</p>
          )}
          {directionVersion && directionVersion.status === "approved" && (
            <DirectionSummary version={directionVersion} />
          )}
        </div>
      )}
    </section>
  );
}

function FlagRow({
  flag,
  resolution,
  onResolve,
}: {
  flag: Flag;
  resolution: Resolution | null;
  onResolve: (
    flag: Flag,
    method: ResolutionMethod,
    content: string | null,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!resolution);
  const [freeText, setFreeText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(method: ResolutionMethod, content: string | null) {
    setSaving(true);
    await onResolve(flag, method, content);
    setSaving(false);
    setEditing(false);
  }

  return (
    <li
      className={`rounded-lg border p-3 ${
        flag.type === "contradiction"
          ? "border-red-300 bg-red-50"
          : "border-amber-300 bg-amber-50"
      }`}
    >
      <span className="mb-1 inline-block rounded-full bg-white px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
        {flag.type}
      </span>
      <p className="text-sm font-medium text-neutral-800">
        {flag.description}
      </p>
      {flag.evidence && (
        <p className="mt-1 text-sm text-neutral-600">{flag.evidence}</p>
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

function DirectionSummary({ version }: { version: DirectionVersion }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-neutral-400">
        Version {version.version_number} — approved{" "}
        {version.approved_at
          ? new Date(version.approved_at).toLocaleString()
          : ""}
      </p>
      <p className="font-medium text-neutral-800">
        {version.content.central_idea}
      </p>
      <p className="text-neutral-600">{version.content.visual_direction}</p>
      {version.content.contradictions.length > 0 && (
        <p className="text-neutral-500">
          {version.content.contradictions.length} contradiction
          {version.content.contradictions.length === 1 ? "" : "s"} still open
        </p>
      )}
      {version.content.unresolved_questions.length > 0 && (
        <p className="text-neutral-500">
          {version.content.unresolved_questions.length} open question
          {version.content.unresolved_questions.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

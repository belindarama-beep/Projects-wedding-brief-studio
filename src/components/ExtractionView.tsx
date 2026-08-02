"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Extraction, ExtractedItem, ExtractedCategory, Flag } from "@/lib/types";

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

export function ExtractionView({
  projectId,
  initialExtraction,
  initialExtractedItems,
  initialFlags,
}: {
  projectId: string;
  initialExtraction: Extraction | null;
  initialExtractedItems: ExtractedItem[];
  initialFlags: Flag[];
}) {
  const [extraction, setExtraction] = useState(initialExtraction);
  const [items, setItems] = useState(initialExtractedItems);
  const [flags, setFlags] = useState(initialFlags);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("extract-facts", {
      body: { project_id: projectId },
    });

    setRunning(false);

    if (error) {
      // supabase-js only gives a generic message for non-2xx responses;
      // the function's actual {error} body is on error.context (a Response).
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const body = await context.clone().json();
          setError(body.error ?? error.message);
        } catch {
          setError(`${error.message} (status ${context.status})`);
        }
      } else {
        setError(error.message);
      }
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }

    setExtraction(data.extraction);
    setItems(data.extracted_items ?? []);
    setFlags(data.flags ?? []);
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
              <li
                key={flag.id}
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
                  <p className="mt-1 text-sm text-neutral-600">
                    {flag.evidence}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-6">
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
    </section>
  );
}

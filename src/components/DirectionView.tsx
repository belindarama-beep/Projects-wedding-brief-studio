"use client";

import { useState } from "react";
import type { DirectionVersion } from "@/lib/types";

export function DirectionView({ versions }: { versions: DirectionVersion[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    versions[0]?.id ?? null,
  );

  if (versions.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-16">
        <h2 className="mb-4 text-lg font-semibold">Direction</h2>
        <p className="text-sm text-neutral-500">
          No direction has been approved yet.
        </p>
      </section>
    );
  }

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];
  const content = selected.content;
  const diff = selected.diff_from_previous;

  return (
    <section className="mx-auto max-w-2xl px-4 pb-16">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Direction</h2>
        {versions.length > 1 && (
          <div className="flex gap-1">
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  v.id === selected.id
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-600"
                }`}
              >
                v{v.version_number}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mb-6 text-xs text-neutral-400">
        Version {selected.version_number} — approved{" "}
        {selected.approved_at
          ? new Date(selected.approved_at).toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "not yet"}
      </p>

      {diff && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
            {diff.is_directional_shift
              ? "Directional shift from previous version"
              : "Changes from previous version"}
          </p>
          <p className="text-sm text-neutral-700">{diff.summary}</p>
          {diff.changes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {diff.changes.map((c, i) => (
                <li key={i} className="text-sm text-neutral-600">
                  <span className="font-medium text-neutral-800">
                    {c.area}:{" "}
                  </span>
                  <span className="text-neutral-400 line-through">
                    {c.before}
                  </span>{" "}
                  → <span>{c.after}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-600">
            Central idea
          </h3>
          <p className="text-sm text-neutral-800">{content.central_idea}</p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-600">
            Visual direction
          </h3>
          <p className="text-sm text-neutral-800">
            {content.visual_direction}
          </p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-600">
            Colour & material
          </h3>
          <p className="text-sm text-neutral-800">
            {content.colour_material_direction}
          </p>
        </div>

        <ListSection title="Priority moments" items={content.priority_moments} />
        <ListSection title="What to avoid" items={content.what_to_avoid} />
        <ListSection title="Fixed decisions" items={content.fixed_decisions} />
        <ListSection
          title="Flexible decisions"
          items={content.flexible_decisions}
        />

        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-600">
            Budget implications
          </h3>
          <p className="text-sm text-neutral-800">
            {content.budget_implications}
          </p>
        </div>

        {content.contradictions.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-600">
              Contradictions still open ({content.contradictions.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {content.contradictions.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
                >
                  <p className="font-medium text-neutral-800">{c.topic}</p>
                  <p className="text-neutral-600">{c.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.unresolved_questions.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-600">
              Open questions ({content.unresolved_questions.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {content.unresolved_questions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
                >
                  <p className="font-medium text-neutral-800">{q.question}</p>
                  <p className="text-neutral-600">{q.context}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.planner_notes && content.planner_notes.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-600">
              Planner notes — private, do not share with the couple
            </h3>
            <ul className="flex flex-col gap-2">
              {content.planner_notes.map((note, i) => (
                <li
                  key={i}
                  className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100"
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-neutral-600">{title}</h3>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-neutral-800">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

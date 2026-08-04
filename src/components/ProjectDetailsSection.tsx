"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";

type EditableProject = Pick<
  Project,
  "id" | "venue" | "wedding_date" | "guest_count" | "budget"
>;

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatBudget(budget: string | null) {
  if (budget === null) return null;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Number(budget));
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div
        className={`text-sm ${value ? "text-neutral-800" : "italic text-neutral-400"}`}
      >
        {value ?? "Not yet decided"}
      </div>
    </div>
  );
}

export function ProjectDetailsSection({ project }: { project: EditableProject }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [venue, setVenue] = useState(project.venue ?? "");
  const [weddingDate, setWeddingDate] = useState(project.wedding_date ?? "");
  const [guestCount, setGuestCount] = useState(
    project.guest_count !== null ? String(project.guest_count) : "",
  );
  const [budget, setBudget] = useState(project.budget ?? "");

  function startEditing() {
    setVenue(project.venue ?? "");
    setWeddingDate(project.wedding_date ?? "");
    setGuestCount(project.guest_count !== null ? String(project.guest_count) : "");
    setBudget(project.budget ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        venue: venue.trim() || null,
        wedding_date: weddingDate || null,
        guest_count: guestCount.trim() === "" ? null : Number(guestCount),
        budget: budget.trim() === "" ? null : Number(budget),
      })
      .eq("id", project.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEditing(false);
    router.refresh();
  }

  return (
    <section className="mx-auto mb-10 max-w-2xl rounded-lg border border-neutral-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-600">Project details</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs text-neutral-500 underline"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Venue
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Not yet decided"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Wedding date
            <input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Guest count
            <input
              type="number"
              min="0"
              step="1"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="Not yet decided"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Total budget (AUD)
            <input
              type="number"
              min="0"
              step="1"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Not yet decided"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <DetailRow label="Venue" value={project.venue} />
          <DetailRow label="Wedding date" value={formatDate(project.wedding_date)} />
          <DetailRow
            label="Guest count"
            value={project.guest_count !== null ? String(project.guest_count) : null}
          />
          <DetailRow label="Total budget" value={formatBudget(project.budget)} />
        </div>
      )}
    </section>
  );
}

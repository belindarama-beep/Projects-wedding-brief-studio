"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attribution, Source } from "@/lib/types";

const ATTRIBUTIONS: Attribution[] = ["Arden", "Theo", "Family", "Vendor"];

type Project = {
  id: string;
  couple_names: string | null;
  venue: string | null;
  wedding_date: string | null;
};

export function CollectView({
  project,
  initialSources,
  initialSignedUrls,
}: {
  project: Project;
  initialSources: Source[];
  initialSignedUrls: Record<string, string>;
}) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [signedUrls, setSignedUrls] =
    useState<Record<string, string>>(initialSignedUrls);
  const [noteText, setNoteText] = useState("");
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function prepend(source: Source) {
    setSources((prev) => [source, ...prev]);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("source_items")
      .insert({
        project_id: project.id,
        type: "written_note",
        raw_content: noteText.trim(),
        attribution,
      })
      .select(
        "id, project_id, type, raw_content, file_path, transcribed_text, attribution, added_at",
      )
      .single();

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    prepend(data as Source);
    setNoteText("");
    setAttribution(null);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const path = `${project.id}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("source-files")
      .upload(path, file);

    if (uploadError) {
      setSubmitting(false);
      setError(uploadError.message);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("source_items")
      .insert({
        project_id: project.id,
        type: "image",
        file_path: path,
        attribution,
      })
      .select(
        "id, project_id, type, raw_content, file_path, transcribed_text, attribution, added_at",
      )
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const { data: signed } = await supabase.storage
      .from("source-files")
      .createSignedUrl(path, 3600);

    if (signed?.signedUrl) {
      setSignedUrls((prev) => ({ ...prev, [path]: signed.signedUrl }));
    }

    prepend(data as Source);
    setAttribution(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold">{project.couple_names}</h1>
        {project.venue && (
          <p className="text-sm text-neutral-500">{project.venue}</p>
        )}
        <form action="/auth/sign-out" method="post" className="mt-2">
          <button
            type="submit"
            className="text-xs text-neutral-400 underline"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mb-10 rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-600">
          Add to the source folder
        </h2>

        <form onSubmit={handleAddNote} className="flex flex-col gap-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Paste a note..."
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />

          <AttributionChips
            selected={attribution}
            onSelect={setAttribution}
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !noteText.trim()}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Add note
            </button>

            <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium">
              Upload image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={submitting}
                className="hidden"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-600">
          {sources.length} source{sources.length === 1 ? "" : "s"} collected
        </h2>

        <ul className="flex flex-col gap-3">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              signedUrl={source.file_path ? signedUrls[source.file_path] : undefined}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}

function AttributionChips({
  selected,
  onSelect,
}: {
  selected: Attribution | null;
  onSelect: (a: Attribution | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ATTRIBUTIONS.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onSelect(selected === a ? null : a)}
          className={`rounded-full border px-3 py-1 text-xs ${
            selected === a
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function SourceRow({
  source,
  signedUrl,
}: {
  source: Source;
  signedUrl?: string;
}) {
  const timestamp = new Date(source.added_at).toLocaleString();

  return (
    <li className="rounded-lg border border-neutral-200 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-neutral-400">
        <span className="uppercase tracking-wide">
          {source.type === "written_note" ? "text" : source.type}
        </span>
        <span>{timestamp}</span>
        {source.attribution && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            {source.attribution}
          </span>
        )}
      </div>

      {source.type === "written_note" && (
        <p className="text-sm text-neutral-800">{source.raw_content}</p>
      )}

      {source.type === "image" &&
        (signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt="Source upload"
            className="max-h-64 rounded-md object-cover"
          />
        ) : (
          <p className="text-sm text-neutral-400">Image unavailable</p>
        ))}

      {source.type === "voice_note" && source.transcribed_text && (
        <p className="text-sm text-neutral-800">{source.transcribed_text}</p>
      )}
    </li>
  );
}

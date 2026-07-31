import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectView } from "@/components/CollectView";
import type { Source } from "@/lib/types";

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
    .select("id, couple_names, venue, wedding_date")
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

  return (
    <CollectView
      project={project}
      initialSources={typedSources}
      initialSignedUrls={signedUrls}
    />
  );
}

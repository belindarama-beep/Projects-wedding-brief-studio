import { chromium } from "playwright";
import { createClient } from "@/lib/supabase/server";

// Pre-installed in this environment; Playwright is configured to find it via
// PLAYWRIGHT_BROWSERS_PATH, but an explicit path avoids any version-mismatch
// download attempt.
const CHROMIUM_EXECUTABLE_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, project_id, document_type, direction_version_id")
    .eq("id", id)
    .single();

  if (docError || !doc) return json({ error: "Document not found" }, 404);

  const { data: direction } = doc.direction_version_id
    ? await supabase
        .from("direction_versions")
        .select("version_number")
        .eq("id", doc.direction_version_id)
        .single()
    : { data: null as { version_number: number } | null };

  const origin = new URL(request.url).origin;
  const cookieHeader = request.headers.get("cookie") ?? "";

  const browser = await chromium.launch({ executablePath: CHROMIUM_EXECUTABLE_PATH });
  let pdfBuffer: Buffer;
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    await page.goto(`${origin}/project/document/${id}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.3in", bottom: "0.3in", left: "0.3in", right: "0.3in" },
    });
  } finally {
    await browser.close();
  }

  const version = direction?.version_number ?? 0;
  const filePath = `${doc.project_id}/${doc.document_type}-v${version}-${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, pdfBuffer, { contentType: "application/pdf" });

  if (uploadError) return json({ error: uploadError.message }, 500);

  const { error: updateError } = await supabase
    .from("documents")
    .update({ file_path: filePath })
    .eq("id", id);

  if (updateError) return json({ error: updateError.message }, 500);

  const { data: signed, error: signedError } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 3600);

  if (signedError || !signed) {
    return json({ error: signedError?.message ?? "Could not sign the PDF URL" }, 500);
  }

  return json({ url: signed.signedUrl, filePath });
}

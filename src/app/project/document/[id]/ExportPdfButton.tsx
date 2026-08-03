"use client";

import { useState } from "react";

export function ExportPdfButton({
  documentId,
  existingFilePath,
}: {
  documentId: string;
  existingFilePath: string | null;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(!!existingFilePath);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/export`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Export failed");
        return;
      }
      setDownloadUrl(body.url);
      setHasFile(true);
    } catch {
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-red-600">{error}</span>}
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-neutral-900 underline"
        >
          Download PDF
        </a>
      )}
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {exporting ? "Exporting…" : hasFile ? "Re-export PDF" : "Export to PDF"}
      </button>
    </div>
  );
}

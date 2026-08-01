"use client";

function inspect(label: string, value: string | undefined) {
  const v = value ?? "";
  const badChars = [...v]
    .map((ch, i) => ({ ch, code: ch.codePointAt(0)!, i }))
    .filter((c) => c.code > 255);

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2>{label}</h2>
      <p>defined: {value === undefined ? "NO (undefined)" : "yes"}</p>
      <p>length: {v.length}</p>
      <p>JSON.stringify (escapes anything non-ASCII):</p>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {JSON.stringify(v)}
      </pre>
      <p>characters with code point &gt; 255 (illegal in fetch headers):</p>
      <pre>
        {badChars.length === 0
          ? "none found"
          : badChars
              .map((c) => `index ${c.i}: "${c.ch}" (U+${c.code.toString(16)})`)
              .join("\n")}
      </pre>
    </div>
  );
}

export default function DebugEnvPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Env var diagnostic (temporary — delete after debugging)</h1>
      {inspect("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)}
      {inspect(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      )}
    </main>
  );
}

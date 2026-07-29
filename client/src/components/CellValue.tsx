export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted/80">
        NULL
      </span>
    );
  }
  if (typeof value === "object") {
    return <span className="whitespace-pre-wrap">{JSON.stringify(value)}</span>;
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

export function formatCellTitle(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Exact clipboard text for a cell — preserves newlines and does not trim. */
export function rawCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export async function copyRawCellValue(value: unknown): Promise<void> {
  const text = rawCellText(value);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for older environments / non-secure contexts
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted/80">
        NULL
      </span>
    );
  }
  if (typeof value === "object") {
    return <span>{JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

export function formatCellTitle(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

import { AlertTriangle, Clock3, Rows3 } from "lucide-react";
import type { QuerySuccess } from "@/lib/api";

type Props = {
  result: QuerySuccess | null;
  error: string | null;
  running: boolean;
};

export function ResultsViewer({ result, error, running }: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-panel/50">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="text-sm font-semibold text-ink">Results</h2>
        {result && !error && (
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Rows3 className="size-3.5" />
              {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              {result.durationMs} ms
            </span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error && (
          <div
            className="mb-4 flex gap-2 rounded-md border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm text-danger"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {error}
            </pre>
          </div>
        )}

        {running && !result && !error && (
          <p className="text-sm text-muted">Running query…</p>
        )}

        {!running && !result && !error && (
          <p className="text-sm text-muted">
            Run a query to see results here.
          </p>
        )}

        {result && !error && (
          <ResultsTable columns={result.columns} rows={result.rows} />
        )}
      </div>
    </section>
  );
}

function ResultsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted">
        Query succeeded with no result columns (e.g. DDL / empty set).
      </p>
    );
  }

  return (
    <div className="overflow-auto rounded-md border border-line bg-panel">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-surface/95 backdrop-blur">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="border-b border-line px-3 py-2 font-mono text-xs font-semibold tracking-wide text-muted"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-sm text-muted"
              >
                No rows returned
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="odd:bg-panel even:bg-surface/40">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="max-w-xs truncate border-b border-line/70 px-3 py-1.5 font-mono text-xs text-ink"
                    title={formatCellTitle(row[col])}
                  >
                    <CellValue value={row[col]} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted/80">NULL</span>;
  }
  if (typeof value === "object") {
    return <span>{JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

function formatCellTitle(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

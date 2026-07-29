import { AlertTriangle, Clock3, Rows3 } from "lucide-react";
import { CellValue, formatCellTitle } from "@/components/CellValue";
import { CellWithCopyMenu } from "@/components/CellWithCopyMenu";
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
            Run a query to see results here. Right-click any cell to copy its raw value.
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
                    className="max-w-xs border-b border-line/70 px-1 py-0.5 font-mono text-xs text-ink"
                  >
                    <CellWithCopyMenu value={row[col]}>
                      <div
                        className="max-h-24 overflow-hidden px-2 py-1"
                        title={`${formatCellTitle(row[col])} — right-click to copy`}
                      >
                        <CellValue value={row[col]} />
                      </div>
                    </CellWithCopyMenu>
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

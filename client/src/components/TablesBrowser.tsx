import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Columns3,
  Loader2,
  RefreshCw,
  Rows3,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CellValue, formatCellTitle } from "@/components/CellValue";
import { browseTables, type BrowseTable, type ConnectionConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  config: ConnectionConfig;
  active: boolean;
};

export function TablesBrowser({ config, active }: Props) {
  const [tables, setTables] = useState<BrowseTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, Set<string>>>({});

  const connectionKey = `${config.host}:${config.port}/${config.database}@${config.username}`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await browseTables(config);
      if (!res.ok) {
        setTables([]);
        setError(res.error);
        setDurationMs(null);
        setLimit(null);
        return;
      }

      setTables(res.tables);
      setDurationMs(res.durationMs);
      setLimit(res.limit);

      // Expand all tables by default so data is visible "all at once"
      const nextExpanded: Record<string, boolean> = {};
      for (const table of res.tables) {
        nextExpanded[tableKey(table)] = true;
      }
      setExpanded(nextExpanded);
      setHiddenColumns({});
    } catch (err) {
      setTables([]);
      setError(err instanceof Error ? err.message : "Failed to reach API server");
      setDurationMs(null);
      setLimit(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    void load();
    // Reload whenever browse opens or connection identity changes
  }, [active, connectionKey]);

  const allExpanded =
    tables.length > 0 && tables.every((t) => expanded[tableKey(t)]);

  const toggleAllTables = () => {
    const next: Record<string, boolean> = {};
    for (const table of tables) {
      next[tableKey(table)] = !allExpanded;
    }
    setExpanded(next);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-panel/50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Tables</h2>
          <p className="text-xs text-muted">
            Browse all tables and rows. Collapse tables or hide columns as needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {durationMs !== null && (
            <span className="text-xs text-muted">
              {tables.length} table{tables.length === 1 ? "" : "s"}
              {limit !== null ? ` · up to ${limit} rows each` : ""}
              {` · ${durationMs} ms`}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllTables}
            disabled={tables.length === 0 || loading}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
          <Button size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        </div>
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

        {loading && tables.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Loading tables…
          </p>
        )}

        {!loading && !error && tables.length === 0 && (
          <p className="text-sm text-muted">No user tables found in this database.</p>
        )}

        <div className="space-y-3">
          {tables.map((table) => {
            const key = tableKey(table);
            const isOpen = Boolean(expanded[key]);
            const hidden = hiddenColumns[key] ?? new Set<string>();
            const visibleColumns = table.columns.filter((c) => !hidden.has(c.name));

            return (
              <article
                key={key}
                className="overflow-hidden rounded-md border border-line bg-panel"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface/70"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  )}
                  <Table2 className="size-4 shrink-0 text-accent" />
                  <span className="font-mono text-sm font-medium text-ink">
                    {table.schema}.{table.name}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Columns3 className="size-3.5" />
                      {table.columns.length}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Rows3 className="size-3.5" />
                      {table.truncated
                        ? `${table.rowCount} of ${table.totalRows}`
                        : table.totalRows}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-3 py-3">
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {table.columns.map((col) => {
                        const isHidden = hidden.has(col.name);
                        return (
                          <button
                            key={col.name}
                            type="button"
                            title={`${col.dataType}${col.nullable ? ", nullable" : ""}`}
                            className={cn(
                              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                              isHidden
                                ? "border-dashed border-line bg-surface text-muted line-through"
                                : "border-line bg-panel text-ink hover:border-accent/40",
                            )}
                            onClick={() =>
                              setHiddenColumns((prev) => {
                                const current = new Set(prev[key] ?? []);
                                if (current.has(col.name)) current.delete(col.name);
                                else current.add(col.name);
                                return { ...prev, [key]: current };
                              })
                            }
                          >
                            {col.name}
                            <span className="ml-1 text-muted">{col.dataType}</span>
                          </button>
                        );
                      })}
                    </div>

                    {table.truncated && (
                      <p className="mb-2 text-xs text-muted">
                        Showing first {table.rowCount} of {table.totalRows} rows.
                      </p>
                    )}

                    {visibleColumns.length === 0 ? (
                      <p className="text-sm text-muted">
                        All columns are hidden. Click a column chip above to show it.
                      </p>
                    ) : (
                      <div className="overflow-auto rounded-md border border-line">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead className="sticky top-0 bg-surface/95 backdrop-blur">
                            <tr>
                              {visibleColumns.map((col) => (
                                <th
                                  key={col.name}
                                  className="border-b border-line px-3 py-2 font-mono text-xs font-semibold tracking-wide text-muted"
                                >
                                  <div>{col.name}</div>
                                  <div className="font-normal text-[10px] text-muted/70">
                                    {col.dataType}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={visibleColumns.length}
                                  className="px-3 py-6 text-center text-sm text-muted"
                                >
                                  Empty table
                                </td>
                              </tr>
                            ) : (
                              table.rows.map((row, i) => (
                                <tr key={i} className="odd:bg-panel even:bg-surface/40">
                                  {visibleColumns.map((col) => (
                                    <td
                                      key={col.name}
                                      className="max-w-xs truncate border-b border-line/70 px-3 py-1.5 font-mono text-xs text-ink"
                                      title={formatCellTitle(row[col.name])}
                                    >
                                      <CellValue value={row[col.name]} />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function tableKey(table: BrowseTable): string {
  return `${table.schema}.${table.name}`;
}

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Columns3,
  Loader2,
  PencilLine,
  RefreshCw,
  Rows3,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CellValue, formatCellTitle, rawCellText } from "@/components/CellValue";
import { CellWithCopyMenu } from "@/components/CellWithCopyMenu";
import {
  browseTables,
  connectionKey,
  fetchTableRows,
  updateTableCell,
  type BrowseColumn,
  type BrowseTableMeta,
  type ConnectionConfig,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  config: ConnectionConfig;
  active: boolean;
};

type TableData = {
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows: number;
  truncated: boolean;
  limit: number;
};

const ROW_LIMIT = 100;

export function TablesBrowser({ config, active }: Props) {
  const [tables, setTables] = useState<BrowseTableMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, Set<string>>>({});
  const [tableData, setTableData] = useState<Record<string, TableData>>({});
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);

  const key = connectionKey(config);

  const loadMeta = async () => {
    setLoading(true);
    setError(null);
    setEditError(null);
    try {
      const res = await browseTables(config);
      if (!res.ok) {
        setTables([]);
        setError(res.error);
        setDurationMs(null);
        return;
      }

      setTables(res.tables);
      setDurationMs(res.durationMs);
      setExpanded({});
      setHiddenColumns({});
      setTableData({});
      setLoadingRows({});
      setRowErrors({});
    } catch (err) {
      setTables([]);
      setError(err instanceof Error ? err.message : "Failed to reach API server");
      setDurationMs(null);
    } finally {
      setLoading(false);
    }
  };

  const loadRows = async (table: BrowseTableMeta, force = false) => {
    const tKey = tableKey(table);
    if (!force && tableData[tKey]) return;

    setLoadingRows((prev) => ({ ...prev, [tKey]: true }));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[tKey];
      return next;
    });

    try {
      const res = await fetchTableRows(config, table.schema, table.name, ROW_LIMIT);
      if (!res.ok) {
        setRowErrors((prev) => ({ ...prev, [tKey]: res.error }));
        return;
      }
      setTableData((prev) => ({
        ...prev,
        [tKey]: {
          rows: res.rows,
          rowCount: res.rowCount,
          totalRows: res.totalRows,
          truncated: res.truncated,
          limit: res.limit,
        },
      }));
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [tKey]: err instanceof Error ? err.message : "Failed to load rows",
      }));
    } finally {
      setLoadingRows((prev) => ({ ...prev, [tKey]: false }));
    }
  };

  useEffect(() => {
    if (!active) return;
    void loadMeta();
  }, [active, key]);

  const allExpanded =
    tables.length > 0 && tables.every((t) => expanded[tableKey(t)]);

  const toggleAllTables = () => {
    if (allExpanded) {
      setExpanded({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const table of tables) {
      const tKey = tableKey(table);
      next[tKey] = true;
      void loadRows(table);
    }
    setExpanded(next);
  };

  const toggleTable = (table: BrowseTableMeta) => {
    const tKey = tableKey(table);
    const willOpen = !expanded[tKey];
    setExpanded((prev) => ({ ...prev, [tKey]: willOpen }));
    if (willOpen) void loadRows(table);
  };

  const handleCellSave = async (args: {
    table: BrowseTableMeta;
    rowIndex: number;
    column: BrowseColumn;
    raw: string;
  }) => {
    const { table, rowIndex, column, raw } = args;
    if (table.primaryKey.length === 0) {
      throw new Error("This table has no primary key, so cells are read-only");
    }

    const tKey = tableKey(table);
    const data = tableData[tKey];
    const row = data?.rows[rowIndex];
    if (!row) throw new Error("Row not found");

    const nextValue = parseEditedValue(raw, column);
    const current = row[column.name];
    if (valuesEqual(current, nextValue)) return;

    const primaryKey: Record<string, unknown> = {};
    for (const pk of table.primaryKey) {
      primaryKey[pk] = row[pk] ?? null;
    }

    const res = await updateTableCell(config, {
      schema: table.schema,
      table: table.name,
      column: column.name,
      value: nextValue,
      primaryKey,
    });
    if (!res.ok) throw new Error(res.error);

    setTableData((prev) => {
      const currentData = prev[tKey];
      if (!currentData) return prev;
      return {
        ...prev,
        [tKey]: {
          ...currentData,
          rows: currentData.rows.map((r, i) =>
            i === rowIndex ? { ...r, [column.name]: nextValue } : r,
          ),
        },
      };
    });
    setEditError(null);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-panel/50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Tables</h2>
          <p className="text-xs text-muted">
            Expand a table to load its rows. Double-click to edit, right-click to copy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {durationMs !== null && (
            <span className="text-xs text-muted">
              {tables.length} table{tables.length === 1 ? "" : "s"}
              {` · meta ${durationMs} ms`}
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
          <Button size="sm" onClick={() => void loadMeta()} disabled={loading}>
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
        {(error || editError) && (
          <div
            className="mb-4 flex gap-2 rounded-md border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm text-danger"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {error || editError}
            </pre>
          </div>
        )}

        {loading && tables.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Loading table list…
          </p>
        )}

        {!loading && !error && tables.length === 0 && (
          <p className="text-sm text-muted">No user tables found in this database.</p>
        )}

        <div className="space-y-3">
          {tables.map((table) => {
            const tKey = tableKey(table);
            const isOpen = Boolean(expanded[tKey]);
            const hidden = hiddenColumns[tKey] ?? new Set<string>();
            const visibleColumns = table.columns.filter((c) => !hidden.has(c.name));
            const editable = table.primaryKey.length > 0;
            const data = tableData[tKey];
            const rowsLoading = Boolean(loadingRows[tKey]);
            const rowError = rowErrors[tKey];

            return (
              <article
                key={tKey}
                className="overflow-hidden rounded-md border border-line bg-panel"
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left hover:bg-surface/70"
                  onClick={() => toggleTable(table)}
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
                  {editable ? (
                    <span className="inline-flex items-center gap-1 rounded bg-success-bg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                      <PencilLine className="size-3" />
                      Editable
                    </span>
                  ) : (
                    <span className="rounded bg-line/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      Read-only
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Columns3 className="size-3.5" />
                      {table.columns.length}
                    </span>
                    {data && (
                      <span className="inline-flex items-center gap-1">
                        <Rows3 className="size-3.5" />
                        {data.truncated
                          ? `${data.rowCount} of ${data.totalRows}`
                          : data.totalRows}
                      </span>
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-3 py-3">
                    {!editable && (
                      <p className="mb-2 text-xs text-muted">
                        No primary key — cells can’t be edited safely.
                      </p>
                    )}
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {table.columns.map((col) => {
                        const isHidden = hidden.has(col.name);
                        const isPk = table.primaryKey.includes(col.name);
                        return (
                          <button
                            key={col.name}
                            type="button"
                            title={`${col.dataType}${col.nullable ? ", nullable" : ""}${isPk ? ", primary key" : ""}`}
                            className={cn(
                              "cursor-pointer rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                              isHidden
                                ? "border-dashed border-line bg-surface text-muted line-through"
                                : "border-line bg-panel text-ink hover:border-accent/40",
                            )}
                            onClick={() =>
                              setHiddenColumns((prev) => {
                                const current = new Set(prev[tKey] ?? []);
                                if (current.has(col.name)) current.delete(col.name);
                                else current.add(col.name);
                                return { ...prev, [tKey]: current };
                              })
                            }
                          >
                            {isPk ? (
                              <span className="mr-1 text-[9px] font-semibold text-accent">
                                PK
                              </span>
                            ) : null}
                            {col.name}
                            <span className="ml-1 text-muted">{col.dataType}</span>
                          </button>
                        );
                      })}
                    </div>

                    {rowsLoading && (
                      <p className="mb-2 flex items-center gap-2 text-sm text-muted">
                        <Loader2 className="size-4 animate-spin" />
                        Loading rows…
                      </p>
                    )}

                    {rowError && (
                      <div className="mb-2 flex gap-2 rounded-md border border-danger/25 bg-danger-bg px-3 py-2 text-sm text-danger">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <pre className="whitespace-pre-wrap font-mono text-xs">{rowError}</pre>
                      </div>
                    )}

                    {data?.truncated && (
                      <p className="mb-2 text-xs text-muted">
                        Showing first {data.rowCount} of {data.totalRows} rows.
                      </p>
                    )}

                    {data && !rowsLoading && visibleColumns.length === 0 && (
                      <p className="text-sm text-muted">
                        All columns are hidden. Click a column chip above to show it.
                      </p>
                    )}

                    {data && !rowsLoading && visibleColumns.length > 0 && (
                      <div className="overflow-auto rounded-md border border-line">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead className="sticky top-0 bg-surface/95 backdrop-blur">
                            <tr>
                              {visibleColumns.map((col) => (
                                <th
                                  key={col.name}
                                  className="border-b border-line px-3 py-2 font-mono text-xs font-semibold tracking-wide text-muted"
                                >
                                  <div>
                                    {table.primaryKey.includes(col.name) ? (
                                      <span className="mr-1 text-[9px] font-semibold text-accent">
                                        PK
                                      </span>
                                    ) : null}
                                    {col.name}
                                  </div>
                                  <div className="font-normal text-[10px] text-muted/70">
                                    {col.dataType}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={visibleColumns.length}
                                  className="px-3 py-6 text-center text-sm text-muted"
                                >
                                  Empty table
                                </td>
                              </tr>
                            ) : (
                              data.rows.map((row, rowIndex) => (
                                <tr
                                  key={rowIndex}
                                  className="odd:bg-panel even:bg-surface/40"
                                >
                                  {visibleColumns.map((col) => (
                                    <td
                                      key={col.name}
                                      className="max-w-xs border-b border-line/70 px-1 py-0.5 font-mono text-xs text-ink"
                                    >
                                      <EditableCell
                                        value={row[col.name]}
                                        column={col}
                                        editable={editable}
                                        onSave={async (raw) => {
                                          try {
                                            await handleCellSave({
                                              table,
                                              rowIndex,
                                              column: col,
                                              raw,
                                            });
                                          } catch (err) {
                                            setEditError(
                                              err instanceof Error
                                                ? err.message
                                                : "Failed to update cell",
                                            );
                                            throw err;
                                          }
                                        }}
                                      />
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

function EditableCell({
  value,
  column,
  editable,
  onSave,
}: {
  value: unknown;
  column: BrowseColumn;
  editable: boolean;
  onSave: (raw: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [inputEl, setInputEl] = useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && inputEl) {
      inputEl.focus();
      const len = inputEl.value.length;
      inputEl.setSelectionRange(len, len);
    }
  }, [editing, inputEl]);

  const display = (
    <div
      className={cn(
        "max-h-24 overflow-hidden px-2 py-1 text-left",
        editable && "cursor-pointer rounded hover:bg-accent/10",
      )}
      title={
        editable
          ? `${formatCellTitle(value)} — double-click to edit, right-click to copy`
          : `${formatCellTitle(value)} — right-click to copy`
      }
      onDoubleClick={
        editable
          ? () => {
              setDraft(rawCellText(value));
              setEditing(true);
            }
          : undefined
      }
    >
      <CellValue value={value} />
    </div>
  );

  if (!editing) {
    return <CellWithCopyMenu value={value}>{display}</CellWithCopyMenu>;
  }

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // keep editing; parent shows error
    } finally {
      setSaving(false);
    }
  };

  const lineCount = Math.min(8, Math.max(2, draft.split("\n").length));

  return (
    <div className="flex items-start gap-1 px-1 py-0.5">
      <textarea
        ref={setInputEl}
        value={draft}
        disabled={saving}
        rows={lineCount}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        onBlur={() => {
          if (!saving) void commit();
        }}
        className="w-full min-w-[8rem] resize-y rounded border border-accent/40 bg-panel px-2 py-1 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-accent/30"
        placeholder={
          column.nullable
            ? "value or NULL · Ctrl/Cmd+Enter to save"
            : "value · Ctrl/Cmd+Enter to save"
        }
      />
      {saving && <Loader2 className="mt-1 size-3.5 shrink-0 animate-spin text-muted" />}
    </div>
  );
}

function parseEditedValue(raw: string, column: BrowseColumn): unknown {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toUpperCase() === "NULL") {
    if (!column.nullable) {
      throw new Error(`Column ${column.name} is not nullable`);
    }
    return null;
  }

  const type = column.dataType.toLowerCase();
  if (
    type.includes("int") ||
    type.includes("real") ||
    type.includes("double") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type === "float" ||
    type === "number"
  ) {
    const num = Number(trimmed);
    if (!Number.isFinite(num)) throw new Error(`Invalid number: ${raw}`);
    return num;
  }

  if (type.includes("bool")) {
    const lower = trimmed.toLowerCase();
    if (["true", "t", "1", "yes"].includes(lower)) return true;
    if (["false", "f", "0", "no"].includes(lower)) return false;
    throw new Error(`Invalid boolean: ${raw}`);
  }

  if (type.includes("json")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error("Invalid JSON");
    }
  }

  return raw;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

function tableKey(table: BrowseTableMeta): string {
  return `${table.schema}.${table.name}`;
}

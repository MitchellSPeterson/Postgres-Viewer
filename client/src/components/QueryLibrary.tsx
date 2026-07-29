import { useEffect, useState } from "react";
import { BookmarkPlus, Clock3, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearHistory,
  createSnippet,
  fetchQueryHistory,
  fetchSnippets,
  removeSnippet,
  type QueryHistoryItem,
  type Snippet,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  sql: string;
  onLoadSql: (sql: string) => void;
  refreshKey: number;
};

export function QueryLibrary({ sql, onLoadSql, refreshKey }: Props) {
  const [tab, setTab] = useState<"history" | "snippets">("history");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [snippetName, setSnippetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyRes, snippetsRes] = await Promise.all([
        fetchQueryHistory(),
        fetchSnippets(),
      ]);
      if (historyRes.ok) setHistory(historyRes.history);
      else setError(historyRes.error);
      if (snippetsRes.ok) setSnippets(snippetsRes.snippets);
      else setError(snippetsRes.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [refreshKey]);

  const handleSaveSnippet = async () => {
    if (!sql.trim()) return;
    const name = snippetName.trim() || `Snippet ${new Date().toLocaleString()}`;
    setSaving(true);
    try {
      const res = await createSnippet(name, sql);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSnippetName("");
      await reload();
      setTab("snippets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save snippet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex h-[28%] min-h-[140px] flex-col border-t border-line bg-panel/60">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="flex items-center rounded-md border border-line bg-surface/70 p-0.5">
          <button
            type="button"
            className={cn(
              "h-7 cursor-pointer rounded px-2.5 text-xs font-medium",
              tab === "history" ? "bg-panel text-ink shadow-sm" : "text-muted",
            )}
            onClick={() => setTab("history")}
          >
            History
          </button>
          <button
            type="button"
            className={cn(
              "h-7 cursor-pointer rounded px-2.5 text-xs font-medium",
              tab === "snippets" ? "bg-panel text-ink shadow-sm" : "text-muted",
            )}
            onClick={() => setTab("snippets")}
          >
            Snippets
          </button>
        </div>

        <div className="flex items-center gap-2">
          {tab === "history" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={history.length === 0}
              onClick={async () => {
                await clearHistory();
                await reload();
              }}
            >
              Clear
            </Button>
          ) : (
            <>
              <Input
                value={snippetName}
                onChange={(e) => setSnippetName(e.target.value)}
                placeholder="Snippet name"
                className="h-8 w-40"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveSnippet()}
                disabled={saving || !sql.trim()}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="size-3.5" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {error && <p className="px-2 py-1 text-xs text-danger">{error}</p>}
        {loading && (
          <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </p>
        )}

        {!loading && tab === "history" && history.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted">No query history yet.</p>
        )}

        {!loading && tab === "snippets" && snippets.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted">
            No snippets yet. Save the current editor SQL above.
          </p>
        )}

        {tab === "history" && (
          <ul className="space-y-1">
            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-line hover:bg-surface/70"
                  onClick={() => onLoadSql(item.sql)}
                  title="Load into editor"
                >
                  <Clock3
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      item.ok ? "text-success" : "text-danger",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <pre className="truncate font-mono text-xs text-ink">
                      {item.sql.replace(/\s+/g, " ").trim()}
                    </pre>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                      {item.ok
                        ? item.durationMs != null
                          ? ` · ${item.durationMs} ms`
                          : ""
                        : ` · ${item.error ?? "failed"}`}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "snippets" && (
          <ul className="space-y-1">
            {snippets.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-1 rounded-md border border-line bg-surface/40 px-2 py-1.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => onLoadSql(item.sql)}
                  title="Load into editor"
                >
                  <div className="truncate text-sm font-medium text-ink">{item.name}</div>
                  <pre className="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {item.sql.replace(/\s+/g, " ").trim()}
                  </pre>
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded p-1 text-muted hover:bg-danger-bg hover:text-danger"
                  aria-label={`Delete ${item.name}`}
                  onClick={async () => {
                    await removeSnippet(item.id);
                    await reload();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

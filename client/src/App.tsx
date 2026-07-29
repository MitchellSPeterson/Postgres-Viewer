import { useState } from "react";
import { Database } from "lucide-react";
import { ConnectionSidebar } from "@/components/ConnectionSidebar";
import { QueryEditor } from "@/components/QueryEditor";
import { ResultsViewer } from "@/components/ResultsViewer";
import { TablesBrowser } from "@/components/TablesBrowser";
import { ToastStack, type Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_POSTGRES,
  DEFAULT_SQLITE,
  connectionLabel,
  runQuery,
  testConnection,
  touchConnection,
  type ConnectionConfig,
  type Engine,
  type PostgresConfig,
  type QuerySuccess,
  type SavedConnection,
  type SqliteConfig,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ViewMode = "query" | "browse";

type Drafts = {
  postgres: PostgresConfig;
  sqlite: SqliteConfig;
};

export default function App() {
  const [engine, setEngine] = useState<Engine>("postgres");
  const [drafts, setDrafts] = useState<Drafts>({
    postgres: DEFAULT_POSTGRES,
    sqlite: DEFAULT_SQLITE,
  });
  const draft = drafts[engine];

  // Live connection used by Query/Browse — unchanged when flipping engine tabs.
  const [live, setLive] = useState<ConnectionConfig | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [view, setView] = useState<ViewMode>("query");
  const [sql, setSql] = useState(defaultSqlFor(DEFAULT_POSTGRES));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QuerySuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const active = live ?? draft;

  const pushToast = (type: Toast["type"], message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), type, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const updateDraft = (next: ConnectionConfig) => {
    setDrafts((prev) =>
      next.engine === "postgres"
        ? { ...prev, postgres: next }
        : { ...prev, sqlite: next },
    );
  };

  const handleEngineChange = (nextEngine: Engine) => {
    if (nextEngine === engine) return;
    setEngine(nextEngine);
    // Only swap the starter query if the editor still has the previous default.
    setSql((prev) => {
      if (prev.trim() === defaultSqlFor(draft).trim()) {
        return defaultSqlFor(drafts[nextEngine]);
      }
      return prev;
    });
  };

  const connectWith = async (
    config: ConnectionConfig,
    options?: { savedId?: number | null; label?: string },
  ) => {
    setConnecting(true);
    try {
      const res = await testConnection(config);
      if (res.ok) {
        setLive(config);
        setConnected(true);
        setSavedId(options?.savedId ?? null);
        updateDraft(config);
        setEngine(config.engine);
        setSql((prev) => {
          const previousDefault = defaultSqlFor(active);
          if (prev.trim() === previousDefault.trim()) return defaultSqlFor(config);
          return prev;
        });
        pushToast(
          "success",
          options?.label
            ? `Connected to “${options.label}”`
            : "message" in res
              ? res.message
              : "Connected successfully",
        );
        if (options?.savedId != null) void touchConnection(options.savedId);
      } else {
        pushToast("error", res.error);
      }
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Failed to reach API server",
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = () => void connectWith(draft, { savedId });

  const handleSelectSaved = (saved: SavedConnection) => {
    updateDraft(saved.config);
    setEngine(saved.config.engine);
    void connectWith(saved.config, { savedId: saved.id, label: saved.name });
  };

  const handleExecute = async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runQuery(active, sql);
      if (res.ok) {
        setLive(active);
        setConnected(true);
        setResult(res);
        setError(null);
        if (savedId !== null) void touchConnection(savedId);
      } else {
        setResult(null);
        setError(res.error);
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Failed to reach API server");
    } finally {
      setRunning(false);
    }
  };

  const headerConfig = live ?? draft;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel/90 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent text-white">
              <Database className="size-4" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">
              SQL Web Viewer
            </h1>
          </div>
          <div className="flex items-center rounded-md border border-line bg-surface/70 p-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-3",
                view === "query" && "bg-panel text-ink shadow-sm",
              )}
              onClick={() => setView("query")}
            >
              Query
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-3",
                view === "browse" && "bg-panel text-ink shadow-sm",
              )}
              onClick={() => setView("browse")}
            >
              Browse Tables
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <span
            className={`size-2.5 shrink-0 rounded-full ${connected && live ? "bg-success" : "bg-danger"}`}
            aria-hidden
          />
          <span className="shrink-0">
            {connected && live ? "Connected" : "Disconnected"}
          </span>
          <span className="text-line">·</span>
          <span className="truncate font-mono" title={connectionLabel(headerConfig)}>
            {headerConfig.engine === "sqlite" ? "SQLite" : "Postgres"} ·{" "}
            {connectionLabel(headerConfig)}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ConnectionSidebar
          config={draft}
          onChange={updateDraft}
          onEngineChange={handleEngineChange}
          onConnect={handleConnect}
          connecting={connecting}
          onSelectSaved={handleSelectSaved}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {view === "query" ? (
            <>
              <QueryEditor
                value={sql}
                onChange={setSql}
                onExecute={handleExecute}
                running={running}
              />
              <ResultsViewer result={result} error={error} running={running} />
            </>
          ) : (
            <TablesBrowser config={active} active={view === "browse"} />
          )}
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function defaultSqlFor(config: ConnectionConfig): string {
  if (config.engine === "sqlite") {
    return "SELECT name AS table_name\nFROM sqlite_master\nWHERE type = 'table' AND name NOT LIKE 'sqlite_%'\nORDER BY name;";
  }
  return "SELECT table_schema, table_name\nFROM information_schema.tables\nWHERE table_schema NOT IN ('pg_catalog', 'information_schema')\nORDER BY 1, 2\nLIMIT 50;";
}

import { useState } from "react";
import { Database } from "lucide-react";
import { ConnectionSidebar } from "@/components/ConnectionSidebar";
import { QueryEditor } from "@/components/QueryEditor";
import { ResultsViewer } from "@/components/ResultsViewer";
import { ToastStack, type Toast } from "@/components/Toast";
import {
  DEFAULT_CONNECTION,
  runQuery,
  testConnection,
  type ConnectionConfig,
  type QuerySuccess,
} from "@/lib/api";

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONNECTION);
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sql, setSql] = useState(
    "SELECT table_schema, table_name\nFROM information_schema.tables\nWHERE table_schema NOT IN ('pg_catalog', 'information_schema')\nORDER BY 1, 2\nLIMIT 50;",
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QuerySuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (type: Toast["type"], message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), type, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testConnection(config);
      if (res.ok) {
        setConnected(true);
        pushToast("success", "message" in res ? res.message : "Connected successfully");
      } else {
        setConnected(false);
        pushToast("error", res.error);
      }
    } catch (err) {
      setConnected(false);
      pushToast(
        "error",
        err instanceof Error ? err.message : "Failed to reach API server",
      );
    } finally {
      setTesting(false);
    }
  };

  const handleExecute = async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runQuery(config, sql);
      if (res.ok) {
        setConnected(true);
        setResult(res);
        setError(null);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel/90 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-white">
            <Database className="size-4" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-ink">
            Postgres Web Viewer
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span
            className={`size-2.5 rounded-full ${connected ? "bg-success" : "bg-danger"}`}
            aria-hidden
          />
          <span>{connected ? "Connected" : "Disconnected"}</span>
          <span className="text-line">·</span>
          <span className="font-mono">
            {config.username}@{config.host}:{config.port}/{config.database}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ConnectionSidebar
          config={config}
          onChange={(next) => {
            setConfig(next);
            setConnected(false);
          }}
          onTest={handleTest}
          testing={testing}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <QueryEditor
            value={sql}
            onChange={setSql}
            onExecute={handleExecute}
            running={running}
          />
          <ResultsViewer result={result} error={error} running={running} />
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

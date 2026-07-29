import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Loader2,
  PlugZap,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectionLabel,
  deleteConnection,
  listConnections,
  saveNamedConnection,
  type ConnectionConfig,
  type PostgresConfig,
  type SavedConnection,
  type SqliteConfig,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  config: ConnectionConfig;
  onChange: (config: ConnectionConfig) => void;
  onEngineChange: (engine: ConnectionConfig["engine"]) => void;
  onConnect: () => void;
  connecting: boolean;
  onSelectSaved: (saved: SavedConnection) => void;
};

export function ConnectionSidebar({
  config,
  onChange,
  onEngineChange,
  onConnect,
  connecting,
  onSelectSaved,
}: Props) {
  const [saved, setSaved] = useState<SavedConnection[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(true);

  const refreshSaved = async () => {
    try {
      const res = await listConnections();
      if (res.ok) setSaved(res.connections);
    } catch {
      // ponytail: sidebar still usable if history API is down
    }
  };

  useEffect(() => {
    void refreshSaved();
  }, []);

  const handleSave = async () => {
    const name =
      saveName.trim() ||
      (config.engine === "sqlite"
        ? config.path.split("/").pop() || "SQLite"
        : `${config.database}@${config.host}`);
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveNamedConnection(name, config);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSaveName("");
      await refreshSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteConnection(id);
    await refreshSaved();
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-line bg-panel/90 backdrop-blur-sm">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Connection</h2>
        <p className="mt-0.5 text-xs text-muted">
          PostgreSQL or local SQLite file
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <section className="border-b border-line">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-surface/60"
            onClick={() => setSavedOpen((open) => !open)}
            aria-expanded={savedOpen}
          >
            {savedOpen ? (
              <ChevronDown className="size-3.5 text-muted" />
            ) : (
              <ChevronRight className="size-3.5 text-muted" />
            )}
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Saved
            </h3>
            <span className="ml-auto text-[11px] text-muted">{saved.length}</span>
          </button>

          {savedOpen && (
            <div className="px-4 pb-3">
              {saved.length === 0 ? (
                <p className="text-xs text-muted">No saved connections yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {saved.map((item) => (
                    <li
                      key={item.id}
                      className="group flex cursor-pointer items-start gap-1 rounded-md border border-line bg-surface/50 px-2 py-1.5 hover:border-accent/40 hover:bg-accent/5"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        onClick={() => onSelectSaved(item)}
                        title={`Connect to ${connectionLabel(item.config)}`}
                      >
                        <div className="truncate text-sm font-medium text-ink">
                          {item.name}
                        </div>
                        <div className="truncate font-mono text-[11px] text-muted">
                          {item.engine === "sqlite" ? "SQLite" : "Postgres"} ·{" "}
                          {connectionLabel(item.config)}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer rounded p-1 text-muted opacity-70 hover:bg-danger-bg hover:text-danger hover:opacity-100"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => void handleDelete(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConnect();
          }}
        >
          <div className="flex rounded-md border border-line bg-surface/70 p-0.5">
            <EngineTab
              active={config.engine === "postgres"}
              onClick={() => onEngineChange("postgres")}
              label="PostgreSQL"
            />
            <EngineTab
              active={config.engine === "sqlite"}
              onClick={() => onEngineChange("sqlite")}
              label="SQLite"
            />
          </div>

          {config.engine === "postgres" ? (
            <PostgresFields
              config={config}
              onChange={(next) => onChange(next)}
            />
          ) : (
            <SqliteFields
              config={config}
              onChange={(next) => onChange(next)}
            />
          )}

          <div className="space-y-1.5 border-t border-line pt-3">
            <Label htmlFor="save-name">Save as</Label>
            <div className="flex gap-2">
              <Input
                id="save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Local Apptainer"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSave()}
                disabled={saving || (config.engine === "sqlite" && !config.path.trim())}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BookmarkPlus className="size-4" />
                )}
              </Button>
            </div>
            {saveError && <p className="text-xs text-danger">{saveError}</p>}
          </div>

          <div className="pt-1">
            <Button type="submit" className="w-full" disabled={connecting}>
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlugZap className="size-4" />
              )}
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </form>
      </div>
    </aside>
  );
}

function EngineTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 flex-1 cursor-pointer rounded px-2 text-xs font-medium transition-colors",
        active ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function PostgresFields({
  config,
  onChange,
}: {
  config: PostgresConfig;
  onChange: (config: PostgresConfig) => void;
}) {
  const set =
    (key: keyof Omit<PostgresConfig, "engine">) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (key === "port") {
        onChange({ ...config, port: Number(value) || 0 });
        return;
      }
      onChange({ ...config, [key]: value });
    };

  return (
    <>
      <Field label="Host" htmlFor="host">
        <Input id="host" value={config.host} onChange={set("host")} autoComplete="off" />
      </Field>
      <Field label="Port" htmlFor="port">
        <Input
          id="port"
          type="number"
          value={config.port}
          onChange={set("port")}
          autoComplete="off"
        />
      </Field>
      <Field label="Database" htmlFor="database">
        <Input
          id="database"
          value={config.database}
          onChange={set("database")}
          autoComplete="off"
        />
      </Field>
      <Field label="Username" htmlFor="username">
        <Input
          id="username"
          value={config.username}
          onChange={set("username")}
          autoComplete="username"
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          value={config.password}
          onChange={set("password")}
          autoComplete="current-password"
        />
      </Field>
    </>
  );
}

function SqliteFields({
  config,
  onChange,
}: {
  config: SqliteConfig;
  onChange: (config: SqliteConfig) => void;
}) {
  return (
    <Field label="File path" htmlFor="sqlite-path">
      <Input
        id="sqlite-path"
        value={config.path}
        onChange={(e) => onChange({ ...config, path: e.target.value })}
        placeholder="/path/to/database.sqlite"
        autoComplete="off"
      />
      <p className="pt-1 text-[11px] leading-snug text-muted">
        Absolute path to a SQLite file on the machine running the Bun server.
      </p>
    </Field>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

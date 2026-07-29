import type { ChangeEvent, ReactNode } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConnectionConfig } from "@/lib/api";

type Props = {
  config: ConnectionConfig;
  onChange: (config: ConnectionConfig) => void;
  onTest: () => void;
  testing: boolean;
};

export function ConnectionSidebar({ config, onChange, onTest, testing }: Props) {
  const set =
    (key: keyof ConnectionConfig) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (key === "port") {
        onChange({ ...config, port: Number(value) || 0 });
        return;
      }
      onChange({ ...config, [key]: value });
    };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-panel/90 backdrop-blur-sm">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Connection</h2>
        <p className="mt-0.5 text-xs text-muted">
          Local Apptainer / PostgreSQL defaults
        </p>
      </div>

      <form
        className="flex flex-1 flex-col gap-3 overflow-auto p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onTest();
        }}
      >
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

        <div className="mt-auto pt-2">
          <Button type="submit" className="w-full" disabled={testing}>
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlugZap className="size-4" />
            )}
            {testing ? "Testing…" : "Test Connection"}
          </Button>
        </div>
      </form>
    </aside>
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

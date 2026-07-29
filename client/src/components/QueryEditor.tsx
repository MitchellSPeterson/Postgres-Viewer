import { Loader2, Play, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  running: boolean;
  safeMode?: boolean;
};

export function QueryEditor({
  value,
  onChange,
  onExecute,
  running,
  safeMode = false,
}: Props) {
  return (
    <section className="flex h-[30%] min-h-[160px] flex-col border-b border-line bg-panel/70">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Query</h2>
          <p className="text-xs text-muted">
            Cmd/Ctrl + Enter to run
            {safeMode ? " · Safe Mode blocks writes" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {safeMode && (
            <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent">
              <Shield className="size-3" />
              Read-only
            </span>
          )}
          <Button onClick={onExecute} disabled={running || !value.trim()}>
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? "Executing…" : "Execute Query"}
          </Button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onExecute();
          }
        }}
        spellCheck={false}
        placeholder="SELECT * FROM information_schema.tables LIMIT 20;"
        className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-muted/50"
      />
    </section>
  );
}

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  running: boolean;
};

export function QueryEditor({ value, onChange, onExecute, running }: Props) {
  return (
    <section className="flex h-[30%] min-h-[180px] flex-col border-b border-line bg-panel/70">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Query</h2>
          <p className="text-xs text-muted">
            Cmd/Ctrl + Enter to run
          </p>
        </div>
        <Button onClick={onExecute} disabled={running || !value.trim()}>
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {running ? "Executing…" : "Execute Query"}
        </Button>
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

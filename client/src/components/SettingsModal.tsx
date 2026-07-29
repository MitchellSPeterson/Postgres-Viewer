import { useEffect } from "react";
import { Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppSettings } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onChange: (patch: Partial<AppSettings>) => void;
};

export function SettingsModal({ open, settings, onClose, onChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-ink/40"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-line bg-panel shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="settings-title" className="text-sm font-semibold text-ink">
            Settings
          </h2>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <ToggleRow
            label="Dark mode"
            description="Use a darker color scheme for the UI."
            checked={settings.darkMode}
            onChange={(darkMode) => onChange({ darkMode })}
          />
          <ToggleRow
            label="Safe Mode"
            description="Read-only: block INSERT, UPDATE, DELETE, DDL, and cell edits."
            checked={settings.safeMode}
            onChange={(safeMode) => onChange({ safeMode })}
            accent={settings.safeMode}
          />
          {settings.safeMode && (
            <div className="flex gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-ink">
              <Shield className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Safe Mode is enforced on the server. Write queries and browse cell edits will be rejected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  accent = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked
            ? accent
              ? "border-accent bg-accent"
              : "border-accent bg-accent"
            : "border-line bg-surface",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-panel shadow transition-transform",
            checked ? "left-6" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

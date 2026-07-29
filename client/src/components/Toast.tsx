import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type Toast = {
  id: number;
  type: "success" | "error";
  message: string;
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const success = toast.type === "success";

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm shadow-md",
        success
          ? "border-success/30 bg-success-bg text-success"
          : "border-danger/30 bg-danger-bg text-danger",
      )}
      role="status"
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" />
      )}
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        type="button"
        className="rounded p-0.5 opacity-70 hover:opacity-100"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

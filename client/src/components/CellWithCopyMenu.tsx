import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { copyRawCellValue } from "@/components/CellValue";
import { cn } from "@/lib/utils";

type MenuState = {
  x: number;
  y: number;
  value: unknown;
} | null;

type Props = {
  value: unknown;
  className?: string;
  children: ReactNode;
};

export function CellWithCopyMenu({ value, className, children }: Props) {
  const [menu, setMenu] = useState<MenuState>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
      setCopied(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        setCopied(false);
      }
    };
    const onScroll = () => {
      setMenu(null);
      setCopied(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  return (
    <>
      <div
        className={cn("min-w-0", className)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setCopied(false);
          setMenu({ x: event.clientX, y: event.clientY, value });
        }}
      >
        {children}
      </div>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-44 overflow-hidden rounded-md border border-line bg-panel py-1 shadow-lg"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 80),
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface"
            onClick={async () => {
              try {
                await copyRawCellValue(menu.value);
                setCopied(true);
                window.setTimeout(() => {
                  setMenu(null);
                  setCopied(false);
                }, 700);
              } catch {
                setMenu(null);
              }
            }}
          >
            {copied ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Copy className="size-3.5 text-muted" />
            )}
            {copied ? "Copied" : "Copy raw value"}
          </button>
        </div>
      )}
    </>
  );
}

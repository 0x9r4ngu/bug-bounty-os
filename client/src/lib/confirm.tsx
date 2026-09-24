import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button, Card } from "./ui";

export type ConfirmOpts = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

let impl: ((o: ConfirmOpts) => Promise<boolean>) | null = null;

/** Promise-based confirm usable from anywhere — replaces window.confirm. */
export function confirmDialog(o: ConfirmOpts | string): Promise<boolean> {
  const opts = typeof o === "string" ? { message: o } : o;
  if (impl) return impl(opts);
  return Promise.resolve(window.confirm(opts.message)); // SSR / not-mounted fallback
}

export function ConfirmHost() {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);

  useEffect(() => {
    impl = (opts) => new Promise((resolve) => setState({ opts, resolve }));
    return () => { impl = null; };
  }, []);

  const close = useCallback((v: boolean) => {
    setState((s) => { s?.resolve(v); return null; });
  }, []);

  useEffect(() => {
    if (!state) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [state, close]);

  if (!state) return null;
  const o = state.opts;
  const danger = o.danger !== false; // default to danger styling (most confirms are deletes)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6" onClick={() => close(false)}>
      <Card className="w-[420px] p-5 shadow-2xl anim-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${danger ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary"}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">{o.title ?? (danger ? "Confirm deletion" : "Please confirm")}</h2>
              <button onClick={() => close(false)} className="cursor-pointer text-faint hover:text-fg"><X size={16} /></button>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">{o.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => close(false)}>{o.cancelText ?? "Cancel"}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => close(true)} className={danger ? "bg-danger/15" : ""} autoFocus>
            {o.confirmText ?? (danger ? "Delete" : "Confirm")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

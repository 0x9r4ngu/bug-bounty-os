import { ReactNode } from "react";

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: "var(--color-crit)",
  High: "var(--color-high)",
  Medium: "var(--color-med)",
  Low: "var(--color-low)",
  Informational: "var(--color-info)",
};

export const STATUS_COLORS: Record<string, string> = {
  Potential: "#8a8168", Confirmed: "#b0743a", Submitted: "#b0743a",
  Triaged: "#b99a3e", Accepted: "#7c8850", Resolved: "#7c8850",
  Duplicate: "#8a8168", Rejected: "#cc3a63", Draft: "#8a8168",
  "In Progress": "#c96b2e", Ready: "#b99a3e", Archived: "#9a927a",
};

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-[var(--radius)] border border-border bg-surface ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ children, color, className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase leading-none tracking-wide ${className}`}
      style={color ? { background: `color-mix(in srgb, ${color} 15%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` } : { background: "var(--color-muted)", color: "var(--color-subtle)", border: "1px solid var(--color-border)" }}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ s }: { s: string }) {
  return <Badge color={SEVERITY_COLORS[s] ?? "#78716b"}>{s}</Badge>;
}
export function StatusBadge({ s }: { s: string }) {
  return <Badge color={STATUS_COLORS[s] ?? "#78716b"}>{s}</Badge>;
}

export function Button({ children, variant = "default", className = "", ...rest }: { children: ReactNode; variant?: "default" | "primary" | "ghost" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    default: "bg-surface2 hover:bg-[#efe3ca] text-fg border border-border hover:border-border-strong",
    primary: "bg-primary hover:brightness-110 text-[color:var(--color-primary-fg)] font-bold border border-transparent",
    ghost: "bg-transparent hover:bg-surface2 text-subtle hover:text-fg border border-transparent",
    danger: "bg-transparent hover:bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-danger border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]",
  }[variant];
  return (
    <button className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40 ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// Coerce only null -> "" (keeps controlled inputs from warning on null). Leaving
// `value` undefined lets callers use `defaultValue` (uncontrolled) without conflict.
export function Input({ value, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input value={value === null ? "" : value} {...props} className={`w-full rounded-[var(--radius)] border border-border bg-muted px-3 py-2 text-[13px] text-fg outline-none focus:border-primary transition-colors ${props.className ?? ""}`} />;
}
export function Textarea({ value, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea value={value === null ? "" : value} {...props} className={`w-full rounded-[var(--radius)] border border-border bg-muted px-3 py-2 text-[13px] text-fg outline-none focus:border-primary transition-colors ${props.className ?? ""}`} />;
}
export function Select({ children, value, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select value={value === null ? "" : value} {...props} className={`w-full rounded-[var(--radius)] border border-border bg-muted px-3 py-2 text-[13px] text-fg outline-none focus:border-primary transition-colors ${props.className ?? ""}`}>{children}</select>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="kicker flex items-center gap-2">
        <span className="text-primary" aria-hidden>▍</span>{children}
      </h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-center rounded-[var(--radius)] border border-dashed border-border py-10 font-mono text-[12px] text-faint">{children}</div>;
}

export function money(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}
export function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

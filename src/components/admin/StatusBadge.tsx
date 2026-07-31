import { cn } from "../../lib/utils";

const GREEN = ["approved", "hired", "shortlisted", "active"];
const RED = ["declined", "rejected", "inactive"];
const BLUE = ["contacted", "reviewing"];
// Anything else (pending, received, and arbitrary subject/category tags
// like "loan-inquiry") falls back to the ember treatment.

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toLowerCase();
  const scheme = GREEN.includes(key)
    ? { bg: "#DCFCE7", text: "#16A34A" }
    : RED.includes(key)
    ? { bg: "#FEE2E2", text: "#DC2626" }
    : BLUE.includes(key)
    ? { bg: "#DBEAFE", text: "#2563EB" }
    : { bg: "var(--color-ember-100)", text: "var(--color-ember-600)" };

  return (
    <span
      className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold")}
      style={{ backgroundColor: scheme.bg, color: scheme.text }}
    >
      {label ?? status}
    </span>
  );
}

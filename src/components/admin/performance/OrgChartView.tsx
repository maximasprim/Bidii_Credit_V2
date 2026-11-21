import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import StatusBadge from "../StatusBadge";
import type { OrgNode } from "../../../lib/performanceApi";
import { ORG_CHART_CSS } from "./orgChartStyles";

/*
  The reporting tree drawn as a chart: one card per person, lines down to their direct reports.
  A person whose reports are all "leaf" people (nobody reports to them) and who has more than three of them gets those reports
  stacked in a column instead of spread sideways, so a branch with 17 staff doesn't make the chart 4,000px wide.
*/

const STACK_FROM = 3;


function Person({ node, compact, expanded, onToggle }: { node: OrgNode; compact?: boolean; expanded?: boolean; onToggle?: () => void }) {
  const lead = node.children.length > 0;
  const sub = [node.role_name, node.level_label].filter(Boolean).join(" · ");
  return (
    <div className={`orgc-card ${lead ? "orgc-lead" : ""} ${compact ? "orgc-compact" : ""} ${node.is_active ? "" : "orgc-gone"}`}>
      <div className={`truncate text-sm font-semibold ${node.is_active ? "text-ink-900" : "text-ink-500 line-through"}`} title={node.full_name}>{node.full_name}</div>
      {sub && <div className="truncate text-xs text-ink-700" title={sub}>{sub}</div>}
      {node.unit_name && <div className="truncate text-xs text-ink-500" title={node.unit_name}>{node.unit_name}</div>}
      {node.status !== "active" && <div className="mt-1.5"><StatusBadge status={node.status} /></div>}
      {lead && onToggle && (
        <button type="button" className="orgc-toggle" aria-expanded={expanded} onClick={onToggle}
          aria-label={`${expanded ? "Hide" : "Show"} the ${node.children.length} ${node.children.length === 1 ? "person" : "people"} reporting to ${node.full_name}`}
          title={`${node.direct_reports} direct · ${node.total_reports} in total`}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{node.children.length}
        </button>
      )}
    </div>
  );
}

function Branch({ node, visible, open, toggle }: { node: OrgNode; visible: Set<string> | null; open: Set<string>; toggle: (id: string) => void }) {
  const kids = visible ? node.children.filter((c) => visible.has(c.id)) : node.children;
  const expanded = visible ? true : open.has(node.id);
  const showKids = kids.length > 0 && expanded;
  const stacked = showKids && kids.length > STACK_FROM && kids.every((c) => c.children.length === 0);
  return (
    <li>
      <Person node={node} expanded={expanded} onToggle={() => toggle(node.id)} />
      {showKids && (stacked ? (
        <ul className="orgc-stack">
          {kids.map((c) => <li key={c.id}><Person node={c} compact /></li>)}
        </ul>
      ) : (
        <ul className="orgc-row">
          {kids.map((c) => <Branch key={c.id} node={c} visible={visible} open={open} toggle={toggle} />)}
        </ul>
      ))}
    </li>
  );
}

function openByDefault(roots: OrgNode[]): Set<string> {
  const s = new Set<string>();
  const walk = (n: OrgNode, depth: number) => {
    if (n.children.length > 0 && depth < 2) s.add(n.id);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return s;
}

function everyLead(roots: OrgNode[]): Set<string> {
  const s = new Set<string>();
  const walk = (n: OrgNode) => {
    if (n.children.length > 0) s.add(n.id);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return s;
}

const smallBtn = "rounded-lg border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50";

export default function OrgChartView({ roots, visible }: { roots: OrgNode[]; visible: Set<string> | null }) {
  const [open, setOpen] = useState<Set<string>>(() => openByDefault(roots));
  const shown = useMemo(() => roots.filter((r) => !visible || visible.has(r.id)), [roots, visible]);
  const trees = shown.filter((r) => r.children.length > 0);
  const loose = shown.filter((r) => r.children.length === 0);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <style>{ORG_CHART_CSS}</style>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500">A blue top edge marks someone who leads a team. Use the number under their card to show or hide their team.</p>
        {!visible && (
          <div className="flex gap-2">
            <button type="button" className={smallBtn} onClick={() => setOpen(everyLead(roots))}>Expand all</button>
            <button type="button" className={smallBtn} onClick={() => setOpen(new Set())}>Collapse all</button>
          </div>
        )}
      </div>

      {trees.length > 0 && (
        <div className="overflow-x-auto pb-6" tabIndex={0} aria-label="Organisation chart">
          <div className="orgc mx-auto flex w-max items-start gap-10 px-2 pt-1">
            {trees.map((r) => (
              <ul key={r.id}>
                <Branch node={r} visible={visible} open={open} toggle={toggle} />
              </ul>
            ))}
          </div>
        </div>
      )}

      {loose.length > 0 && (
        <div className={trees.length > 0 ? "mt-4 border-t border-mist-200 pt-4" : ""}>
          <h3 className="font-display text-sm font-bold text-ink-900">Not in the reporting tree yet</h3>
          <p className="mb-3 text-xs text-ink-500">These people have no line manager and no one reports to them. Set a manager for each, or use "Place people in the structure" above.</p>
          <div className="orgc flex flex-wrap gap-2">
            {loose.map((p) => <Person key={p.id} node={p} compact />)}
          </div>
        </div>
      )}
    </div>
  );
}

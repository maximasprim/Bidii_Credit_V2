import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CornerLeftUp, Search, X } from "lucide-react";
import StatusBadge from "../StatusBadge";
import { getOrgStructure, type OrgStructure } from "../../../lib/performanceApi";
import {
  STACK_FROM, aboveChain, ancestorsOf, buildTree, chainOf, defaultOpen, everyParent, type ChartNode, type ChartTree, type Lens,
} from "../../../lib/orgStructure";
import { ORG_CHART_CSS } from "./orgChartStyles";

/*
  Two ways to follow the chain of command, both built from the same people:
    Leadership   Board > Directors > CEO > departments > down to individual staff
    Regions      Head Office > regions > branches > the people in each
  Pick anyone (click a card, or search) to light up the line of people they report up through.
*/

const LENSES: { key: Lens; label: string; blurb: string; openDepth: number }[] = [
  { key: "leadership", label: "Leadership and departments", openDepth: 4, blurb: "The Board and Directors at the top, then the CEO, then each department and the people who report up to its head." },
  { key: "regions", label: "Regions and branches", openDepth: 3, blurb: "Head Office at the top, then each region, each branch in it, and the people in that branch." },
];

type Ui = {
  open: Set<string>; toggle: (id: string) => void; selected: string | null; chain: Set<string>;
  select: (personId: string) => void; // clicking a card: pick them, or clear if they're already picked
  pick: (personId: string) => void; // always pick them
};

const smallBtn = "rounded-lg border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50";

function PersonCard({ node, ui, compact }: { node: ChartNode; ui: Ui; compact?: boolean }) {
  const p = node.person!;
  const lead = node.children.length > 0;
  const expanded = ui.open.has(node.id);
  const cls = ["orgc-card", "orgc-pick", lead ? "orgc-lead" : "", compact ? "orgc-compact" : "", p.is_active ? "" : "orgc-gone", node.copy ? "orgc-copy" : "",
    ui.chain.has(p.id) ? "orgs-chain" : "", ui.selected === p.id ? "orgs-selected" : ""].filter(Boolean).join(" ");
  return (
    <div id={`orgs-${node.id}`} className={cls} role="button" tabIndex={0} aria-pressed={ui.selected === p.id}
      aria-label={`${p.full_name}${node.sub ? `, ${node.sub}` : ""}${node.note ? `, ${node.note}` : ""}. Show who they report to.`}
      onClick={() => ui.select(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ui.select(p.id); } }}>
      <div className={`truncate text-sm font-semibold ${p.is_active ? "text-ink-900" : "text-ink-500 line-through"}`} title={node.title}>{node.title}</div>
      {node.sub && <div className="truncate text-xs text-ink-700" title={node.sub}>{node.sub}</div>}
      {node.detail && <div className="truncate text-xs text-ink-500" title={node.detail}>{node.detail}</div>}
      {node.note && <div className="mt-0.5 truncate text-xs font-medium text-ink-700" title={node.note}>{node.note}</div>}
      {node.reportsTo && <div className="mt-1 flex items-center gap-1 truncate text-xs text-ink-500" title={`Reports to ${node.reportsTo}`}><CornerLeftUp size={11} className="shrink-0" aria-hidden="true" />{node.reportsTo}</div>}
      {p.status !== "active" && <div className="mt-1.5"><StatusBadge status={p.status} /></div>}
      {lead && <Toggle node={node} expanded={expanded} ui={ui} />}
    </div>
  );
}

function Toggle({ node, expanded, ui }: { node: ChartNode; expanded: boolean; ui: Ui }) {
  const n = node.children.length;
  return (
    <button type="button" className="orgc-toggle" aria-expanded={expanded}
      aria-label={`${expanded ? "Hide" : "Show"} ${n} ${n === 1 ? "item" : "items"} under ${node.title}`}
      onClick={(e) => { e.stopPropagation(); ui.toggle(node.id); }}>
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{n}
    </button>
  );
}

function GroupCard({ node, ui }: { node: ChartNode; ui: Ui }) {
  const expanded = ui.open.has(node.id);
  const members = node.members ?? [];
  return (
    <div id={`orgs-${node.id}`} className={`orgc-group k-${node.groupKind}`}>
      <div className="orgc-group-head">
        {node.label && <div className="text-[11px] opacity-80">{node.label}</div>}
        <div className="truncate font-display text-sm font-bold" title={node.title}>{node.title}</div>
      </div>
      <div className="orgc-group-body space-y-1 text-xs">
        {node.led && <div className="text-ink-700">{node.led}</div>}
        {node.reportsTo && <div className="flex items-center gap-1 text-ink-500"><CornerLeftUp size={11} className="shrink-0" aria-hidden="true" />Reports to {node.reportsTo}</div>}
        {members.length > 0 && (
          <ul className="space-y-0.5">
            {members.slice(0, 8).map((m) => (
              <li key={m.id}>
                <button type="button" className={`text-left hover:underline ${ui.selected === m.id ? "font-semibold text-ink-900" : "text-ink-700"}`} onClick={() => ui.pick(m.id)}>
                  {m.name}{m.role && <span className="text-ink-500"> · {m.role}</span>}
                </button>
              </li>
            ))}
            {members.length > 8 && <li className="text-ink-500">+{members.length - 8} more</li>}
          </ul>
        )}
        {node.groupKind !== "bundle" && <div className="text-ink-500">{node.people} {node.people === 1 ? "person" : "people"}</div>}
      </div>
      {node.children.length > 0 && <Toggle node={node} expanded={expanded} ui={ui} />}
    </div>
  );
}

function Branch({ node, ui }: { node: ChartNode; ui: Ui }) {
  const expanded = ui.open.has(node.id);
  const kids = node.children;
  const showKids = kids.length > 0 && expanded;
  const stacked = showKids && kids.length > STACK_FROM && kids.every((c) => c.kind === "person" && c.children.length === 0);
  return (
    <li>
      {node.kind === "person" ? <PersonCard node={node} ui={ui} /> : <GroupCard node={node} ui={ui} />}
      {showKids && (stacked ? (
        <ul className="orgc-stack">{kids.map((c) => <li key={c.id}><PersonCard node={c} ui={ui} compact /></li>)}</ul>
      ) : (
        <ul className="orgc-row">{kids.map((c) => <Branch key={c.id} node={c} ui={ui} />)}</ul>
      ))}
    </li>
  );
}

function Forest({ roots, ui, label }: { roots: ChartNode[]; ui: Ui; label: string }) {
  return (
    <div className="overflow-x-auto pb-6" tabIndex={0} aria-label={label}>
      <div className="orgc mx-auto flex w-max items-start gap-10 px-2 pt-1">
        {roots.map((r) => <ul key={r.id}><Branch node={r} ui={ui} /></ul>)}
      </div>
    </div>
  );
}

/** `initialData` (optional) is the structure for reloadKey 0 / people who have left hidden, already fetched by the page, so it shows at once. */
export default function OrgStructureView({ reloadKey, includeInactive, initialData }: { reloadKey: number; includeInactive: boolean; initialData?: OrgStructure | null }) {
  const [data, setData] = useState<OrgStructure | null>(initialData ?? null);
  const have = useRef(initialData ? "false|0" : "");
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>(() => {
    try { return localStorage.getItem("bidii-org-lens") === "regions" ? "regions" : "leadership"; } catch { return "leadership"; }
  });
  const [openBy, setOpenBy] = useState<Partial<Record<Lens, Set<string>>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const key = `${includeInactive}|${reloadKey}`;
    if (have.current === key) return; // already holding exactly this
    let cancelled = false;
    getOrgStructure(includeInactive)
      .then((d) => { if (!cancelled) { have.current = key; setData(d); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "The structure couldn't be loaded."); });
    return () => { cancelled = true; };
  }, [reloadKey, includeInactive]);

  const tree: ChartTree | null = useMemo(() => (data ? buildTree(data, lens) : null), [data, lens]);
  const meta = LENSES.find((l) => l.key === lens)!;
  const open = useMemo(() => openBy[lens] ?? (tree ? defaultOpen(tree, meta.openDepth) : new Set<string>()), [openBy, lens, tree, meta.openDepth]);

  const setOpen = useCallback((next: Set<string>) => setOpenBy((prev) => ({ ...prev, [lens]: next })), [lens]);
  const toggle = useCallback((id: string) => { const next = new Set(open); if (next.has(id)) next.delete(id); else next.add(id); setOpen(next); }, [open, setOpen]);

  const chain = useMemo(() => (data && selected ? chainOf(data, selected) : []), [data, selected]);
  const chainIds = useMemo(() => new Set(chain.map((p) => p.id)), [chain]);

  const pick = useCallback((personId: string) => {
    setSelected(personId);
    const up = tree ? [...tree.roots, ...(tree.aside ? [tree.aside] : [])] : [];
    const trail = ancestorsOf(up, `p:${personId}`);
    if (trail) setOpen(new Set([...open, ...trail]));
  }, [tree, open, setOpen]);
  const select = useCallback((personId: string) => (personId === selected ? setSelected(null) : pick(personId)), [selected, pick]);

  useEffect(() => {
    if (!selected) return;
    const el = document.getElementById(`orgs-p:${selected}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [selected, lens]);

  function chooseLens(l: Lens) {
    if (data && selected) {
      // keep the picked person in view in the other lens: open the path down to them there
      const next = buildTree(data, l);
      const trail = ancestorsOf([...next.roots, ...(next.aside ? [next.aside] : [])], `p:${selected}`);
      if (trail) setOpenBy((prev) => ({ ...prev, [l]: new Set([...(prev[l] ?? defaultOpen(next, LENSES.find((x) => x.key === l)!.openDepth)), ...trail]) }));
    }
    setLens(l);
    try { localStorage.setItem("bidii-org-lens", l); } catch { /* the choice just won't be remembered */ }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || q.length < 2) return [];
    return data.people.filter((p) => p.full_name.toLowerCase().includes(q) || (p.role_name ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [data, query]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!data || !tree) return <p className="text-sm text-ink-500">Loading the structure…</p>;
  if (data.people.length === 0) return <p className="text-sm text-ink-500">No one is in the structure yet.</p>;

  const ui: Ui = { open, toggle, selected, chain: chainIds, select, pick };
  const top = chain[chain.length - 1];
  const above = aboveChain(data, top);

  return (
    <div>
      <style>{ORG_CHART_CSS}</style>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Which structure" className="inline-flex rounded-lg border border-mist-200 p-0.5">
          {LENSES.map((l) => (
            <button key={l.key} type="button" aria-pressed={lens === l.key} onClick={() => chooseLens(l.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${lens === l.key ? "bg-navy-800 text-white" : "text-ink-700 hover:bg-mist-50"}`}>{l.label}</button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input aria-label="Find a person to trace their chain of command" placeholder="Find a person…" value={query} onChange={(e) => setQuery(e.target.value)}
            className="w-56 rounded-lg border border-mist-200 bg-surface py-2 pl-8 pr-2.5 text-sm text-ink-700 focus:border-ember-500 focus:outline-none focus:ring-2 focus:ring-ember-500/30" />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-72 overflow-hidden rounded-lg border border-mist-200 bg-surface shadow-lg">
              {matches.map((m) => (
                <li key={m.id}>
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-mist-50" onClick={() => { pick(m.id); setQuery(""); }}>
                    <span className="font-semibold text-ink-900">{m.full_name}</span>
                    <span className="block text-xs text-ink-500">{m.role_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className={smallBtn} onClick={() => setOpen(everyParent(tree))}>Expand all</button>
          <button type="button" className={smallBtn} onClick={() => setOpen(new Set())}>Collapse all</button>
        </div>
      </div>
      <p className="mb-3 text-xs text-ink-500">{meta.blurb} Click anyone to see who they report up to.</p>

      {chain.length > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-ember-400 bg-ember-100 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-ink-700">Chain of command for <span className="font-semibold text-ink-900">{chain[0].full_name}</span>. Each person reports to the next.</p>
            <button type="button" className="shrink-0 rounded-md p-1 text-ink-700 hover:bg-surface" aria-label="Clear the chain of command" onClick={() => setSelected(null)}><X size={14} /></button>
          </div>
          <ol className="mt-2 flex flex-wrap items-center gap-1.5">
            {chain.map((p, i) => (
              <li key={p.id} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} className="text-ink-500" aria-hidden="true" />}
                <button type="button" className="rounded-lg border border-mist-200 bg-surface px-2.5 py-1 text-left text-xs hover:bg-mist-50" onClick={() => pick(p.id)}>
                  <span className="font-semibold text-ink-900">{p.full_name}</span>{p.role_name && <span className="text-ink-500"> · {p.role_name}</span>}
                </button>
              </li>
            ))}
            {above.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <ChevronRight size={14} className="text-ink-500" aria-hidden="true" />
                <span className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-semibold text-white">{a}</span>
              </li>
            ))}
          </ol>
          {chain.length === 1 && above.length === 0 && <p className="mt-2 text-xs text-ink-500">Nobody is recorded above this person.</p>}
        </div>
      )}

      <Forest roots={tree.roots} ui={ui} label={meta.label} />

      {tree.aside && (
        <div className="mt-2 border-t border-mist-200 pt-4">
          <p className="mb-3 text-xs text-ink-500">
            {lens === "leadership" ? "These people have no line manager recorded, so they can't be placed under anyone yet. Set their manager, or use \"Place people in the structure\" above."
              : "These people aren't in a branch, team or head office unit yet. Assign them a unit, or use \"Place people in the structure\" above."}
          </p>
          <Forest roots={[tree.aside]} ui={ui} label="People who still need placing" />
        </div>
      )}
    </div>
  );
}

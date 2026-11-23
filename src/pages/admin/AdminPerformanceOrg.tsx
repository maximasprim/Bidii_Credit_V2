import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import { getCurrentAdminRole } from "../../lib/adminApi";
import StatusBadge from "../../components/admin/StatusBadge";
import OrgEditor, { type OrgEditorInitial } from "../../components/admin/performance/OrgEditor";
import OrgChartView from "../../components/admin/performance/OrgChartView";
import OrgStructureView from "../../components/admin/performance/OrgStructureView";
import {
  applySetup,
  getOrgHealth,
  getOrgLayout,
  getOrgStructure,
  getOrgTree,
  getSetupPreview,
  getStaff,
  getUnitDuplicates,
  type OrgHealth,
  type OrgIssue,
  type OrgNode,
  type OrgStructure,
  type SetupPreview,
  type SetupResult,
} from "../../lib/performanceApi";

const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";

/** The ids of nodes that match `q`, plus every ancestor, so a match is always shown in context. */
function visibleIds(roots: OrgNode[], q: string): Set<string> | null {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  const keep = new Set<string>();
  const walk = (n: OrgNode): boolean => {
    const own = [n.full_name, n.role_name, n.level_label, n.unit_name].some((v) => v?.toLowerCase().includes(needle));
    const kids = n.children.map(walk).some(Boolean);
    if (own || kids) keep.add(n.id);
    return own || kids;
  };
  roots.forEach(walk);
  return keep;
}

function TreeNode({ node, visible, depth }: { node: OrgNode; visible: Set<string> | null; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (visible && !visible.has(node.id)) return null;
  const expanded = visible ? true : open;
  const hasKids = node.children.length > 0;
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-mist-50">
        {hasKids ? (
          <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${node.full_name}`} onClick={() => setOpen((o) => !o)} className="rounded p-0.5 text-ink-500">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}
        <span className={`text-sm font-semibold ${node.is_active ? "text-ink-900" : "text-ink-400 line-through"}`}>{node.full_name}</span>
        <span className="text-xs text-ink-500">
          {[node.role_name, node.level_label, node.unit_name].filter(Boolean).join(" · ")}
        </span>
        {node.status !== "active" && <StatusBadge status={node.status} />}
        {hasKids && <span className="text-xs text-ink-400">{node.direct_reports} direct · {node.total_reports} total</span>}
      </div>
      {hasKids && expanded && (
        <ul className="ml-4 border-l border-mist-200 pl-3">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} visible={visible} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

const SEVERITY_ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const SEVERITY_CLASS = { error: "text-red-600", warning: "text-amber-700", info: "text-ink-500" } as const;

function Health({ health }: { health: OrgHealth }) {
  const order: OrgIssue["severity"][] = ["error", "warning", "info"];
  return (
    <section className={card}>
      <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Structure health</h2>
      <p className="mb-3 text-xs text-ink-500">
        {health.counts.error ?? 0} errors · {health.counts.warning ?? 0} warnings · {health.counts.info ?? 0} notes. Errors make results wrong; warnings mean the structure is incomplete.
      </p>
      {health.issues.length === 0 ? (
        <p className="text-sm text-green-700">Nothing to fix.</p>
      ) : (
        <ul className="space-y-1.5">
          {order.flatMap((sev) =>
            health.issues.filter((i) => i.severity === sev).map((i, idx) => {
              const Icon = SEVERITY_ICON[sev];
              return (
                <li key={`${sev}-${idx}`} className={`flex items-start gap-2 text-sm ${SEVERITY_CLASS[sev]}`}>
                  <Icon size={15} className="mt-0.5 shrink-0" aria-label={sev} />
                  <span className="text-ink-700">{i.message}</span>
                </li>
              );
            }),
          )}
        </ul>
      )}
    </section>
  );
}

function Setup() {
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => new Map(preview?.branches.map((b) => [b.branch_id, b.name]) ?? []), [preview]);

  async function load() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setConfirmed(false);
      setPreview(await getSetupPreview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the proposal.");
    } finally {
      setBusy(false);
    }
  }
  // A structure already exists when any branch has a unit or any proposed region is already there.
  const hasStructure = !!preview && (preview.branches.some((b) => b.unit_id) || preview.regions.some((r) => r.exists));
  async function apply() {
    if (!preview) return;
    if (hasStructure && !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await applySetup(preview.regions));
      setPreview(null);
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply the setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Set up branches and regions</h2>
      <p className="mb-3 text-xs text-ink-500">
        Creates a performance unit for every branch on the website's branch list (the list itself is never changed), adds Head Office, Check-off and Debt Collection teams,
        and groups the branches into regions. Safe to run again; it never moves a branch that is already in a region.
      </p>
      {!preview && (
        <button type="button" className={btn} disabled={busy} onClick={() => void load()}>
          Show the proposal
        </button>
      )}
      {preview && (
        <div className="space-y-3">
          {preview.regions.map((r) => (
            <div key={r.name}>
              <h3 className="text-sm font-semibold text-ink-900">{r.name}{r.exists ? " (already exists)" : ""}</h3>
              <p className="text-xs text-ink-500">{r.branch_ids.map((id) => names.get(id) ?? id).join(", ") || "No branches matched"}</p>
            </div>
          ))}
          <p className="text-xs text-ink-500">
            Teams: {preview.extra_units.map((u) => `${u.name}${u.exists ? " (exists)" : ""}`).join(", ")}. Branches not placed in a region: {preview.branches.filter((b) => !b.proposed_region).map((b) => b.name).join(", ") || "none"}.
          </p>
          {preview.unmatched.length > 0 && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              These proposed branches weren't found on the branch list, so they're left out: {preview.unmatched.join(", ")}.
            </p>
          )}
          {hasStructure && (
            <label role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>
                A structure already exists. Applying adds only what is missing: it never deletes or moves a unit, region or branch that is already placed,
                and anything that would have to move is listed as a conflict instead. Tick to confirm you want to apply this over your current setup.
              </span>
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={busy || (hasStructure && !confirmed)} onClick={() => void apply()}>Apply this setup</button>
            <button type="button" className={btn} disabled={busy} onClick={() => { setPreview(null); setConfirmed(false); }}>Cancel</button>
          </div>
        </div>
      )}
      {result && (
        <p role="status" className="mt-3 text-sm text-green-700">
          Done: {result.units_created} units created, {result.units_linked} linked, {result.regions_created} regions created, {result.links_created} branches placed.
          {result.conflicts.length > 0 && <span className="block text-amber-800">{result.conflicts.join(" ")}</span>}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

type View = "list" | "chart" | "structure";
const VIEWS: [View, string][] = [["list", "List"], ["chart", "Chart"], ["structure", "Structure"]];

type OrgTreeData = Awaited<ReturnType<typeof getOrgTree>>;
/** Everything the page needs for its first paint, fetched together. A part that fails is simply absent and loads itself the way it always did. */
type Boot = {
  tree: OrgTreeData | null;
  health: OrgHealth | null;
  structure: OrgStructure | null;
  editor: OrgEditorInitial;
};

const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);

/** Fetches every part of the page at once and shows the page only when they have all arrived (or failed), so nothing pops in afterwards. */
export default function AdminPerformanceOrg() {
  usePageMeta("Organisation chart");
  const role = getCurrentAdminRole();
  const isAdmin = role === "admin";
  const canSeeHealth = isAdmin || role === "hr";
  const [boot, setBoot] = useState<Boot | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      getOrgTree(false),
      canSeeHealth ? getOrgHealth() : Promise.resolve(null),
      getOrgStructure(false),
      canSeeHealth ? getOrgLayout() : Promise.resolve(null),
      canSeeHealth ? getStaff() : Promise.resolve(null),
      isAdmin ? getUnitDuplicates() : Promise.resolve(null),
    ]).then(([tree, health, structure, layout, staff, dups]) => {
      if (cancelled) return;
      const staffList = ok(staff);
      const dupList = ok(dups);
      setBoot({
        tree: ok(tree),
        health: ok(health),
        structure: ok(structure),
        editor: {
          layout: ok(layout),
          staff: staffList ? staffList.items.map((s) => ({ id: s.id, full_name: s.full_name })) : null,
          dups: dupList ? dupList.pairs : null,
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [canSeeHealth, isAdmin]);

  if (!boot) {
    return (
      <div className="space-y-6">
        <div>
          <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
          <h1 className="font-display text-lg font-bold" style={heading}>Organisation chart</h1>
        </div>
        <p role="status" className="text-sm text-ink-500">Loading the organisation…</p>
      </div>
    );
  }
  return <OrgPage boot={boot} />;
}

function OrgPage({ boot }: { boot: Boot }) {
  const role = getCurrentAdminRole();
  const isAdmin = role === "admin";
  const canSeeHealth = isAdmin || role === "hr";
  const [roots, setRoots] = useState<OrgNode[]>(boot.tree?.roots ?? []);
  const [total, setTotal] = useState(boot.tree?.total ?? 0);
  const [health, setHealth] = useState<OrgHealth | null>(boot.health);
  const haveTree = useRef(boot.tree ? "false|0" : "");
  const [q, setQ] = useState("");
  const [inactive, setInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!boot.tree);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem("bidii-org-view");
      return saved === "chart" || saved === "structure" ? saved : "list";
    } catch { return "list"; }
  });
  function changeView(v: View) {
    setView(v);
    try { localStorage.setItem("bidii-org-view", v); } catch { /* storage unavailable: the choice just won't be remembered */ }
  }

  useEffect(() => {
    const key = `${inactive}|${reload}`;
    if (haveTree.current === key) return; // the page already holds exactly this
    let cancelled = false;
    getOrgTree(inactive)
      .then((t) => {
        if (cancelled) return;
        haveTree.current = key;
        setRoots(t.roots);
        setTotal(t.total);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the organisation chart.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inactive, reload]);

  useEffect(() => {
    if (!canSeeHealth || boot.health) return;
    let cancelled = false;
    getOrgHealth()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canSeeHealth, boot.health]);

  const visible = useMemo(() => visibleIds(roots, q), [roots, q]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Organisation chart</h1>
        <p className="text-sm text-ink-500">Who reports to whom. You see your own part of the organisation.</p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {canSeeHealth && <OrgEditor canWrite={isAdmin} canPlace={canSeeHealth} onChanged={() => setReload((n) => n + 1)} initial={boot.editor} />}

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="How to show the organisation" className="inline-flex rounded-lg border border-mist-200 p-0.5">
            {VIEWS.map(([v, label]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => changeView(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === v ? "bg-navy-800 text-white" : "text-ink-700 hover:bg-mist-50"}`}>
                {label}
              </button>
            ))}
          </div>
          {view !== "structure" && (
            <input aria-label="Search the chart" placeholder="Search by name, role, level or branch" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[220px] flex-1 rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none" />
          )}
          <label className="flex items-center gap-2 text-xs text-ink-500">
            <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Show people who have left
          </label>
          <span className="text-xs text-ink-400">{total} people</span>
        </div>
        {view === "structure" ? (
          <OrgStructureView reloadKey={reload} includeInactive={inactive} initialData={boot.structure} />
        ) : loading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : roots.length === 0 ? (
          <p className="text-sm text-ink-500">No one to show yet. Add staff profiles and assign their managers.</p>
        ) : visible && visible.size === 0 ? (
          <p className="text-sm text-ink-500">No one matches that search.</p>
        ) : view === "chart" ? (
          <OrgChartView roots={roots} visible={visible} />
        ) : (
          <ul>
            {roots.map((r) => (
              <TreeNode key={r.id} node={r} visible={visible} depth={0} />
            ))}
          </ul>
        )}
      </section>

      {health && <Health health={health} />}
      {isAdmin && <Setup />}
    </div>
  );
}

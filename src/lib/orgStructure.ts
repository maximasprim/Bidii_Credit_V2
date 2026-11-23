import type { OrgStructure, StructPerson, StructUnit } from "./performanceApi";

/*
  Turns the flat people / units / regions into the two chain-of-command trees:

    Leadership   Board > Directors > CEO > departments > the people under each department head, down to individual staff
    Regions      Head Office > regions > branches (and teams) > the people in each, following who reports to whom

  Nothing here talks to the server, so it can be tested on its own.
*/

export type Tier = "board" | "director" | "ceo" | "staff";
export type GroupKind = "board" | "directors" | "hq" | "region" | "department" | "unit" | "bundle" | "unplaced";
export type Lens = "leadership" | "regions";

export type ChartNode = {
  id: string; // unique in the chart: "p:<profile id>" for people, "g:..." for groups
  kind: "person" | "group";
  person?: StructPerson;
  groupKind?: GroupKind;
  title: string;
  label?: string; // the small kind label on a group card: "Region", "Branch"...
  sub?: string; // person: role · level
  detail?: string; // person: unit
  led?: string; // group: "Regional manager: Mary Njeri"
  reportsTo?: string; // who this card's person (or group lead) reports to, when the card above is not their manager
  members?: { id: string; name: string; role: string | null }[]; // board / directors tiers
  note?: string; // person: "Also covers Thika, Ruiru" (or "Main unit: Karatina" on a copy)
  copy?: boolean; // person: a second card for someone who covers more than one branch (the first card is their main unit)
  people: number; // distinct people in or under this node
  children: ChartNode[];
};

export type ChartTree = { roots: ChartNode[]; aside: ChartNode | null };

/** More than this many reports, all of them leaves, are stacked in a column instead of spread sideways. */
export const STACK_FROM = 3;

const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Where someone sits above the departments. Driven by the role's department ("Board", "Directors") or its name, so no new setting is needed. */
export function tierOf(p: StructPerson): Tier {
  const key = lc(p.role_key), name = lc(p.role_name), dept = lc(p.department);
  if (key === "ceo" || /chief executive|managing director/.test(name)) return "ceo";
  if (/^board/.test(dept) || /^board\b|\bchair(man|woman|person)?$/.test(name) || key.startsWith("board")) return "board";
  if (/^directors?\b/.test(dept) || /^(executive |non-executive |independent )?director\b/.test(name) || key.startsWith("director")) return "director";
  return "staff";
}

export const kindLabel = (kind: string) => (kind === "head_office" ? "Head office" : kind === "team" ? "Team" : "Branch");

type Ctx = { byId: Map<string, StructPerson>; kids: Map<string, StructPerson[]>; tier: Map<string, Tier>; unitName: Map<string, string>; units: Map<string, StructUnit> };

function index(data: OrgStructure): Ctx {
  const byId = new Map(data.people.map((p) => [p.id, p]));
  const kids = new Map<string, StructPerson[]>();
  for (const p of [...data.people].sort((a, b) => a.full_name.localeCompare(b.full_name))) {
    if (p.manager_id && byId.has(p.manager_id)) kids.set(p.manager_id, [...(kids.get(p.manager_id) ?? []), p]);
  }
  return { byId, kids, tier: new Map(data.people.map((p) => [p.id, tierOf(p)])), unitName: new Map(data.units.map((u) => [u.id, u.name])), units: new Map(data.units.map((u) => [u.id, u])) };
}

const name = (ctx: Ctx, id: string | null | undefined) => (id ? ctx.byId.get(id)?.full_name : undefined);
/** "Thika" for "Thika Debt Collection": the branch a unit sits under, else its own name. */
const shortUnit = (ctx: Ctx, id: string) => {
  const u = ctx.units.get(id);
  const parent = u?.parent_unit_id ? ctx.units.get(u.parent_unit_id) : undefined;
  return parent?.name ?? u?.name ?? "another unit";
};
const coverNote = (ctx: Ctx, p: StructPerson) => {
  const names = (p.covers ?? []).filter((id) => id !== p.unit_id && ctx.units.has(id)).map((id) => shortUnit(ctx, id));
  return names.length ? `Also covers ${names.join(", ")}` : undefined;
};
const roleOf = (p: StructPerson) => [p.role_name, p.level_label].filter(Boolean).join(" · ");

/** One person and, recursively, everyone who reports to them (optionally only those inside `within`). A reporting loop is cut, never followed. */
function personNode(ctx: Ctx, p: StructPerson, seen: Set<string>, opts: { within?: Set<string>; showUnit?: boolean } = {}): ChartNode {
  seen.add(p.id);
  const children = (ctx.kids.get(p.id) ?? [])
    .filter((c) => !seen.has(c.id) && (!opts.within || opts.within.has(c.id)) && ctx.tier.get(c.id) === "staff")
    .map((c) => personNode(ctx, c, seen, opts));
  return {
    id: `p:${p.id}`, kind: "person", person: p, title: p.full_name, sub: roleOf(p) || undefined,
    detail: opts.showUnit && p.unit_id ? ctx.unitName.get(p.unit_id) : undefined, note: coverNote(ctx, p), people: 1 + children.reduce((n, c) => n + c.people, 0), children,
  };
}

/** Lots of leaf reports next to a few real sub-teams would make a very wide row: gather the leaves into one "also reporting to" block. */
function tidy(node: ChartNode): void {
  node.children.forEach(tidy);
  const leaves = node.children.filter((c) => c.kind === "person" && c.children.length === 0);
  if (leaves.length > STACK_FROM && leaves.length < node.children.length) {
    const bundle: ChartNode = {
      id: `g:bundle:${node.id}`, kind: "group", groupKind: "bundle", label: `${leaves.length} people`,
      title: node.kind === "person" ? `Also reporting to ${node.title}` : "Others", people: leaves.length, children: leaves,
    };
    node.children = [...node.children.filter((c) => !leaves.includes(c)), bundle];
  }
}

/** People are counted once however many cards they have (someone covering three branches is one person in the region's total). */
function recount(node: ChartNode): Set<string> {
  const ids = new Set<string>();
  if (node.kind === "person" && node.person) ids.add(node.person.id);
  node.members?.forEach((m) => ids.add(m.id));
  node.children.forEach((c) => recount(c).forEach((i) => ids.add(i)));
  node.people = ids.size;
  return ids;
}

const finish = (roots: ChartNode[]) => { roots.forEach(tidy); roots.forEach(recount); };

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const member = (p: StructPerson) => ({ id: p.id, name: p.full_name, role: p.role_name });

// ---- Leadership: Board > Directors > CEO > departments > people ------------------------------------------------

export function buildLeadership(data: OrgStructure): ChartTree {
  const ctx = index(data);
  const of = (t: Tier) => data.people.filter((p) => ctx.tier.get(p.id) === t).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const board = of("board"), directors = of("director"), ceos = of("ceo");
  const staff = of("staff");
  const seen = new Set<string>();

  const asHead = (p: StructPerson, boss: StructPerson | undefined): ChartNode => {
    const n = personNode(ctx, p, seen, { showUnit: true });
    if (boss) n.reportsTo = boss.full_name;
    return n;
  };
  const deptGroups = (heads: StructPerson[], boss: StructPerson | undefined, owner: string): ChartNode[] =>
    groupBy(heads, (h) => h.department?.trim() || "Other").map(([dept, hs]) => ({
      id: `g:dept:${owner}:${dept}`, kind: "group" as const, groupKind: "department" as const, label: "Department", title: dept,
      people: 0, children: hs.map((h) => asHead(h, boss)),
    }));

  const ceoNodes: ChartNode[] = ceos.map((c) => {
    seen.add(c.id);
    const heads = (ctx.kids.get(c.id) ?? []).filter((k) => ctx.tier.get(k.id) === "staff");
    return { id: `p:${c.id}`, kind: "person", person: c, title: c.full_name, sub: roleOf(c) || undefined, people: 0, children: deptGroups(heads, c, c.id) };
  });

  const aboveCeo = [...board, ...directors];
  const staffManagedByBoard = staff.filter((p) => p.manager_id && aboveCeo.some((b) => b.id === p.manager_id));
  const boardReports: ChartNode | null = staffManagedByBoard.length
    ? {
        id: "g:board-reports", kind: "group", groupKind: "department", label: "Reports to", title: directors.length ? "The Directors" : "The Board", people: 0,
        children: staffManagedByBoard.map((p) => asHead(p, ctx.byId.get(p.manager_id!))),
      }
    : null;

  const tierNode = (id: string, kind: GroupKind, title: string, label: string, people: StructPerson[]): ChartNode => ({
    id, kind: "group", groupKind: kind, title, label, members: people.map(member), people: 0, children: [],
  });
  const boardNode = board.length ? tierNode("g:board", "board", "Board", "Governance", board) : null;
  const dirNode = directors.length ? tierNode("g:directors", "directors", "Directors", "Governance", directors) : null;

  const below = [...ceoNodes, ...(boardReports ? [boardReports] : [])];
  let roots: ChartNode[];
  if (dirNode || boardNode) {
    const lowest = (dirNode ?? boardNode)!;
    lowest.children = below;
    if (dirNode && boardNode) { boardNode.children = [dirNode]; roots = [boardNode]; } else roots = [lowest];
  } else {
    roots = below;
  }

  // Everyone else with nobody above them.
  const loose = staff.filter((p) => !p.manager_id || !ctx.byId.has(p.manager_id));
  let aside: ChartNode | null = null;
  if (ceos.length > 0 || aboveCeo.length > 0) {
    const nodes = loose.filter((p) => !seen.has(p.id)).map((p) => personNode(ctx, p, seen, { showUnit: true }));
    if (nodes.length) {
      aside = { id: "g:unplaced", kind: "group", groupKind: "unplaced", label: "Needs a manager", title: "Not in the reporting tree yet", people: 0, children: nodes };
    }
  } else {
    // No CEO or directors visible (a smaller view, or none recorded yet): the tops of what's visible, grouped by department.
    const tops = loose.filter((p) => !seen.has(p.id));
    roots = groupBy(tops, (h) => h.department?.trim() || "Other").map(([dept, hs]) => ({
      id: `g:dept:top:${dept}`, kind: "group" as const, groupKind: "department" as const, label: "Department", title: dept, people: 0,
      children: hs.map((h) => personNode(ctx, h, seen, { showUnit: true })),
    }));
  }
  // Anyone still unplaced is in a reporting loop (bad data): show them rather than lose them.
  const stuck: ChartNode[] = [];
  for (const p of staff) if (!seen.has(p.id)) stuck.push(personNode(ctx, p, seen, { showUnit: true }));
  if (stuck.length) {
    aside = aside
      ? { ...aside, children: [...aside.children, ...stuck] }
      : { id: "g:unplaced", kind: "group", groupKind: "unplaced", label: "Needs a manager", title: "Not in the reporting tree yet", people: 0, children: stuck };
  }
  finish(aside ? [...roots, aside] : roots);
  return { roots, aside };
}

// ---- Regions: Head Office > regions > branches > people ---------------------------------------------------------

export function buildRegions(data: OrgStructure): ChartTree {
  const ctx = index(data);
  const of = (t: Tier) => data.people.filter((p) => ctx.tier.get(p.id) === t);
  const ceos = of("ceo");
  const seen = new Set<string>();

  const forest = (members: StructPerson[]): ChartNode[] => {
    const set = new Set(members.map((m) => m.id));
    const roots = members.filter((m) => !m.manager_id || !set.has(m.manager_id));
    const nodes = roots.map((r) => {
      const n = personNode(ctx, r, seen, { within: set });
      const boss = name(ctx, r.manager_id);
      if (boss) n.reportsTo = boss;
      return n;
    });
    for (const m of members) if (!seen.has(m.id)) nodes.push(personNode(ctx, m, seen, { within: set })); // a reporting loop
    // the lead of the unit first, then by size
    return nodes.sort((a, b) => b.children.length - a.children.length || a.title.localeCompare(b.title));
  };

  const staff = data.people.filter((p) => ctx.tier.get(p.id) === "staff");
  const isChild = (u: StructUnit) => !!u.parent_unit_id && ctx.units.has(u.parent_unit_id);
  const topUnits = data.units.filter((u) => !isChild(u));

  /** Someone who covers this unit without it being their main one: a second card, marked as a copy. */
  const coverers = (u: StructUnit): ChartNode[] =>
    staff.filter((p) => p.unit_id !== u.id && (p.covers ?? []).includes(u.id)).map((p) => {
      const boss = name(ctx, p.manager_id);
      return {
        id: `p:${p.id}@${u.id}`, kind: "person" as const, person: p, copy: true, title: p.full_name, sub: roleOf(p) || undefined,
        note: p.unit_id ? `Main unit: ${shortUnit(ctx, p.unit_id)}` : undefined, reportsTo: boss, people: 1, children: [],
      };
    });

  const unitNode = (u: StructUnit): ChartNode => {
    const mgr = name(ctx, u.manager_profile_id);
    const under = data.units.filter((c) => c.parent_unit_id === u.id).map(unitNode);
    return {
      id: `g:unit:${u.id}`, kind: "group", groupKind: "unit", label: u.parent_unit_id && ctx.units.has(u.parent_unit_id) ? `${kindLabel(u.kind)} under ${shortUnit(ctx, u.id)}` : kindLabel(u.kind),
      title: u.name, led: mgr ? `Managed by ${mgr}` : undefined, people: 0,
      children: [...forest(staff.filter((p) => p.unit_id === u.id)), ...coverers(u), ...under],
    };
  };

  const regionNodes: ChartNode[] = data.regions.map((r) => {
    const mgr = ctx.byId.get(r.manager_profile_id ?? "");
    const node: ChartNode = {
      id: `g:region:${r.id}`, kind: "group", groupKind: "region", label: "Region", title: r.name,
      led: mgr ? `Regional manager: ${mgr.full_name}` : undefined, people: 0,
      children: topUnits.filter((u) => u.region_id === r.id).map(unitNode),
    };
    const boss = name(ctx, mgr?.manager_id);
    if (boss) node.reportsTo = boss;
    return node;
  });

  const noRegion = topUnits.filter((u) => !u.region_id);
  const direct = noRegion.filter((u) => u.kind !== "branch").map(unitNode);
  const strayBranches = noRegion.filter((u) => u.kind === "branch").map(unitNode);
  const strayGroup: ChartNode[] = strayBranches.length
    ? [{ id: "g:no-region", kind: "group", groupKind: "unplaced", label: "Needs a region", title: "Branches not in a region", people: 0, children: strayBranches }]
    : [];

  const board = of("board"), directors = of("director");
  const led = ceos.map((c) => c.full_name).join(", ");
  const hq: ChartNode = {
    id: "g:hq", kind: "group", groupKind: "hq", label: "Organisation", title: "Head Office",
    led: led ? `Led by ${led}` : undefined, reportsTo: directors.length ? "The Directors" : board.length ? "The Board" : undefined,
    people: 0, children: [...direct, ...regionNodes, ...strayGroup],
  };

  const inUnit = new Set(data.units.map((u) => u.id));
  const homeless = staff.filter((p) => !p.unit_id || !inUnit.has(p.unit_id));
  const aside: ChartNode | null = homeless.length
    ? { id: "g:no-unit", kind: "group", groupKind: "unplaced", label: "Needs a unit", title: "Not assigned to a unit", people: 0, children: forest(homeless) }
    : null;

  const roots = [hq];
  finish(aside ? [hq, aside] : [hq]);
  return { roots, aside };
}

export const buildTree = (data: OrgStructure, lens: Lens): ChartTree => (lens === "leadership" ? buildLeadership(data) : buildRegions(data));

// ---- walking a tree ---------------------------------------------------------------------------------------------

/** The person, their manager, theirs, and so on to the top (a loop stops the walk). */
export function chainOf(data: OrgStructure, personId: string): StructPerson[] {
  const byId = new Map(data.people.map((p) => [p.id, p]));
  const out: StructPerson[] = [];
  const seen = new Set<string>();
  let cur = byId.get(personId);
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    cur = cur.manager_id ? byId.get(cur.manager_id) : undefined;
  }
  return out;
}

/** What sits above the top of a chain: the Directors and the Board, when the top person is a CEO. */
export function aboveChain(data: OrgStructure, top: StructPerson | undefined): string[] {
  if (!top || tierOf(top) !== "ceo") return [];
  const has = (t: Tier) => data.people.some((p) => tierOf(p) === t);
  return [...(has("director") ? ["Directors"] : []), ...(has("board") ? ["Board"] : [])];
}

export function ancestorsOf(roots: ChartNode[], nodeId: string): string[] | null {
  const walk = (n: ChartNode, trail: string[]): string[] | null => {
    if (n.id === nodeId) return trail;
    for (const c of n.children) {
      const hit = walk(c, [...trail, n.id]);
      if (hit) return hit;
    }
    return null;
  };
  for (const r of roots) {
    const hit = walk(r, []);
    if (hit) return hit;
  }
  return null;
}

export function defaultOpen(tree: ChartTree, depth: number): Set<string> {
  const s = new Set<string>();
  const walk = (n: ChartNode, d: number) => {
    if (n.children.length > 0 && d < depth) s.add(n.id);
    n.children.forEach((c) => walk(c, d + 1));
  };
  [...tree.roots, ...(tree.aside ? [tree.aside] : [])].forEach((r) => walk(r, 0));
  return s;
}

export function everyParent(tree: ChartTree): Set<string> {
  const s = new Set<string>();
  const walk = (n: ChartNode) => {
    if (n.children.length > 0) s.add(n.id);
    n.children.forEach(walk);
  };
  [...tree.roots, ...(tree.aside ? [tree.aside] : [])].forEach(walk);
  return s;
}

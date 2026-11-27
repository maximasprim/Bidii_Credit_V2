import { useCallback, useEffect, useState } from "react";
import {
  cascadeApply, cascadeKpis, cascadeProposal, cascadeSet, cascadeTree, 
  type CascadeGap, type CascadeLevel, type CascadeProposal, type CascadeTree,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { usePerformanceCapabilities } from "../../lib/usePerformanceCapabilities";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const input = "rounded-lg border border-mist-200 px-2 py-1.5 text-sm";
const n = (v: number | null | undefined) => (v == null ? "not set" : v.toLocaleString("en-KE", { maximumFractionDigits: 0 }));
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");
const STATE: Record<string, string> = { balanced: "Balanced", unallocated: "Still to allocate", over: "Over-allocated", no_target: "No target set" };
const TONE: Record<string, string> = { balanced: "text-emerald-700", unallocated: "text-amber-700", over: "text-red-700", no_target: "text-ink-500" };

function Gap({ g }: { g: CascadeGap }) {
  return <span className={`text-xs font-semibold ${TONE[g.state]}`}>{STATE[g.state]}{g.gap != null && g.state !== "balanced" ? `: ${n(Math.abs(g.gap))}` : ""}</span>;
}

export default function AdminPerformanceCascade() {
  usePageMeta("Goal cascading");
  const { can } = usePerformanceCapabilities();
  const canEdit = can("cascade.manage");
  const [kpis, setKpis] = useState<{ key: string; label: string }[]>([]);
  const [kpi, setKpi] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [tree, setTree] = useState<CascadeTree | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [prop, setProp] = useState<CascadeProposal | null>(null);
  const [edit, setEdit] = useState<{ level: CascadeLevel; id: string; label: string } | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    cascadeKpis().then((d) => {
      setKpis(d.items);
      if (d.items[0]) setKpi(d.items[0].key);
    }).catch((e) => setErr(msg(e)));
  }, []);
  const load = useCallback(() => {
    if (!kpi) return;
    cascadeTree(kpi, month).then((t) => { setTree(t); setErr(null); }).catch((e) => { setTree(null); setErr(msg(e)); });
  }, [kpi, month]);
  useEffect(load, [load]);
  const run = async (fn: () => Promise<string>) => {
    setErr(null);
    setNote(null);
    try {
      setNote(await fn());
      load();
    } catch (e) {
      setErr(msg(e));
    }
  };
  const Actions = ({ level, id, label }: { level: CascadeLevel; id: string; label: string }) =>
    canEdit ? (
      <span className="ml-2 inline-flex gap-2 text-xs">
        <button className="underline" onClick={() => { setEdit({ level, id, label }); setValue(""); setReason(""); }}>Set target</button>
        <button className="underline" onClick={() => cascadeProposal(level, id, kpi, month).then(setProp).catch((e) => setErr(msg(e)))}>Preview split</button>
      </span>
    ) : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Goal cascading</h1>
        <p className="text-sm text-ink-500">Company target to regions, branches and people. A change at the top shows at once as a gap below. Nothing is rewritten until HR applies a split.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-600"><span className="block font-semibold">Measure</span>
          <select className={input} value={kpi} onChange={(e) => setKpi(e.target.value)}>{kpis.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
        </label>
        <label className="text-xs text-ink-600"><span className="block font-semibold">Month</span><input type="date" className={input} value={month} onChange={(e) => setMonth(e.target.value.slice(0, 8) + "01")} /></label>
      </div>
      {note && <p role="status" className="text-sm text-ink-600">{note}</p>}
      {err && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</p>}
      {edit && (
        <form className="flex flex-wrap items-end gap-2 rounded-xl border border-mist-200 p-3" onSubmit={(e) => {
          e.preventDefault();
          run(async () => { const r = await cascadeSet({ level: edit.level, entity_id: edit.id, kpi_key: kpi, month, value: Number(value), reason }); setEdit(null); return r.changed ? "Target saved." : "No change."; });
        }}>
          <p className="w-full text-sm font-semibold">Set {edit.label} target from {month.slice(0, 7)}</p>
          <label className="text-xs text-ink-600"><span className="block font-semibold">Monthly target</span><input className={input} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          <label className="text-xs text-ink-600"><span className="block font-semibold">Reason</span><input className={`${input} w-64`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="submit" className={btn} disabled={!value || reason.trim().length < 3}>Save</button>
          <button type="button" className={btn} onClick={() => setEdit(null)}>Cancel</button>
        </form>
      )}
      {prop && (
        <div className="space-y-2 rounded-xl border border-mist-200 p-3 text-sm">
          <p className="font-semibold">Split of {prop.parent}'s {n(prop.parent_target)} ({prop.basis})</p>
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Proposed split</caption>
            <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">Name</th><th scope="col" className="py-1 pr-2">Now</th><th scope="col" className="py-1 pr-2">Proposed</th><th scope="col" className="py-1">Change</th></tr></thead>
            <tbody>{prop.rows.map((r) => <tr key={r.child_id} className="border-t border-mist-100"><td className="py-1 pr-2">{r.name}</td><td className="py-1 pr-2">{n(r.current)}</td><td className="py-1 pr-2">{n(r.proposed)}</td><td className="py-1">{r.change > 0 ? "+" : ""}{n(r.change)}</td></tr>)}</tbody>
          </table>
          <div className="flex gap-2">
            <button className={btn} onClick={() => run(async () => { const r = await cascadeApply({ level: prop.level, entity_id: prop.entity_id, kpi_key: kpi, month, confirm: true }); setProp(null); return `Applied: ${r.changed} of ${r.children} targets changed.`; })}>Apply these targets</button>
            <button className={btn} onClick={() => setProp(null)}>Discard</button>
          </div>
        </div>
      )}
      {tree && (
        <div className="space-y-4">
          {tree.company && (
            <p className="text-sm"><strong>Company</strong>: target {n(tree.company.target)} · given to regions {n(tree.company.regions_total)} · <Gap g={tree.company} />{canEdit && <Actions level="company" id="company" label="Company" />}</p>
          )}
          {tree.regions.map((r) => (
            <section key={r.region_id ?? "none"} className="rounded-2xl border border-mist-200 p-3">
              <h2 className="text-sm font-bold">{r.name} <span className="font-normal text-ink-600">target {n(r.target)} · given to branches {n(r.units_total)} · </span><Gap g={r} />{r.region_id && <Actions level="region" id={r.region_id} label={r.name} />}</h2>
              <ul className="mt-2 space-y-2">
                {r.units.map((u) => (
                  <li key={u.unit_id} className="text-sm">
                    <p><strong>{u.name}</strong> <span className="text-ink-600">target {n(u.target)} · people total {n(u.individuals_total)} · </span><Gap g={u} /><Actions level="unit" id={u.unit_id} label={u.name ?? "Branch"} /></p>
                    <p className="text-xs text-ink-500">{u.people.map((p) => `${p.name} ${n(p.target)}`).join(" · ")}{u.people_without_target ? ` · ${u.people_without_target} without a target` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-ink-500">{tree.note}</p>
        </div>
      )}
    </div>
  );
}


// import { useCallback, useEffect, useRef, useState } from "react";
// import {
//   cascadeApply, cascadeKpis, cascadeProposal, cascadeSet, cascadeTree, 
//   type CascadeGap, type CascadeLevel, type CascadeProposal, type CascadeTree,
// } from "../../lib/performanceApi";
// import { getCurrentAdminRole } from "../../lib/adminApi";
// import { usePageMeta } from "../../lib/usePageMeta";

// const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
// const input = "rounded-lg border border-mist-200 px-2 py-1.5 text-sm";
// const n = (v: number | null | undefined) => (v == null ? "not set" : v.toLocaleString("en-KE", { maximumFractionDigits: 0 }));
// const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");
// const STATE: Record<string, string> = { balanced: "Balanced", unallocated: "Still to allocate", over: "Over-allocated", no_target: "No target set" };
// const TONE: Record<string, string> = { balanced: "text-emerald-700", unallocated: "text-amber-700", over: "text-red-700", no_target: "text-ink-500" };

// function Gap({ g }: { g: CascadeGap }) {
//   return <span className={`text-xs font-semibold ${TONE[g.state]}`}>{STATE[g.state]}{g.gap != null && g.state !== "balanced" ? `: ${n(Math.abs(g.gap))}` : ""}</span>;
// }

// type Boot = { kpis: { key: string; label: string }[]; kpi: string; month: string; tree: CascadeTree | null; error: string | null };

// /** Fetches the measures and the first tree together and shows the page only when both have arrived. */
// export default function AdminPerformanceCascade() {
//   usePageMeta("Goal cascading");
//   const [boot, setBoot] = useState<Boot | null>(null);
//   useEffect(() => {
//     let cancelled = false;
//     const month = new Date().toISOString().slice(0, 8) + "01";
//     (async () => {
//       let result: Boot;
//       try {
//         const k = await cascadeKpis();
//         const first = k.items[0]?.key ?? "";
//         let tree: CascadeTree | null = null;
//         let error: string | null = null;
//         if (first) {
//           try {
//             tree = await cascadeTree(first, month);
//           } catch (e) {
//             error = msg(e);
//           }
//         }
//         result = { kpis: k.items, kpi: first, month, tree, error };
//       } catch (e) {
//         result = { kpis: [], kpi: "", month, tree: null, error: msg(e) };
//       }
//       if (!cancelled) setBoot(result);
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, []);
//   if (!boot) {
//     return (
//       <div className="space-y-6">
//         <div>
//           <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Goal cascading</h1>
//         </div>
//         <p role="status" className="text-sm text-ink-500">Loading…</p>
//       </div>
//     );
//   }
//   return <CascadePage boot={boot} />;
// }

// function CascadePage({ boot }: { boot: Boot }) {
//   const canEdit = ["admin", "hr"].includes(getCurrentAdminRole() ?? "");
//   const [kpis] = useState<{ key: string; label: string }[]>(boot.kpis);
//   const [kpi, setKpi] = useState(boot.kpi);
//   const [month, setMonth] = useState(boot.month);
//   const [tree, setTree] = useState<CascadeTree | null>(boot.tree);
//   const [err, setErr] = useState<string | null>(boot.error);
//   const have = useRef(`${boot.kpi}|${boot.month}`); // the tree for this measure and month is already held
//   const [note, setNote] = useState<string | null>(null);
//   const [prop, setProp] = useState<CascadeProposal | null>(null);
//   const [edit, setEdit] = useState<{ level: CascadeLevel; id: string; label: string } | null>(null);
//   const [value, setValue] = useState("");
//   const [reason, setReason] = useState("");
//   const load = useCallback(() => {
//     if (!kpi) return;
//     cascadeTree(kpi, month).then((t) => { setTree(t); setErr(null); }).catch((e) => { setTree(null); setErr(msg(e)); });
//   }, [kpi, month]);
//   useEffect(() => {
//     if (have.current === `${kpi}|${month}`) { have.current = ""; return; } // the page already supplied this one
//     load();
//   }, [load, kpi, month]);
//   const run = async (fn: () => Promise<string>) => {
//     setErr(null);
//     setNote(null);
//     try {
//       setNote(await fn());
//       load();
//     } catch (e) {
//       setErr(msg(e));
//     }
//   };
//   const Actions = ({ level, id, label }: { level: CascadeLevel; id: string; label: string }) =>
//     canEdit ? (
//       <span className="ml-2 inline-flex gap-2 text-xs">
//         <button className="underline" onClick={() => { setEdit({ level, id, label }); setValue(""); setReason(""); }}>Set target</button>
//         <button className="underline" onClick={() => cascadeProposal(level, id, kpi, month).then(setProp).catch((e) => setErr(msg(e)))}>Preview split</button>
//       </span>
//     ) : null;
//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Goal cascading</h1>
//         <p className="text-sm text-ink-500">Company target to regions, branches and people. A change at the top shows at once as a gap below. Nothing is rewritten until HR applies a split.</p>
//       </div>
//       <div className="flex flex-wrap items-end gap-3">
//         <label className="text-xs text-ink-600"><span className="block font-semibold">Measure</span>
//           <select className={input} value={kpi} onChange={(e) => setKpi(e.target.value)}>{kpis.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
//         </label>
//         <label className="text-xs text-ink-600"><span className="block font-semibold">Month</span><input type="date" className={input} value={month} onChange={(e) => setMonth(e.target.value.slice(0, 8) + "01")} /></label>
//       </div>
//       {note && <p role="status" className="text-sm text-ink-600">{note}</p>}
//       {err && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</p>}
//       {edit && (
//         <form className="flex flex-wrap items-end gap-2 rounded-xl border border-mist-200 p-3" onSubmit={(e) => {
//           e.preventDefault();
//           run(async () => { const r = await cascadeSet({ level: edit.level, entity_id: edit.id, kpi_key: kpi, month, value: Number(value), reason }); setEdit(null); return r.changed ? "Target saved." : "No change."; });
//         }}>
//           <p className="w-full text-sm font-semibold">Set {edit.label} target from {month.slice(0, 7)}</p>
//           <label className="text-xs text-ink-600"><span className="block font-semibold">Monthly target</span><input className={input} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
//           <label className="text-xs text-ink-600"><span className="block font-semibold">Reason</span><input className={`${input} w-64`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
//           <button type="submit" className={btn} disabled={!value || reason.trim().length < 3}>Save</button>
//           <button type="button" className={btn} onClick={() => setEdit(null)}>Cancel</button>
//         </form>
//       )}
//       {prop && (
//         <div className="space-y-2 rounded-xl border border-mist-200 p-3 text-sm">
//           <p className="font-semibold">Split of {prop.parent}'s {n(prop.parent_target)} ({prop.basis})</p>
//           <table className="w-full text-left text-xs">
//             <caption className="sr-only">Proposed split</caption>
//             <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">Name</th><th scope="col" className="py-1 pr-2">Now</th><th scope="col" className="py-1 pr-2">Proposed</th><th scope="col" className="py-1">Change</th></tr></thead>
//             <tbody>{prop.rows.map((r) => <tr key={r.child_id} className="border-t border-mist-100"><td className="py-1 pr-2">{r.name}</td><td className="py-1 pr-2">{n(r.current)}</td><td className="py-1 pr-2">{n(r.proposed)}</td><td className="py-1">{r.change > 0 ? "+" : ""}{n(r.change)}</td></tr>)}</tbody>
//           </table>
//           <div className="flex gap-2">
//             <button className={btn} onClick={() => run(async () => { const r = await cascadeApply({ level: prop.level, entity_id: prop.entity_id, kpi_key: kpi, month, confirm: true }); setProp(null); return `Applied: ${r.changed} of ${r.children} targets changed.`; })}>Apply these targets</button>
//             <button className={btn} onClick={() => setProp(null)}>Discard</button>
//           </div>
//         </div>
//       )}
//       {tree && (
//         <div className="space-y-4">
//           {tree.company && (
//             <p className="text-sm"><strong>Company</strong>: target {n(tree.company.target)} · given to regions {n(tree.company.regions_total)} · <Gap g={tree.company} />{canEdit && <Actions level="company" id="company" label="Company" />}</p>
//           )}
//           {tree.regions.map((r) => (
//             <section key={r.region_id ?? "none"} className="rounded-2xl border border-mist-200 p-3">
//               <h2 className="text-sm font-bold">{r.name} <span className="font-normal text-ink-600">target {n(r.target)} · given to branches {n(r.units_total)} · </span><Gap g={r} />{r.region_id && <Actions level="region" id={r.region_id} label={r.name} />}</h2>
//               <ul className="mt-2 space-y-2">
//                 {r.units.map((u) => (
//                   <li key={u.unit_id} className="text-sm">
//                     <p><strong>{u.name}</strong> <span className="text-ink-600">target {n(u.target)} · people total {n(u.individuals_total)} · </span><Gap g={u} /><Actions level="unit" id={u.unit_id} label={u.name ?? "Branch"} /></p>
//                     <p className="text-xs text-ink-500">{u.people.map((p) => `${p.name} ${n(p.target)}`).join(" · ")}{u.people_without_target ? ` · ${u.people_without_target} without a target` : ""}</p>
//                   </li>
//                 ))}
//               </ul>
//             </section>
//           ))}
//           <p className="text-xs text-ink-500">{tree.note}</p>
//         </div>
//       )}
//     </div>
//   );
// }

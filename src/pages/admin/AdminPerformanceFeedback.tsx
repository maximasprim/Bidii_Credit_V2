import { useCallback, useEffect, useRef, useState } from "react";
import {
  f360AddSubject, f360Answer, f360Cycle, f360CreateCycle, f360Cycles, f360Decline, f360MyRequests, f360MyResults, f360Request, f360TeamResults, f360SetStatus, getStaff,
  type F360Cycle, type F360Form, type F360Progress, type F360Request, type F360Results, type StaffProfile,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const input = "rounded-lg border border-mist-200 px-2 py-1.5 text-sm";
const REL: Record<string, string> = { self: "Yourself", manager: "Your manager", peer: "A peer", direct_report: "Someone you manage", other: "Colleague" };
const GROUP: Record<string, string> = { self: "Self", manager: "Manager", peer: "Peers", direct_report: "Direct reports", other: "Others" };
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");

function RatingForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [form, setForm] = useState<F360Form | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    f360Request(id).then((f) => {
      setForm(f);
      setAnswers(f.answers ?? {});
      setStrengths(f.strengths ?? "");
      setDevelopment(f.development ?? "");
    }).catch((e) => setErr(msg(e)));
  }, [id]);
  if (err && !form) return <p role="alert" className="text-sm text-red-600">{err}</p>;
  if (!form) return null;
  const complete = form.questions.every((q) => answers[q.key]);
  return (
    <form className="space-y-4 rounded-2xl border border-mist-200 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setErr(null);
      try {
        await f360Answer(id, { answers, strengths: strengths.trim() || null, development: development.trim() || null });
        onDone();
      } catch (x) {
        setErr(msg(x));
      }
    }}>
      <h3 className="text-sm font-bold">Feedback for {form.subject} ({REL[form.relationship] ?? form.relationship})</h3>
      <p className="text-xs text-ink-500">{form.anonymity} Rate 1 (rarely) to 5 (consistently).</p>
      {form.questions.map((q) => (
        <fieldset key={q.key} className="space-y-1">
          <legend className="text-sm font-semibold">{q.title}</legend>
          <p className="text-xs text-ink-500">{q.description}</p>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex items-center gap-1 text-sm">
                <input type="radio" name={q.key} value={n} checked={answers[q.key] === n} onChange={() => setAnswers({ ...answers, [q.key]: n })} /> {n}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="block text-xs text-ink-600"><span className="block font-semibold">What do they do well?</span><textarea className={`${input} w-full`} rows={3} maxLength={1000} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
      <label className="block text-xs text-ink-600"><span className="block font-semibold">What could they do better?</span><textarea className={`${input} w-full`} rows={3} maxLength={1000} value={development} onChange={(e) => setDevelopment(e.target.value)} /></label>
      <p className="text-xs text-ink-500">Please don't include names or details that would identify you.</p>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button type="submit" className={btn} disabled={!complete}>{form.status === "submitted" ? "Update my answers" : "Submit"}</button>
    </form>
  );
}

function Requests({ initial }: { initial: F360Request[] | null }) {
  const seeded = useRef(initial !== null);
  const [items, setItems] = useState<F360Request[]>(initial ?? []);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => f360MyRequests().then((d) => setItems(d.items)).catch(() => undefined), []);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; } // the page already supplied the first list
    load();
  }, [load]);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="req-h" className="space-y-3">
      <h2 id="req-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Feedback I've been asked to give</h2>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.rater_id} className="rounded-xl border border-mist-200 p-3 text-sm">
            <p>{r.cycle}: <strong>{r.subject}</strong> · {r.status}</p>
            <div className="mt-2 flex gap-2">
              <button className={btn} onClick={() => setOpen(open === r.rater_id ? null : r.rater_id)}>{open === r.rater_id ? "Close" : r.status === "submitted" ? "Review my answers" : "Give feedback"}</button>
              {r.status === "pending" && <button className={btn} onClick={() => f360Decline(r.rater_id).then(load)}>Decline</button>}
            </div>
            {open === r.rater_id && <div className="mt-3"><RatingForm id={r.rater_id} onDone={() => { setOpen(null); load(); }} /></div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResultsView({ r }: { r: F360Results }) {
  return (
    <div className="space-y-3 rounded-2xl border border-mist-200 p-4 text-sm">
      <h3 className="font-bold">{r.cycle}{r.subject ? `: ${r.subject}` : ""}</h3>
      <p className="text-xs text-ink-500">{r.note}</p>
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Average rating per competency by group, out of 5</caption>
        <thead>
          <tr className="text-ink-500">
            <th scope="col" className="py-1 pr-2">Competency</th>
            {Object.keys(r.groups).map((g) => <th key={g} scope="col" className="py-1 pr-2">{GROUP[g] ?? g}</th>)}
            <th scope="col" className="py-1">All others</th>
          </tr>
        </thead>
        <tbody>
          {r.questions.map((q) => (
            <tr key={q.key} className="border-t border-mist-100">
              <th scope="row" className="py-1 pr-2 font-normal">{q.title}</th>
              {Object.entries(r.groups).map(([g, v]) => <td key={g} className="py-1 pr-2">{v.shown ? v.averages?.[q.key] : "–"}</td>)}
              <td className="py-1">{r.overall_others ? r.overall_others[q.key] : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {Object.entries(r.groups).map(([g, v]) => (
        <div key={g}>
          <h4 className="text-xs font-bold text-ink-600">{GROUP[g] ?? g} ({v.responses})</h4>
          {!v.shown ? <p className="text-xs text-ink-500">{v.message}</p> : (
            <>
              {v.strengths && v.strengths.length > 0 && <><p className="text-xs font-semibold">Doing well</p><ul className="list-disc pl-5">{v.strengths.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
              {v.development && v.development.length > 0 && <><p className="mt-1 text-xs font-semibold">Could do better</p><ul className="list-disc pl-5">{v.development.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function MyResults({ initial }: { initial: F360Results[] | null }) {
  const seeded = useRef(initial !== null);
  const [items, setItems] = useState<F360Results[]>(initial ?? []);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; }
    f360MyResults().then((d) => setItems(d.items)).catch(() => undefined);
  }, []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="myres-h" className="space-y-3">
      <h2 id="myres-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>My 360 results</h2>
      {items.map((r, i) => <ResultsView key={i} r={r} />)}
    </section>
  );
}

function TeamResults({ initial }: { initial: F360Results[] | null }) {
  const seeded = useRef(initial !== null);
  const [items, setItems] = useState<F360Results[]>(initial ?? []);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; }
    f360TeamResults().then((d) => setItems(d.items)).catch(() => undefined);
  }, []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="teamres-h" className="space-y-3">
      <h2 id="teamres-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>360 results for the people I manage</h2>
      {items.map((r, i) => <ResultsView key={i} r={r} />)}
    </section>
  );
}

function Manage({ initialCycles, initialPeople }: { initialCycles: F360Cycle[] | null; initialPeople: StaffProfile[] | null }) {
  const seeded = useRef(initialCycles !== null);
  const [cycles, setCycles] = useState<F360Cycle[] | null>(initialCycles);
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<(F360Cycle & { progress: F360Progress[] }) | null>(null);
  const [people, setPeople] = useState<StaffProfile[]>(initialPeople ?? []);
  const [who, setWho] = useState("");
  const [results, setResults] = useState<Record<string, F360Results>>({});
  const [err, setErr] = useState<string | null>(null);
  const loadAll = useCallback(() => f360Cycles().then((d) => setCycles(d.items)).catch(() => setCycles(null)), []);
  const loadOne = useCallback((id: string) => f360Cycle(id).then(setDetail).catch((e) => setErr(msg(e))), []);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; } // the page already supplied the rounds and the people
    loadAll();
    getStaff().then((d) => setPeople(d.items)).catch(() => undefined);
  }, [loadAll]);
  useEffect(() => {
    if (sel) loadOne(sel);
  }, [sel, loadOne]);
  if (!cycles) return null;
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      loadAll();
      if (sel) loadOne(sel);
    } catch (e) {
      setErr(msg(e));
    }
  };
  const NEXT: Record<string, "open" | "closed" | "released" | undefined> = { draft: "open", open: "closed", closed: "released" };
  return (
    <section aria-labelledby="f360-h" className="space-y-3">
      <h2 id="f360-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Run a 360 round (HR)</h2>
      <p className="text-xs text-ink-500">Development only: results never affect a score, rating or improvement plan. People are asked together with their manager, direct reports and peers; small groups stay hidden.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-ink-600"><span className="block font-semibold">New round</span><input className={`${input} w-64`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Branch managers 2026" /></label>
        <button className={btn} disabled={name.trim().length < 3} onClick={() => run(async () => { await f360CreateCycle(name.trim(), 3); setName(""); })}>Create</button>
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <ul className="space-y-1 text-sm">
        {cycles.map((c) => <li key={c.id}><button className="underline" onClick={() => setSel(c.id)}>{c.name}</button> · {c.status}</li>)}
      </ul>
      {detail && (
        <div className="space-y-3 rounded-2xl border border-mist-200 p-4 text-sm">
          <h3 className="font-bold">{detail.name} ({detail.status})</h3>
          {(detail.status === "draft" || detail.status === "open") && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-ink-600"><span className="block font-semibold">Add a person</span>
                <select className={input} value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
              </label>
              <button className={btn} disabled={!who} onClick={() => run(() => f360AddSubject(detail.id, who))}>Add with suggested raters</button>
            </div>
          )}
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Progress per person</caption>
            <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">Person</th><th scope="col" className="py-1 pr-2">Answered</th><th scope="col" className="py-1">Still to answer</th></tr></thead>
            <tbody>{detail.progress.map((p) => (
              <tr key={p.subject_id} className="border-t border-mist-100">
                <td className="py-1 pr-2">{p.name}{detail.status === "released" && <> · <button className="underline" onClick={() => f360ResultsFor(p.subject_id, setResults)}>View results</button></>}</td>
                <td className="py-1 pr-2">{p.submitted}/{p.asked}{p.declined ? ` (${p.declined} declined)` : ""}</td>
                <td className="py-1">{p.pending_raters.join(", ")}</td>
              </tr>
            ))}</tbody>
          </table>
          {NEXT[detail.status] && <button className={btn} onClick={() => run(() => f360SetStatus(detail.id, NEXT[detail.status]!))}>{detail.status === "draft" ? "Open the round" : detail.status === "open" ? "Close the round" : "Release results to the people and their managers"}</button>}
          {Object.entries(results).map(([k, r]) => <ResultsView key={k} r={r} />)}
        </div>
      )}
    </section>
  );
}

async function f360ResultsFor(id: string, set: (fn: (p: Record<string, F360Results>) => Record<string, F360Results>) => void) {
  const { f360Results } = await import("../../lib/performanceApi");
  const r = await f360Results(id);
  set((p) => ({ ...p, [id]: r }));
}

type Boot = {
  requests: F360Request[] | null;
  mine: F360Results[] | null;
  team: F360Results[] | null;
  cycles: F360Cycle[] | null;
  people: StaffProfile[] | null;
};
const val = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);

/** Fetches every section together and shows the page only when all of them have arrived (a section you may not see simply stays hidden). */
export default function AdminPerformanceFeedback() {
  usePageMeta("360 feedback");
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([f360MyRequests(), f360MyResults(), f360TeamResults(), f360Cycles(), getStaff()]).then(([a, b, c, d, e]) => {
      if (cancelled) return;
      setBoot({ requests: val(a)?.items ?? null, mine: val(b)?.items ?? null, team: val(c)?.items ?? null, cycles: val(d)?.items ?? null, people: val(e)?.items ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!boot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>360° feedback</h1>
        </div>
        <p role="status" className="text-sm text-ink-500">Loading…</p>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>360° feedback</h1>
        <p className="text-sm text-ink-500">Confidential development feedback for managers. Your answers are anonymous within a group of at least three.</p>
      </div>
      <Requests initial={boot.requests} />
      <MyResults initial={boot.mine} />
      <TeamResults initial={boot.team} />
      <Manage initialCycles={boot.cycles} initialPeople={boot.people} />
    </div>
  );
}

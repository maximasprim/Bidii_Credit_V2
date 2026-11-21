import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import {
  generateRecommendations,
  getPersonProjection,
  getRecommendationAdvice,
  getRecommendations,
  updateRecommendation,
  type Advice,
  type PersonProjection,
  type Recommendation,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";
import ProjectionCard from "../../components/admin/performance/ProjectionCard";

const SEVERITY: Record<string, string> = { urgent: "bg-red-50 text-red-700 border-red-200", action: "bg-amber-50 text-amber-800 border-amber-200", info: "bg-mist-50 text-ink-700 border-mist-200" };

function AdviceBlock({ a }: { a: Advice }) {
  return (
    <div className="mt-3 rounded-lg border border-mist-200 bg-mist-50 p-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{a.label}{a.ai ? ` · ${a.ai.provider} ${a.ai.model} · ${a.ai.prompt_version}${a.ai.cached ? " · saved copy" : ""}` : ""}</p>
      <p className="mt-1 text-ink-800">{a.summary}</p>
      {a.why_fallback && <p className="mt-1 text-xs text-ink-500">AI wasn't used: {a.why_fallback}</p>}
      {a.root_causes.length > 0 && (
        <>
          <h4 className="mt-2 text-xs font-bold text-ink-600">Possible causes</h4>
          <ul className="list-disc pl-5">{a.root_causes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </>
      )}
      {a.actions.length > 0 && (
        <>
          <h4 className="mt-2 text-xs font-bold text-ink-600">Suggested actions</h4>
          <ul className="list-disc pl-5">{a.actions.map((x, i) => <li key={i}>{x.action} <span className="text-ink-500">({x.owner}, {x.timeframe})</span></li>)}</ul>
        </>
      )}
      {a.training.length > 0 && (
        <>
          <h4 className="mt-2 text-xs font-bold text-ink-600">Training ideas</h4>
          <ul className="list-disc pl-5">{a.training.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </>
      )}
      {a.confidence && <p className="mt-2 text-xs text-ink-500">Confidence: {a.confidence}. Review before acting; nothing here changes a score, rating or PIP.</p>}
    </div>
  );
}

function Card({ r, canManage, reload }: { r: Recommendation; canManage: boolean; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(r.advice);
  const [proj, setProj] = useState<PersonProjection | null>(null);
  const done = r.status === "actioned" || r.status === "dismissed";

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };
  const act = (status: "acknowledged" | "actioned" | "dismissed") =>
    run(async () => {
      await updateRecommendation(r.id, { status, note: note || undefined, due_on: due || undefined });
      reload();
    });

  return (
    <li className="rounded-2xl border border-mist-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEVERITY[r.severity] ?? SEVERITY.info}`}>{r.severity}</span>
        {r.restricted && <span className="rounded-full border border-mist-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600">Restricted: HR, direct manager and the person</span>}
        <span className="text-xs text-ink-500">{r.entity_name ?? "—"} · {r.period_key} · {r.status}</span>
      </div>
      <h3 className="mt-1 text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{r.title}</h3>
      {r.detail && <p className="text-sm text-ink-700">{r.detail}</p>}
      {r.figures && Object.keys(r.figures).length > 0 && (
        <p className="mt-1 text-xs text-ink-500">Why: {Object.entries(r.figures).map(([k, v]) => `${k.replace(/_/g, " ")} ${JSON.stringify(v)}`).join("; ")}</p>
      )}
      {r.status_note && <p className="mt-1 text-xs text-ink-600">Note: {r.status_note}{r.due_on ? ` · due ${r.due_on}` : ""}</p>}
      {r.outcome && <p className="mt-1 text-xs text-ink-600">Follow-up: score {String(r.outcome.score_then)} → {String(r.outcome.score_now)} ({r.outcome.improved ? "improved" : "not improved"}).</p>}
      {advice && <AdviceBlock a={advice} />}
      {proj && <div className="mt-3"><ProjectionCard data={proj} /></div>}
      {err && <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} />{err}</p>}
      {!done && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-600">
            <span className="block font-semibold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="w-56 rounded-lg border border-mist-200 px-2 py-1 text-sm" />
          </label>
          {canManage && (
            <label className="text-xs text-ink-600">
              <span className="block font-semibold">Due date</span>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-mist-200 px-2 py-1 text-sm" />
            </label>
          )}
          {r.status === "new" && <button disabled={busy} onClick={() => act("acknowledged")} className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50">Acknowledge</button>}
          {canManage && <button disabled={busy} onClick={() => act("actioned")} className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50">Mark actioned</button>}
          {canManage && <button disabled={busy || !note.trim()} onClick={() => act("dismissed")} title="A note is needed to dismiss" className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50">Dismiss</button>}
        </div>
      )}
      {canManage && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
          <button disabled={busy} onClick={() => run(async () => setAdvice(await getRecommendationAdvice(r.id, !!advice)))} className="flex items-center gap-1 text-ink-700 underline">
            <Sparkles size={12} /> {advice ? "Regenerate advice" : "Get AI advice"}
          </button>
          {r.entity_type === "staff" && !proj && (
            <button disabled={busy} onClick={() => run(async () => setProj(await getPersonProjection(r.entity_id)))} className="text-ink-700 underline">Show projection</button>
          )}
        </div>
      )}
    </li>
  );
}

export default function AdminPerformanceSuggestions() {
  usePageMeta("Performance suggestions");
  const [items, setItems] = useState<Recommendation[]>([]);
  const [canGenerate, setCanGenerate] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getRecommendations(filter)
      .then((d) => {
        setItems(d.items);
        setCanGenerate(d.can_generate);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load suggestions."))
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(load, [load]);

  const generate = async () => {
    setMessage(null);
    try {
      const r = await generateRecommendations();
      setMessage(`Checked ${r.people} people: ${r.created} new, ${r.updated} refreshed.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't run the checks.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Suggestions</h1>
          <p className="text-sm text-ink-500">Rule-based prompts from verified results. They never change a score, rating or PIP; people decide.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-600">
            <span className="sr-only">Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")} className="rounded-lg border border-mist-200 px-2 py-1.5 text-sm">
              <option value="open">Open</option>
              <option value="all">All</option>
            </select>
          </label>
          {canGenerate && <button onClick={generate} className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50">Run checks now</button>}
        </div>
      </div>
      {message && <p role="status" className="text-sm text-ink-600">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {loading && <p role="status" className="text-sm text-ink-500">Loading…</p>}
      {!loading && !error && items.length === 0 && <p className="rounded-xl border border-mist-200 p-4 text-sm text-ink-600">Nothing needs attention right now.</p>}
      <ul className="space-y-3">
        {items.map((r) => (
          <Card key={r.id} r={r} canManage={canGenerate} reload={load} />
        ))}
      </ul>
    </div>
  );
}

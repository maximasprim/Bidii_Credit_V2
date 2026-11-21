import { useEffect, useState } from "react";
import { getMyProjection, type PersonProjection } from "../../../lib/performanceApi";
import ProjectionCard from "./ProjectionCard";

/** Where my results are heading, from my own verified months. */
export default function MyProjectionSection() {
  const [data, setData] = useState<PersonProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMyProjection()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : ""));
    return () => {
      cancelled = true;
    };
  }, []);
  if (error || !data) return null; // no linked profile, or nothing to show: stay quiet
  return (
    <section aria-labelledby="my-proj-h" className="space-y-3">
      <h2 id="my-proj-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Where I'm heading</h2>
      <ProjectionCard data={data} />
    </section>
  );
}

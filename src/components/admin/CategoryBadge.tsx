import { CATEGORY_STYLE, type CategoryBand, type CategoryKey } from "../../lib/performanceApi";

/** Colour-coded performance category pill. Text is always shown too, so meaning never relies on colour alone. */
export default function CategoryBadge({ categoryKey, label }: { categoryKey: CategoryKey; label: string }) {
  const s = CATEGORY_STYLE[categoryKey];
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
      {label}
    </span>
  );
}

/** Legend of the configured categories and the score range each covers. */
export function CategoryLegend({ categories }: { categories: CategoryBand[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c, i) => {
        const upper = i === 0 ? null : categories[i - 1].min_score;
        const range = upper === null ? `${c.min_score}% and above` : `${c.min_score}% to under ${upper}%`;
        return (
          <div key={c.key} className="flex items-center gap-2 rounded-lg border border-mist-200 bg-surface px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_STYLE[c.key].solid }} />
            <div>
              <p className="text-xs font-semibold text-ink-700">{c.label}</p>
              <p className="text-[11px] text-ink-400">{range}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

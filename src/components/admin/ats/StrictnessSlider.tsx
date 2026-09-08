import { ATS_STRICTNESS_LABELS, type ATSStrictness } from "../../../lib/atsApi";

const LEVELS: ATSStrictness[] = ["lenient", "balanced", "strict"];

/**
 * Slim 3-position toggle slider for ATSConfiguration.strictness. A plain
 * <select> works fine functionally, but this setting only ever has these
 * three ordered levels, so a slider reads faster at a glance than a
 * dropdown - and makes "balanced" visually sit in the middle, where it
 * belongs as the default.
 */
export default function StrictnessSlider({
  value,
  onChange,
  disabled = false,
}: {
  value: ATSStrictness;
  onChange: (value: ATSStrictness) => void;
  disabled?: boolean;
}) {
  const index = LEVELS.indexOf(value);

  return (
    <div
      role="radiogroup"
      aria-label="Strictnes"
      className="relative inline-flex w-full max-w-[240px] items-center rounded-full p-0.5"
      style={{ backgroundColor: "var(--color-mist-200)" }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 rounded-full bg-green-400 shadow-sm transition-all duration-150 ease-out"
        style={{ width: "calc(33.333% - 4px)", left: `calc(${index * 33.333}% + 2px)` }}
      />
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          disabled={disabled}
          onClick={() => onChange(level)}
          className="relative z-10 flex-1 rounded-full py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: value === level ? "var(--color-ink-900)" : "var(--color-ink-400)" }}
        >
          {ATS_STRICTNESS_LABELS[level]}
        </button>
      ))}
    </div>
  );
}

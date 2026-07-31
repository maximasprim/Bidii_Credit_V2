import { motion } from "framer-motion";

type GrowthLineProps = {
  className?: string;
  stroke?: string;
  dotFill?: string;
  animate?: boolean;
};

/**
 * Signature motif: an ascending staircase line — each flat tread is a
 * deliberate step, each riser is the effort between steps. It stands in
 * for "bidii" (Kiswahili: diligence/effort) compounding into visible
 * growth, and it recurs at different scales through the page: full hero
 * path, a quiet section-divider, and the spine behind the stat numbers.
 */
export default function GrowthLine({
  className,
  stroke = "var(--color-ember-500)",
  dotFill = "var(--color-ember-500)",
  animate = true,
}: GrowthLineProps) {
  const path =
    "M0 150 L60 150 L60 120 L130 120 L130 95 L200 95 L200 68 L280 68 L280 44 L360 44 L360 20 L440 20";

  return (
    <svg
      viewBox="0 0 440 170"
      fill="none"
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <motion.path
        d={path}
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
        whileInView={animate ? { pathLength: 1, opacity: 1 } : undefined}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
      <motion.circle
        cx="440"
        cy="20"
        r="6"
        fill={dotFill}
        initial={animate ? { opacity: 0, scale: 0 } : undefined}
        whileInView={animate ? { opacity: 1, scale: 1 } : undefined}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ delay: 1.3, duration: 0.4, ease: "backOut" }}
      />
    </svg>
  );
}

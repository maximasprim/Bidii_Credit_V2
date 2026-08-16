import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Download, Info, Pencil, Check, AlertCircle, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { loanProducts } from "../data/content";
import { useLoanTiers, PRIVILEGED_ROLES, type LoanTier } from "../lib/useLoanTiers";
import { useAdminAuth } from "../lib/AdminAuthContext";
import { CHECK_OFF_FEES, findCheckOffRateRow, CHECK_OFF_RATE_TABLE } from "../data/checkOffRateTable";
import { useEngagement } from "../lib/EngagementContext";

function formatKes(n: number, roundOff: boolean = true) {
  return roundOff
    ? "KES " + Math.round(n).toLocaleString("en-KE")
    : "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 4 weeks = 1 month, matching how Bidii itself defines weekly-repayment tiers. */
function termToMonths(term: number, unit: "weeks" | "months") {
  return unit === "months" ? term : term / 4;
}

function amountStep(tier: LoanTier) {
  return tier.max_amount <= 100_000 ? 500 : 5_000;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * The tracking fee's KES-per-month rate isn't fixed - it varies by which
 * tracking company (e.g. Regent/Jawabu) handles a given vehicle, per Bidii's
 * Auto/Logbook training material. This range keeps the slider centered on
 * the standard 1,500/month rate while allowing for that variance.
 */
const TRACKING_FEE_MIN = 500;
const TRACKING_FEE_MAX = 3000;
const TRACKING_FEE_STEP = 100;

type ScheduleRow = {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
};

function buildSchedule(tier: LoanTier, amount: number, term: number, trackingFeePerMonthOverride?: number) {
  const termInMonths = termToMonths(term, tier.term_unit);
  const interestTotal =
    tier.interest_basis === "flat_over_term" ? amount * tier.interest_rate : amount * tier.interest_rate * termInMonths;
  const totalRepayment = amount + interestTotal;
  const installmentCount = Math.max(1, Math.round(term));
  const principalPerInstallment = amount / installmentCount;
  const interestPerInstallment = interestTotal / installmentCount;
  const paymentPerInstallment = totalRepayment / installmentCount;

  const rows: ScheduleRow[] = Array.from({ length: installmentCount }, (_, i) => ({
    period: i + 1,
    payment: paymentPerInstallment,
    principal: principalPerInstallment,
    interest: interestPerInstallment,
    balance: Math.max(amount - principalPerInstallment * (i + 1), 0),
  }));

  // One-time fees, all based on the requested principal. These fields are
  // only present on `tier` for a logged-in admin/loan officer (see
  // useLoanTiers) — for the general public they're simply absent, so this
  // defaults to 0. That's harmless either way: the Fees & Charges panel
  // built from this data is only ever rendered for privileged viewers
  // (see CalculatorBody/CheckOffCalculatorBody), so a public visitor
  // never sees these zeroed-out numbers regardless.
  const processingFee = amount * (tier.processing_fee_rate ?? 0);
  const lifeInsuranceFee = amount * (tier.life_insurance_fee_rate ?? 0);
  const chattelFee = tier.chattel_fee ?? 0;
  const inchargeFee = tier.incharge_fee ?? 0;
  const exciseDuty = (tier.excise_duty_on_fees_rate ?? 0) * (processingFee + chattelFee);
  // Logbook products (standard Auto Loan + Jikuze Auto) carry a monthly vehicle
  // tracking fee. The rate varies by tracking company, so it's editable here,
  // defaulting to the tier's configured rate.
  const trackingFeePerMonth = trackingFeePerMonthOverride ?? tier.tracking_fee_per_month ?? 0;
  const trackingFeeTotal = trackingFeePerMonth * termInMonths;

  // Registration fee is paid upfront by the client as a separate facilitation
  // fee (per the SME appraisal process); everything else - including the
  // tracking fee - is deducted from the disbursed loan proceeds.
  const deductedFromLoan = processingFee + lifeInsuranceFee + chattelFee + inchargeFee + exciseDuty + trackingFeeTotal;
  const netDisbursed = amount - deductedFromLoan;

  return {
    rows,
    interestTotal,
    totalRepayment,
    paymentPerInstallment,
    processingFee,
    lifeInsuranceFee,
    chattelFee,
    inchargeFee,
    exciseDuty,
    trackingFeePerMonth,
    trackingFeeTotal,
    registrationFee: tier.registration_fee,
    netDisbursed,
  };
}

export default function Calculator() {
  usePageMeta("Loan Calculator");
  const { tiersByProduct, loading: tiersLoading, isFallback } = useLoanTiers();

    // Starts/stops the 5-minutes-on-this-page intent timer for as long as this
  // component is mounted, regardless of which product/tier is selected.
  const { setOnCalculatorPage } = useEngagement();
  useEffect(() => {
    setOnCalculatorPage(true);
    return () => setOnCalculatorPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [productSlug, setProductSlug] = useState(loanProducts[0].slug);
  const product = useMemo(
    () => loanProducts.find((p) => p.slug === productSlug) ?? loanProducts[0],
    [productSlug]
  );

  // Whether displayed figures are rounded to whole KES (on) or shown to
  // 2 decimal places (off). Applies across the whole calculator.
  const [roundOff, setRoundOff] = useState(true);

  const tiers = tiersByProduct[productSlug] ?? [];

  if (tiersLoading) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-24 text-center">
        <p className="text-sm text-ink-500">Loading loan terms…</p>
      </section>
    );
  }

  if (tiers.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-24">
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          No loan terms are configured for this product yet.
        </div>
      </section>
    );
  }

  return product.isAffordabilityBased ? (
    <CheckOffCalculatorBody
      productSlug={productSlug}
      setProductSlug={setProductSlug}
      isFallback={isFallback}
      roundOff={roundOff}
      setRoundOff={setRoundOff}
    />
  ) : (
    <CalculatorBody
      product={product}
      productSlug={productSlug}
      setProductSlug={setProductSlug}
      tiers={tiers}
      allTiersByProduct={tiersByProduct}
      isFallback={isFallback}
      roundOff={roundOff}
      setRoundOff={setRoundOff}
    />
  );
}

function CalculatorBody({
  product,
  productSlug,
  setProductSlug,
  tiers,
  allTiersByProduct,
  isFallback,
  roundOff,
  setRoundOff,
}: {
  product: (typeof loanProducts)[number];
  productSlug: string;
  setProductSlug: (slug: string) => void;
  tiers: LoanTier[];
  allTiersByProduct: Record<string, LoanTier[]>;
  isFallback: boolean;
  roundOff: boolean;
  setRoundOff: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const [tierId, setTierId] = useState(tiers[0].tier_key);
  const tier = useMemo(
    () => tiers.find((t) => t.tier_key === tierId) ?? tiers[0],
    [tiers, tierId]
  );

  // The internal "Fees & charges" breakdown (registration/processing/
  // insurance/chattel/incharge fees, excise duty, net amount disbursed)
  // is only for logged-in admins/loan officers — the general public only
  // sees the installment, total interest, total repayment, and rate,
  // none of which depend on this flag.
  const { isAuthenticated, role } = useAdminAuth();
  const canViewInternalFees = isAuthenticated && role !== null && PRIVILEGED_ROLES.has(role);

  const [amount, setAmount] = useState(tier.min_amount);
  const [term, setTerm] = useState(tier.min_term);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editingTerm, setEditingTerm] = useState(false);
    // Fires the "tried to calculate a loan" intent trigger the first time the
  // visitor genuinely changes amount/term (not when a tier/product switch
  // resets them back to the tier's defaults - baselineRef tracks that).
  const { requestIntent } = useEngagement();
  const hasFiredCalcAttempt = useRef(false);
  const baselineRef = useRef({ amount: tier.min_amount, term: tier.min_term });
  useEffect(() => {
    if (hasFiredCalcAttempt.current) return;
    if (amount !== baselineRef.current.amount || term !== baselineRef.current.term) {
      hasFiredCalcAttempt.current = true;
      requestIntent({
        sourcePage: "calculator",
        trigger: "calculator_interaction",
        productInterest: product.name,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, term]);
  // Editable monthly tracking fee for logbook products (standard Auto Loan +
  // Jikuze Auto). Only rendered when the tier defines tracking_fee_per_month.
  const [trackingFee, setTrackingFee] = useState(tier.tracking_fee_per_month ?? 0);
  const [editingTrackingFee, setEditingTrackingFee] = useState(false);

  // Check Off Loans are underwritten by salary affordability, not a chosen
  // amount - see the CW formula from Bidii's own check-off training material.
  const [basicSalary, setBasicSalary] = useState(60000);
  const [netSalary, setNetSalary] = useState(45000);

  // Reset tier + clamp amount/term whenever the product or tier changes.
  // This is React's recommended "adjust state during render" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect) rather than an
  // effect, since it's synchronizing state to a prop/selection change, not
  // an external system - an effect here would cause an extra render pass.
  const [prevProductSlug, setPrevProductSlug] = useState(productSlug);
  const [prevTierId, setPrevTierId] = useState(tierId);

  if (productSlug !== prevProductSlug) {
    setPrevProductSlug(productSlug);
    const firstTier = (allTiersByProduct[productSlug] ?? tiers)[0];
    setTierId(firstTier.tier_key);
    setPrevTierId(firstTier.tier_key);
    setAmount(firstTier.min_amount);
    setTerm(firstTier.min_term);
    setTrackingFee(firstTier.tracking_fee_per_month ?? 0);
    setEditingAmount(false);
    setEditingTerm(false);
    setEditingTrackingFee(false);
  } else if (tierId !== prevTierId) {
    setPrevTierId(tierId);
    setAmount((a) => Math.min(Math.max(a, tier.min_amount), tier.max_amount));
    setTerm((t) => Math.min(Math.max(t, tier.min_term), tier.max_term));
    setTrackingFee(tier.tracking_fee_per_month ?? 0);
    setEditingAmount(false);
    setEditingTerm(false);
    setEditingTrackingFee(false);
  }

  // Whether this tier's product carries a tracking fee at all (logbook products).
  // const hasTrackingFee = tier.tracking_fee_per_month !== undefined && tier.tracking_fee_per_month !== null;
  const hasTrackingFee =
  productSlug === "logbook-loans" &&
  tier.tracking_fee_per_month !== undefined &&
  tier.tracking_fee_per_month !== null;

  const affordability = useMemo(() => {
    const cw = Math.max(0, netSalary - basicSalary / 3);
    const termInMonths = termToMonths(term, tier.term_unit);
    const maxAmount = (cw * termInMonths) / (1 + tier.interest_rate * termInMonths);
    return { cw, maxAmount: Math.max(0, Math.round(maxAmount)) };
  }, [basicSalary, netSalary, term, tier]);

  const effectiveAmount = product.isAffordabilityBased ? affordability.maxAmount : amount;
  const schedule = useMemo(
    () => buildSchedule(tier, Math.max(effectiveAmount, 1), term, hasTrackingFee ? trackingFee : undefined),
    [tier, effectiveAmount, term, hasTrackingFee, trackingFee]
  );

  const periodLabel = tier.repayment_frequency === "weekly" ? "Week" : "Month";
  const installmentLabel = tier.repayment_frequency === "weekly" ? "Weekly repayment" : "Monthly repayment";

  function downloadCsv() {
    const header = `${periodLabel},Payment,Principal,Interest,Remaining Balance\n`;
    const body = schedule.rows
      .map((r) => `${r.period},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bidii-${product.slug}-repayment-schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHero
        eyebrow="Bidii Credit Loan Calculator"
        title="See your full repayment schedule"
        description="Choose a product and plan, set your amount and term, and get a month-by-month or week-by-week breakdown you can download before you apply."
      />

      {isFallback && (
        <div className="mx-auto mt-6 max-w-2xl px-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
            <Info size={14} className="shrink-0" />
            Showing standard rates - we couldn't reach the server for the latest terms.
          </div>
        </div>
      )}

      <div className="mx-auto mt-6 flex max-w-6xl items-center justify-end gap-2.5 px-5 lg:px-8">
        <span className="text-xs text-ink-500">Show exact figures (2dp)</span>
        <button
          type="button"
          role="switch"
          aria-checked={roundOff}
          aria-label="Toggle rounding of displayed figures"
          onClick={() => setRoundOff((r) => !r)}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: roundOff ? "var(--color-ember-500)" : "var(--color-mist-200)" }}
        >
          <span
            className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: roundOff ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
        <span className="text-xs text-ink-500">Round off</span>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-4 sm:py-4 lg:px-8 lg:py-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="h-fit rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
          >
            <div className="mb-5">
              <label className="mb-2 block text-sm text-ink-500">Loan product</label>
              <select
                value={productSlug}
                onChange={(e) => setProductSlug(e.target.value)}
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
              >
                {loanProducts.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </div>

            {tiers.length > 1 && (
              <div className="mb-6">
                <label className="mb-2 block text-sm text-ink-500">Plan</label>
                <select
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value)}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
                >
                  {tiers.map((t) => (
                    <option key={t.tier_key} value={t.tier_key}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            {product.isAffordabilityBased ? (
              <>
                <div className="mb-4 flex items-start gap-2.5 rounded-xl p-4 text-xs leading-relaxed" style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}>
                  <Info size={15} className="mt-0.5 shrink-0" />
                  Check Off Loans are underwritten by salary affordability, not a fixed
                  amount. Rate shown is set by your admin team and may be a placeholder
                  pending confirmed figures for this product.
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-sm text-ink-500">Basic salary (KES)</label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                  />
                </div>
                <div className="mb-5">
                  <label className="mb-2 block text-sm text-ink-500">Net salary (KES)</label>
                  <input
                    type="number"
                    value={netSalary}
                    onChange={(e) => setNetSalary(Number(e.target.value))}
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                  />
                </div>

                <div className="mb-6 rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--color-mist-50)" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Credit worthiness (max installment)</span>
                    <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(affordability.cw, roundOff)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-500">CW = Net salary − ⅓ × Basic salary</p>
                </div>
              </>
            ) : (
              <div className="mb-6">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
                  <label htmlFor="amount" className="text-ink-500">Loan amount</label>
                  {editingAmount ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        autoFocus
                        value={amount}
                        min={tier.min_amount}
                        max={tier.max_amount}
                        step={amountStep(tier)}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setAmount((a) => clamp(a, tier.min_amount, tier.max_amount));
                            setEditingAmount(false);
                          }
                        }}
                        className="w-24 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-28"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAmount((a) => clamp(a, tier.min_amount, tier.max_amount));
                          setEditingAmount(false);
                        }}
                        aria-label="Confirm amount"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: "var(--color-ember-500)" }}
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(amount, roundOff)}</span>
                      <button
                        type="button"
                        onClick={() => setEditingAmount(true)}
                        aria-label="Enter amount manually"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <input
                  id="amount"
                  type="range"
                  min={tier.min_amount}
                  max={tier.max_amount}
                  step={amountStep(tier)}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-[var(--color-ember-500)]"
                />
                <div className="mt-1 flex justify-between text-xs text-ink-500">
                  <span>{formatKes(tier.min_amount, roundOff)}</span>
                  <span>{formatKes(tier.max_amount, roundOff)}</span>
                </div>
              </div>
            )}

            <div className="mb-7">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
                <label htmlFor="term" className="text-ink-500">Repayment term</label>
                {editingTerm ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      autoFocus
                      value={term}
                      min={tier.min_term}
                      max={tier.max_term}
                      step={1}
                      onChange={(e) => setTerm(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setTerm((t) => clamp(t, tier.min_term, tier.max_term));
                          setEditingTerm(false);
                        }
                      }}
                      className="w-16 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-20"
                    />
                    <span className="text-xs text-ink-500">{tier.term_unit}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTerm((t) => clamp(t, tier.min_term, tier.max_term));
                        setEditingTerm(false);
                      }}
                      aria-label="Confirm term"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: "var(--color-ember-500)" }}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
                      {term} {tier.term_unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingTerm(true)}
                      aria-label="Enter term manually"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
              <input
                id="term"
                type="range"
                min={tier.min_term}
                max={tier.max_term}
                step={1}
                value={term}
                onChange={(e) => setTerm(Number(e.target.value))}
                className="w-full accent-[var(--color-ember-500)]"
              />
              <div className="mt-1 flex justify-between text-xs text-ink-500">
                <span>{tier.min_term} {tier.term_unit}</span>
                <span>{tier.max_term} {tier.term_unit}</span>
              </div>
            </div>

            {hasTrackingFee && (
              <div className="mb-7">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
                  <label htmlFor="trackingFee" className="text-ink-500">Tracking fee (per month)</label>
                  {editingTrackingFee ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        autoFocus
                        value={trackingFee}
                        min={TRACKING_FEE_MIN}
                        max={TRACKING_FEE_MAX}
                        step={TRACKING_FEE_STEP}
                        onChange={(e) => setTrackingFee(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setTrackingFee((f) => clamp(f, TRACKING_FEE_MIN, TRACKING_FEE_MAX));
                            setEditingTrackingFee(false);
                          }
                        }}
                        className="w-20 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-24"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTrackingFee((f) => clamp(f, TRACKING_FEE_MIN, TRACKING_FEE_MAX));
                          setEditingTrackingFee(false);
                        }}
                        aria-label="Confirm tracking fee"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: "var(--color-ember-500)" }}
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(trackingFee, roundOff)}</span>
                      <button
                        type="button"
                        onClick={() => setEditingTrackingFee(true)}
                        aria-label="Enter tracking fee manually"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <input
                  id="trackingFee"
                  type="range"
                  min={TRACKING_FEE_MIN}
                  max={TRACKING_FEE_MAX}
                  step={TRACKING_FEE_STEP}
                  value={trackingFee}
                  onChange={(e) => setTrackingFee(Number(e.target.value))}
                  className="w-full accent-[var(--color-ember-500)]"
                />
                <div className="mt-1 flex justify-between text-xs text-ink-500">
                  <span>{formatKes(TRACKING_FEE_MIN, roundOff)}</span>
                  <span>{formatKes(TRACKING_FEE_MAX, roundOff)}</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-500">
                  Rate varies by tracking company. Charged monthly for the {Math.round(termToMonths(term, tier.term_unit))}-month term (can also be paid upfront annually) and deducted from the net amount disbursed.
                </p>
              </div>
            )}

            {product.isAffordabilityBased && (
              <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--color-mist-50)" }}>
                <p className="text-xs text-ink-500">Maximum loan amount you qualify for</p>
                <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(affordability.maxAmount, roundOff)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
              <div>
                <p className="text-xs text-ink-500">{installmentLabel}</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(schedule.paymentPerInstallment, roundOff)}
                </p>
                {schedule.trackingFeePerMonth > 0 && (
                  <p className="mt-0.5 text-[11px] text-ink-500">+ {formatKes(schedule.trackingFeePerMonth, roundOff)}/month tracking fee</p>
                )}
              </div>
              <div>
                <p className="text-xs text-ink-500">Total interest</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(schedule.interestTotal, roundOff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Total repayment</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(schedule.totalRepayment, roundOff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Interest rate</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {(tier.interest_rate * 100).toFixed(1)}%{tier.interest_basis === "per_month" ? "/mo" : " flat"}
                </p>
              </div>
            </div>

            {canViewInternalFees ? (
              <div className="mt-5 space-y-2 rounded-2xl border border-mist-200 p-5 text-sm">
                <p className="mb-2 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
                  <Lock size={12} /> Fees & charges (staff only)
                </p>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-ink-500">Registration fee (paid upfront, separate)</span>
                  <span className="tabular text-ink-700">{formatKes(schedule.registrationFee ?? 0, roundOff)}</span>
                </div>
                {schedule.processingFee > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Loan processing fee ({((tier.processing_fee_rate ?? 0) * 100).toFixed(0)}%)</span>
                    <span className="tabular text-ink-700">{formatKes(schedule.processingFee, roundOff)}</span>
                  </div>
                )}
                {schedule.lifeInsuranceFee > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Life insurance fee ({((tier.life_insurance_fee_rate ?? 0) * 100).toFixed(0)}%)</span>
                    <span className="tabular text-ink-700">{formatKes(schedule.lifeInsuranceFee, roundOff)}</span>
                  </div>
                )}
                {schedule.chattelFee > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Chattel/legal fee</span>
                    <span className="tabular text-ink-700">{formatKes(schedule.chattelFee, roundOff)}</span>
                  </div>
                )}
                {schedule.inchargeFee > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Incharge fee</span>
                    <span className="tabular text-ink-700">{formatKes(schedule.inchargeFee, roundOff)}</span>
                  </div>
                )}
                {schedule.trackingFeeTotal > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Tracking fee ({formatKes(schedule.trackingFeePerMonth, roundOff)}/month × {Math.round(termToMonths(term, tier.term_unit))})</span>
                    <span className="tabular text-ink-700">{formatKes(schedule.trackingFeeTotal, roundOff)}</span>
                  </div>
                )}
                {schedule.exciseDuty > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Excise duty (20% on LPF + chattel)</span>
                    <span className="tabular text-ink-700">{formatKes(schedule.exciseDuty, roundOff)}</span>
                  </div>
                )}
                {tier.guarantors != null && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Guarantors required</span>
                    <span className="tabular text-ink-700">{tier.guarantors}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-mist-200 pt-2 font-semibold">
                  <span style={{ color: "var(--color-ink-900)" }}>Net amount disbursed</span>
                  <span className="tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(schedule.netDisbursed, roundOff)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-500">
                <Lock size={12} />
                Fee breakdown & net disbursed amount are visible to Bidii staff.{" "}
                <Link to="/admin/login?next=/calculator" className="font-medium underline text-ember-500 hover:text-ember-400">
                  Staff login
                </Link>
              </p>
            )}

            <button
              onClick={downloadCsv}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: "var(--color-navy-900)" }}
            >
              <Download size={16} className="shrink-0" />
              Download Repayment Schedule (CSV)
            </button>
            <p className="mt-3 text-xs text-ink-500">
              Estimate only. Your final offer depends on product terms and your credit assessment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
          >
            <p className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
              Outstanding balance over time
            </p>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={schedule.rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist-200)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
                  <Tooltip
                    formatter={((v: unknown) => formatKes(Number(Array.isArray(v) ? v[0] : v) || 0, roundOff)) as never}
                    labelFormatter={(l) => `${periodLabel} ${l}`}
                  />
                  <Area type="monotone" dataKey="balance" stroke="var(--color-navy-900)" fill="url(#balanceFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 max-h-64 overflow-auto rounded-xl border border-mist-200 sm:max-h-72">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="sticky top-0 bg-mist-50 text-xs text-ink-500">
                  <tr>
                    <th className="px-3 py-2.5 font-medium sm:px-4">{periodLabel}</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Payment</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Interest</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-200">
                  {schedule.rows.map((r) => (
                    <tr key={r.period}>
                      <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{r.period}</td>
                      <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{formatKes(r.payment, roundOff)}</td>
                      <td className="px-3 py-2.5 tabular text-ink-500 sm:px-4">{formatKes(r.interest, roundOff)}</td>
                      <td className="px-3 py-2.5 tabular font-semibold sm:px-4" style={{ color: "var(--color-ink-900)" }}>
                        {formatKes(r.balance, roundOff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 rounded-2xl border border-mist-200 p-5 sm:p-6">
              <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
                What you'll need for {product.name}
              </p>
              <div className="overflow-auto pr-1">
                {product.eligibility.length > 0 && (
                  <>
                    <p className="mb-1.5 text-xs font-semibold text-ink-700">Eligibility</p>
                    <ul className="mb-4 space-y-1 text-xs text-ink-700">
                      {product.eligibility.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-ink-500">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {product.requirements.length > 0 && (
                  <>
                    <p className="mb-1.5 text-xs font-semibold text-ink-700">Documents required</p>
                    <ul className="space-y-1 text-xs text-ink-700">
                      {product.requirements.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-ink-500">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            <p className="mt-auto text-center text-sm text-orange-500 italic">
              Partners For Growth
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}

/**
 * Dedicated Check Off Loans calculator — this product is underwritten by
 * salary affordability against a duration-based rate/factor table, not by
 * a simple amount slider, so it doesn't share the generic CalculatorBody's
 * logic at all. Matches Bidii's real check-off calculator
 * (loan_calculator_.xlsx): see src/data/checkOffRateTable.ts for the
 * extracted rate/factor/fee constants and formula notes.
 */
function CheckOffCalculatorBody({
  productSlug,
  setProductSlug,
  isFallback,
  roundOff,
  setRoundOff,
}: {
  productSlug: string;
  setProductSlug: (slug: string) => void;
  isFallback: boolean;
  roundOff: boolean;
  setRoundOff: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const product = useMemo(
    () => loanProducts.find((p) => p.slug === productSlug) ?? loanProducts[0],
    [productSlug]
  );

  // Same staff-only gate as CalculatorBody — see the comment there.
  const { isAuthenticated, role } = useAdminAuth();
  const canViewInternalFees = isAuthenticated && role !== null && PRIVILEGED_ROLES.has(role);

  const [basicSalary, setBasicSalary] = useState(62156);
  const [netPay, setNetPay] = useState(21333);
  const [lessArrears, setLessArrears] = useState(0);
  const [buyoffInstallment, setBuyoffInstallment] = useState(0);
  const [buyoffBalance, setBuyoffBalance] = useState(0);
  const [termMonths, setTermMonths] = useState(12);
  const [loanAmount, setLoanAmount] = useState(50000);
  const [retirementDate, setRetirementDate] = useState("");

    // Fires the "tried to calculate a loan" intent trigger the first time the
  // visitor changes the amount or term away from their defaults.
  const { requestIntent } = useEngagement();
  const hasFiredCalcAttempt = useRef(false);
  useEffect(() => {
    if (hasFiredCalcAttempt.current) return;
    if (loanAmount !== 50000 || termMonths !== 12) {
      hasFiredCalcAttempt.current = true;
      requestIntent({
        sourcePage: "calculator",
        trigger: "calculator_interaction",
        productInterest: product.name,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanAmount, termMonths]);

  const result = useMemo(() => {
    const thirdOfBasic = basicSalary / 3;
    const actualNet = netPay - lessArrears;
    const affordability = actualNet - thirdOfBasic + buyoffInstallment;

    const rateRow = findCheckOffRateRow(termMonths);
    const maxQualified = affordability > 0 ? affordability / rateRow.factor : 0;

    const laf = loanAmount > 0 ? CHECK_OFF_FEES.LAF : 0;
    const lpf = loanAmount * CHECK_OFF_FEES.LPF;
    const insuranceFee = loanAmount * CHECK_OFF_FEES.IF;
    const totalCharges = laf + lpf + insuranceFee;

    // ROUNDUP(loanAmount * term * (rate + 100/loanAmount), 0), expanded to
    // avoid dividing by a possibly-zero loanAmount.
    const totalInterest = Math.ceil(termMonths * (loanAmount * rateRow.monthlyInterestRate + 100));
    const totalLoanPayable = loanAmount + totalInterest;
    const installmentRequired = totalLoanPayable / termMonths;
    const takeHomeAmount = loanAmount - (totalCharges + buyoffBalance);
    const remainingAffordability = affordability - installmentRequired;

    let maxEligibleTerm: number | null = null;
    if (retirementDate) {
      const today = new Date();
      const rod = new Date(retirementDate);
      const months = (rod.getFullYear() - today.getFullYear()) * 12 + (rod.getMonth() - today.getMonth());
      maxEligibleTerm = Math.max(0, months - 3);
    }

    return {
      thirdOfBasic,
      actualNet,
      affordability,
      rateRow,
      maxQualified,
      laf,
      lpf,
      insuranceFee,
      totalCharges,
      totalInterest,
      totalLoanPayable,
      installmentRequired,
      takeHomeAmount,
      remainingAffordability,
      maxEligibleTerm,
    };
  }, [basicSalary, netPay, lessArrears, buyoffInstallment, buyoffBalance, termMonths, loanAmount, retirementDate]);

  const scheduleRows = useMemo(() => {
    const principalPerMonth = loanAmount / termMonths;
    return Array.from({ length: termMonths }, (_, i) => ({
      period: i + 1,
      balance: Math.max(loanAmount - principalPerMonth * (i + 1), 0),
    }));
  }, [loanAmount, termMonths]);

  function downloadCsv() {
    const header = "Month,Installment,Remaining Balance\n";
    const body = scheduleRows
      .map((r) => `${r.period},${result.installmentRequired.toFixed(2)},${r.balance.toFixed(2)}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bidii-check-off-loan-schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const overAffordability = result.remainingAffordability < 0;
  const overRetirementCap = result.maxEligibleTerm !== null && termMonths > result.maxEligibleTerm;

  return (
    <>
      <PageHero
        eyebrow="Bidii Credit Loan Calculator"
        title="Check Off Loan affordability calculator"
        description="Enter your salary details to see exactly what you qualify for, matching the same calculation your loan officer uses."
      />

      {isFallback && (
        <div className="mx-auto mt-6 max-w-2xl px-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
            <Info size={14} className="shrink-0" />
            Showing standard rates — we couldn't reach the server for the latest terms.
          </div>
        </div>
      )}

      <div className="mx-auto mt-6 flex max-w-6xl items-center justify-end gap-2.5 px-5 lg:px-8">
        <span className="text-xs text-ink-500">Show exact figures (2dp)</span>
        <button
          type="button"
          role="switch"
          aria-checked={roundOff}
          aria-label="Toggle rounding of displayed figures"
          onClick={() => setRoundOff((r) => !r)}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: roundOff ? "var(--color-ember-500)" : "var(--color-mist-200)" }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: roundOff ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
        <span className="text-xs text-ink-500">Round off</span>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="h-fit rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
          >
            <div className="mb-5">
              <label className="mb-2 block text-sm text-ink-500">Loan product</label>
              <select
                value={productSlug}
                onChange={(e) => setProductSlug(e.target.value)}
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
              >
                {loanProducts.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </div>

            <p className="mb-4 font-display text-xs font-bold uppercase tracking-wide text-ink-500">Your salary</p>

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Basic salary (KES)</label>
                <input
                  type="number"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Current net pay (KES)</label>
                <input
                  type="number"
                  value={netPay}
                  onChange={(e) => setNetPay(Number(e.target.value))}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm text-ink-500">Less: salary arrears / unusable allowances (KES)</label>
              <input
                type="number"
                value={lessArrears}
                onChange={(e) => setLessArrears(Number(e.target.value))}
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
              />
            </div>

            <p className="mb-4 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
              Existing loan to pay off (leave as 0 if none)
            </p>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Its monthly installment (KES)</label>
                <input
                  type="number"
                  value={buyoffInstallment}
                  onChange={(e) => setBuyoffInstallment(Number(e.target.value))}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Its payoff balance (KES)</label>
                <input
                  type="number"
                  value={buyoffBalance}
                  onChange={(e) => setBuyoffBalance(Number(e.target.value))}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-6 rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--color-mist-50)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-ink-500">Affordability (max installment)</span>
                <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(result.affordability, roundOff)}</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-500">(Net pay − ⅓ × Basic) + existing installment being paid off</p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Loan term</label>
                <select
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
                >
                  {CHECK_OFF_RATE_TABLE.map((row: any) => (
                    <option key={row.durationMonths} value={row.durationMonths}>
                      {row.durationMonths} months ({(row.monthlyInterestRate * 100).toFixed(2)}%/mo)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Loan amount applied (KES)</label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm text-ink-500">Retirement date (optional — caps your eligible term)</label>
              <input
                type="date"
                value={retirementDate}
                onChange={(e) => setRetirementDate(e.target.value)}
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
              />
              {overRetirementCap && (
                <p className="mt-1.5 text-xs text-red-500">
                  This term exceeds your maximum eligible period of {result.maxEligibleTerm} months before retirement.
                </p>
              )}
            </div>

            <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--color-mist-50)" }}>
              <p className="text-xs text-ink-500">Maximum loan you qualify for at this term</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                {formatKes(result.maxQualified, roundOff)}
              </p>
            </div>

            {overAffordability && (
              <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-600">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                This amount and term exceed your affordability by {formatKes(Math.abs(result.remainingAffordability), roundOff)}/month.
                Reduce the amount or extend the term.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
              <div>
                <p className="text-xs text-ink-500">Monthly installment</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(result.installmentRequired, roundOff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Total interest</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(result.totalInterest, roundOff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Total repayment</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(result.totalLoanPayable, roundOff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Interest rate</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {(result.rateRow.monthlyInterestRate * 100).toFixed(2)}%/mo
                </p>
              </div>
            </div>

            {canViewInternalFees ? (
              <div className="mt-5 space-y-2 rounded-2xl border border-mist-200 p-5 text-sm">
                <p className="mb-2 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
                  <Lock size={12} /> Fees & charges (staff only)
                </p>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-ink-500">Loan application fee</span>
                  <span className="tabular text-ink-700">{formatKes(result.laf, roundOff)}</span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-ink-500">Loan processing fee (3%)</span>
                  <span className="tabular text-ink-700">{formatKes(result.lpf, roundOff)}</span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-ink-500">Insurance fee (1%)</span>
                  <span className="tabular text-ink-700">{formatKes(result.insuranceFee, roundOff)}</span>
                </div>
                {buyoffBalance > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-ink-500">Existing loan payoff balance</span>
                    <span className="tabular text-ink-700">{formatKes(buyoffBalance, roundOff)}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-mist-200 pt-2 font-semibold">
                  <span style={{ color: "var(--color-ink-900)" }}>Take-home amount</span>
                  <span className="tabular" style={{ color: result.takeHomeAmount < 0 ? "#DC2626" : "var(--color-ink-900)" }}>
                    {formatKes(result.takeHomeAmount, roundOff)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-500">
                <Lock size={12} />
                Fee breakdown and take-home amount are visible to Bidii staff.{" "}
                <Link to="/admin/login?next=/calculator" className="font-medium underline hover:text-ink-700">
                  Staff login
                </Link>
              </p>
            )}

            <button
              onClick={downloadCsv}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: "var(--color-navy-900)" }}
            >
              <Download size={16} className="shrink-0" />
              Download Repayment Schedule (CSV)
            </button>
            <p className="mt-3 text-xs text-ink-500">
              Estimate only. Your final offer depends on employer verification and credit assessment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
          >
            <p className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
              Outstanding balance over time
            </p>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scheduleRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="checkOffBalanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist-200)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
                  <Tooltip
                    formatter={((v: unknown) => formatKes(Number(Array.isArray(v) ? v[0] : v) || 0, roundOff)) as never}
                    labelFormatter={(l) => `Month ${l}`}
                  />
                  <Area type="monotone" dataKey="balance" stroke="var(--color-navy-900)" fill="url(#checkOffBalanceFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 max-h-64 overflow-auto rounded-xl border border-mist-200 sm:max-h-72">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="sticky top-0 bg-mist-50 text-xs text-ink-500">
                  <tr>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Month</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Installment</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist-200">
                  {scheduleRows.map((r) => (
                    <tr key={r.period}>
                      <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{r.period}</td>
                      <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{formatKes(result.installmentRequired, roundOff)}</td>
                      <td className="px-3 py-2.5 tabular font-semibold sm:px-4" style={{ color: "var(--color-ink-900)" }}>
                        {formatKes(r.balance, roundOff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 rounded-2xl border border-mist-200 p-5 sm:p-6">
              <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
                What you'll need for {product.name}
              </p>
              <div className="overflow-auto pr-1">
                {product.eligibility.length > 0 && (
                  <>
                    <p className="mb-1.5 text-xs font-semibold text-ink-700">Eligibility</p>
                    <ul className="mb-4 space-y-1 text-xs text-ink-700">
                      {product.eligibility.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-ink-500">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {product.requirements.length > 0 && (
                  <>
                    <p className="mb-1.5 text-xs font-semibold text-ink-700">Documents required</p>
                    <ul className="space-y-1 text-xs text-ink-700">
                      {product.requirements.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-ink-500">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            <p className="mt-auto text-center text-sm text-orange-500 italic">
              Partners For Growth
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}

// import { useMemo, useState, useEffect, useRef } from "react";
// import { motion } from "framer-motion";
// import { Download, Info, Pencil, Check, AlertCircle } from "lucide-react";
// import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
// import PageHero from "../components/ui/PageHero";
// import { usePageMeta } from "../lib/usePageMeta";
// import { loanProducts } from "../data/content";
// import { useLoanTiers, type LoanTier } from "../lib/useLoanTiers";
// import { CHECK_OFF_FEES, findCheckOffRateRow, CHECK_OFF_RATE_TABLE } from "../data/checkOffRateTable";
// import { useEngagement } from "../lib/EngagementContext";

// function formatKes(n: number, roundOff: boolean = true) {
//   return roundOff
//     ? "KES " + Math.round(n).toLocaleString("en-KE")
//     : "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// }

// /** 4 weeks = 1 month, matching how Bidii itself defines weekly-repayment tiers. */
// function termToMonths(term: number, unit: "weeks" | "months") {
//   return unit === "months" ? term : term / 4;
// }

// function amountStep(tier: LoanTier) {
//   return tier.max_amount <= 100_000 ? 500 : 5_000;
// }

// function clamp(value: number, min: number, max: number) {
//   if (Number.isNaN(value)) return min;
//   return Math.min(Math.max(value, min), max);
// }

// /**
//  * The tracking fee's KES-per-month rate isn't fixed - it varies by which
//  * tracking company (e.g. Regent/Jawabu) handles a given vehicle, per Bidii's
//  * Auto/Logbook training material. This range keeps the slider centered on
//  * the standard 1,500/month rate while allowing for that variance.
//  */
// const TRACKING_FEE_MIN = 500;
// const TRACKING_FEE_MAX = 3000;
// const TRACKING_FEE_STEP = 100;

// type ScheduleRow = {
//   period: number;
//   payment: number;
//   principal: number;
//   interest: number;
//   balance: number;
// };

// function buildSchedule(tier: LoanTier, amount: number, term: number, trackingFeePerMonthOverride?: number) {
//   const termInMonths = termToMonths(term, tier.term_unit);
//   const interestTotal =
//     tier.interest_basis === "flat_over_term" ? amount * tier.interest_rate : amount * tier.interest_rate * termInMonths;
//   const totalRepayment = amount + interestTotal;
//   const installmentCount = Math.max(1, Math.round(term));
//   const principalPerInstallment = amount / installmentCount;
//   const interestPerInstallment = interestTotal / installmentCount;
//   const paymentPerInstallment = totalRepayment / installmentCount;

//   const rows: ScheduleRow[] = Array.from({ length: installmentCount }, (_, i) => ({
//     period: i + 1,
//     payment: paymentPerInstallment,
//     principal: principalPerInstallment,
//     interest: interestPerInstallment,
//     balance: Math.max(amount - principalPerInstallment * (i + 1), 0),
//   }));

//   // One-time fees, all based on the requested principal.
//   const processingFee = amount * tier.processing_fee_rate;
//   const lifeInsuranceFee = amount * tier.life_insurance_fee_rate;
//   const chattelFee = tier.chattel_fee ?? 0;
//   const inchargeFee = tier.incharge_fee ?? 0;
//   const exciseDuty = (tier.excise_duty_on_fees_rate ?? 0) * (processingFee + chattelFee);
//   // Logbook products (standard Auto Loan + Jikuze Auto) carry a monthly vehicle
//   // tracking fee. The rate varies by tracking company, so it's editable here,
//   // defaulting to the tier's configured rate.
//   const trackingFeePerMonth = trackingFeePerMonthOverride ?? tier.tracking_fee_per_month ?? 0;
//   const trackingFeeTotal = trackingFeePerMonth * termInMonths;

//   // Registration fee is paid upfront by the client as a separate facilitation
//   // fee (per the SME appraisal process); everything else - including the
//   // tracking fee - is deducted from the disbursed loan proceeds.
//   const deductedFromLoan = processingFee + lifeInsuranceFee + chattelFee + inchargeFee + exciseDuty + trackingFeeTotal;
//   const netDisbursed = amount - deductedFromLoan;

//   return {
//     rows,
//     interestTotal,
//     totalRepayment,
//     paymentPerInstallment,
//     processingFee,
//     lifeInsuranceFee,
//     chattelFee,
//     inchargeFee,
//     exciseDuty,
//     trackingFeePerMonth,
//     trackingFeeTotal,
//     registrationFee: tier.registration_fee,
//     netDisbursed,
//   };
// }

// export default function Calculator() {
//   usePageMeta("Loan Calculator");
//   const { tiersByProduct, loading: tiersLoading, isFallback } = useLoanTiers();

//     // Starts/stops the 5-minutes-on-this-page intent timer for as long as this
//   // component is mounted, regardless of which product/tier is selected.
//   const { setOnCalculatorPage } = useEngagement();
//   useEffect(() => {
//     setOnCalculatorPage(true);
//     return () => setOnCalculatorPage(false);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const [productSlug, setProductSlug] = useState(loanProducts[0].slug);
//   const product = useMemo(
//     () => loanProducts.find((p) => p.slug === productSlug) ?? loanProducts[0],
//     [productSlug]
//   );

//   // Whether displayed figures are rounded to whole KES (on) or shown to
//   // 2 decimal places (off). Applies across the whole calculator.
//   const [roundOff, setRoundOff] = useState(true);

//   const tiers = tiersByProduct[productSlug] ?? [];

//   if (tiersLoading) {
//     return (
//       <section className="mx-auto max-w-2xl px-5 py-24 text-center">
//         <p className="text-sm text-ink-500">Loading loan terms…</p>
//       </section>
//     );
//   }

//   if (tiers.length === 0) {
//     return (
//       <section className="mx-auto max-w-2xl px-5 py-24">
//         <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
//           <AlertCircle size={16} />
//           No loan terms are configured for this product yet.
//         </div>
//       </section>
//     );
//   }

//   return product.isAffordabilityBased ? (
//     <CheckOffCalculatorBody
//       productSlug={productSlug}
//       setProductSlug={setProductSlug}
//       isFallback={isFallback}
//       roundOff={roundOff}
//       setRoundOff={setRoundOff}
//     />
//   ) : (
//     <CalculatorBody
//       product={product}
//       productSlug={productSlug}
//       setProductSlug={setProductSlug}
//       tiers={tiers}
//       allTiersByProduct={tiersByProduct}
//       isFallback={isFallback}
//       roundOff={roundOff}
//       setRoundOff={setRoundOff}
//     />
//   );
// }

// function CalculatorBody({
//   product,
//   productSlug,
//   setProductSlug,
//   tiers,
//   allTiersByProduct,
//   isFallback,
//   roundOff,
//   setRoundOff,
// }: {
//   product: (typeof loanProducts)[number];
//   productSlug: string;
//   setProductSlug: (slug: string) => void;
//   tiers: LoanTier[];
//   allTiersByProduct: Record<string, LoanTier[]>;
//   isFallback: boolean;
//   roundOff: boolean;
//   setRoundOff: (value: boolean | ((prev: boolean) => boolean)) => void;
// }) {
//   const [tierId, setTierId] = useState(tiers[0].tier_key);
//   const tier = useMemo(
//     () => tiers.find((t) => t.tier_key === tierId) ?? tiers[0],
//     [tiers, tierId]
//   );

//   const [amount, setAmount] = useState(tier.min_amount);
//   const [term, setTerm] = useState(tier.min_term);
//   const [editingAmount, setEditingAmount] = useState(false);
//   const [editingTerm, setEditingTerm] = useState(false);
//     // Fires the "tried to calculate a loan" intent trigger the first time the
//   // visitor genuinely changes amount/term (not when a tier/product switch
//   // resets them back to the tier's defaults - baselineRef tracks that).
//   const { requestIntent } = useEngagement();
//   const hasFiredCalcAttempt = useRef(false);
//   const baselineRef = useRef({ amount: tier.min_amount, term: tier.min_term });
//   useEffect(() => {
//     if (hasFiredCalcAttempt.current) return;
//     if (amount !== baselineRef.current.amount || term !== baselineRef.current.term) {
//       hasFiredCalcAttempt.current = true;
//       requestIntent({
//         sourcePage: "calculator",
//         trigger: "calculator_interaction",
//         productInterest: product.name,
//       });
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [amount, term]);
//   // Editable monthly tracking fee for logbook products (standard Auto Loan +
//   // Jikuze Auto). Only rendered when the tier defines tracking_fee_per_month.
//   const [trackingFee, setTrackingFee] = useState(tier.tracking_fee_per_month ?? 0);
//   const [editingTrackingFee, setEditingTrackingFee] = useState(false);

//   // Check Off Loans are underwritten by salary affordability, not a chosen
//   // amount - see the CW formula from Bidii's own check-off training material.
//   const [basicSalary, setBasicSalary] = useState(60000);
//   const [netSalary, setNetSalary] = useState(45000);

//   // Reset tier + clamp amount/term whenever the product or tier changes.
//   // This is React's recommended "adjust state during render" pattern
//   // (https://react.dev/learn/you-might-not-need-an-effect) rather than an
//   // effect, since it's synchronizing state to a prop/selection change, not
//   // an external system - an effect here would cause an extra render pass.
//   const [prevProductSlug, setPrevProductSlug] = useState(productSlug);
//   const [prevTierId, setPrevTierId] = useState(tierId);

//   if (productSlug !== prevProductSlug) {
//     setPrevProductSlug(productSlug);
//     const firstTier = (allTiersByProduct[productSlug] ?? tiers)[0];
//     setTierId(firstTier.tier_key);
//     setPrevTierId(firstTier.tier_key);
//     setAmount(firstTier.min_amount);
//     setTerm(firstTier.min_term);
//     setTrackingFee(firstTier.tracking_fee_per_month ?? 0);
//     setEditingAmount(false);
//     setEditingTerm(false);
//     setEditingTrackingFee(false);
//   } else if (tierId !== prevTierId) {
//     setPrevTierId(tierId);
//     setAmount((a) => Math.min(Math.max(a, tier.min_amount), tier.max_amount));
//     setTerm((t) => Math.min(Math.max(t, tier.min_term), tier.max_term));
//     setTrackingFee(tier.tracking_fee_per_month ?? 0);
//     setEditingAmount(false);
//     setEditingTerm(false);
//     setEditingTrackingFee(false);
//   }

//   // Whether this tier's product carries a tracking fee at all (logbook products).
//   // const hasTrackingFee = tier.tracking_fee_per_month !== undefined && tier.tracking_fee_per_month !== null;
//   const hasTrackingFee =
//   productSlug === "logbook-loans" &&
//   tier.tracking_fee_per_month !== undefined &&
//   tier.tracking_fee_per_month !== null;

//   const affordability = useMemo(() => {
//     const cw = Math.max(0, netSalary - basicSalary / 3);
//     const termInMonths = termToMonths(term, tier.term_unit);
//     const maxAmount = (cw * termInMonths) / (1 + tier.interest_rate * termInMonths);
//     return { cw, maxAmount: Math.max(0, Math.round(maxAmount)) };
//   }, [basicSalary, netSalary, term, tier]);

//   const effectiveAmount = product.isAffordabilityBased ? affordability.maxAmount : amount;
//   const schedule = useMemo(
//     () => buildSchedule(tier, Math.max(effectiveAmount, 1), term, hasTrackingFee ? trackingFee : undefined),
//     [tier, effectiveAmount, term, hasTrackingFee, trackingFee]
//   );

//   const periodLabel = tier.repayment_frequency === "weekly" ? "Week" : "Month";
//   const installmentLabel = tier.repayment_frequency === "weekly" ? "Weekly repayment" : "Monthly repayment";

//   function downloadCsv() {
//     const header = `${periodLabel},Payment,Principal,Interest,Remaining Balance\n`;
//     const body = schedule.rows
//       .map((r) => `${r.period},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`)
//       .join("\n");
//     const blob = new Blob([header + body], { type: "text/csv" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `bidii-${product.slug}-repayment-schedule.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   }

//   return (
//     <>
//       <PageHero
//         eyebrow="Bidii Credit Loan Calculator"
//         title="See your full repayment schedule"
//         description="Choose a product and plan, set your amount and term, and get a month-by-month or week-by-week breakdown you can download before you apply."
//       />

//       {isFallback && (
//         <div className="mx-auto mt-6 max-w-2xl px-5">
//           <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
//             <Info size={14} className="shrink-0" />
//             Showing standard rates - we couldn't reach the server for the latest terms.
//           </div>
//         </div>
//       )}

//       <div className="mx-auto mt-6 flex max-w-6xl items-center justify-end gap-2.5 px-5 lg:px-8">
//         <span className="text-xs text-ink-500">Show exact figures (2dp)</span>
//         <button
//           type="button"
//           role="switch"
//           aria-checked={roundOff}
//           aria-label="Toggle rounding of displayed figures"
//           onClick={() => setRoundOff((r) => !r)}
//           className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
//           style={{ backgroundColor: roundOff ? "var(--color-ember-500)" : "var(--color-mist-200)" }}
//         >
//           <span
//             className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
//             style={{ transform: roundOff ? "translateX(22px)" : "translateX(2px)" }}
//           />
//         </button>
//         <span className="text-xs text-ink-500">Round off</span>
//       </div>

//       <section className="mx-auto max-w-6xl px-5 py-4 sm:py-4 lg:px-8 lg:py-6">
//         <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
//           <motion.div
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//             transition={{ duration: 0.5 }}
//             className="h-fit rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
//           >
//             <div className="mb-5">
//               <label className="mb-2 block text-sm text-ink-500">Loan product</label>
//               <select
//                 value={productSlug}
//                 onChange={(e) => setProductSlug(e.target.value)}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//               >
//                 {loanProducts.map((p) => (
//                   <option key={p.slug} value={p.slug}>{p.name}</option>
//                 ))}
//               </select>
//             </div>

//             {tiers.length > 1 && (
//               <div className="mb-6">
//                 <label className="mb-2 block text-sm text-ink-500">Plan</label>
//                 <select
//                   value={tierId}
//                   onChange={(e) => setTierId(e.target.value)}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//                 >
//                   {tiers.map((t) => (
//                     <option key={t.tier_key} value={t.tier_key}>{t.label}</option>
//                   ))}
//                 </select>
//               </div>
//             )}

//             {product.isAffordabilityBased ? (
//               <>
//                 <div className="mb-4 flex items-start gap-2.5 rounded-xl p-4 text-xs leading-relaxed" style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}>
//                   <Info size={15} className="mt-0.5 shrink-0" />
//                   Check Off Loans are underwritten by salary affordability, not a fixed
//                   amount. Rate shown is set by your admin team and may be a placeholder
//                   pending confirmed figures for this product.
//                 </div>

//                 <div className="mb-5">
//                   <label className="mb-2 block text-sm text-ink-500">Basic salary (KES)</label>
//                   <input
//                     type="number"
//                     value={basicSalary}
//                     onChange={(e) => setBasicSalary(Number(e.target.value))}
//                     className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                   />
//                 </div>
//                 <div className="mb-5">
//                   <label className="mb-2 block text-sm text-ink-500">Net salary (KES)</label>
//                   <input
//                     type="number"
//                     value={netSalary}
//                     onChange={(e) => setNetSalary(Number(e.target.value))}
//                     className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                   />
//                 </div>

//                 <div className="mb-6 rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--color-mist-50)" }}>
//                   <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                     <span className="text-ink-500">Credit worthiness (max installment)</span>
//                     <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(affordability.cw, roundOff)}</span>
//                   </div>
//                   <p className="mt-1.5 text-xs text-ink-500">CW = Net salary − ⅓ × Basic salary</p>
//                 </div>
//               </>
//             ) : (
//               <div className="mb-6">
//                 <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
//                   <label htmlFor="amount" className="text-ink-500">Loan amount</label>
//                   {editingAmount ? (
//                     <div className="flex items-center gap-1.5">
//                       <input
//                         type="number"
//                         autoFocus
//                         value={amount}
//                         min={tier.min_amount}
//                         max={tier.max_amount}
//                         step={amountStep(tier)}
//                         onChange={(e) => setAmount(Number(e.target.value))}
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             setAmount((a) => clamp(a, tier.min_amount, tier.max_amount));
//                             setEditingAmount(false);
//                           }
//                         }}
//                         className="w-24 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-28"
//                       />
//                       <button
//                         type="button"
//                         onClick={() => {
//                           setAmount((a) => clamp(a, tier.min_amount, tier.max_amount));
//                           setEditingAmount(false);
//                         }}
//                         aria-label="Confirm amount"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
//                         style={{ backgroundColor: "var(--color-ember-500)" }}
//                       >
//                         <Check size={12} />
//                       </button>
//                     </div>
//                   ) : (
//                     <div className="flex items-center gap-1.5">
//                       <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(amount, roundOff)}</span>
//                       <button
//                         type="button"
//                         onClick={() => setEditingAmount(true)}
//                         aria-label="Enter amount manually"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
//                       >
//                         <Pencil size={12} />
//                       </button>
//                     </div>
//                   )}
//                 </div>
//                 <input
//                   id="amount"
//                   type="range"
//                   min={tier.min_amount}
//                   max={tier.max_amount}
//                   step={amountStep(tier)}
//                   value={amount}
//                   onChange={(e) => setAmount(Number(e.target.value))}
//                   className="w-full accent-[var(--color-ember-500)]"
//                 />
//                 <div className="mt-1 flex justify-between text-xs text-ink-500">
//                   <span>{formatKes(tier.min_amount, roundOff)}</span>
//                   <span>{formatKes(tier.max_amount, roundOff)}</span>
//                 </div>
//               </div>
//             )}

//             <div className="mb-7">
//               <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
//                 <label htmlFor="term" className="text-ink-500">Repayment term</label>
//                 {editingTerm ? (
//                   <div className="flex items-center gap-1.5">
//                     <input
//                       type="number"
//                       autoFocus
//                       value={term}
//                       min={tier.min_term}
//                       max={tier.max_term}
//                       step={1}
//                       onChange={(e) => setTerm(Number(e.target.value))}
//                       onKeyDown={(e) => {
//                         if (e.key === "Enter") {
//                           setTerm((t) => clamp(t, tier.min_term, tier.max_term));
//                           setEditingTerm(false);
//                         }
//                       }}
//                       className="w-16 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-20"
//                     />
//                     <span className="text-xs text-ink-500">{tier.term_unit}</span>
//                     <button
//                       type="button"
//                       onClick={() => {
//                         setTerm((t) => clamp(t, tier.min_term, tier.max_term));
//                         setEditingTerm(false);
//                       }}
//                       aria-label="Confirm term"
//                       className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
//                       style={{ backgroundColor: "var(--color-ember-500)" }}
//                     >
//                       <Check size={12} />
//                     </button>
//                   </div>
//                 ) : (
//                   <div className="flex items-center gap-1.5">
//                     <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
//                       {term} {tier.term_unit}
//                     </span>
//                     <button
//                       type="button"
//                       onClick={() => setEditingTerm(true)}
//                       aria-label="Enter term manually"
//                       className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
//                     >
//                       <Pencil size={12} />
//                     </button>
//                   </div>
//                 )}
//               </div>
//               <input
//                 id="term"
//                 type="range"
//                 min={tier.min_term}
//                 max={tier.max_term}
//                 step={1}
//                 value={term}
//                 onChange={(e) => setTerm(Number(e.target.value))}
//                 className="w-full accent-[var(--color-ember-500)]"
//               />
//               <div className="mt-1 flex justify-between text-xs text-ink-500">
//                 <span>{tier.min_term} {tier.term_unit}</span>
//                 <span>{tier.max_term} {tier.term_unit}</span>
//               </div>
//             </div>

//             {hasTrackingFee && (
//               <div className="mb-7">
//                 <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
//                   <label htmlFor="trackingFee" className="text-ink-500">Tracking fee (per month)</label>
//                   {editingTrackingFee ? (
//                     <div className="flex items-center gap-1.5">
//                       <input
//                         type="number"
//                         autoFocus
//                         value={trackingFee}
//                         min={TRACKING_FEE_MIN}
//                         max={TRACKING_FEE_MAX}
//                         step={TRACKING_FEE_STEP}
//                         onChange={(e) => setTrackingFee(Number(e.target.value))}
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             setTrackingFee((f) => clamp(f, TRACKING_FEE_MIN, TRACKING_FEE_MAX));
//                             setEditingTrackingFee(false);
//                           }
//                         }}
//                         className="w-20 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-24"
//                       />
//                       <button
//                         type="button"
//                         onClick={() => {
//                           setTrackingFee((f) => clamp(f, TRACKING_FEE_MIN, TRACKING_FEE_MAX));
//                           setEditingTrackingFee(false);
//                         }}
//                         aria-label="Confirm tracking fee"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
//                         style={{ backgroundColor: "var(--color-ember-500)" }}
//                       >
//                         <Check size={12} />
//                       </button>
//                     </div>
//                   ) : (
//                     <div className="flex items-center gap-1.5">
//                       <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(trackingFee, roundOff)}</span>
//                       <button
//                         type="button"
//                         onClick={() => setEditingTrackingFee(true)}
//                         aria-label="Enter tracking fee manually"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
//                       >
//                         <Pencil size={12} />
//                       </button>
//                     </div>
//                   )}
//                 </div>
//                 <input
//                   id="trackingFee"
//                   type="range"
//                   min={TRACKING_FEE_MIN}
//                   max={TRACKING_FEE_MAX}
//                   step={TRACKING_FEE_STEP}
//                   value={trackingFee}
//                   onChange={(e) => setTrackingFee(Number(e.target.value))}
//                   className="w-full accent-[var(--color-ember-500)]"
//                 />
//                 <div className="mt-1 flex justify-between text-xs text-ink-500">
//                   <span>{formatKes(TRACKING_FEE_MIN, roundOff)}</span>
//                   <span>{formatKes(TRACKING_FEE_MAX, roundOff)}</span>
//                 </div>
//                 <p className="mt-1.5 text-xs text-ink-500">
//                   Rate varies by tracking company. Charged monthly for the {Math.round(termToMonths(term, tier.term_unit))}-month term (can also be paid upfront annually) and deducted from the net amount disbursed.
//                 </p>
//               </div>
//             )}

//             {product.isAffordabilityBased && (
//               <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--color-mist-50)" }}>
//                 <p className="text-xs text-ink-500">Maximum loan amount you qualify for</p>
//                 <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(affordability.maxAmount, roundOff)}
//                 </p>
//               </div>
//             )}

//             <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
//               <div>
//                 <p className="text-xs text-ink-500">{installmentLabel}</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(schedule.paymentPerInstallment, roundOff)}
//                 </p>
//                 {schedule.trackingFeePerMonth > 0 && (
//                   <p className="mt-0.5 text-[11px] text-ink-500">+ {formatKes(schedule.trackingFeePerMonth, roundOff)}/month tracking fee</p>
//                 )}
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Total interest</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(schedule.interestTotal, roundOff)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Total repayment</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(schedule.totalRepayment, roundOff)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Interest rate</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {(tier.interest_rate * 100).toFixed(1)}%{tier.interest_basis === "per_month" ? "/mo" : " flat"}
//                 </p>
//               </div>
//             </div>

//             <div className="mt-5 space-y-2 rounded-2xl border border-mist-200 p-5 text-sm">
//               <p className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-ink-500">Fees & charges</p>
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                 <span className="text-ink-500">Registration fee (paid upfront, separate)</span>
//                 <span className="tabular text-ink-700">{formatKes(schedule.registrationFee, roundOff)}</span>
//               </div>
//               {schedule.processingFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Loan processing fee ({(tier.processing_fee_rate * 100).toFixed(0)}%)</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.processingFee, roundOff)}</span>
//                 </div>
//               )}
//               {schedule.lifeInsuranceFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Life insurance fee ({(tier.life_insurance_fee_rate * 100).toFixed(0)}%)</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.lifeInsuranceFee, roundOff)}</span>
//                 </div>
//               )}
//               {schedule.chattelFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Chattel/legal fee</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.chattelFee, roundOff)}</span>
//                 </div>
//               )}
//               {schedule.inchargeFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Incharge fee</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.inchargeFee, roundOff)}</span>
//                 </div>
//               )}
//               {schedule.trackingFeeTotal > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Tracking fee ({formatKes(schedule.trackingFeePerMonth, roundOff)}/month × {Math.round(termToMonths(term, tier.term_unit))})</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.trackingFeeTotal, roundOff)}</span>
//                 </div>
//               )}
//               {schedule.exciseDuty > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Excise duty (20% on LPF + chattel)</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.exciseDuty, roundOff)}</span>
//                 </div>
//               )}
//               {tier.guarantors !== null && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Guarantors required</span>
//                   <span className="tabular text-ink-700">{tier.guarantors}</span>
//                 </div>
//               )}
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-mist-200 pt-2 font-semibold">
//                 <span style={{ color: "var(--color-ink-900)" }}>Net amount disbursed</span>
//                 <span className="tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(schedule.netDisbursed, roundOff)}</span>
//               </div>
//             </div>

//             <button
//               onClick={downloadCsv}
//               className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
//               style={{ backgroundColor: "var(--color-navy-900)" }}
//             >
//               <Download size={16} className="shrink-0" />
//               Download Repayment Schedule (CSV)
//             </button>
//             <p className="mt-3 text-xs text-ink-500">
//               Estimate only. Your final offer depends on product terms and your credit assessment.
//             </p>
//           </motion.div>

//           <motion.div
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//             transition={{ duration: 0.5, delay: 0.1 }}
//             className="flex flex-col rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
//           >
//             <p className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//               Outstanding balance over time
//             </p>
//             <div className="h-56 w-full sm:h-64">
//               <ResponsiveContainer width="100%" height="100%">
//                 <AreaChart data={schedule.rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
//                   <defs>
//                     <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.35} />
//                       <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
//                     </linearGradient>
//                   </defs>
//                   <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist-200)" />
//                   <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
//                   <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
//                   <Tooltip
//                     formatter={((v: unknown) => formatKes(Number(Array.isArray(v) ? v[0] : v) || 0, roundOff)) as never}
//                     labelFormatter={(l) => `${periodLabel} ${l}`}
//                   />
//                   <Area type="monotone" dataKey="balance" stroke="var(--color-navy-900)" fill="url(#balanceFill)" strokeWidth={2} />
//                 </AreaChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="mt-6 max-h-64 overflow-auto rounded-xl border border-mist-200 sm:max-h-72">
//               <table className="w-full min-w-[420px] text-left text-sm">
//                 <thead className="sticky top-0 bg-mist-50 text-xs text-ink-500">
//                   <tr>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">{periodLabel}</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Payment</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Interest</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Balance</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-mist-200">
//                   {schedule.rows.map((r) => (
//                     <tr key={r.period}>
//                       <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{r.period}</td>
//                       <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{formatKes(r.payment, roundOff)}</td>
//                       <td className="px-3 py-2.5 tabular text-ink-500 sm:px-4">{formatKes(r.interest, roundOff)}</td>
//                       <td className="px-3 py-2.5 tabular font-semibold sm:px-4" style={{ color: "var(--color-ink-900)" }}>
//                         {formatKes(r.balance, roundOff)}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//             <div className="mt-6 rounded-2xl border border-mist-200 p-5 sm:p-6">
//               <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
//                 What you'll need for {product.name}
//               </p>
//               <div className="overflow-auto pr-1">
//                 {product.eligibility.length > 0 && (
//                   <>
//                     <p className="mb-1.5 text-xs font-semibold text-ink-700">Eligibility</p>
//                     <ul className="mb-4 space-y-1 text-xs text-ink-700">
//                       {product.eligibility.map((item) => (
//                         <li key={item} className="flex gap-2">
//                           <span className="text-ink-500">•</span>
//                           <span>{item}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </>
//                 )}
//                 {product.requirements.length > 0 && (
//                   <>
//                     <p className="mb-1.5 text-xs font-semibold text-ink-700">Documents required</p>
//                     <ul className="space-y-1 text-xs text-ink-700">
//                       {product.requirements.map((item) => (
//                         <li key={item} className="flex gap-2">
//                           <span className="text-ink-500">•</span>
//                           <span>{item}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </>
//                 )}
//               </div>
//             </div>
//             <p className="mt-auto text-center text-sm text-orange-500 italic">
//               Partners For Growth
//             </p>
//           </motion.div>
//         </div>
//       </section>
//     </>
//   );
// }

// /**
//  * Dedicated Check Off Loans calculator — this product is underwritten by
//  * salary affordability against a duration-based rate/factor table, not by
//  * a simple amount slider, so it doesn't share the generic CalculatorBody's
//  * logic at all. Matches Bidii's real check-off calculator
//  * (loan_calculator_.xlsx): see src/data/checkOffRateTable.ts for the
//  * extracted rate/factor/fee constants and formula notes.
//  */
// function CheckOffCalculatorBody({
//   productSlug,
//   setProductSlug,
//   isFallback,
//   roundOff,
//   setRoundOff,
// }: {
//   productSlug: string;
//   setProductSlug: (slug: string) => void;
//   isFallback: boolean;
//   roundOff: boolean;
//   setRoundOff: (value: boolean | ((prev: boolean) => boolean)) => void;
// }) {
//   const product = useMemo(
//     () => loanProducts.find((p) => p.slug === productSlug) ?? loanProducts[0],
//     [productSlug]
//   );

//   const [basicSalary, setBasicSalary] = useState(62156);
//   const [netPay, setNetPay] = useState(21333);
//   const [lessArrears, setLessArrears] = useState(0);
//   const [buyoffInstallment, setBuyoffInstallment] = useState(0);
//   const [buyoffBalance, setBuyoffBalance] = useState(0);
//   const [termMonths, setTermMonths] = useState(12);
//   const [loanAmount, setLoanAmount] = useState(50000);
//   const [retirementDate, setRetirementDate] = useState("");

//     // Fires the "tried to calculate a loan" intent trigger the first time the
//   // visitor changes the amount or term away from their defaults.
//   const { requestIntent } = useEngagement();
//   const hasFiredCalcAttempt = useRef(false);
//   useEffect(() => {
//     if (hasFiredCalcAttempt.current) return;
//     if (loanAmount !== 50000 || termMonths !== 12) {
//       hasFiredCalcAttempt.current = true;
//       requestIntent({
//         sourcePage: "calculator",
//         trigger: "calculator_interaction",
//         productInterest: product.name,
//       });
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [loanAmount, termMonths]);

//   const result = useMemo(() => {
//     const thirdOfBasic = basicSalary / 3;
//     const actualNet = netPay - lessArrears;
//     const affordability = actualNet - thirdOfBasic + buyoffInstallment;

//     const rateRow = findCheckOffRateRow(termMonths);
//     const maxQualified = affordability > 0 ? affordability / rateRow.factor : 0;

//     const laf = loanAmount > 0 ? CHECK_OFF_FEES.LAF : 0;
//     const lpf = loanAmount * CHECK_OFF_FEES.LPF;
//     const insuranceFee = loanAmount * CHECK_OFF_FEES.IF;
//     const totalCharges = laf + lpf + insuranceFee;

//     // ROUNDUP(loanAmount * term * (rate + 100/loanAmount), 0), expanded to
//     // avoid dividing by a possibly-zero loanAmount.
//     const totalInterest = Math.ceil(termMonths * (loanAmount * rateRow.monthlyInterestRate + 100));
//     const totalLoanPayable = loanAmount + totalInterest;
//     const installmentRequired = totalLoanPayable / termMonths;
//     const takeHomeAmount = loanAmount - (totalCharges + buyoffBalance);
//     const remainingAffordability = affordability - installmentRequired;

//     let maxEligibleTerm: number | null = null;
//     if (retirementDate) {
//       const today = new Date();
//       const rod = new Date(retirementDate);
//       const months = (rod.getFullYear() - today.getFullYear()) * 12 + (rod.getMonth() - today.getMonth());
//       maxEligibleTerm = Math.max(0, months - 3);
//     }

//     return {
//       thirdOfBasic,
//       actualNet,
//       affordability,
//       rateRow,
//       maxQualified,
//       laf,
//       lpf,
//       insuranceFee,
//       totalCharges,
//       totalInterest,
//       totalLoanPayable,
//       installmentRequired,
//       takeHomeAmount,
//       remainingAffordability,
//       maxEligibleTerm,
//     };
//   }, [basicSalary, netPay, lessArrears, buyoffInstallment, buyoffBalance, termMonths, loanAmount, retirementDate]);

//   const scheduleRows = useMemo(() => {
//     const principalPerMonth = loanAmount / termMonths;
//     return Array.from({ length: termMonths }, (_, i) => ({
//       period: i + 1,
//       balance: Math.max(loanAmount - principalPerMonth * (i + 1), 0),
//     }));
//   }, [loanAmount, termMonths]);

//   function downloadCsv() {
//     const header = "Month,Installment,Remaining Balance\n";
//     const body = scheduleRows
//       .map((r) => `${r.period},${result.installmentRequired.toFixed(2)},${r.balance.toFixed(2)}`)
//       .join("\n");
//     const blob = new Blob([header + body], { type: "text/csv" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "bidii-check-off-loan-schedule.csv";
//     a.click();
//     URL.revokeObjectURL(url);
//   }

//   const overAffordability = result.remainingAffordability < 0;
//   const overRetirementCap = result.maxEligibleTerm !== null && termMonths > result.maxEligibleTerm;

//   return (
//     <>
//       <PageHero
//         eyebrow="Bidii Credit Loan Calculator"
//         title="Check Off Loan affordability calculator"
//         description="Enter your salary details to see exactly what you qualify for, matching the same calculation your loan officer uses."
//       />

//       {isFallback && (
//         <div className="mx-auto mt-6 max-w-2xl px-5">
//           <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
//             <Info size={14} className="shrink-0" />
//             Showing standard rates — we couldn't reach the server for the latest terms.
//           </div>
//         </div>
//       )}

//       <div className="mx-auto mt-6 flex max-w-6xl items-center justify-end gap-2.5 px-5 lg:px-8">
//         <span className="text-xs text-ink-500">Show exact figures (2dp)</span>
//         <button
//           type="button"
//           role="switch"
//           aria-checked={roundOff}
//           aria-label="Toggle rounding of displayed figures"
//           onClick={() => setRoundOff((r) => !r)}
//           className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
//           style={{ backgroundColor: roundOff ? "var(--color-ember-500)" : "var(--color-mist-200)" }}
//         >
//           <span
//             className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
//             style={{ transform: roundOff ? "translateX(22px)" : "translateX(2px)" }}
//           />
//         </button>
//         <span className="text-xs text-ink-500">Round off</span>
//       </div>

//       <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8 lg:py-10">
//         <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
//           <motion.div
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//             transition={{ duration: 0.5 }}
//             className="h-fit rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
//           >
//             <div className="mb-5">
//               <label className="mb-2 block text-sm text-ink-500">Loan product</label>
//               <select
//                 value={productSlug}
//                 onChange={(e) => setProductSlug(e.target.value)}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//               >
//                 {loanProducts.map((p) => (
//                   <option key={p.slug} value={p.slug}>{p.name}</option>
//                 ))}
//               </select>
//             </div>

//             <p className="mb-4 font-display text-xs font-bold uppercase tracking-wide text-ink-500">Your salary</p>

//             <div className="mb-4 grid gap-4 sm:grid-cols-2">
//               <div>
//                 <label className="mb-1.5 block text-sm text-ink-500">Basic salary (KES)</label>
//                 <input
//                   type="number"
//                   value={basicSalary}
//                   onChange={(e) => setBasicSalary(Number(e.target.value))}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1.5 block text-sm text-ink-500">Current net pay (KES)</label>
//                 <input
//                   type="number"
//                   value={netPay}
//                   onChange={(e) => setNetPay(Number(e.target.value))}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                 />
//               </div>
//             </div>

//             <div className="mb-6">
//               <label className="mb-1.5 block text-sm text-ink-500">Less: salary arrears / unusable allowances (KES)</label>
//               <input
//                 type="number"
//                 value={lessArrears}
//                 onChange={(e) => setLessArrears(Number(e.target.value))}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//               />
//             </div>

//             <p className="mb-4 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
//               Existing loan to pay off (leave as 0 if none)
//             </p>
//             <div className="mb-6 grid gap-4 sm:grid-cols-2">
//               <div>
//                 <label className="mb-1.5 block text-sm text-ink-500">Its monthly installment (KES)</label>
//                 <input
//                   type="number"
//                   value={buyoffInstallment}
//                   onChange={(e) => setBuyoffInstallment(Number(e.target.value))}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                 />
//               </div>
//               <div>
//                 <label className="mb-1.5 block text-sm text-ink-500">Its payoff balance (KES)</label>
//                 <input
//                   type="number"
//                   value={buyoffBalance}
//                   onChange={(e) => setBuyoffBalance(Number(e.target.value))}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                 />
//               </div>
//             </div>

//             <div className="mb-6 rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--color-mist-50)" }}>
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                 <span className="text-ink-500">Affordability (max installment)</span>
//                 <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(result.affordability, roundOff)}</span>
//               </div>
//               <p className="mt-1.5 text-xs text-ink-500">(Net pay − ⅓ × Basic) + existing installment being paid off</p>
//             </div>

//             <div className="mb-6 grid grid-cols-2 gap-4">
//               <div>
//                 <label className="mb-1.5 block text-sm text-ink-500">Loan term</label>
//                 <select
//                   value={termMonths}
//                   onChange={(e) => setTermMonths(Number(e.target.value))}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//                 >
//                   {CHECK_OFF_RATE_TABLE.map((row: any) => (
//                     <option key={row.durationMonths} value={row.durationMonths}>
//                       {row.durationMonths} months ({(row.monthlyInterestRate * 100).toFixed(2)}%/mo)
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div>
//                 <label className="mb-1.5 block text-sm text-ink-500">Loan amount applied (KES)</label>
//                 <input
//                   type="number"
//                   value={loanAmount}
//                   onChange={(e) => setLoanAmount(Number(e.target.value))}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                 />
//               </div>
//             </div>

//             <div className="mb-6">
//               <label className="mb-1.5 block text-sm text-ink-500">Retirement date (optional — caps your eligible term)</label>
//               <input
//                 type="date"
//                 value={retirementDate}
//                 onChange={(e) => setRetirementDate(e.target.value)}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//               />
//               {overRetirementCap && (
//                 <p className="mt-1.5 text-xs text-red-500">
//                   This term exceeds your maximum eligible period of {result.maxEligibleTerm} months before retirement.
//                 </p>
//               )}
//             </div>

//             <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--color-mist-50)" }}>
//               <p className="text-xs text-ink-500">Maximum loan you qualify for at this term</p>
//               <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                 {formatKes(result.maxQualified, roundOff)}
//               </p>
//             </div>

//             {overAffordability && (
//               <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-600">
//                 <AlertCircle size={15} className="mt-0.5 shrink-0" />
//                 This amount and term exceed your affordability by {formatKes(Math.abs(result.remainingAffordability), roundOff)}/month.
//                 Reduce the amount or extend the term.
//               </div>
//             )}

//             <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
//               <div>
//                 <p className="text-xs text-ink-500">Monthly installment</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(result.installmentRequired, roundOff)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Total interest</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(result.totalInterest, roundOff)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Total repayment</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(result.totalLoanPayable, roundOff)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Interest rate</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {(result.rateRow.monthlyInterestRate * 100).toFixed(2)}%/mo
//                 </p>
//               </div>
//             </div>

//             <div className="mt-5 space-y-2 rounded-2xl border border-mist-200 p-5 text-sm">
//               <p className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-ink-500">Fees & charges</p>
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                 <span className="text-ink-500">Loan application fee</span>
//                 <span className="tabular text-ink-700">{formatKes(result.laf, roundOff)}</span>
//               </div>
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                 <span className="text-ink-500">Loan processing fee (3%)</span>
//                 <span className="tabular text-ink-700">{formatKes(result.lpf, roundOff)}</span>
//               </div>
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                 <span className="text-ink-500">Insurance fee (1%)</span>
//                 <span className="tabular text-ink-700">{formatKes(result.insuranceFee, roundOff)}</span>
//               </div>
//               {buyoffBalance > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Existing loan payoff balance</span>
//                   <span className="tabular text-ink-700">{formatKes(buyoffBalance, roundOff)}</span>
//                 </div>
//               )}
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-mist-200 pt-2 font-semibold">
//                 <span style={{ color: "var(--color-ink-900)" }}>Take-home amount</span>
//                 <span className="tabular" style={{ color: result.takeHomeAmount < 0 ? "#DC2626" : "var(--color-ink-900)" }}>
//                   {formatKes(result.takeHomeAmount, roundOff)}
//                 </span>
//               </div>
//             </div>

//             <button
//               onClick={downloadCsv}
//               className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
//               style={{ backgroundColor: "var(--color-navy-900)" }}
//             >
//               <Download size={16} className="shrink-0" />
//               Download Repayment Schedule (CSV)
//             </button>
//             <p className="mt-3 text-xs text-ink-500">
//               Estimate only. Your final offer depends on employer verification and credit assessment.
//             </p>
//           </motion.div>

//           <motion.div
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//             transition={{ duration: 0.5, delay: 0.1 }}
//             className="flex flex-col rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
//           >
//             <p className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//               Outstanding balance over time
//             </p>
//             <div className="h-56 w-full sm:h-64">
//               <ResponsiveContainer width="100%" height="100%">
//                 <AreaChart data={scheduleRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
//                   <defs>
//                     <linearGradient id="checkOffBalanceFill" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.35} />
//                       <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
//                     </linearGradient>
//                   </defs>
//                   <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist-200)" />
//                   <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
//                   <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
//                   <Tooltip
//                     formatter={((v: unknown) => formatKes(Number(Array.isArray(v) ? v[0] : v) || 0, roundOff)) as never}
//                     labelFormatter={(l) => `Month ${l}`}
//                   />
//                   <Area type="monotone" dataKey="balance" stroke="var(--color-navy-900)" fill="url(#checkOffBalanceFill)" strokeWidth={2} />
//                 </AreaChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="mt-6 max-h-64 overflow-auto rounded-xl border border-mist-200 sm:max-h-72">
//               <table className="w-full min-w-[320px] text-left text-sm">
//                 <thead className="sticky top-0 bg-mist-50 text-xs text-ink-500">
//                   <tr>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Month</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Installment</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Balance</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-mist-200">
//                   {scheduleRows.map((r) => (
//                     <tr key={r.period}>
//                       <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{r.period}</td>
//                       <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{formatKes(result.installmentRequired, roundOff)}</td>
//                       <td className="px-3 py-2.5 tabular font-semibold sm:px-4" style={{ color: "var(--color-ink-900)" }}>
//                         {formatKes(r.balance, roundOff)}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//             <div className="mt-6 rounded-2xl border border-mist-200 p-5 sm:p-6">
//               <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
//                 What you'll need for {product.name}
//               </p>
//               <div className="overflow-auto pr-1">
//                 {product.eligibility.length > 0 && (
//                   <>
//                     <p className="mb-1.5 text-xs font-semibold text-ink-700">Eligibility</p>
//                     <ul className="mb-4 space-y-1 text-xs text-ink-700">
//                       {product.eligibility.map((item) => (
//                         <li key={item} className="flex gap-2">
//                           <span className="text-ink-500">•</span>
//                           <span>{item}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </>
//                 )}
//                 {product.requirements.length > 0 && (
//                   <>
//                     <p className="mb-1.5 text-xs font-semibold text-ink-700">Documents required</p>
//                     <ul className="space-y-1 text-xs text-ink-700">
//                       {product.requirements.map((item) => (
//                         <li key={item} className="flex gap-2">
//                           <span className="text-ink-500">•</span>
//                           <span>{item}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </>
//                 )}
//               </div>
//             </div>
//             <p className="mt-auto text-center text-sm text-orange-500 italic">
//               Partners For Growth
//             </p>
//           </motion.div>
//         </div>
//       </section>
//     </>
//   );
// }



// import { useMemo, useState } from "react";
// import { motion } from "framer-motion";
// import { Download, Info, Pencil, Check, AlertCircle } from "lucide-react";
// import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
// import PageHero from "../components/ui/PageHero";
// import { usePageMeta } from "../lib/usePageMeta";
// import { loanProducts } from "../data/content";
// import { useLoanTiers, type LoanTier } from "../lib/useLoanTiers";
// import { CHECK_OFF_FEES, findCheckOffRateRow, CHECK_OFF_RATE_TABLE } from "../data/checkOffRateTable";

// function formatKes(n: number) {
//   return "KES " + Math.round(n).toLocaleString("en-KE");
// }

// /** 4 weeks = 1 month, matching how Bidii itself defines weekly-repayment tiers. */
// function termToMonths(term: number, unit: "weeks" | "months") {
//   return unit === "months" ? term : term / 4;
// }

// function amountStep(tier: LoanTier) {
//   return tier.max_amount <= 100_000 ? 500 : 5_000;
// }

// function clamp(value: number, min: number, max: number) {
//   if (Number.isNaN(value)) return min;
//   return Math.min(Math.max(value, min), max);
// }

// /**
//  * The tracking fee's KES-per-month rate isn't fixed - it varies by which
//  * tracking company (e.g. Regent/Jawabu) handles a given vehicle, per Bidii's
//  * Auto/Logbook training material. This range keeps the slider centered on
//  * the standard 1,500/month rate while allowing for that variance.
//  */
// const TRACKING_FEE_MIN = 500;
// const TRACKING_FEE_MAX = 3000;
// const TRACKING_FEE_STEP = 100;

// type ScheduleRow = {
//   period: number;
//   payment: number;
//   principal: number;
//   interest: number;
//   balance: number;
// };

// function buildSchedule(tier: LoanTier, amount: number, term: number, trackingFeePerMonthOverride?: number) {
//   const termInMonths = termToMonths(term, tier.term_unit);
//   const interestTotal =
//     tier.interest_basis === "flat_over_term" ? amount * tier.interest_rate : amount * tier.interest_rate * termInMonths;
//   const totalRepayment = amount + interestTotal;
//   const installmentCount = Math.max(1, Math.round(term));
//   const principalPerInstallment = amount / installmentCount;
//   const interestPerInstallment = interestTotal / installmentCount;
//   const paymentPerInstallment = totalRepayment / installmentCount;

//   const rows: ScheduleRow[] = Array.from({ length: installmentCount }, (_, i) => ({
//     period: i + 1,
//     payment: paymentPerInstallment,
//     principal: principalPerInstallment,
//     interest: interestPerInstallment,
//     balance: Math.max(amount - principalPerInstallment * (i + 1), 0),
//   }));

//   // One-time fees, all based on the requested principal.
//   const processingFee = amount * tier.processing_fee_rate;
//   const lifeInsuranceFee = amount * tier.life_insurance_fee_rate;
//   const chattelFee = tier.chattel_fee ?? 0;
//   const inchargeFee = tier.incharge_fee ?? 0;
//   const exciseDuty = (tier.excise_duty_on_fees_rate ?? 0) * (processingFee + chattelFee);
//   // Logbook products (standard Auto Loan + Jikuze Auto) carry a monthly vehicle
//   // tracking fee. The rate varies by tracking company, so it's editable here,
//   // defaulting to the tier's configured rate.
//   const trackingFeePerMonth = trackingFeePerMonthOverride ?? tier.tracking_fee_per_month ?? 0;
//   const trackingFeeTotal = trackingFeePerMonth * termInMonths;

//   // Registration fee is paid upfront by the client as a separate facilitation
//   // fee (per the SME appraisal process); everything else - including the
//   // tracking fee - is deducted from the disbursed loan proceeds.
//   const deductedFromLoan = processingFee + lifeInsuranceFee + chattelFee + inchargeFee + exciseDuty + trackingFeeTotal;
//   const netDisbursed = amount - deductedFromLoan;

//   return {
//     rows,
//     interestTotal,
//     totalRepayment,
//     paymentPerInstallment,
//     processingFee,
//     lifeInsuranceFee,
//     chattelFee,
//     inchargeFee,
//     exciseDuty,
//     trackingFeePerMonth,
//     trackingFeeTotal,
//     registrationFee: tier.registration_fee,
//     netDisbursed,
//   };
// }

// export default function Calculator() {
//   usePageMeta("Loan Calculator");
//   const { tiersByProduct, loading: tiersLoading, isFallback } = useLoanTiers();

//   const [productSlug, setProductSlug] = useState(loanProducts[0].slug);
//   const product = useMemo(
//     () => loanProducts.find((p) => p.slug === productSlug) ?? loanProducts[0],
//     [productSlug]
//   );

//   const tiers = tiersByProduct[productSlug] ?? [];

//   if (tiersLoading) {
//     return (
//       <section className="mx-auto max-w-2xl px-5 py-24 text-center">
//         <p className="text-sm text-ink-500">Loading loan terms…</p>
//       </section>
//     );
//   }

//   if (tiers.length === 0) {
//     return (
//       <section className="mx-auto max-w-2xl px-5 py-24">
//         <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
//           <AlertCircle size={16} />
//           No loan terms are configured for this product yet.
//         </div>
//       </section>
//     );
//   }

//   return (
//     <CalculatorBody
//       product={product}
//       productSlug={productSlug}
//       setProductSlug={setProductSlug}
//       tiers={tiers}
//       allTiersByProduct={tiersByProduct}
//       isFallback={isFallback}
//     />
//   );
// }

// function CalculatorBody({
//   product,
//   productSlug,
//   setProductSlug,
//   tiers,
//   allTiersByProduct,
//   isFallback,
// }: {
//   product: (typeof loanProducts)[number];
//   productSlug: string;
//   setProductSlug: (slug: string) => void;
//   tiers: LoanTier[];
//   allTiersByProduct: Record<string, LoanTier[]>;
//   isFallback: boolean;
// }) {
//   const [tierId, setTierId] = useState(tiers[0].tier_key);
//   const tier = useMemo(
//     () => tiers.find((t) => t.tier_key === tierId) ?? tiers[0],
//     [tiers, tierId]
//   );

//   const [amount, setAmount] = useState(tier.min_amount);
//   const [term, setTerm] = useState(tier.min_term);
//   const [editingAmount, setEditingAmount] = useState(false);
//   const [editingTerm, setEditingTerm] = useState(false);
//   // Editable monthly tracking fee for logbook products (standard Auto Loan +
//   // Jikuze Auto). Only rendered when the tier defines tracking_fee_per_month.
//   const [trackingFee, setTrackingFee] = useState(tier.tracking_fee_per_month ?? 0);
//   const [editingTrackingFee, setEditingTrackingFee] = useState(false);

//   // Check Off Loans are underwritten by salary affordability, not a chosen
//   // amount - see the CW formula from Bidii's own check-off training material.
//   const [basicSalary, setBasicSalary] = useState(60000);
//   const [netSalary, setNetSalary] = useState(45000);

//   // Reset tier + clamp amount/term whenever the product or tier changes.
//   // This is React's recommended "adjust state during render" pattern
//   // (https://react.dev/learn/you-might-not-need-an-effect) rather than an
//   // effect, since it's synchronizing state to a prop/selection change, not
//   // an external system - an effect here would cause an extra render pass.
//   const [prevProductSlug, setPrevProductSlug] = useState(productSlug);
//   const [prevTierId, setPrevTierId] = useState(tierId);

//   if (productSlug !== prevProductSlug) {
//     setPrevProductSlug(productSlug);
//     const firstTier = (allTiersByProduct[productSlug] ?? tiers)[0];
//     setTierId(firstTier.tier_key);
//     setPrevTierId(firstTier.tier_key);
//     setAmount(firstTier.min_amount);
//     setTerm(firstTier.min_term);
//     setTrackingFee(firstTier.tracking_fee_per_month ?? 0);
//     setEditingAmount(false);
//     setEditingTerm(false);
//     setEditingTrackingFee(false);
//   } else if (tierId !== prevTierId) {
//     setPrevTierId(tierId);
//     setAmount((a) => Math.min(Math.max(a, tier.min_amount), tier.max_amount));
//     setTerm((t) => Math.min(Math.max(t, tier.min_term), tier.max_term));
//     setTrackingFee(tier.tracking_fee_per_month ?? 0);
//     setEditingAmount(false);
//     setEditingTerm(false);
//     setEditingTrackingFee(false);
//   }

//   // Whether this tier's product carries a tracking fee at all (logbook products).
//   const hasTrackingFee = tier.tracking_fee_per_month !== undefined && tier.tracking_fee_per_month !== null;

//   const affordability = useMemo(() => {
//     const cw = Math.max(0, netSalary - basicSalary / 3);
//     const termInMonths = termToMonths(term, tier.term_unit);
//     const maxAmount = (cw * termInMonths) / (1 + tier.interest_rate * termInMonths);
//     return { cw, maxAmount: Math.max(0, Math.round(maxAmount)) };
//   }, [basicSalary, netSalary, term, tier]);

//   const effectiveAmount = product.isAffordabilityBased ? affordability.maxAmount : amount;
//   const schedule = useMemo(
//     () => buildSchedule(tier, Math.max(effectiveAmount, 1), term, hasTrackingFee ? trackingFee : undefined),
//     [tier, effectiveAmount, term, hasTrackingFee, trackingFee]
//   );

//   const periodLabel = tier.repayment_frequency === "weekly" ? "Week" : "Month";
//   const installmentLabel = tier.repayment_frequency === "weekly" ? "Weekly repayment" : "Monthly repayment";

//   function downloadCsv() {
//     const header = `${periodLabel},Payment,Principal,Interest,Remaining Balance\n`;
//     const body = schedule.rows
//       .map((r) => `${r.period},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`)
//       .join("\n");
//     const blob = new Blob([header + body], { type: "text/csv" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `bidii-${product.slug}-repayment-schedule.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   }

//   return (
//     <>
//       <PageHero
//         eyebrow="Bidii Credit Loan Calculator"
//         title="See your full repayment schedule"
//         description="Choose a product and plan, set your amount and term, and get a month-by-month or week-by-week breakdown you can download before you apply."
//       />

//       {isFallback && (
//         <div className="mx-auto mt-6 max-w-2xl px-5">
//           <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
//             <Info size={14} className="shrink-0" />
//             Showing standard rates - we couldn't reach the server for the latest terms.
//           </div>
//         </div>
//       )}

//       <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8 lg:py-10">
//         <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
//           <motion.div
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//             transition={{ duration: 0.5 }}
//             className="h-fit rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
//           >
//             <div className="mb-5">
//               <label className="mb-2 block text-sm text-ink-500">Loan product</label>
//               <select
//                 value={productSlug}
//                 onChange={(e) => setProductSlug(e.target.value)}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//               >
//                 {loanProducts.map((p) => (
//                   <option key={p.slug} value={p.slug}>{p.name}</option>
//                 ))}
//               </select>
//             </div>

//             {tiers.length > 1 && (
//               <div className="mb-6">
//                 <label className="mb-2 block text-sm text-ink-500">Plan</label>
//                 <select
//                   value={tierId}
//                   onChange={(e) => setTierId(e.target.value)}
//                   className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//                 >
//                   {tiers.map((t) => (
//                     <option key={t.tier_key} value={t.tier_key}>{t.label}</option>
//                   ))}
//                 </select>
//               </div>
//             )}

//             {product.isAffordabilityBased ? (
//               <>
//                 <div className="mb-4 flex items-start gap-2.5 rounded-xl p-4 text-xs leading-relaxed" style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}>
//                   <Info size={15} className="mt-0.5 shrink-0" />
//                   Check Off Loans are underwritten by salary affordability, not a fixed
//                   amount. Rate shown is set by your admin team and may be a placeholder
//                   pending confirmed figures for this product.
//                 </div>

//                 <div className="mb-5">
//                   <label className="mb-2 block text-sm text-ink-500">Basic salary (KES)</label>
//                   <input
//                     type="number"
//                     value={basicSalary}
//                     onChange={(e) => setBasicSalary(Number(e.target.value))}
//                     className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                   />
//                 </div>
//                 <div className="mb-5">
//                   <label className="mb-2 block text-sm text-ink-500">Net salary (KES)</label>
//                   <input
//                     type="number"
//                     value={netSalary}
//                     onChange={(e) => setNetSalary(Number(e.target.value))}
//                     className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
//                   />
//                 </div>

//                 <div className="mb-6 rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--color-mist-50)" }}>
//                   <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                     <span className="text-ink-500">Credit worthiness (max installment)</span>
//                     <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(affordability.cw)}</span>
//                   </div>
//                   <p className="mt-1.5 text-xs text-ink-500">CW = Net salary − ⅓ × Basic salary</p>
//                 </div>
//               </>
//             ) : (
//               <div className="mb-6">
//                 <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
//                   <label htmlFor="amount" className="text-ink-500">Loan amount</label>
//                   {editingAmount ? (
//                     <div className="flex items-center gap-1.5">
//                       <input
//                         type="number"
//                         autoFocus
//                         value={amount}
//                         min={tier.min_amount}
//                         max={tier.max_amount}
//                         step={amountStep(tier)}
//                         onChange={(e) => setAmount(Number(e.target.value))}
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             setAmount((a) => clamp(a, tier.min_amount, tier.max_amount));
//                             setEditingAmount(false);
//                           }
//                         }}
//                         className="w-24 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-28"
//                       />
//                       <button
//                         type="button"
//                         onClick={() => {
//                           setAmount((a) => clamp(a, tier.min_amount, tier.max_amount));
//                           setEditingAmount(false);
//                         }}
//                         aria-label="Confirm amount"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
//                         style={{ backgroundColor: "var(--color-ember-500)" }}
//                       >
//                         <Check size={12} />
//                       </button>
//                     </div>
//                   ) : (
//                     <div className="flex items-center gap-1.5">
//                       <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(amount)}</span>
//                       <button
//                         type="button"
//                         onClick={() => setEditingAmount(true)}
//                         aria-label="Enter amount manually"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
//                       >
//                         <Pencil size={12} />
//                       </button>
//                     </div>
//                   )}
//                 </div>
//                 <input
//                   id="amount"
//                   type="range"
//                   min={tier.min_amount}
//                   max={tier.max_amount}
//                   step={amountStep(tier)}
//                   value={amount}
//                   onChange={(e) => setAmount(Number(e.target.value))}
//                   className="w-full accent-[var(--color-ember-500)]"
//                 />
//                 <div className="mt-1 flex justify-between text-xs text-ink-500">
//                   <span>{formatKes(tier.min_amount)}</span>
//                   <span>{formatKes(tier.max_amount)}</span>
//                 </div>
//               </div>
//             )}

//             <div className="mb-7">
//               <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
//                 <label htmlFor="term" className="text-ink-500">Repayment term</label>
//                 {editingTerm ? (
//                   <div className="flex items-center gap-1.5">
//                     <input
//                       type="number"
//                       autoFocus
//                       value={term}
//                       min={tier.min_term}
//                       max={tier.max_term}
//                       step={1}
//                       onChange={(e) => setTerm(Number(e.target.value))}
//                       onKeyDown={(e) => {
//                         if (e.key === "Enter") {
//                           setTerm((t) => clamp(t, tier.min_term, tier.max_term));
//                           setEditingTerm(false);
//                         }
//                       }}
//                       className="w-16 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-20"
//                     />
//                     <span className="text-xs text-ink-500">{tier.term_unit}</span>
//                     <button
//                       type="button"
//                       onClick={() => {
//                         setTerm((t) => clamp(t, tier.min_term, tier.max_term));
//                         setEditingTerm(false);
//                       }}
//                       aria-label="Confirm term"
//                       className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
//                       style={{ backgroundColor: "var(--color-ember-500)" }}
//                     >
//                       <Check size={12} />
//                     </button>
//                   </div>
//                 ) : (
//                   <div className="flex items-center gap-1.5">
//                     <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
//                       {term} {tier.term_unit}
//                     </span>
//                     <button
//                       type="button"
//                       onClick={() => setEditingTerm(true)}
//                       aria-label="Enter term manually"
//                       className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
//                     >
//                       <Pencil size={12} />
//                     </button>
//                   </div>
//                 )}
//               </div>
//               <input
//                 id="term"
//                 type="range"
//                 min={tier.min_term}
//                 max={tier.max_term}
//                 step={1}
//                 value={term}
//                 onChange={(e) => setTerm(Number(e.target.value))}
//                 className="w-full accent-[var(--color-ember-500)]"
//               />
//               <div className="mt-1 flex justify-between text-xs text-ink-500">
//                 <span>{tier.min_term} {tier.term_unit}</span>
//                 <span>{tier.max_term} {tier.term_unit}</span>
//               </div>
//             </div>

//             {hasTrackingFee && (
//               <div className="mb-7">
//                 <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
//                   <label htmlFor="trackingFee" className="text-ink-500">Tracking fee (per month)</label>
//                   {editingTrackingFee ? (
//                     <div className="flex items-center gap-1.5">
//                       <input
//                         type="number"
//                         autoFocus
//                         value={trackingFee}
//                         min={TRACKING_FEE_MIN}
//                         max={TRACKING_FEE_MAX}
//                         step={TRACKING_FEE_STEP}
//                         onChange={(e) => setTrackingFee(Number(e.target.value))}
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             setTrackingFee((f) => clamp(f, TRACKING_FEE_MIN, TRACKING_FEE_MAX));
//                             setEditingTrackingFee(false);
//                           }
//                         }}
//                         className="w-20 min-w-0 rounded-lg border border-mist-200 px-2 py-1 text-right text-sm tabular focus:outline-none sm:w-24"
//                       />
//                       <button
//                         type="button"
//                         onClick={() => {
//                           setTrackingFee((f) => clamp(f, TRACKING_FEE_MIN, TRACKING_FEE_MAX));
//                           setEditingTrackingFee(false);
//                         }}
//                         aria-label="Confirm tracking fee"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
//                         style={{ backgroundColor: "var(--color-ember-500)" }}
//                       >
//                         <Check size={12} />
//                       </button>
//                     </div>
//                   ) : (
//                     <div className="flex items-center gap-1.5">
//                       <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(trackingFee)}</span>
//                       <button
//                         type="button"
//                         onClick={() => setEditingTrackingFee(true)}
//                         aria-label="Enter tracking fee manually"
//                         className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
//                       >
//                         <Pencil size={12} />
//                       </button>
//                     </div>
//                   )}
//                 </div>
//                 <input
//                   id="trackingFee"
//                   type="range"
//                   min={TRACKING_FEE_MIN}
//                   max={TRACKING_FEE_MAX}
//                   step={TRACKING_FEE_STEP}
//                   value={trackingFee}
//                   onChange={(e) => setTrackingFee(Number(e.target.value))}
//                   className="w-full accent-[var(--color-ember-500)]"
//                 />
//                 <div className="mt-1 flex justify-between text-xs text-ink-500">
//                   <span>{formatKes(TRACKING_FEE_MIN)}</span>
//                   <span>{formatKes(TRACKING_FEE_MAX)}</span>
//                 </div>
//                 <p className="mt-1.5 text-xs text-ink-500">
//                   Rate varies by tracking company. Charged monthly for the {Math.round(termToMonths(term, tier.term_unit))}-month term (can also be paid upfront annually) and deducted from the net amount disbursed.
//                 </p>
//               </div>
//             )}

//             {product.isAffordabilityBased && (
//               <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--color-mist-50)" }}>
//                 <p className="text-xs text-ink-500">Maximum loan amount you qualify for</p>
//                 <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(affordability.maxAmount)}
//                 </p>
//               </div>
//             )}

//             <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
//               <div>
//                 <p className="text-xs text-ink-500">{installmentLabel}</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(schedule.paymentPerInstallment)}
//                 </p>
//                 {schedule.trackingFeePerMonth > 0 && (
//                   <p className="mt-0.5 text-[11px] text-ink-500">+ {formatKes(schedule.trackingFeePerMonth)}/month tracking fee</p>
//                 )}
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Total interest</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(schedule.interestTotal)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Total repayment</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {formatKes(schedule.totalRepayment)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-ink-500">Interest rate</p>
//                 <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                   {(tier.interest_rate * 100).toFixed(1)}%{tier.interest_basis === "per_month" ? "/mo" : " flat"}
//                 </p>
//               </div>
//             </div>

//             <div className="mt-5 space-y-2 rounded-2xl border border-mist-200 p-5 text-sm">
//               <p className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-ink-500">Fees & charges</p>
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                 <span className="text-ink-500">Registration fee (paid upfront, separate)</span>
//                 <span className="tabular text-ink-700">{formatKes(schedule.registrationFee)}</span>
//               </div>
//               {schedule.processingFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Loan processing fee ({(tier.processing_fee_rate * 100).toFixed(0)}%)</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.processingFee)}</span>
//                 </div>
//               )}
//               {schedule.lifeInsuranceFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Life insurance fee ({(tier.life_insurance_fee_rate * 100).toFixed(0)}%)</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.lifeInsuranceFee)}</span>
//                 </div>
//               )}
//               {schedule.chattelFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Chattel/legal fee</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.chattelFee)}</span>
//                 </div>
//               )}
//               {schedule.inchargeFee > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Incharge fee</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.inchargeFee)}</span>
//                 </div>
//               )}
//               {schedule.trackingFeeTotal > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Tracking fee ({formatKes(schedule.trackingFeePerMonth)}/month × {Math.round(termToMonths(term, tier.term_unit))})</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.trackingFeeTotal)}</span>
//                 </div>
//               )}
//               {schedule.exciseDuty > 0 && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Excise duty (20% on LPF + chattel)</span>
//                   <span className="tabular text-ink-700">{formatKes(schedule.exciseDuty)}</span>
//                 </div>
//               )}
//               {tier.guarantors !== null && (
//                 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
//                   <span className="text-ink-500">Guarantors required</span>
//                   <span className="tabular text-ink-700">{tier.guarantors}</span>
//                 </div>
//               )}
//               <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-mist-200 pt-2 font-semibold">
//                 <span style={{ color: "var(--color-ink-900)" }}>Net amount disbursed</span>
//                 <span className="tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(schedule.netDisbursed)}</span>
//               </div>
//             </div>

//             <button
//               onClick={downloadCsv}
//               className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
//               style={{ backgroundColor: "var(--color-navy-900)" }}
//             >
//               <Download size={16} className="shrink-0" />
//               Download Repayment Schedule (CSV)
//             </button>
//             <p className="mt-3 text-xs text-ink-500">
//               Estimate only. Your final offer depends on product terms and your credit assessment.
//             </p>
//           </motion.div>

//           <motion.div
//             initial={{ opacity: 0, y: 16 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.3 }}
//             transition={{ duration: 0.5, delay: 0.1 }}
//             className="flex flex-col rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
//           >
//             <p className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//               Outstanding balance over time
//             </p>
//             <div className="h-56 w-full sm:h-64">
//               <ResponsiveContainer width="100%" height="100%">
//                 <AreaChart data={schedule.rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
//                   <defs>
//                     <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="0%" stopColor="var(--color-navy-700)" stopOpacity={0.35} />
//                       <stop offset="100%" stopColor="var(--color-navy-700)" stopOpacity={0} />
//                     </linearGradient>
//                   </defs>
//                   <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist-200)" />
//                   <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
//                   <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
//                   <Tooltip
//                     formatter={((v: unknown) => formatKes(Number(Array.isArray(v) ? v[0] : v) || 0)) as never}
//                     labelFormatter={(l) => `${periodLabel} ${l}`}
//                   />
//                   <Area type="monotone" dataKey="balance" stroke="var(--color-navy-900)" fill="url(#balanceFill)" strokeWidth={2} />
//                 </AreaChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="mt-6 max-h-64 overflow-auto rounded-xl border border-mist-200 sm:max-h-72">
//               <table className="w-full min-w-[420px] text-left text-sm">
//                 <thead className="sticky top-0 bg-mist-50 text-xs text-ink-500">
//                   <tr>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">{periodLabel}</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Payment</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Interest</th>
//                     <th className="px-3 py-2.5 font-medium sm:px-4">Balance</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-mist-200">
//                   {schedule.rows.map((r) => (
//                     <tr key={r.period}>
//                       <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{r.period}</td>
//                       <td className="px-3 py-2.5 tabular text-ink-700 sm:px-4">{formatKes(r.payment)}</td>
//                       <td className="px-3 py-2.5 tabular text-ink-500 sm:px-4">{formatKes(r.interest)}</td>
//                       <td className="px-3 py-2.5 tabular font-semibold sm:px-4" style={{ color: "var(--color-ink-900)" }}>
//                         {formatKes(r.balance)}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//             <div className="mt-6 rounded-2xl border border-mist-200 p-5 sm:p-6">
//               <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-ink-500">
//                 What you'll need for {product.name}
//               </p>
//               <div className="overflow-auto pr-1">
//                 {product.eligibility.length > 0 && (
//                   <>
//                     <p className="mb-1.5 text-xs font-semibold text-ink-700">Eligibility</p>
//                     <ul className="mb-4 space-y-1 text-xs text-ink-700">
//                       {product.eligibility.map((item) => (
//                         <li key={item} className="flex gap-2">
//                           <span className="text-ink-500">•</span>
//                           <span>{item}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </>
//                 )}
//                 {product.requirements.length > 0 && (
//                   <>
//                     <p className="mb-1.5 text-xs font-semibold text-ink-700">Documents required</p>
//                     <ul className="space-y-1 text-xs text-ink-700">
//                       {product.requirements.map((item) => (
//                         <li key={item} className="flex gap-2">
//                           <span className="text-ink-500">•</span>
//                           <span>{item}</span>
//                         </li>
//                       ))}
//                     </ul>
//                   </>
//                 )}
//               </div>
//             </div>
//             <p className="mt-auto text-center text-sm text-orange-500 italic">
//               Partners For Growth
//             </p>
//           </motion.div>
//         </div>
//       </section>
//     </>
//   );
// }
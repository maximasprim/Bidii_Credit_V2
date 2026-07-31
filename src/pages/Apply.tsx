import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle, Info } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { apiPost, ApiError } from "../lib/api";
import { loanProducts } from "../data/content";
import { useLoanTiers, type LoanTier } from "../lib/useLoanTiers";

const detailsSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  idNumber: z.string().min(6, "Enter a valid national ID number"),
  phone: z.string().min(10, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email address"),
  monthlyIncome: z.string().min(1, "Enter your estimated monthly income"),
});

type DetailsForm = z.infer<typeof detailsSchema>;

function formatKes(n: number) {
  return "KES " + Math.round(n).toLocaleString("en-KE");
}

function termToMonths(term: number, unit: "weeks" | "months") {
  return unit === "months" ? term : term / 4;
}

function amountStep(_min: number, max: number) {
  return max <= 100_000 ? 500 : 5_000;
}

export default function Apply() {
  usePageMeta("Apply for a Loan");
  const { tiersByProduct, loading: tiersLoading, isFallback } = useLoanTiers();

  const [productSlug, setProductSlug] = useState(loanProducts[0].slug);
  const product = useMemo(
    () => loanProducts.find((p) => p.slug === productSlug) ?? loanProducts[0],
    [productSlug]
  );

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

  return (
    <ApplyBody
      product={product}
      productSlug={productSlug}
      setProductSlug={setProductSlug}
      tiers={tiers}
      allTiersByProduct={tiersByProduct}
      isFallback={isFallback}
    />
  );
}

function ApplyBody({
  product,
  productSlug,
  setProductSlug,
  tiers,
  allTiersByProduct,
  isFallback,
}: {
  product: (typeof loanProducts)[number];
  productSlug: string;
  setProductSlug: (slug: string) => void;
  tiers: LoanTier[];
  allTiersByProduct: Record<string, LoanTier[]>;
  isFallback: boolean;
}) {
  const [step, setStep] = useState(1);

  const [tierId, setTierId] = useState(tiers[0].tier_key);
  const tier = useMemo(
    () => tiers.find((t) => t.tier_key === tierId) ?? tiers[0],
    [tiers, tierId]
  );

  const [amount, setAmount] = useState(tier.min_amount);
  const [term, setTerm] = useState(tier.min_term);

  const [basicSalary, setBasicSalary] = useState(60000);
  const [netSalary, setNetSalary] = useState(45000);

  // Adjust state when the product/tier selection changes - React's
  // recommended pattern for this (https://react.dev/learn/you-might-not-need-an-effect)
  // rather than an effect, since it's synchronizing to a selection change.
  const [prevProductSlug, setPrevProductSlug] = useState(productSlug);
  const [prevTierId, setPrevTierId] = useState(tierId);

  if (productSlug !== prevProductSlug) {
    setPrevProductSlug(productSlug);
    const firstTier = (allTiersByProduct[productSlug] ?? tiers)[0];
    setTierId(firstTier.tier_key);
    setPrevTierId(firstTier.tier_key);
    setAmount(firstTier.min_amount);
    setTerm(firstTier.min_term);
  } else if (tierId !== prevTierId) {
    setPrevTierId(tierId);
    setAmount((a) => Math.min(Math.max(a, tier.min_amount), tier.max_amount));
    setTerm((t) => Math.min(Math.max(t, tier.min_term), tier.max_term));
  }

  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsForm>({ resolver: zodResolver(detailsSchema) });

  const affordability = useMemo(() => {
    const cw = Math.max(0, netSalary - basicSalary / 3);
    const termInMonths = termToMonths(term, tier.term_unit);
    const maxAmount = (cw * termInMonths) / (1 + tier.interest_rate * termInMonths);
    return { cw, maxAmount: Math.max(0, Math.round(maxAmount)) };
  }, [basicSalary, netSalary, term, tier]);

  const effectiveAmount = product.isAffordabilityBased ? affordability.maxAmount : amount;

  const estimate = useMemo(() => {
    const termInMonths = termToMonths(term, tier.term_unit);
    const interest =
      tier.interest_basis === "flat_over_term"
        ? effectiveAmount * tier.interest_rate
        : effectiveAmount * tier.interest_rate * termInMonths;
    const installments = Math.max(1, Math.round(term));
    return { installment: (effectiveAmount + interest) / installments };
  }, [effectiveAmount, term, tier]);

  const steps = ["Loan details", "Your information", "Review & submit"];
  const periodLabel = tier.repayment_frequency === "weekly" ? "week" : "month";

  async function onFinalSubmit() {
    if (!details) return;
    setIsSubmittingApp(true);
    setSubmitError(null);
    try {
      await apiPost("/api/loan-applications", {
        product_slug: product.slug,
        tier_id: tier.tier_key,
        amount: effectiveAmount,
        term_value: term,
        term_unit: tier.term_unit,
        estimated_installment: estimate.installment,
        full_name: details.fullName,
        id_number: details.idNumber,
        phone: details.phone,
        email: details.email,
        monthly_income: details.monthlyIncome,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      setIsSubmittingApp(false);
    }
  }

  if (submitted) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 py-24 text-center">
        <CheckCircle2 size={48} style={{ color: "var(--color-ember-500)" }} />
        <h1 className="mt-5 font-display text-2xl font-extrabold" style={{ color: "var(--color-ink-900)" }}>
          Application received
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          A loan officer will call {details?.phone} within 24 hours to verify your details for the{" "}
          {product.name} ({tier.label}) application of {formatKes(effectiveAmount)}.
        </p>
      </section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Apply for a Loan"
        title="Three steps, most of it in one sitting"
        description="Check your eligibility instantly, tell us about yourself, then review before you submit."
      />

      {isFallback && (
        <div className="mx-auto mt-6 max-w-2xl px-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
            <Info size={14} className="shrink-0" />
            Showing standard rates - we couldn't reach the server for the latest terms.
          </div>
        </div>
      )}

      <section className="mx-auto max-w-2xl px-5 py-16 lg:py-20">
        <div className="mb-10 flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-extrabold text-white"
                  style={{ backgroundColor: step > i ? "var(--color-ember-500)" : i + 1 === step ? "var(--color-navy-900)" : "var(--color-mist-200)" }}
                >
                  {i + 1}
                </div>
                <span className="hidden text-xs text-ink-500 sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && <div className="mx-2 h-px flex-1" style={{ backgroundColor: "var(--color-mist-200)" }} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7">
            <label className="mb-2 block text-sm text-ink-500">Loan product</label>
            <select
              value={productSlug}
              onChange={(e) => setProductSlug(e.target.value)}
              className="mb-6 w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
            >
              {loanProducts.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>

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
                <div className="mb-5">
                  <label className="mb-2 block text-sm text-ink-500">Basic salary (KES)</label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                  />
                </div>
                <div className="mb-6">
                  <label className="mb-2 block text-sm text-ink-500">Net salary (KES)</label>
                  <input
                    type="number"
                    value={netSalary}
                    onChange={(e) => setNetSalary(Number(e.target.value))}
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm tabular focus:outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-ink-500">Loan amount</span>
                  <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{formatKes(amount)}</span>
                </div>
                <input
                  type="range"
                  min={tier.min_amount}
                  max={tier.max_amount}
                  step={amountStep(tier.min_amount, tier.max_amount)}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-[var(--color-ember-500)]"
                />
                <div className="mt-1 flex justify-between text-xs text-ink-500">
                  <span>{formatKes(tier.min_amount)}</span>
                  <span>{formatKes(tier.max_amount)}</span>
                </div>
              </div>
            )}

            <div className="mb-7">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-500">Repayment term</span>
                <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>{term} {tier.term_unit}</span>
              </div>
              <input
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

            {product.isAffordabilityBased && (
              <div className="mb-7 rounded-xl p-4" style={{ backgroundColor: "var(--color-mist-50)" }}>
                <p className="text-xs text-ink-500">Maximum loan amount you qualify for</p>
                <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                  {formatKes(affordability.maxAmount)}
                </p>
              </div>
            )}

            <div className="mb-7 flex items-start gap-3 rounded-xl p-4" style={{ backgroundColor: "var(--color-ember-100)" }}>
              <ShieldCheck size={18} className="mt-0.5 shrink-0" style={{ color: "var(--color-ember-600)" }} />
              <p className="text-sm" style={{ color: "var(--color-ember-600)" }}>
                Estimated {periodLabel}ly repayment: <strong className="tabular">{formatKes(estimate.installment)}</strong>. You
                look eligible for this range based on the product's typical limits - final approval depends on verification.
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01]"
              style={{ backgroundColor: "var(--color-navy-900)" }}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && (
          <form
            onSubmit={handleSubmit((data) => {
              setDetails(data);
              setStep(3);
            })}
            className="space-y-5 rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7"
          >
            <div>
              <label className="mb-1.5 block text-sm text-ink-500">Full name</label>
              <input {...register("fullName")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
              {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">National ID number</label>
                <input {...register("idNumber")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
                {errors.idNumber && <p className="mt-1 text-xs text-red-500">{errors.idNumber.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Phone number</label>
                <input {...register("phone")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-ink-500">Email address</label>
              <input {...register("email")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-ink-500">Estimated monthly income (KES)</label>
              <input {...register("monthlyIncome")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
              {errors.monthlyIncome && <p className="mt-1 text-xs text-red-500">{errors.monthlyIncome.message}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-full border border-mist-200 px-5 py-3 text-sm font-semibold text-ink-700"
              >
                <ArrowLeft size={15} />
                Back
              </button>
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--color-navy-900)" }}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {step === 3 && details && (
          <div className="rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7">
            <h2 className="mb-5 font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
              Review your application
            </h2>

            {submitError && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {submitError}
              </div>
            )}

            <div className="space-y-3 text-sm">
              {[
                ["Product", product.name],
                ["Plan", tier.label],
                ["Amount", formatKes(effectiveAmount)],
                ["Term", `${term} ${tier.term_unit}`],
                [`Estimated ${periodLabel}ly repayment`, formatKes(estimate.installment)],
                ["Full name", details.fullName],
                ["National ID", details.idNumber],
                ["Phone", details.phone],
                ["Email", details.email],
                ["Monthly income", details.monthlyIncome],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-mist-200 pb-2.5">
                  <span className="text-ink-500">{label}</span>
                  <span className="font-semibold" style={{ color: "var(--color-ink-900)" }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-full border border-mist-200 px-5 py-3 text-sm font-semibold text-ink-700"
              >
                <ArrowLeft size={15} />
                Back
              </button>
              <button
                onClick={onFinalSubmit}
                disabled={isSubmittingApp}
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              >
                {isSubmittingApp ? "Submitting…" : "Submit Application"}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

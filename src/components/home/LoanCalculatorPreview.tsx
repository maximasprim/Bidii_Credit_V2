import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

function formatKes(n: number) {
  return "KES " + Math.round(n).toLocaleString("en-KE");
}

// Mirrors Jikuze Plus (see src/data/fallbackLoanTiers.ts / the seeded
// sme-loans/jikuze-plus tier) — hardcoded on purpose: this preview sits on
// the landing page, where we don't want a network fetch or loading state.
// If Jikuze Plus's rate/bounds ever change in the backend, update these
// three constants to match so the homepage preview doesn't drift out of
// sync with the real Calculator again.
const JIKUZE_PLUS_MIN_AMOUNT = 80_000;
const JIKUZE_PLUS_MAX_AMOUNT = 100_000;
const JIKUZE_PLUS_MIN_TERM_WEEKS = 4;
const JIKUZE_PLUS_MAX_TERM_WEEKS = 24;
const JIKUZE_PLUS_MONTHLY_RATE = 0.125; // interest_basis: "per_month"

export default function LoanCalculatorPreview() {
  const [amount, setAmount] = useState(90_000);
  const [weeks, setWeeks] = useState(8);

  const { weekly, totalRepayment } = useMemo(() => {
    const termInMonths = weeks / 4; // 4 weeks = 1 month, same convention as the full Calculator
    const totalInterest = amount * JIKUZE_PLUS_MONTHLY_RATE * termInMonths;
    const total = amount + totalInterest;
    return { weekly: total / weeks, totalRepayment: total };
  }, [amount, weeks]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
            Loan Calculator
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
            Know your repayment before you apply
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-500">
            Move the sliders to see how the amount and term change your weekly repayment on Jikuze Plus.
            The full calculator covers every product and gives you a downloadable schedule.
          </p>
          <Link
            to="/calculator"
            className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: "var(--color-navy-900)" }}
          >
            Open Full Calculator
            <ArrowRight size={16} />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-mist-200 bg-surface p-7 shadow-lg shadow-navy-900/5"
        >
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <label htmlFor="amount" className="text-ink-500">Loan amount</label>
              <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
                {formatKes(amount)}
              </span>
            </div>
            <input
              id="amount"
              type="range"
              min={JIKUZE_PLUS_MIN_AMOUNT}
              max={JIKUZE_PLUS_MAX_AMOUNT}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-[var(--color-ember-500)]"
            />
          </div>

          <div className="mb-7">
            <div className="mb-2 flex items-center justify-between text-sm">
              <label htmlFor="weeks" className="text-ink-500">Repayment term</label>
              <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
                {weeks} weeks
              </span>
            </div>
            <input
              id="weeks"
              type="range"
              min={JIKUZE_PLUS_MIN_TERM_WEEKS}
              max={JIKUZE_PLUS_MAX_TERM_WEEKS}
              step={1}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="w-full accent-[var(--color-ember-500)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
            <div>
              <p className="text-xs text-ink-500">Weekly repayment</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                {formatKes(weekly)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total repayment</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
                {formatKes(totalRepayment)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Based on Jikuze Plus at 12.5% monthly interest, for loans of KES 80,000-100,000. Other products have different rates and terms - see the full calculator.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// import { useMemo, useState } from "react";
// import { motion } from "framer-motion";
// import { Link } from "react-router-dom";
// import { ArrowRight } from "lucide-react";

// function formatKes(n: number) {
//   return "KES " + Math.round(n).toLocaleString("en-KE");
// }

// export default function LoanCalculatorPreview() {
//   const [amount, setAmount] = useState(150000);
//   const [months, setMonths] = useState(12);
//   const monthlyRate = 0.015;

//   const { monthly, totalRepayment } = useMemo(() => {
//     const totalInterest = amount * monthlyRate * months;
//     const total = amount + totalInterest;
//     return { monthly: total / months, totalRepayment: total };
//   }, [amount, months]);

//   return (
//     <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
//       <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
//         <div>
//           <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
//             Loan Calculator
//           </p>
//           <h2 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
//             Know your repayment before you apply
//           </h2>
//           <p className="mt-4 max-w-md text-base leading-relaxed text-ink-500">
//             Move the sliders to see how the amount and term change your monthly repayment.
//             The full calculator also gives you a downloadable schedule.
//           </p>
//           <Link
//             to="/calculator"
//             className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
//             style={{ backgroundColor: "var(--color-navy-900)" }}
//           >
//             Open Full Calculator
//             <ArrowRight size={16} />
//           </Link>
//         </div>

//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true, amount: 0.4 }}
//           transition={{ duration: 0.6 }}
//           className="rounded-3xl border border-mist-200 bg-surface p-7 shadow-lg shadow-navy-900/5"
//         >
//           <div className="mb-6">
//             <div className="mb-2 flex items-center justify-between text-sm">
//               <label htmlFor="amount" className="text-ink-500">Loan amount</label>
//               <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
//                 {formatKes(amount)}
//               </span>
//             </div>
//             <input
//               id="amount"
//               type="range"
//               min={10000}
//               max={1000000}
//               step={5000}
//               value={amount}
//               onChange={(e) => setAmount(Number(e.target.value))}
//               className="w-full accent-[var(--color-ember-500)]"
//             />
//           </div>

//           <div className="mb-7">
//             <div className="mb-2 flex items-center justify-between text-sm">
//               <label htmlFor="months" className="text-ink-500">Repayment term</label>
//               <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
//                 {months} months
//               </span>
//             </div>
//             <input
//               id="months"
//               type="range"
//               min={1}
//               max={36}
//               step={1}
//               value={months}
//               onChange={(e) => setMonths(Number(e.target.value))}
//               className="w-full accent-[var(--color-ember-500)]"
//             />
//           </div>

//           <div className="grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: "var(--color-mist-50)" }}>
//             <div>
//               <p className="text-xs text-ink-500">Monthly repayment</p>
//               <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                 {formatKes(monthly)}
//               </p>
//             </div>
//             <div>
//               <p className="text-xs text-ink-500">Total repayment</p>
//               <p className="mt-1 font-display text-xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
//                 {formatKes(totalRepayment)}
//               </p>
//             </div>
//           </div>
//           <p className="mt-4 text-xs text-ink-500">
//             Estimate at 1.5% monthly interest. Your actual rate depends on the product and your credit profile.
//           </p>
//         </motion.div>
//       </div>
//     </section>
//   );
// }

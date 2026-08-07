import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { useEngagement } from "../../lib/EngagementContext";
import { submitCrmLead } from "../../lib/crmApi";

export default function LeadCaptureModal() {
  const { modalOpen, pendingContext, closeModal, markCaptured } = useEngagement();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    // Reset so the next time it opens (a different session) it's fresh -
    // this instance won't actually remount within a session since markCaptured
    // suppresses future prompts, but keeps behavior predictable either way.
    setFullName("");
    setPhone("");
    setEmail("");
    setDone(false);
    setError(null);
    closeModal();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2 || phone.trim().length < 10) {
      setError("Please enter your name and a valid phone number.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const ok = await submitCrmLead({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      sourcePage: pendingContext?.sourcePage ?? "calculator",
      trigger: pendingContext?.trigger ?? "site_time_10min",
      productInterest: pendingContext?.productInterest,
      message: pendingContext?.message,
    });
    setSubmitting(false);
    if (ok) {
      markCaptured();
      setDone(true);
    } else {
      setError("Couldn't send that just now - please try again in a moment.");
    }
  }

  return (
    <AnimatePresence>
      {modalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-label="Request a callback"
            className="relative w-full max-w-sm rounded-3xl border border-mist-200 bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="absolute right-4 top-4 text-ink-500 hover:text-ink-700"
            >
              <X size={18} />
            </button>

            {done ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle2 size={40} style={{ color: "var(--color-ember-500)" }} />
                <p className="mt-4 font-display text-lg font-extrabold" style={{ color: "var(--color-ink-900)" }}>
                  Got it - thank you!
                </p>
                <p className="mt-1.5 text-sm text-ink-500">
                  A loan officer will reach out to you shortly.
                </p>
              </div>
            ) : (
              <>
                <p className="pr-6 font-display text-lg font-extrabold" style={{ color: "var(--color-ink-900)" }}>
                  Get a callback
                </p>
                <p className="mt-1.5 text-xs text-ink-500">
                  Just two details - we'll take it from here.
                </p>

                <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                  {/* Honeypot: hidden from real visitors via CSS, catches bots that fill every field. */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />
                  <div>
                    <label className="mb-1.5 block text-xs text-ink-500">Full name</label>
                    <input
                      type="text"
                      autoFocus
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Wanjiru"
                      className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-ink-500">Phone number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07xx xxx xxx"
                      className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-ink-500">Email (optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-70"
                    style={{ backgroundColor: "var(--color-navy-900)" }}
                  >
                    {submitting && <Loader2 size={16} className="animate-spin" />}
                    {submitting ? "Sending…" : "Request callback"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

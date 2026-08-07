import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle } from "lucide-react";
import { useEngagement } from "../../lib/EngagementContext";

export default function IntentPrompt() {
  const { promptOpen, acceptPrompt, dismissPrompt } = useEngagement();

  return (
    <AnimatePresence>
      {promptOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-label="Get in touch"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-mist-200 bg-surface p-4 shadow-lg sm:bottom-6 sm:left-auto sm:right-6"
        >
          <button
            type="button"
            onClick={dismissPrompt}
            aria-label="Dismiss"
            className="absolute right-3 top-3 text-ink-500 hover:text-ink-700"
          >
            <X size={16} />
          </button>
          <div className="flex gap-3 pr-4">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
            >
              <MessageCircle size={18} />
            </div>
            <div>
              <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                Want us to reach out?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Looks like you're exploring our loan products. A loan officer can call you
                to help - no obligation.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={dismissPrompt}
              className="flex-1 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-500 hover:bg-mist-50"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={acceptPrompt}
              className="flex-1 rounded-full px-4 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: "var(--color-ember-500)" }}
            >
              Yes, contact me
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

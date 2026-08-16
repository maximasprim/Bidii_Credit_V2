import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LeadSourcePage, LeadTrigger } from "./crmApi";

const SITE_TIME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes anywhere on the site
const CALCULATOR_TIME_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes on the calculator page

// Once we've shown the opt-in prompt this browser session, don't show it
// again even if a different trigger fires later - nobody wants to be asked
// twice in one visit. Once someone actually submits their details, we never
// ask again on this device at all.
const SESSION_PROMPTED_KEY = "bidii_intent_prompted";
const CAPTURED_KEY = "bidii_lead_captured";

export type IntentContext = {
  sourcePage: LeadSourcePage;
  trigger: LeadTrigger;
  productInterest?: string;
  message?: string;
};

type EngagementContextValue = {
  /** Whether the opt-in prompt should currently be visible. */
  promptOpen: boolean;
  /** Whether the name/phone capture modal should currently be visible. */
  modalOpen: boolean;
  pendingContext: IntentContext | null;
  /** Call from anywhere to (maybe) surface the "want us to reach out?" prompt. */
  requestIntent: (context: IntentContext) => void;
  /** Tell the tracker the visitor is currently on the calculator page. */
  setOnCalculatorPage: (isOn: boolean) => void;
  acceptPrompt: () => void;
  dismissPrompt: () => void;
  closeModal: () => void;
  markCaptured: () => void;
};

const EngagementContext = createContext<EngagementContextValue | null>(null);

function hasAlreadyBeenPromptedOrCaptured() {
  return (
    sessionStorage.getItem(SESSION_PROMPTED_KEY) === "1" ||
    localStorage.getItem(CAPTURED_KEY) === "1"
  );
}

export function EngagementProvider({ children }: { children: ReactNode }) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingContext, setPendingContext] = useState<IntentContext | null>(null);

  const calculatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function requestIntent(context: IntentContext) {
    if (hasAlreadyBeenPromptedOrCaptured() || promptOpen || modalOpen) return;
    sessionStorage.setItem(SESSION_PROMPTED_KEY, "1");
    setPendingContext(context);
    setPromptOpen(true);
  }

  // 10-minutes-anywhere-on-site timer, started once on first mount and left
  // running for the life of the SPA session.
  useEffect(() => {
    const timer = setTimeout(() => {
      requestIntent({ sourcePage: "calculator", trigger: "site_time_10min" });
    }, SITE_TIME_THRESHOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setOnCalculatorPage(isOn: boolean) {
    if (calculatorTimerRef.current) {
      clearTimeout(calculatorTimerRef.current);
      calculatorTimerRef.current = null;
    }
    if (isOn) {
      calculatorTimerRef.current = setTimeout(() => {
        requestIntent({ sourcePage: "calculator", trigger: "calculator_time_5min" });
      }, CALCULATOR_TIME_THRESHOLD_MS);
    }
  }

  function acceptPrompt() {
    setPromptOpen(false);
    setModalOpen(true);
  }

  function dismissPrompt() {
    setPromptOpen(false);
    setPendingContext(null);
  }

  function closeModal() {
    setModalOpen(false);
    setPendingContext(null);
  }

  function markCaptured() {
    localStorage.setItem(CAPTURED_KEY, "1");
    setModalOpen(false);
    setPendingContext(null);
  }

  return (
    <EngagementContext.Provider
      value={{
        promptOpen,
        modalOpen,
        pendingContext,
        requestIntent,
        setOnCalculatorPage,
        acceptPrompt,
        dismissPrompt,
        closeModal,
        markCaptured,
      }}
    >
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error("useEngagement must be used within an EngagementProvider");
  return ctx;
}

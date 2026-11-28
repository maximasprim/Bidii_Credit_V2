import { useCallback, useEffect, useState } from "react";

/**
 * Makes the staff/admin area an installable app ("Bidii Staff") that opens on the login page.
 *
 * - useAdminManifest(): while the admin area is on screen, points the page at
 *   /admin.webmanifest (start_url /admin/login, scope /admin/) instead of the public site's
 *   manifest, and registers the tiny service worker /admin-sw.js. Leaving the admin area
 *   restores the public manifest, so the public website is unaffected.
 * - useInstallApp(): drives the "Install app" button on the login page.
 *
 * index.html does the same manifest swap before the page finishes loading when someone opens
 * /admin/... directly, and stashes the browser's install prompt in window.__bidiiInstallPrompt.
 */

const PUBLIC_MANIFEST = "/site.webmanifest";
const ADMIN_MANIFEST = "/admin.webmanifest";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __bidiiInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function manifestLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  return link;
}

export function useAdminManifest() {
  useEffect(() => {
    const link = manifestLink();
    link.setAttribute("href", ADMIN_MANIFEST);

    if ("serviceWorker" in navigator) {
      // Scope is /admin/ only (the server sends Service-Worker-Allowed for it - see vercel.json).
      // Failing here (dev server, unsupported browser) only means no install prompt.
      navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin/" }).catch(() => {});
    }

    return () => {
      manifestLink().setAttribute("href", PUBLIC_MANIFEST);
    };
  }, []);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

export function useInstallApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(() => window.__bidiiInstallPrompt ?? null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault(); // keep the event so our own button can trigger the install
      window.__bidiiInstallPrompt = e as BeforeInstallPromptEvent;
      setPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      window.__bidiiInstallPrompt = null;
      setPrompt(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = prompt ?? window.__bidiiInstallPrompt;
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    window.__bidiiInstallPrompt = null; // a prompt can only be used once
    setPrompt(null);
  }, [prompt]);

  const standalone = typeof window !== "undefined" && isStandalone();
  return {
    /** The browser offered an install prompt we can trigger from a button. */
    canInstall: !!prompt && !standalone && !installed,
    /** iPhone/iPad Safari has no prompt: show "Share > Add to Home Screen" instead. */
    showIOSHint: isIOS() && !standalone && !installed && !prompt,
    installed,
    install,
  };
}

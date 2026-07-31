import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "Bidii Credit";
const SITE_URL = "https://www.bidiicreditkenya.co.ke";

/**
 * Sets document.title and the canonical <link> tag per page. This is a
 * client-rendered SPA (no SSR/prerendering), so search engines that don't
 * execute JavaScript won't see per-route titles — this covers browser tabs,
 * social shares fetched by a crawler that does render JS, and keeps the
 * canonical tag correct if this site is ever prerendered later.
 */
export function usePageMeta(title: string) {
  const location = useLocation();

  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}${location.pathname}`;
  }, [title, location.pathname]);
}

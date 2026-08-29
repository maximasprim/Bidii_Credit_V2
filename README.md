# Bidii Credit - Website Rebuild

A modern rebuild of the Bidii Credit Kenya website: React 19 + TypeScript + Vite +
Tailwind CSS v4, with Framer Motion, React Router, React Hook Form + Zod, Swiper,
Recharts, and Leaflet wired in throughout.

## Every page from the brief is built

Home, About, Services, Products (index + per-product detail), Loan Calculator,
Branch Locator (with a real interactive map), Downloads, News & Insights
(index + article detail), Careers, Contact, Apply, FAQ - plus the shared
navbar (with products mega-menu + dark mode toggle), footer, and mobile
sticky "Apply Now" bar.

## Getting started

```bash
npm install
npm run dev       # start local dev server
npm run build     # type-check + production build
npm run preview   # preview the production build
npm run lint       # eslint
npm run format     # prettier
```

## Design notes

- **Palette**: deep navy (`--color-navy-*`) for trust/authority, a single
  warm ember-orange (`--color-ember-*`) reserved for actions and emphasis,
  a warm-tinted gray (`--color-mist-*`) instead of a cold slate. Tokens live
  in `src/index.css` under `@theme` - Tailwind v4 auto-generates utilities
  like `bg-navy-900` / `text-ember-500` from them.
- **Type**: Plus Jakarta Sans for display/headings, Inter for body and UI,
  with `tabular-nums` applied to all monetary and numeric figures.
- **Signature motif**: an ascending "staircase" growth line
  (`src/components/ui/GrowthLine.tsx`) standing in for *bidii* (Kiswahili:
  diligence/effort compounding into growth), reused at different scales
  through the hero, CTA band, and page sub-heroes.

## Dark mode

Toggled from the navbar (sun/moon icon, desktop and mobile), persisted to
`localStorage`, defaults to system preference on first visit. Implementation:
colors are CSS custom properties (`--color-mist-*`, `--color-ink-*`,
`--color-surface`), redefined under a `.dark` class on `<html>` in
`src/index.css` - so every Tailwind utility and inline style built from those
tokens repaints automatically, with no per-component `dark:` variants needed.
Sections that are permanently navy regardless of theme (Hero, footer, CTA
band) are untouched since they reference `--color-navy-*` directly.
An inline script in `index.html` applies the class before first paint to
avoid a flash of the wrong theme. `color-scheme: dark` is set under `.dark`
so native form controls (inputs, selects, scrollbars) re-theme for free.

## Branch Locator map

Real interactive map via `react-leaflet` + OpenStreetMap tiles - no API key
required, ever. Branch coordinates live in `src/data/content.ts`. The map
component is lazy-loaded (`src/pages/Branches.tsx`) so its ~160KB isn't in
the main bundle for visitors who never open that page.

## SEO

- `public/robots.txt` and `public/sitemap.xml` (covers all static routes plus
  every product/article slug).
- `FinancialService` JSON-LD structured data in `index.html`.
- `src/lib/usePageMeta.ts` sets `document.title` and the canonical `<link>`
  per route - every page calls it. Note this is a client-rendered SPA with no
  SSR/prerendering, so a crawler that doesn't execute JavaScript won't see
  per-route titles; this covers browser tabs and any crawler that does render
  JS, and keeps things correct if SSR/prerendering is added later.

## Performance: code-split by route

Every page except Home is `React.lazy`-loaded (`src/App.tsx`), wrapped in a
single `<Suspense>` with a small spinner fallback. This cut the initial JS
bundle from ~1,040KB to ~490KB - the Loan Calculator's `recharts` dependency
(~360KB) and the Branch Locator's `leaflet` dependency (~160KB) now only
download when a visitor actually opens those pages.

## Responsiveness

Verified from small phones through ultra-wide desktops - see git history /
earlier notes for the specific fixes (mega-menu width capped to viewport,
global overflow-x safety net, calculator table scrolls horizontally on
narrow screens, footer 2-column tablet layout, CTA band contained to the
page's max-width column, mobile sticky bar respects iPhone safe-area insets).

## Content

All copy (products, stats, testimonials, branches, FAQs, services,
downloads, articles, jobs) lives in `src/data/content.ts` as realistic
placeholder content matching Bidii's product lineup - swap in real
figures, branch addresses, verified testimonials, and actual documents
before launch.

## Known gaps to close before a real launch

- Contact, Apply, and Careers forms simulate submission client-side -
  no backend/email endpoint connected yet.
- No SSR/prerendering, so search engines that don't execute JavaScript see
  only the initial (Home) HTML - consider prerendering or a framework like
  Next.js/Remix if pre-JS crawlability of every route matters.
- Leaflet's default popup styling is not dark-mode aware (third-party CSS).

import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Menu, X, Sun, Moon } from "lucide-react";
import { loanProducts } from "../../data/content";
import { cn } from "../../lib/utils";
import logo from "../../../public/Bidii-logo.png";
import { useTheme } from "../../lib/useTheme";

const navLinks = [
  { label: "About", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "Loan Calculator", to: "/calculator" },
  { label: "Branches", to: "/branches" },
  { label: "News", to: "/news" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled ? "bg-white/95 backdrop-blur shadow-sm" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          {/* <div className=""> */}
            {/* <img
              src={logo}
              alt="Bidii Credit"
              className="h-14 w-auto object-contain"
            /> */}
          {/* </div> */}
                       <span className="flex flex-row items-center gap-4 font-display text-lg font-extrabold text-white">
                {/* Logo + glow */}
                <div className="relative flex items-center justify-center">
                  {/* Bright soft glow */}
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: "200px",
                      height: "85px",
                      background:
                        "radial-gradient(circle, rgba(251, 125, 83, 0.95) 0%, rgba(223, 177, 131, 0.42) 20%, rgba(248, 150, 52, 0.10) 50%, transparent 70%)",
                      filter: "blur(12px)",
                      zIndex: 0,
                    }}
                  />

                  {/* Logo */}
                  <img
                    src={logo}
                    alt="Bidii Credit"
                    className="relative z-10 h-14 w-auto object-contain"
                  />
                </div>

            
              </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              className={cn(
                "flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                scrolled ? "text-ink-700 hover:bg-mist-100" : "text-orange-500/90 hover:bg-white/10"
              )}
            >
              Products
              <ChevronDown size={15} className={cn("transition-transform", productsOpen && "rotate-180")} />
            </button>
            {productsOpen && (
              <div className="absolute left-1/2 top-full w-[min(560px,90vw)] -translate-x-1/2 pt-3">
                <div className="grid grid-cols-2 gap-1 rounded-2xl border border-mist-200 bg-white p-3 shadow-xl">
                  {loanProducts.map((p) => (
                    <Link
                      key={p.slug}
                      to={`/products/${p.slug}`}
                      className="rounded-xl px-4 py-3 transition-colors hover:bg-mist-50"
                    >
                      <p className="font-display text-sm font-bold" style={{ color: "var(--color-navy-900)" }}>
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">{p.tagline}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                scrolled ? "text-ink-700 hover:bg-mist-100" : "text-orange-500/90 hover:bg-white/10"
              )}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              scrolled ? "text-ink-700 hover:bg-mist-100" : "text-orange-400 hover:bg-white/10"
            )}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <Link
            to="/contact"
            className={cn("text-sm font-medium", scrolled ? "text-ink-700" : "text-orange-500/90")}
          >
            Contact
          </Link>
          <Link
            to="/apply"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            Apply Now
          </Link>
        </div>
        <div className="flex items-center gap-1 md:gap-8 lg:gap-10 lg:hidden">
          <div className="flex items-center gap-1 lg:hidden">
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 items-center justify-center"
              style={{ color: scrolled ? "var(--color-ink-500)" : "var(--color-ink-900)" }}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* <button
            className="flex h-9 w-9 items-center justify-center"
            style={{ color: scrolled ? "var(--color-ink-900)" : "white" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button> */}
          </div>

          <button
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X color={scrolled ? "#0B2A4A" : "#ff8000"} />
            ) : (
              <Menu color={scrolled ? "#0B2A4A" : "#ff8000"} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-mist-200 bg-white px-5 py-4 lg:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Products</p>
          <div className="mb-4 flex flex-col gap-1">
            {loanProducts.map((p) => (
              <Link
                key={p.slug}
                to={`/products/${p.slug}`}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-1 text-xs text-ink-700"
              >
                {p.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-mist-50"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/apply"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-full px-4 py-3 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-ember-500)" }}
            >
              Apply Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

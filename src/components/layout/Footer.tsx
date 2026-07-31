import { Link } from "react-router-dom";
import { MessageCircle, MapPin, Phone, Mail, ShieldCheck } from "lucide-react";
import { loanProducts } from "../../data/content";
import logo from "../../../public/Bidii_Credit_Logo.png";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedin,
  // FaTiktok,
} from "react-icons/fa";

import { FaXTwitter } from "react-icons/fa6";
const socialIcons = [
  {
    icon: FaFacebookF,
    href: "https://www.facebook.com/bidiicredit",
    label: "Facebook",
  },
  {
    icon: FaInstagram,
    href: "https://www.instagram.com/bidiicreditltd/",
    label: "Instagram",
  },
  {
    icon: FaLinkedin,
    href: "https://www.linkedin.com/company/bidii-credit-kenya",
    label: "LinkedIn",
  },
  {
    icon: FaXTwitter,
    href: "https://www.twitter.com/bidiicredit",
    label: "X (Twitter)",
  },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "var(--color-navy-950)" }} className="text-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="bg-white p-1 rounded-full w-16 h-16 flex items-center justify-center mb-2">
              <img
                src={logo}
                alt="Bidii Credit"
                className="h-16 w-auto object-contain"
              />
            </div>
            <span className="font-display text-xl font-extrabold">
              Bidii<span style={{ color: "var(--color-ember-500)" }}>Credit</span>
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Licensed lending for Kenyan entrepreneurs, salaried professionals and small
              businesses - built around how income actually moves.
            </p>
            {/* <div className="mt-5 flex gap-3">
              {[AtSign, MessageCircle, Send, Globe].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                  aria-label="Social link"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div> */}



            <div className="mt-5 flex gap-3">
              {socialIcons.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                  aria-label={label}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-white/90">Products</p>
            <ul className="space-y-2.5 text-sm text-white/60">
              {loanProducts.slice(0, 5).map((p) => (
                <li key={p.slug}>
                  <Link to={`/products/${p.slug}`} className="transition-colors hover:text-white">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-white/90">Company</p>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link to="/about" className="transition-colors hover:text-white">About Us</Link></li>
              <li><Link to="/careers" className="transition-colors hover:text-white">Careers</Link></li>
              <li><Link to="/news" className="transition-colors hover:text-white">News &amp; Insights</Link></li>
              <li><Link to="/downloads" className="transition-colors hover:text-white">Downloads</Link></li>
              <li><Link to="/branches" className="transition-colors hover:text-white">Branch Locator</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-white/90">Resources</p>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link to="/calculator" className="transition-colors hover:text-white">Loan Calculator</Link></li>
              <li><Link to="/faq" className="transition-colors hover:text-white">FAQs</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-white">Support</Link></li>
              <li><a href="#" className="transition-colors hover:text-white">Privacy Policy</a></li>
              <li><a href="#" className="transition-colors hover:text-white">Terms of Service</a></li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-white/90">Get in touch</p>
            <ul className="space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                Applewood Adams, 3ʳᵈ Floor, Ngong Road, Nairobi, Kenya
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={16} className="shrink-0" />
                +254 709 840 000
              </li>
              <li className="flex items-center gap-2.5">
                <MessageCircle size={16} className="shrink-0" />
                +254 797 360 977
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="shrink-0" />
                info@bidiicreditkenya.co.ke
              </li>
            </ul>
            <form className="mt-5 flex" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email"
                className="w-full rounded-l-full bg-white/10 px-4 py-2.5 text-sm placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-r-full px-4 text-sm font-semibold"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              >
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "var(--color-ember-500)" }} />
            Licensed and regulated microfinance institution, Kenya. Member of the AMFI-K.
          </div>
          <p>© {new Date().getFullYear()} Bidii Credit Kenya. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

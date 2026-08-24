import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import StickyApplyCTA from "./components/layout/StickyApplyCTA";
import Home from "./pages/Home";
import { AdminAuthProvider } from "./lib/AdminAuthContext";
import { EngagementProvider } from "./lib/EngagementContext";
import IntentPrompt from "./components/ui/IntentPrompt";
import LeadCaptureModal from "./components/ui/LeadCaptureModal";
import { Toaster } from "react-hot-toast";

// Home loads eagerly since it's the most common entry point. Every other
// route is code-split so a visitor only downloads the page they asked for -
// e.g. the Loan Calculator's recharts dependency, or the Branch Locator's
// map, never load for someone just reading About or FAQ.
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const Downloads = lazy(() => import("./pages/Downloads"));
const News = lazy(() => import("./pages/News"));
const NewsArticle = lazy(() => import("./pages/NewsArticle"));
const Careers = lazy(() => import("./pages/Careers"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Calculator = lazy(() => import("./pages/Calculator"));
const Branches = lazy(() => import("./pages/Branches"));
const Contact = lazy(() => import("./pages/Contact"));
const Apply = lazy(() => import("./pages/Apply"));
const Faq = lazy(() => import("./pages/Faq"));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));

// Admin dashboard - a completely separate route tree (no public Navbar/
// Footer/sticky CTA), gated by its own auth provider, code-split as its
// own chunk since it's irrelevant to the vast majority of visitors.
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminContacts = lazy(() => import("./pages/admin/AdminContacts"));
const AdminLoanApplications = lazy(() => import("./pages/admin/AdminLoanApplications"));
const AdminCareerApplications = lazy(() => import("./pages/admin/AdminCareerApplications"));
const AdminNews = lazy(() => import("./pages/admin/AdminNews"));
const AdminJobs = lazy(() => import("./pages/admin/AdminJobs"));
const AdminLoanTerms = lazy(() => import("./pages/admin/AdminLoanTerms"));
const AdminBranches = lazy(() => import("./pages/admin/AdminBranches"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminRolePermissions = lazy(() => import("./pages/admin/AdminRolePermissions"));

//ATS
const AdminATS = lazy(() => import("./pages/admin/AdminATS"));
const AdminATSConfig = lazy(() => import("./pages/admin/AdminATSConfig"));
const AdminATSCandidate = lazy(() => import("./pages/admin/AdminATSCandidate"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-mist-200"
        style={{ borderTopColor: "var(--color-ember-500)" }}
      />
    </div>
  );
}

function Shell() {
  return (
    <EngagementProvider>
      <div className="flex min-h-screen flex-col pb-20 lg:pb-0">
        <Navbar />
        <main className="flex-1">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/branches" element={<Branches />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/news" element={<News />} />
              <Route path="/news/:slug" element={<NewsArticle />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="*" element={<PlaceholderPage title="Page Not Found" />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <StickyApplyCTA />
        <IntentPrompt />
        <LeadCaptureModal />
      </div>
      </EngagementProvider>
      );
}

function AdminApp() {
  return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="contacts" element={<AdminContacts />} />
            <Route path="loan-applications" element={<AdminLoanApplications />} />
            <Route path="career-applications" element={<AdminCareerApplications />} />
            <Route path="news" element={<AdminNews />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="loan-terms" element={<AdminLoanTerms />} />
            <Route path="branches" element={<AdminBranches />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="role-permissions" element={<AdminRolePermissions />} />
            <Route path="ats" element={<AdminATS />} />
            <Route path="ats/config/:jobId" element={<AdminATSConfig />} />
            <Route path="ats/candidates/:applicationId" element={<AdminATSCandidate />} />
          </Route>
        </Routes>
      </Suspense>
      );
}

      export default function App() {
  return (
      <BrowserRouter>
      {/*
        AdminAuthProvider wraps the whole app, not just /admin/*, so that
        public pages (like the Loan Calculator) can also check whether a
        staff member (admin/loan officer) is currently logged in and show
        them extra fields. It only reads/exposes localStorage-backed state
        and renders no UI of its own, so this doesn't change anything for
        the public routes that don't use it.
      */}
      <AdminAuthProvider>
      <Toaster 
      position="top-right"
      reverseOrder={false}
      gutter={12}
      toastOptions={{
        duration: 4000,
        style: {
          background: "#ffffff",
          color: "#1f2937",
          borderRadius: "16px",
          padding: "14px 18px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
        },
        success: {
          duration: 4000,
        },
        error: {
          duration: 5000,
        },
      }}
      />
        <ScrollToTop />
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </AdminAuthProvider>
      </BrowserRouter>
      );
}


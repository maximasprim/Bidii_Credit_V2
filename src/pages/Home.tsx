import Hero from "../components/home/Hero";
import StatsBand from "../components/home/StatsBand";
import WhyChooseBidii from "../components/home/WhyChooseBidii";
import FeaturedProducts from "../components/home/FeaturedProducts";
import LoanCalculatorPreview from "../components/home/LoanCalculatorPreview";
import ApplicationJourney from "../components/home/ApplicationJourney";
import Testimonials from "../components/home/Testimonials";
import BranchesPreview from "../components/home/BranchesPreview";
import FAQSection from "../components/home/FAQSection";
import CTABand from "../components/home/CTABand";
import { usePageMeta } from "../lib/usePageMeta";

export default function Home() {
  usePageMeta("Financing for Kenyan Businesses That Show Up Every Day");
  return (
    <>
      <Hero />
      <StatsBand />
      <WhyChooseBidii />
      <FeaturedProducts />
      <LoanCalculatorPreview />
      <ApplicationJourney />
      <Testimonials />
      <BranchesPreview />
      <FAQSection />
      <CTABand />
    </>
  );
}

import { LandingNav } from "@/components/landing/nav";
import { HeroSection } from "@/components/landing/hero";
import {
  FeaturesSection,
  TestimonialsSection,
  PricingSection,
  CTASection,
  LandingFooter,
} from "@/components/landing/sections";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}

import { Navbar } from "@/components/layout/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { TripleBlindSection } from "@/components/landing/TripleBlindSection";
import { EngineSection } from "@/components/landing/EngineSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ForCompaniesSection } from "@/components/landing/ForCompaniesSection";
import { ForRecruitersSection } from "@/components/landing/ForRecruitersSection";
import { AnalyticsSection } from "@/components/landing/AnalyticsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TrustSecuritySection } from "@/components/landing/TrustSecuritySection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTASection } from "@/components/landing/FinalCTASection";
import { FooterSection } from "@/components/landing/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <SocialProofSection />
      <ProblemSection />
      <TripleBlindSection />
      <EngineSection />
      <HowItWorksSection />
      <FeaturesSection />
      <ForCompaniesSection />
      <ForRecruitersSection />
      <AnalyticsSection />
      <PricingSection />
      <TrustSecuritySection />
      <FAQSection />
      <FinalCTASection />
      <FooterSection />
    </div>
  );
};

export default Index;

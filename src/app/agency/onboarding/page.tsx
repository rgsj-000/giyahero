import type { Metadata } from "next";
import { AgencyOnboardingForm } from "@/features/agencies/components/agency-onboarding-form";

export const metadata: Metadata = {
  title: "Agency onboarding",
};

export default function AgencyOnboardingPage() {
  return <AgencyOnboardingForm />;
}

import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}

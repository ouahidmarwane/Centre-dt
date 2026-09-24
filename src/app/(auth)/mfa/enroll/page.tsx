import type { Metadata } from "next";

import { requireMfaPage } from "@/lib/auth/server";

import { MfaFrame } from "../mfa-frame";
import { EnrollmentForm } from "./enrollment-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Configurer la double authentification", robots: { index: false, follow: false } };

export default async function MfaEnrollPage() {
  await requireMfaPage("enroll");
  return <MfaFrame title="Configurer votre authentificateur" description="Cette étape est obligatoire pour protéger votre accès aux données des patients du cabinet."><EnrollmentForm /></MfaFrame>;
}

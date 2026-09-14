import type { Metadata } from "next";

import { SecurityCenter } from "@/components/security/security-center";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getSecurityCenter } from "@/lib/security/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Centre de sécurité",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

const notices: Record<string, { tone: "success" | "error"; message: string }> = {
  "policy-added": { tone: "success", message: "La règle IP a été ajoutée au registre." },
  "policy-disabled": { tone: "success", message: "La règle IP a été désactivée." },
  "user-deactivated": { tone: "success", message: "L’accès applicatif a été désactivé." },
  "user-reactivated": { tone: "success", message: "L’accès applicatif a été réactivé." },
  "confirmation-required": { tone: "error", message: "Une confirmation explicite est requise." },
  "invalid-block": { tone: "error", message: "Vérifiez l’adresse, le motif et la durée." },
  "policy-refused": { tone: "error", message: "Cette règle IP a été refusée pour des raisons de sécurité." },
  "policy-disable-refused": { tone: "error", message: "Cette règle IP n’a pas pu être désactivée." },
  "user-change-refused": { tone: "error", message: "Cette modification d’accès a été refusée." },
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requirePermission("security.read");
  const query = await searchParams;
  const notice = query.notice ? notices[query.notice] : undefined;
  const data = await getSecurityCenter();

  return (
    <>
      <PageHeader
        description="Événements récents, connexions observées et contrôles d’accès réservés au docteur."
        eyebrow="Accès docteur"
        title="Centre de sécurité"
      />
      <SecurityCenter data={data} notice={notice} />
    </>
  );
}

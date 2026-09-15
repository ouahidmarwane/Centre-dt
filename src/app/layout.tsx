import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Centre Dentaire Ouahid",
    template: "%s | Centre Dentaire Ouahid",
  },
  description: "Plateforme interne de gestion du Centre Dentaire Ouahid",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

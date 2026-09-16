import { redirect } from "next/navigation";

import { getLoginDestination } from "@/lib/auth/server";

export default async function Home() {
  const destination = await getLoginDestination();
  redirect(destination ?? "/login");
}

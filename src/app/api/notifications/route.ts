import { getAuthorizedUser } from "@/lib/auth/server";
import { getNotificationFeed } from "@/lib/notifications/data";

export const dynamic = "force-dynamic";

// Background poll of the notification centre. It is checked for inactivity by the proxy
// but never renews the session, so an open tab does not stay signed in on its own.
export async function GET() {
  const user = await getAuthorizedUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getNotificationFeed(user.role), { headers: { "Cache-Control": "private, no-store" } });
}

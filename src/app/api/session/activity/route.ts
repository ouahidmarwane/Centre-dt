import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Keep-alive sent by the page while the user interacts without navigating (reading,
// scrolling, typing). The proxy has already checked and renewed the activity marker.
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MonthFigures, NatureFigure } from "./presentation";

type RawMonth = { month: string; production: number; received: number; new_patients: number; completed: number; no_show: number; cancelled: number; scheduled: number };
type RawNature = { nature: string; amount: number; count: number };

export async function getMonthlyStatistics(month: string): Promise<{ months: MonthFigures[]; natures: NatureFigure[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_statistics", { target_month: `${month}-01` }).single();
  if (error || !data) throw new Error("STATISTICS_UNAVAILABLE");
  const months = ((data.months ?? []) as RawMonth[]).map((row) => ({
    month: row.month, production: Number(row.production), received: Number(row.received), newPatients: Number(row.new_patients),
    completed: Number(row.completed), noShow: Number(row.no_show), cancelled: Number(row.cancelled), scheduled: Number(row.scheduled),
  }));
  const natures = ((data.natures ?? []) as RawNature[]).map((row) => ({ nature: row.nature, amount: Number(row.amount), count: Number(row.count) }));
  return { months, natures };
}

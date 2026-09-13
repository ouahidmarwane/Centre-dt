import "server-only";

import type { AccountingBucket } from "@/lib/accounting/periods";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export type AccountingSeriesPoint = {
  bucket_start: string;
  production: number;
  received: number;
};

export type AccountingPaymentMethod = {
  method: PaymentMethod;
  amount: number;
  payment_count: number;
};

export type AccountingDashboard = {
  production: number;
  received: number;
  period_net: number;
  current_outstanding: number;
  active_patient_count: number;
  intervention_count: number;
  payment_count: number;
  series: AccountingSeriesPoint[];
  payment_methods: AccountingPaymentMethod[];
};

const paymentMethods = new Set<PaymentMethod>(["cash", "card", "bank_transfer", "cheque", "other"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseDashboard(value: unknown): AccountingDashboard {
  if (!value || typeof value !== "object") throw new Error("ACCOUNTING_UNAVAILABLE");
  const row = value as Record<string, unknown>;
  const numberFields = [
    "production",
    "received",
    "period_net",
    "current_outstanding",
    "active_patient_count",
    "intervention_count",
    "payment_count",
  ] as const;
  if (numberFields.some((field) => !isFiniteNumber(row[field]))) throw new Error("ACCOUNTING_UNAVAILABLE");
  if (!Array.isArray(row.series) || !Array.isArray(row.payment_methods)) throw new Error("ACCOUNTING_UNAVAILABLE");

  const series = row.series.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("ACCOUNTING_UNAVAILABLE");
    const point = entry as Record<string, unknown>;
    if (typeof point.bucket_start !== "string" || !isFiniteNumber(point.production) || !isFiniteNumber(point.received)) {
      throw new Error("ACCOUNTING_UNAVAILABLE");
    }
    return { bucket_start: point.bucket_start, production: point.production, received: point.received };
  });
  const methods = row.payment_methods.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("ACCOUNTING_UNAVAILABLE");
    const method = entry as Record<string, unknown>;
    if (!paymentMethods.has(method.method as PaymentMethod) || !isFiniteNumber(method.amount) || !isFiniteNumber(method.payment_count)) {
      throw new Error("ACCOUNTING_UNAVAILABLE");
    }
    return { method: method.method as PaymentMethod, amount: method.amount, payment_count: method.payment_count };
  });

  return {
    production: row.production as number,
    received: row.received as number,
    period_net: row.period_net as number,
    current_outstanding: row.current_outstanding as number,
    active_patient_count: row.active_patient_count as number,
    intervention_count: row.intervention_count as number,
    payment_count: row.payment_count as number,
    series,
    payment_methods: methods,
  };
}

export async function getAccountingDashboard(
  startDate: string,
  endDate: string,
  bucket: AccountingBucket,
): Promise<AccountingDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accounting_dashboard", {
    target_start_date: startDate,
    target_end_date: endDate,
    target_bucket: bucket,
  }).single();
  if (error) throw new Error("ACCOUNTING_UNAVAILABLE");
  return parseDashboard(data);
}

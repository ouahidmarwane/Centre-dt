import "server-only";

import { requirePermission } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type SecuritySeverity = "info" | "warning" | "critical";

export type SecurityCenterEvent = {
  id: string;
  userId: string | null;
  eventType: string;
  severity: SecuritySeverity;
  createdAt: string;
};

export type ObservedConnection = {
  id: string;
  userId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  endedAt: string | null;
};

export type IpPolicy = {
  id: string;
  ipAddress: string;
  reason: string;
  blockedBy: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
};

export type SecurityUser = {
  id: string;
  fullName: string;
  role: "doctor" | "assistant";
  isActive: boolean;
  createdAt: string;
  lastObservedAt: string | null;
};

export type SecurityCenterData = {
  generatedAt: string;
  windowStartedAt: string;
  summary: {
    events24h: number;
    alerts14d: number;
    critical14d: number;
    activeIpPolicies: number;
    observedConnections: number;
    activeUsers: number;
  };
  events: SecurityCenterEvent[];
  sessions: ObservedConnection[];
  ipPolicies: IpPolicy[];
  users: SecurityUser[];
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSecurityCenter(value: unknown): SecurityCenterData {
  const root = object(value);
  const summary = object(root.summary);

  return {
    generatedAt: string(root.generated_at),
    windowStartedAt: string(root.window_started_at),
    summary: {
      events24h: number(summary.events_24h),
      alerts14d: number(summary.alerts_14d),
      critical14d: number(summary.critical_14d),
      activeIpPolicies: number(summary.active_ip_policies),
      observedConnections: number(summary.observed_connections),
      activeUsers: number(summary.active_users),
    },
    events: array(root.events).map((entry) => {
      const event = object(entry);
      const severity = string(event.severity);
      return {
        id: string(event.id),
        userId: nullableString(event.user_id),
        eventType: string(event.event_type),
        severity:
          severity === "critical" || severity === "warning" ? severity : "info",
        createdAt: string(event.created_at),
      };
    }),
    sessions: array(root.sessions).map((entry) => {
      const session = object(entry);
      return {
        id: string(session.id),
        userId: string(session.user_id),
        firstSeenAt: string(session.first_seen_at),
        lastSeenAt: string(session.last_seen_at),
        endedAt: nullableString(session.ended_at),
      };
    }),
    ipPolicies: array(root.ip_policies).map((entry) => {
      const block = object(entry);
      return {
        id: string(block.id),
        ipAddress: string(block.ip_address),
        reason: string(block.reason),
        blockedBy: string(block.blocked_by),
        createdAt: string(block.created_at),
        expiresAt: nullableString(block.expires_at),
        isActive: block.is_active === true,
      };
    }),
    users: array(root.users).flatMap((entry) => {
      const user = object(entry);
      const role = string(user.role);
      if (role !== "doctor" && role !== "assistant") return [];
      return [{
        id: string(user.id),
        fullName: string(user.full_name),
        role,
        isActive: user.is_active === true,
        createdAt: string(user.created_at),
        lastObservedAt: nullableString(user.last_observed_at),
      }];
    }),
  };
}

export async function getSecurityCenter(): Promise<SecurityCenterData> {
  await requirePermission("security.read");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_security_center", {
    reference_time: new Date().toISOString(),
  });

  if (error || !data) {
    throw new Error("SECURITY_CENTER_UNAVAILABLE");
  }

  return normalizeSecurityCenter(data);
}

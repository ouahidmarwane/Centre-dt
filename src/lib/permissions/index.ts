export const roles = ["doctor", "assistant"] as const;

export type AppRole = (typeof roles)[number];

export const permissions = [
  "patients.read",
  "patients.write",
  "appointments.read",
  "appointments.write",
  "billing.read",
  "billing.write",
  "accounting.read",
  "accounting.write",
  "security.read",
  "security.manage",
] as const;

export type Permission = (typeof permissions)[number];

export const doctorOnlyRoutePermissions = {
  "/accounting": "accounting.read",
  "/security": "security.read",
} as const satisfies Record<string, Permission>;

const rolePermissions: Record<AppRole, ReadonlySet<Permission>> = {
  doctor: new Set(permissions),
  assistant: new Set([
    "patients.read",
    "patients.write",
    "appointments.read",
    "appointments.write",
    "billing.read",
    "billing.write",
  ]),
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && roles.includes(value as AppRole);
}

export function hasPermission(
  role: AppRole,
  permission: Permission,
): boolean {
  return rolePermissions[role].has(permission);
}

export function canAccessDoctorRoute(
  role: AppRole,
  pathname: keyof typeof doctorOnlyRoutePermissions,
): boolean {
  return hasPermission(role, doctorOnlyRoutePermissions[pathname]);
}

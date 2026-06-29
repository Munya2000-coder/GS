import { cookies } from "next/headers";
import { prisma } from "./db";
import { parseRoles, permissionsFor, type Permission, type RoleKey } from "./rbac";

/**
 * Pluggable authentication (PRD §7.2).
 *
 * AUTH_MODE=dev   — cookie-based identity with an in-app role switcher. The single
 *                   surface to replace when wiring real SSO.
 * AUTH_MODE=entra — validate the Entra ID (MSAL/OIDC) token on every request and
 *                   sync roles from Entra group membership. Stubbed here: the
 *                   `resolveEntraSession` boundary is where MSAL token validation
 *                   and group→role mapping would live.
 */

const AUTH_COOKIE = "icms_user";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleKey[];
  siteScope: string | null;
  isExternal: boolean;
  permissions: Set<Permission>;
};

async function loadUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;
  // Enforce time-limited external access (inspector / legal adviser) — PRD ICMS-079/102.
  if (user.accessExpiresAt && user.accessExpiresAt < new Date()) return null;
  const roles = parseRoles(user.roles);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles,
    siteScope: user.siteScope,
    isExternal: user.isExternal,
    permissions: permissionsFor(roles),
  };
}

/** Returns the active session user, or null if unauthenticated. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const mode = process.env.AUTH_MODE ?? "dev";

  if (mode === "entra") {
    const entraUserId = await resolveEntraSession();
    if (!entraUserId) return null;
    return loadUser(entraUserId);
  }

  // Dev mode: identity carried in a cookie set by the dev login page.
  const userId = cookies().get(AUTH_COOKIE)?.value;
  if (!userId) return null;
  return loadUser(userId);
}

/** Like getCurrentUser but throws when unauthenticated — use in protected server actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) {
    throw new Error(`FORBIDDEN: missing permission ${permission}`);
  }
  return user;
}

export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  return !!user && user.permissions.has(permission);
}

export const DEV_COOKIE = AUTH_COOKIE;

/**
 * Entra ID session resolver — boundary for MSAL/OIDC integration.
 * In production this validates the bearer token server-side (PRD §7.2:
 * "Token validation: server-side on every API request") and maps the Entra
 * `oid` to a local User row, provisioning/refreshing roles from Entra groups.
 */
async function resolveEntraSession(): Promise<string | null> {
  // Intentionally unimplemented in the reference build. Wire MSAL here.
  return null;
}

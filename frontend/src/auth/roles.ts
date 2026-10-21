import type { UserRole } from "./AuthContext";

export function isAdminPortalRole(role: UserRole | undefined): boolean {
  return role === "ADMIN" || role === "PAYER" || role === "SESSION_VIEWER";
}

export function adminHomePath(role: UserRole | undefined): string {
  if (role === "PAYER") return "/admin/payouts";
  if (role === "SESSION_VIEWER") return "/admin/payments";
  return "/admin/users";
}

export function canOpenAdminPath(role: UserRole, path: string): boolean {
  if (role === "ADMIN") return true;
  if (role === "PAYER") return path === "/admin/payouts" || path.startsWith("/admin/payouts/");
  if (role === "SESSION_VIEWER") return path === "/admin/payments" || path.startsWith("/admin/payments/");
  return false;
}

export enum UserRole {
  ADMIN = "ADMIN",
  EMPLOYEE = "EMPLOYEE",
  EXTENSION_USER = "EXTENSION_USER",
  PAYER = "PAYER",
  SESSION_VIEWER = "SESSION_VIEWER",
}

export function isAdminPortalRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PAYER || role === UserRole.SESSION_VIEWER;
}

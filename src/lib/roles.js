export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  AGENT: "agent"
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ADMIN]: "Admin",
  [ROLES.MANAGER]: "Manager",
  [ROLES.AGENT]: "Agent"
};

export function canAccessDashboard(role) {
  return Object.values(ROLES).includes(role);
}

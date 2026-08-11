export const accountNamespaces = {
  MEMBER: "member-auth",
  SUPER_ADMIN: "super-admin-auth",
  ADMIN: "admin-auth",
} as const;

export type AccountType = keyof typeof accountNamespaces;

export const namespaceAccounts = Object.fromEntries(
  Object.entries(accountNamespaces).map(([account, namespace]) => [namespace, account]),
) as Record<(typeof accountNamespaces)[AccountType], AccountType>;

export const REFRESH_COOKIE = "mdp_refresh";
export const PORTAL_COOKIE = "mdp_portal";
export const PHOTO_ACCESS_COOKIE = "mdp_photo_access";

export function accountFromApiPath(path: string): AccountType | null {
  const namespace = path.split("/")[0] as keyof typeof namespaceAccounts;
  return namespaceAccounts[namespace] ?? null;
}


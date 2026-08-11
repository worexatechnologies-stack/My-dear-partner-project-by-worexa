import { describe, expect, it } from 'vitest';
import {
  accountFromApiPath,
  accountNamespaces,
  namespaceAccounts,
  PORTAL_COOKIE,
  REFRESH_COOKIE,
} from '@/lib/auth-config';

describe('auth configuration', () => {
  it('keeps account and Django namespace mappings reciprocal', () => {
    for (const [account, namespace] of Object.entries(accountNamespaces)) {
      expect(namespaceAccounts[namespace]).toBe(account);
      expect(accountFromApiPath(`${namespace}/login/`)).toBe(account);
    }
  });

  it('rejects non-auth API namespaces', () => {
    expect(accountFromApiPath('profiles/me/')).toBeNull();
    expect(accountFromApiPath('')).toBeNull();
  });

  it('uses dedicated refresh and portal cookie names', () => {
    expect(REFRESH_COOKIE).toBe('mdp_refresh');
    expect(PORTAL_COOKIE).toBe('mdp_portal');
    expect(REFRESH_COOKIE).not.toBe(PORTAL_COOKIE);
  });
});

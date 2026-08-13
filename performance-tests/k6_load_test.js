import http from 'k6/http';
import { check } from 'k6';

const targetVUs = Number(__ENV.TARGET_VUS || 10);
const baseUrl = (__ENV.BASE_URL || 'http://localhost/api/v1').replace(/\/$/, '');
const loginPassword = __ENV.LOGIN_PASSWORD || '';
const loginIdentifiers = (__ENV.LOGIN_IDENTIFIERS || __ENV.LOGIN_IDENTIFIER || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export const options = {
  // Each VU performs one login, which models a simultaneous login burst.
  // Supply a pool of real test accounts with LOGIN_IDENTIFIERS for production
  // rehearsal; one account is useful only for a limited smoke test.
  scenarios: {
    login_burst: {
      executor: 'per-vu-iterations',
      vus: targetVUs,
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION || '10m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  if (!loginIdentifiers.length || !loginPassword) {
    throw new Error('Set LOGIN_IDENTIFIERS (or LOGIN_IDENTIFIER) and LOGIN_PASSWORD.');
  }

  const identifier = loginIdentifiers[(__VU - 1) % loginIdentifiers.length];
  const response = http.post(
    `${baseUrl}/member-auth/login/`,
    JSON.stringify({ identifier, password: loginPassword }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'member-login' },
    },
  );

  check(response, {
    'login status 200': (result) => result.status === 200,
    'login response has access token': (result) => {
      try {
        const body = JSON.parse(result.body);
        return Boolean(body.data && body.data.access);
      } catch (_error) {
        return false;
      }
    },
  });
}

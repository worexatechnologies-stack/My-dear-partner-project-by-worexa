import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 }, // ramp up to 5 users
    { duration: '20s', target: 10 }, // stay at 10 users
    { duration: '10s', target: 0 },  // ramp down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // success rate > 99%
    http_req_duration: ['p(95)<500'], // 95th percentile response time < 500ms
  },
};

const BASE_URL = 'http://localhost:8000/api/v1';

export default function () {
  // 1. Health check
  let res = http.get(`${BASE_URL}/health/`);
  check(res, { 'health check OK': (r) => r.status === 200 });
  sleep(1);

  // 2. Fetch public FAQs
  res = http.get(`${BASE_URL}/faqs/`);
  check(res, { 'faqs status 200': (r) => r.status === 200 });
  sleep(1);

  // 3. Login
  const loginPayload = JSON.stringify({
    email: 'rahul@email.com',
    password: 'test-password',
  });
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  res = http.post(`${BASE_URL}/auth/login/`, loginPayload, params);
  const loginOk = check(res, {
    'login status 200': (r) => r.status === 200,
    'has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.access !== undefined;
      } catch (e) {
        return false;
      }
    }
  });

  if (loginOk) {
    const token = JSON.parse(res.body).data.access;
    const authParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    // 4. View matches profiles list
    res = http.get(`${BASE_URL}/profiles/`, authParams);
    check(res, { 'profiles list status 200': (r) => r.status === 200 });
    sleep(1);

    // 5. Calculate compatibility
    const compatPayload = JSON.stringify({
      p1_name: 'Arjun',
      p1_mbti: 'INTJ',
      p1_career: 'Tech',
      p1_values: 'Ambition',
      p2_name: 'Priya',
      p2_mbti: 'ENFP',
      p2_career: 'Design',
      p2_values: 'Travel',
    });
    res = http.post(`${BASE_URL}/matchmaking/compatibility/`, compatPayload, params);
    check(res, { 'compatibility status 200': (r) => r.status === 200 });
    sleep(1);
  }
}

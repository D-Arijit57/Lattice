// k6 load test for the Lattice delivery API.
//
//   SCENARIO = list | deep | detail | health | throttle
//   MODE     = steady (default; RATE req/s for DURATION after a warm-up)
//              ramp   (RAMP_STAGES e.g. "50:20s,100:20s,200:20s" to find the knee)
//
// Each iteration uses the next API key round-robin, so with thousands of keys
// no single key reaches the 60/min throttle. `throttle` is the opposite: one
// key, to prove that the 429 limit works.
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const BASE = __ENV.BASE_URL || 'http://localhost:8000';
const SCENARIO = __ENV.SCENARIO || 'list';
const MODE = __ENV.MODE || 'steady';
const RATE = parseInt(__ENV.RATE || '50');
const DURATION = __ENV.DURATION || '60s';
const WARMUP = '15s';
const WARMUP_RATE = SCENARIO === 'deep' ? 5 : 20; // deep = 3 requests per iteration

const keys = new SharedArray('keys', () => open('./keys.txt').split('\n').filter(Boolean));
const meta = JSON.parse(open('./meta.json'));

export const s2xx = new Counter('status_2xx');
export const s429 = new Counter('status_429');
export const s5xx = new Counter('status_5xx');
export const sOther = new Counter('status_other');

http.setResponseCallback(http.expectedStatuses(200));

function stages() {
  return (__ENV.RAMP_STAGES || '50:20s,100:20s,200:20s,400:20s')
    .split(',')
    .map((s) => { const [t, d] = s.split(':'); return { target: parseInt(t), duration: d }; });
}

const measure =
  MODE === 'ramp'
    ? { executor: 'ramping-arrival-rate', startRate: 10, timeUnit: '1s', stages: stages(), preAllocatedVUs: 200, maxVUs: 2000, startTime: WARMUP }
    : { executor: 'constant-arrival-rate', rate: RATE, timeUnit: '1s', duration: DURATION, preAllocatedVUs: 100, maxVUs: 2000, startTime: WARMUP };

export const options = {
  scenarios: {
    warmup: { executor: 'constant-arrival-rate', rate: WARMUP_RATE, timeUnit: '1s', duration: WARMUP, preAllocatedVUs: 20, maxVUs: 100 },
    measure,
  },
  thresholds: {
    // only the measured phase, and only successful (200) responses
    'http_req_duration{scenario:measure,expected_response:true}': ['p(95)<500'],
    'status_5xx{scenario:measure}': ['count==0'],
    // a 429 means key rotation failed and the run is contaminated
    'status_429{scenario:measure}': SCENARIO === 'throttle' ? ['count>=0'] : ['count==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function record(res) {
  if (res.status === 200) s2xx.add(1);
  else if (res.status === 429) s429.add(1);
  else if (res.status >= 500) s5xx.add(1);
  else sOther.add(1);
}

export default function () {
  const key = SCENARIO === 'throttle' ? keys[0] : keys[exec.scenario.iterationInTest % keys.length];
  // SECURE_SSL_REDIRECT is on outside DEBUG; the prod proxies send this header.
  const params = { headers: { Authorization: `Bearer ${key}`, 'X-Forwarded-Proto': 'https' } };
  const list = `${BASE}/api/delivery/content-types/${meta.slug}/entries/`;

  if (SCENARIO === 'health') {
    const r = http.get(`${BASE}/api/monitoring/health/`, { headers: { 'X-Forwarded-Proto': 'https' } });
    record(r);
    check(r, { 'health 200': (x) => x.status === 200 });
  } else if (SCENARIO === 'detail') {
    const id = meta.min_id + Math.floor(Math.random() * (meta.max_id - meta.min_id + 1));
    const r = http.get(`${list}${id}/`, params);
    record(r);
    check(r, { 'detail 200': (x) => x.status === 200 });
  } else if (SCENARIO === 'deep') {
    let url = list;
    for (let page = 0; page < 3 && url; page++) {
      const r = http.get(url, params);
      record(r);
      check(r, { 'page 200': (x) => x.status === 200 });
      // `next` is built from X-Forwarded-Proto (https); the test server speaks plain HTTP
      const next = r.status === 200 ? r.json('next') : null;
      url = next ? next.replace(/^https?:\/\/[^/]+/, BASE) : null;
    }
  } else {
    const r = http.get(list, params);
    record(r);
    check(r, { 'list 200': (x) => x.status === 200 && r.json('results').length === 50 });
  }
}

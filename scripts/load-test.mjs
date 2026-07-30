import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import autocannon from 'autocannon';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

function runAutocannon(options) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

function summarize(result) {
  const statusCodeStats = result.statusCodeStats ?? {};
  const twoXx = Object.entries(statusCodeStats)
    .filter(([code]) => code.startsWith('2'))
    .reduce((sum, [, value]) => sum + (value.count ?? 0), 0);

  return {
    title: result.title,
    url: result.url,
    durationSec: result.duration,
    connections: result.connections,
    pipelining: result.pipelining,
    requests: {
      average: result.requests.average,
      mean: result.requests.mean,
      stddev: result.requests.stddev,
      min: result.requests.min,
      max: result.requests.max,
      total: result.requests.total,
      sent: result.requests.sent,
    },
    latencyMs: {
      average: result.latency.average,
      mean: result.latency.mean,
      stddev: result.latency.stddev,
      min: result.latency.min,
      max: result.latency.max,
      p50: result.latency.p50,
      p90: result.latency.p90,
      p99: result.latency.p99,
    },
    throughputBytes: {
      average: result.throughput.average,
      total: result.throughput.total,
    },
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    twoXx,
    successRate:
      result.requests.total > 0
        ? Number(((twoXx / result.requests.total) * 100).toFixed(2))
        : 0,
    statusCodeStats,
  };
}

async function waitForHealthy(retries = 30) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const health = await fetch(`${BASE}/health`);
      if (health.ok) {
        const ready = await fetch(`${BASE}/ready`);
        if (ready.ok) return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('API not healthy');
}

async function seedUsers(count = 10) {
  const users = [];
  for (let i = 0; i < count; i += 1) {
    const stamp = `${Date.now()}_${i}`;
    const email = `load_${stamp}@example.com`;
    const username = `Load${stamp.replace(/[^a-zA-Z0-9]/g, '').slice(-16)}`;
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password: 'password12345',
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Register failed (${res.status}): ${body}`);
    }
    const json = await res.json();
    users.push({
      email,
      username,
      accessToken: json.tokens.accessToken,
      playerId: json.player.id,
    });
  }
  return users;
}

async function main() {
  mkdirSync('docs/load-test', { recursive: true });
  await waitForHealthy();

  console.log('Seeding users...');
  const users = await seedUsers(8);
  const token = users[0].accessToken;

  console.log('Scenario 1: health storm');
  const health = summarize(
    await runAutocannon({
      title: 'GET /health · 150 connections · 25s',
      url: `${BASE}/health`,
      connections: 150,
      duration: 25,
      pipelining: 10,
    }),
  );

  console.log('Scenario 2: authenticated profile storm');
  const me = summarize(
    await runAutocannon({
      title: 'GET /players/me · 100 connections · 20s',
      url: `${BASE}/players/me`,
      headers: { authorization: `Bearer ${token}` },
      connections: 100,
      duration: 20,
      pipelining: 5,
    }),
  );

  console.log('Scenario 3: lobby list storm');
  const rooms = summarize(
    await runAutocannon({
      title: 'GET /lobby/rooms · 80 connections · 20s',
      url: `${BASE}/lobby/rooms`,
      headers: { authorization: `Bearer ${token}` },
      connections: 80,
      duration: 20,
      pipelining: 5,
    }),
  );

  console.log('Scenario 4: login storm');
  const login = summarize(
    await runAutocannon({
      title: 'POST /auth/login · 40 connections · 15s',
      url: `${BASE}/auth/login`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: users[0].email, password: 'password12345' }),
      connections: 40,
      duration: 15,
      pipelining: 1,
    }),
  );

  const dockerPs = spawnSync('docker', ['compose', 'ps'], { encoding: 'utf8' });
  const healthAfter = await fetch(`${BASE}/health`).then((r) => r.json());
  const readyAfter = await fetch(`${BASE}/ready`).then((r) => r.json());

  const scenarios = [health, me, rooms, login];
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    tool: 'autocannon',
    stackHealthyAfterLoad: healthAfter.status === 'ok' && readyAfter.status === 'ready',
    healthAfter,
    readyAfter,
    dockerPs: dockerPs.stdout.trim(),
    scenarios,
    totals: {
      requests: scenarios.reduce((s, x) => s + x.requests.total, 0),
      twoXx: scenarios.reduce((s, x) => s + x.twoXx, 0),
      errors: scenarios.reduce((s, x) => s + x.errors, 0),
      timeouts: scenarios.reduce((s, x) => s + x.timeouts, 0),
      non2xx: scenarios.reduce((s, x) => s + x.non2xx, 0),
      peakReqPerSec: Math.max(...scenarios.map((x) => x.requests.max || x.requests.average || 0)),
      bestP99Ms: Math.min(...scenarios.map((x) => x.latencyMs.p99 || Number.MAX_SAFE_INTEGER)),
    },
    seededUsers: users.length,
  };

  report.totals.overallSuccessRate =
    report.totals.requests > 0
      ? Number(((report.totals.twoXx / report.totals.requests) * 100).toFixed(2))
      : 0;

  writeFileSync('docs/load-test/results.json', JSON.stringify(report, null, 2));
  console.log('Wrote docs/load-test/results.json');
  console.log(JSON.stringify(report.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

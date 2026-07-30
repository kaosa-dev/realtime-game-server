import { writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import WebSocket from 'ws';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const WS_BASE = process.env.WS_URL ?? BASE.replace(/^http/, 'ws');
const CLIENTS = Number(process.env.WS_CLIENTS ?? 200);
const ROOM_SIZE = Number(process.env.WS_ROOM_SIZE ?? 8);
const DURATION_SEC = Number(process.env.WS_DURATION_SEC ?? 30);
const INPUT_HZ = Number(process.env.WS_INPUT_HZ ?? 20);
const CONNECT_BATCH = Number(process.env.WS_CONNECT_BATCH ?? 25);
const CONNECT_BATCH_DELAY_MS = Number(process.env.WS_CONNECT_BATCH_DELAY_MS ?? 200);

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function avg(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const hasBody = body !== undefined;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  }
  return json;
}

async function registerPlayer(index) {
  const stamp = `${Date.now()}_${index}`;
  const email = `wsload_${stamp}@example.com`;
  const username = `ws${stamp.replace(/[^a-zA-Z0-9]/g, '').slice(-18)}`;
  const result = await api('/auth/register', {
    method: 'POST',
    body: { email, username, password: 'password12345' },
  });
  return {
    index,
    email,
    username,
    playerId: result.player.id,
    accessToken: result.tokens.accessToken,
  };
}

async function bootstrapRooms(players) {
  const rooms = [];
  for (let i = 0; i < players.length; i += ROOM_SIZE) {
    const group = players.slice(i, i + ROOM_SIZE);
    if (group.length === 0) continue;
    const host = group[0];
    const created = await api('/lobby/rooms', {
      method: 'POST',
      token: host.accessToken,
      body: { name: `LoadRoom_${i / ROOM_SIZE}`, maxPlayers: ROOM_SIZE },
    });
    const room = created.room;
    for (const member of group.slice(1)) {
      await api('/lobby/rooms/join', {
        method: 'POST',
        token: member.accessToken,
        body: { code: room.code },
      });
    }
    for (const member of group) {
      await api('/lobby/rooms/ready', {
        method: 'POST',
        token: member.accessToken,
        body: { ready: true },
      });
    }
    const started = await api('/lobby/rooms/start', {
      method: 'POST',
      token: host.accessToken,
    });
    rooms.push({
      roomId: started.room.id,
      code: started.room.code,
      members: group,
    });
  }
  return rooms;
}

function connectClient(player, roomId) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const ws = new WebSocket(`${WS_BASE}/ws`, {
      headers: { authorization: `Bearer ${player.accessToken}` },
    });

    const state = {
      player,
      roomId,
      ws,
      connected: false,
      joined: false,
      reconnectToken: null,
      seq: 0,
      inputsSent: 0,
      inputAcks: 0,
      snapshots: 0,
      deltas: 0,
      pongs: 0,
      errors: 0,
      pendingInputs: new Map(),
      ackLatenciesMs: [],
      pongLatenciesMs: [],
      ticksSeen: [],
      connectMs: 0,
      reconnectOk: false,
    };

    const timeout = setTimeout(() => {
      reject(new Error(`WS connect timeout for ${player.username}`));
      ws.close();
    }, 10_000);

    ws.on('open', () => {
      state.connected = true;
      state.connectMs = performance.now() - startedAt;
      ws.send(JSON.stringify({ type: 'join_session', roomId }));
    });

    ws.on('close', (code, reason) => {
      if (state.joined) return;
      clearTimeout(timeout);
      reject(
        new Error(
          `WS closed before join for ${player.username}: ${code} ${reason.toString()}`,
        ),
      );
    });

    ws.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        state.errors += 1;
        return;
      }

      if (message.type === 'joined' && message.roomId === roomId) {
        state.joined = true;
        state.reconnectToken = message.reconnectToken;
        clearTimeout(timeout);
        resolve(state);
        return;
      }
      if (message.type === 'error' && !state.joined) {
        state.errors += 1;
        clearTimeout(timeout);
        reject(
          new Error(
            `WS join error for ${player.username}: ${message.code} ${message.message}`,
          ),
        );
        return;
      }
      if (message.type === 'input_ack') {
        state.inputAcks += 1;
        const sentAt = state.pendingInputs.get(message.seq);
        if (sentAt !== undefined) {
          state.ackLatenciesMs.push(performance.now() - sentAt);
          state.pendingInputs.delete(message.seq);
        }
        return;
      }
      if (message.type === 'snapshot') {
        state.snapshots += 1;
        if (typeof message.tick === 'number') state.ticksSeen.push(message.tick);
        return;
      }
      if (message.type === 'delta') {
        state.deltas += 1;
        if (typeof message.tick === 'number') state.ticksSeen.push(message.tick);
        return;
      }
      if (message.type === 'pong') {
        state.pongs += 1;
        state.pongLatenciesMs.push(Math.max(0, Date.now() - message.clientTime));
        return;
      }
      if (message.type === 'error') {
        state.errors += 1;
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function startInputLoop(states, durationSec, inputHz) {
  const intervalMs = 1000 / inputHz;
  const endsAt = Date.now() + durationSec * 1000;

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (Date.now() >= endsAt) {
        clearInterval(timer);
        resolve();
        return;
      }

      for (const state of states) {
        if (!state.joined || state.ws.readyState !== WebSocket.OPEN) continue;
        state.seq += 1;
        const payload = {
          type: 'input',
          seq: state.seq,
          dt: intervalMs / 1000,
          move: {
            x: Math.sin(state.seq / 10) * 0.5,
            y: 0,
            z: Math.cos(state.seq / 10) * 0.5,
          },
          look: { x: 0, y: state.seq / 50, z: 0 },
        };
        state.pendingInputs.set(state.seq, performance.now());
        state.ws.send(JSON.stringify(payload));
        state.inputsSent += 1;

        if (state.seq % inputHz === 0) {
          state.ws.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
          state.ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }
    }, intervalMs);
  });
}

async function reconnectClient(state) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_BASE}/ws`, {
      headers: { authorization: `Bearer ${state.player.accessToken}` },
    });
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 8_000);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'join_session',
          roomId: state.roomId,
          reconnectToken: state.reconnectToken,
        }),
      );
    });

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'joined' && message.roomId === state.roomId) {
          clearTimeout(timeout);
          state.reconnectToken = message.reconnectToken;
          state.ws = ws;
          state.joined = true;
          state.reconnectOk = true;
          resolve(true);
        }
      } catch {
        // ignore
      }
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function main() {
  mkdirSync('docs/load-test', { recursive: true });
  console.log(`WS load test: ${CLIENTS} clients, roomSize=${ROOM_SIZE}, ${DURATION_SEC}s @ ${INPUT_HZ} Hz`);

  const healthBefore = await api('/health');
  const players = [];
  for (let i = 0; i < CLIENTS; i += 1) {
    let attempts = 0;
    for (;;) {
      try {
        players.push(await registerPlayer(i));
        break;
      } catch (error) {
        attempts += 1;
        if (!String(error).includes('429') || attempts > 8) throw error;
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }
    if ((i + 1) % 25 === 0) {
      console.log(`Registered ${i + 1}/${CLIENTS}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log('Bootstrapping rooms...');
  const rooms = await bootstrapRooms(players);
  console.log(`Created ${rooms.length} rooms`);

  console.log('Connecting WebSocket clients...');
  const states = [];
  const flat = rooms.flatMap((room) =>
    room.members.map((member) => ({ member, roomId: room.roomId })),
  );

  for (let i = 0; i < flat.length; i += CONNECT_BATCH) {
    const batch = flat.slice(i, i + CONNECT_BATCH);
    const settled = await Promise.allSettled(
      batch.map(({ member, roomId }) => connectClient(member, roomId)),
    );
    for (let j = 0; j < settled.length; j += 1) {
      const result = settled[j];
      if (result.status === 'fulfilled') {
        states.push(result.value);
        continue;
      }
      const { member, roomId } = batch[j];
      console.warn(`Retrying ${member.username}: ${result.reason}`);
      await new Promise((r) => setTimeout(r, 250));
      states.push(await connectClient(member, roomId));
    }
    console.log(`Connected ${states.length}/${flat.length}`);
    await new Promise((r) => setTimeout(r, CONNECT_BATCH_DELAY_MS));
  }

  const joinedCount = states.filter((s) => s.joined).length;
  console.log(`Joined sessions: ${joinedCount}/${states.length}`);
  console.log(`Running gameplay for ${DURATION_SEC}s...`);
  await startInputLoop(states, DURATION_SEC, INPUT_HZ);

  console.log('Testing reconnect on sample clients...');
  const sample = states.filter((s) => s.reconnectToken).slice(0, Math.min(40, states.length));
  for (const state of sample) {
    try {
      state.ws.close();
    } catch {
      // ignore
    }
  }
  await new Promise((r) => setTimeout(r, 500));
  const reconnectResults = await Promise.all(sample.map((state) => reconnectClient(state)));
  const reconnectSuccess = reconnectResults.filter(Boolean).length;

  const ackLatencies = states.flatMap((s) => s.ackLatenciesMs);
  const pongLatencies = states.flatMap((s) => s.pongLatenciesMs);
  const allTicks = states.flatMap((s) => s.ticksSeen).sort((a, b) => a - b);
  let observedTickRate = 0;
  if (allTicks.length > 1) {
    const tickSpan = allTicks[allTicks.length - 1] - allTicks[0];
    observedTickRate = tickSpan > 0 ? tickSpan / DURATION_SEC : 0;
  }

  const totals = {
    clientsRequested: CLIENTS,
    clientsConnected: states.filter((s) => s.connected).length,
    clientsJoined: joinedCount,
    rooms: rooms.length,
    roomSize: ROOM_SIZE,
    durationSec: DURATION_SEC,
    inputHz: INPUT_HZ,
    inputsSent: states.reduce((sum, s) => sum + s.inputsSent, 0),
    inputAcks: states.reduce((sum, s) => sum + s.inputAcks, 0),
    snapshots: states.reduce((sum, s) => sum + s.snapshots, 0),
    deltas: states.reduce((sum, s) => sum + s.deltas, 0),
    errors: states.reduce((sum, s) => sum + s.errors, 0),
    messagesPerSec:
      states.reduce((sum, s) => sum + s.inputsSent + s.inputAcks + s.snapshots + s.deltas, 0) /
      DURATION_SEC,
    inputAckLatencyMs: {
      p50: Number(percentile(ackLatencies, 50).toFixed(2)),
      p95: Number(percentile(ackLatencies, 95).toFixed(2)),
      p99: Number(percentile(ackLatencies, 99).toFixed(2)),
      avg: Number(avg(ackLatencies).toFixed(2)),
    },
    pongLatencyMs: {
      p50: Number(percentile(pongLatencies, 50).toFixed(2)),
      p95: Number(percentile(pongLatencies, 95).toFixed(2)),
      avg: Number(avg(pongLatencies).toFixed(2)),
    },
    observedTickRate: Number(observedTickRate.toFixed(2)),
    reconnect: {
      attempted: sample.length,
      succeeded: reconnectSuccess,
      successRate:
        sample.length > 0
          ? Number(((reconnectSuccess / sample.length) * 100).toFixed(2))
          : 0,
    },
    avgConnectMs: Number(avg(states.map((s) => s.connectMs)).toFixed(2)),
  };

  for (const state of states) {
    try {
      state.ws.close();
    } catch {
      // ignore
    }
  }

  const healthAfter = await api('/health');
  const readyAfter = await api('/ready');
  const dockerPs = spawnSync('docker', ['compose', 'ps'], { encoding: 'utf8' });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    wsUrl: WS_BASE,
    tool: 'custom-ws-load-test',
    healthBefore,
    healthAfter,
    readyAfter,
    stackHealthyAfterLoad: healthAfter.status === 'ok' && readyAfter.status === 'ready',
    dockerPs: dockerPs.stdout.trim(),
    totals,
  };

  writeFileSync('docs/load-test/ws-results.json', JSON.stringify(report, null, 2));
  console.log('Wrote docs/load-test/ws-results.json');
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

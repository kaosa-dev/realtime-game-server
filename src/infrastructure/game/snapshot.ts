import type { RuntimePlayerState } from '../../domain/entities/player.js';
import type { PlayerSnapshot } from '../websocket/protocol.js';

export function toPlayerSnapshot(state: RuntimePlayerState): PlayerSnapshot {
  return {
    id: state.id,
    username: state.username,
    position: { ...state.position },
    rotation: { ...state.rotation },
    velocity: { ...state.velocity },
    hp: state.hp,
    connected: state.connected,
    ping: state.ping,
    lastProcessedInputSeq: state.lastProcessedInputSeq,
  };
}

export function computeDelta(
  previous: Map<string, PlayerSnapshot>,
  current: PlayerSnapshot[],
): { changes: Array<Partial<PlayerSnapshot> & { id: string }>; removed: string[] } {
  const currentMap = new Map(current.map((player) => [player.id, player]));
  const changes: Array<Partial<PlayerSnapshot> & { id: string }> = [];
  const removed: string[] = [];

  for (const id of previous.keys()) {
    if (!currentMap.has(id)) {
      removed.push(id);
    }
  }

  for (const player of current) {
    const prev = previous.get(player.id);
    if (!prev) {
      changes.push(player);
      continue;
    }

    const patch: Partial<PlayerSnapshot> & { id: string } = { id: player.id };
    let dirty = false;

    if (
      prev.position.x !== player.position.x ||
      prev.position.y !== player.position.y ||
      prev.position.z !== player.position.z
    ) {
      patch.position = player.position;
      dirty = true;
    }
    if (
      prev.rotation.x !== player.rotation.x ||
      prev.rotation.y !== player.rotation.y ||
      prev.rotation.z !== player.rotation.z
    ) {
      patch.rotation = player.rotation;
      dirty = true;
    }
    if (
      prev.velocity.x !== player.velocity.x ||
      prev.velocity.y !== player.velocity.y ||
      prev.velocity.z !== player.velocity.z
    ) {
      patch.velocity = player.velocity;
      dirty = true;
    }
    if (prev.hp !== player.hp) {
      patch.hp = player.hp;
      dirty = true;
    }
    if (prev.connected !== player.connected) {
      patch.connected = player.connected;
      dirty = true;
    }
    if (prev.ping !== player.ping) {
      patch.ping = player.ping;
      dirty = true;
    }
    if (prev.lastProcessedInputSeq !== player.lastProcessedInputSeq) {
      patch.lastProcessedInputSeq = player.lastProcessedInputSeq;
      dirty = true;
    }

    if (dirty) {
      changes.push(patch);
    }
  }

  return { changes, removed };
}

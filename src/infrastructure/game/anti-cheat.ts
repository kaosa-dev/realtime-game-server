import type { RuntimePlayerState } from '../../domain/entities/player.js';
import { clampVec3, createVec3, magnitude } from '../../domain/value-objects/vec3.js';
import { DEFAULT_PLAYER_HP, WORLD_BOUNDS } from '../../shared/constants/game.js';
import { env } from '../../shared/config/env.js';

export interface MovementInput {
  seq: number;
  dt: number;
  move: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
}

export interface ValidationResult {
  accepted: boolean;
  reason?: string;
  state: RuntimePlayerState;
}

export function createRuntimePlayer(
  id: string,
  username: string,
  spawnIndex = 0,
): RuntimePlayerState {
  const angle = (spawnIndex * Math.PI * 2) / 8;
  return {
    id,
    username,
    position: createVec3(Math.cos(angle) * 5, 0, Math.sin(angle) * 5),
    rotation: createVec3(0, angle, 0),
    velocity: createVec3(),
    hp: DEFAULT_PLAYER_HP,
    connected: true,
    ping: 0,
    lastProcessedInputSeq: 0,
    lastHeartbeatAt: Date.now(),
  };
}

export function validateAndApplyMovement(
  state: RuntimePlayerState,
  input: MovementInput,
  maxSpeed = env.MAX_MOVE_SPEED,
): ValidationResult {
  if (input.seq <= state.lastProcessedInputSeq) {
    return { accepted: false, reason: 'stale_input', state };
  }

  if (input.dt <= 0 || input.dt > 0.25) {
    return { accepted: false, reason: 'invalid_dt', state };
  }

  const moveMag = magnitude(input.move);
  if (moveMag > 1.05) {
    return { accepted: false, reason: 'invalid_move_vector', state };
  }

  const speed = Math.min(1, moveMag) * maxSpeed;
  const nextVelocity = {
    x: input.move.x * speed,
    y: input.move.y * speed,
    z: input.move.z * speed,
  };

  if (magnitude(nextVelocity) > maxSpeed + 0.01) {
    return { accepted: false, reason: 'speed_cheat', state };
  }

  const proposedPosition = {
    x: state.position.x + nextVelocity.x * input.dt,
    y: state.position.y + nextVelocity.y * input.dt,
    z: state.position.z + nextVelocity.z * input.dt,
  };

  const clamped = clampVec3(proposedPosition, WORLD_BOUNDS);
  const teleportDistance = magnitude({
    x: proposedPosition.x - state.position.x,
    y: proposedPosition.y - state.position.y,
    z: proposedPosition.z - state.position.z,
  });

  const maxDistance = maxSpeed * input.dt * 1.15;
  if (teleportDistance > maxDistance) {
    return { accepted: false, reason: 'position_cheat', state };
  }

  const next: RuntimePlayerState = {
    ...state,
    position: clamped,
    velocity: nextVelocity,
    rotation: {
      x: input.look.x,
      y: input.look.y,
      z: input.look.z,
    },
    lastProcessedInputSeq: input.seq,
  };

  return { accepted: true, state: next };
}

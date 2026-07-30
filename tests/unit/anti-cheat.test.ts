import { describe, expect, it } from 'vitest';
import {
  createRuntimePlayer,
  validateAndApplyMovement,
} from '../../src/infrastructure/game/anti-cheat';

describe('validateAndApplyMovement', () => {
  it('applies valid movement within speed limits', () => {
    const state = createRuntimePlayer('p1', 'hero');
    const result = validateAndApplyMovement(state, {
      seq: 1,
      dt: 0.05,
      move: { x: 1, y: 0, z: 0 },
      look: { x: 0, y: 1.5, z: 0 },
    });

    expect(result.accepted).toBe(true);
    expect(result.state.position.x).toBeGreaterThan(state.position.x);
    expect(result.state.lastProcessedInputSeq).toBe(1);
  });

  it('rejects oversized move vectors', () => {
    const state = createRuntimePlayer('p1', 'hero');
    const result = validateAndApplyMovement(state, {
      seq: 1,
      dt: 0.05,
      move: { x: 2, y: 0, z: 0 },
      look: { x: 0, y: 0, z: 0 },
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('invalid_move_vector');
  });

  it('rejects stale input sequences', () => {
    const state = createRuntimePlayer('p1', 'hero');
    state.lastProcessedInputSeq = 5;

    const result = validateAndApplyMovement(state, {
      seq: 5,
      dt: 0.05,
      move: { x: 0, y: 0, z: 0 },
      look: { x: 0, y: 0, z: 0 },
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('stale_input');
  });

  it('rejects invalid delta time', () => {
    const state = createRuntimePlayer('p1', 'hero');
    const result = validateAndApplyMovement(state, {
      seq: 1,
      dt: 1,
      move: { x: 0, y: 0, z: 0 },
      look: { x: 0, y: 0, z: 0 },
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('invalid_dt');
  });
});

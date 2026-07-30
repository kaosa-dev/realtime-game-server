import { describe, expect, it } from 'vitest';
import { computeDelta, toPlayerSnapshot } from '../../src/infrastructure/game/snapshot';
import { createRuntimePlayer } from '../../src/infrastructure/game/anti-cheat';

describe('snapshot delta', () => {
  it('emits full player on first appearance', () => {
    const player = toPlayerSnapshot(createRuntimePlayer('p1', 'nova'));
    const { changes, removed } = computeDelta(new Map(), [player]);

    expect(removed).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.id).toBe('p1');
    expect(changes[0]?.username).toBe('nova');
  });

  it('emits only changed fields', () => {
    const base = toPlayerSnapshot(createRuntimePlayer('p1', 'nova'));
    const previous = new Map([['p1', base]]);
    const next = {
      ...base,
      position: { ...base.position, x: base.position.x + 1 },
      ping: 42,
    };

    const { changes, removed } = computeDelta(previous, [next]);
    expect(removed).toEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      id: 'p1',
      position: next.position,
      ping: 42,
    });
  });

  it('tracks removals', () => {
    const base = toPlayerSnapshot(createRuntimePlayer('p1', 'nova'));
    const previous = new Map([['p1', base]]);
    const { changes, removed } = computeDelta(previous, []);

    expect(changes).toEqual([]);
    expect(removed).toEqual(['p1']);
  });
});

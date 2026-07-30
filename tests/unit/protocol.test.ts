import { describe, expect, it } from 'vitest';
import { ClientMessageSchema } from '../../src/infrastructure/websocket/protocol';
import { generateRoomCode } from '../../src/shared/utils/room-code';
import { levelFromExperience } from '../../src/shared/constants/game';

describe('protocol validation', () => {
  it('accepts valid input messages', () => {
    const parsed = ClientMessageSchema.parse({
      type: 'input',
      seq: 10,
      dt: 0.05,
      move: { x: 0.5, y: 0, z: -0.2 },
      look: { x: 0, y: 1, z: 0 },
    });
    expect(parsed.type).toBe('input');
  });

  it('rejects invalid input magnitudes via schema bounds', () => {
    expect(() =>
      ClientMessageSchema.parse({
        type: 'input',
        seq: 1,
        dt: 0.05,
        move: { x: 2, y: 0, z: 0 },
        look: { x: 0, y: 0, z: 0 },
      }),
    ).toThrow();
  });
});

describe('helpers', () => {
  it('generates room codes of expected length', () => {
    expect(generateRoomCode(6)).toHaveLength(6);
  });

  it('computes levels from experience', () => {
    expect(levelFromExperience(0)).toBe(1);
    expect(levelFromExperience(999)).toBe(1);
    expect(levelFromExperience(1000)).toBe(2);
  });
});

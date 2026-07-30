import { describe, expect, it } from 'vitest';
import { clampVec3, createVec3, distance3, magnitude } from '../../src/domain/value-objects/vec3';
import { WORLD_BOUNDS } from '../../src/shared/constants/game';

describe('vec3', () => {
  it('computes magnitude and distance', () => {
    expect(magnitude(createVec3(3, 4, 0))).toBe(5);
    expect(distance3(createVec3(0, 0, 0), createVec3(3, 4, 0))).toBe(5);
  });

  it('clamps to world bounds', () => {
    const clamped = clampVec3(createVec3(1000, -10, -1000), WORLD_BOUNDS);
    expect(clamped.x).toBe(WORLD_BOUNDS.maxX);
    expect(clamped.y).toBe(WORLD_BOUNDS.minY);
    expect(clamped.z).toBe(WORLD_BOUNDS.minZ);
  });
});

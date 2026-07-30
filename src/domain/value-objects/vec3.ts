export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function createVec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function distance3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function clampVec3(
  v: Vec3,
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
): Vec3 {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, v.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, v.y)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, v.z)),
  };
}

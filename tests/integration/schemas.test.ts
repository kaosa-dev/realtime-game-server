import { describe, expect, it } from 'vitest';
import { registerSchema, addInventorySchema } from '../../src/api/schemas/index';

describe('API schemas', () => {
  it('validates registration payloads', () => {
    const parsed = registerSchema.parse({
      email: 'player@example.com',
      username: 'Nova_1',
      password: 'supersecure',
    });
    expect(parsed.username).toBe('Nova_1');
  });

  it('rejects short passwords', () => {
    expect(() =>
      registerSchema.parse({
        email: 'player@example.com',
        username: 'Nova',
        password: 'short',
      }),
    ).toThrow();
  });

  it('validates inventory add payloads', () => {
    const parsed = addInventorySchema.parse({
      itemKey: 'sword_iron',
      name: 'Iron Sword',
      quantity: 1,
    });
    expect(parsed.itemKey).toBe('sword_iron');
  });
});

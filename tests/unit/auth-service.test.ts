import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/application/services/auth-service';
import { ConflictError, UnauthorizedError } from '../../src/domain/errors/app-error';
import type { PlayerRepository } from '../../src/domain/repositories/player-repository';
import type { RefreshTokenRepository } from '../../src/domain/repositories/refresh-token-repository';
import type { UserRepository } from '../../src/domain/repositories/user-repository';
import { hashPassword } from '../../src/infrastructure/auth/token-service';

function createMocks() {
  const users: UserRepository = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    findById: vi.fn(),
  };
  const players: PlayerRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByUsername: vi.fn(),
    updateCoins: vi.fn(),
    addExperience: vi.fn(),
    updateEquipment: vi.fn(),
  };
  const refreshTokens: RefreshTokenRepository = {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  return { users, players, refreshTokens };
}

describe('AuthService', () => {
  it('registers a new user and issues tokens', async () => {
    const { users, players, refreshTokens } = createMocks();
    vi.mocked(users.findByEmail).mockResolvedValue(null);
    vi.mocked(users.findByUsername).mockResolvedValue(null);
    vi.mocked(users.create).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      username: 'ace',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(players.create).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      username: 'ace',
      experience: 0,
      coins: 100,
      level: 1,
      equipment: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(refreshTokens.create).mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'th',
      expiresAt: new Date(Date.now() + 10000),
      revokedAt: null,
      createdAt: new Date(),
    });

    const service = new AuthService(users, players, refreshTokens);
    const result = await service.register({
      email: 'a@example.com',
      username: 'ace',
      password: 'password123',
    });

    expect(result.user.username).toBe('ace');
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it('rejects duplicate email registration', async () => {
    const { users, players, refreshTokens } = createMocks();
    vi.mocked(users.findByEmail).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      username: 'ace',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AuthService(users, players, refreshTokens);
    await expect(
      service.register({
        email: 'a@example.com',
        username: 'ace',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects invalid login credentials', async () => {
    const { users, players, refreshTokens } = createMocks();
    const passwordHash = await hashPassword('password123');
    vi.mocked(users.findByEmail).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      username: 'ace',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AuthService(users, players, refreshTokens);
    await expect(
      service.login({ email: 'a@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

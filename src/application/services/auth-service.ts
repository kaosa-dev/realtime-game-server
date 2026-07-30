import { ConflictError, ForbiddenError, UnauthorizedError } from '../../domain/errors/app-error.js';
import type { PlayerRepository } from '../../domain/repositories/player-repository.js';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token-repository.js';
import type { UserRepository } from '../../domain/repositories/user-repository.js';
import {
  createRefreshTokenPair,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPasswordWithTimingPad,
  verifyRefreshToken,
} from '../../infrastructure/auth/token-service.js';
import { DEFAULT_STARTING_COINS } from '../../shared/constants/game.js';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
  };
  player: {
    id: string;
    username: string;
    coins: number;
    experience: number;
    level: number;
  };
  tokens: AuthTokens;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();
    const username = normalizeUsername(input.username);

    const existingEmail = await this.users.findByEmail(email);
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    const existingUsername = await this.users.findByUsername(username);
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email,
      username,
      passwordHash,
    });

    const player = await this.players.create({
      userId: user.id,
      username: user.username,
      coins: DEFAULT_STARTING_COINS,
    });

    const tokens = await this.issueTokens(user.id, player.id, player.username);

    return {
      user: { id: user.id, email: user.email, username: user.username },
      player: {
        id: player.id,
        username: player.username,
        coins: player.coins,
        experience: player.experience,
        level: player.level,
      },
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email.toLowerCase().trim());
    const valid = await verifyPasswordWithTimingPad(input.password, user?.passwordHash ?? null);
    if (!user || !valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const player = await this.players.findByUserId(user.id);
    if (!player) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, player.id, player.username);

    return {
      user: { id: user.id, email: user.email, username: user.username },
      player: {
        id: player.id,
        username: player.username,
        coins: player.coins,
        experience: player.experience,
        level: player.level,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const stored = await this.refreshTokens.findByTokenHash(hashToken(refreshToken));
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token revoked or expired');
    }

    if (stored.userId !== payload.userId) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const revoked = await this.refreshTokens.revokeIfActive(stored.id);
    if (!revoked) {
      // Reuse of an already-rotated refresh token → revoke the whole session family.
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Refresh token reuse detected');
    }

    const player = await this.players.findByUserId(payload.userId);
    if (!player) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return this.issueTokens(payload.userId, player.id, player.username);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByTokenHash(hashToken(refreshToken));
    if (!stored) {
      return;
    }
    if (stored.userId !== userId) {
      throw new ForbiddenError('Refresh token does not belong to this user');
    }
    if (!stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  private async issueTokens(
    userId: string,
    playerId: string,
    username: string,
  ): Promise<AuthTokens> {
    const accessToken = signAccessToken({
      sub: userId,
      userId,
      playerId,
      username,
    });

    const refresh = createRefreshTokenPair(userId);
    await this.refreshTokens.create({
      userId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
    };
  }
}

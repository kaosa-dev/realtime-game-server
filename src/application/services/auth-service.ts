import { ConflictError, UnauthorizedError } from '../../domain/errors/app-error.js';
import type { PlayerRepository } from '../../domain/repositories/player-repository.js';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token-repository.js';
import type { UserRepository } from '../../domain/repositories/user-repository.js';
import {
  createRefreshTokenPair,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
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

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existingEmail = await this.users.findByEmail(input.email.toLowerCase());
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    const existingUsername = await this.users.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email: input.email.toLowerCase(),
      username: input.username,
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
    const user = await this.users.findByEmail(input.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const player = await this.players.findByUserId(user.id);
    if (!player) {
      throw new UnauthorizedError('Player profile missing');
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
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token revoked or expired');
    }

    await this.refreshTokens.revoke(stored.id);

    const player = await this.players.findByUserId(payload.userId);
    if (!player) {
      throw new UnauthorizedError('Player profile missing');
    }

    return this.issueTokens(payload.userId, player.id, player.username);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByTokenHash(hashToken(refreshToken));
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
    }
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

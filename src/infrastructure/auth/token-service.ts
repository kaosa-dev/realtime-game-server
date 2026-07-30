import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env.js';

const JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

export interface AccessTokenPayload {
  sub: string;
  userId: string;
  playerId: string;
  username: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  userId: string;
  type: 'refresh';
  jti: string;
}

let cachedDummyHash: string | null = null;

async function getDummyPasswordHash(): Promise<string> {
  if (!cachedDummyHash) {
    cachedDummyHash = await bcrypt.hash('dummy-password-for-timing', env.BCRYPT_ROUNDS);
  }
  return cachedDummyHash;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function verifyPasswordWithTimingPad(
  password: string,
  hash: string | null,
): Promise<boolean> {
  if (!hash) {
    await verifyPassword(password, await getDummyPasswordHash());
    return false;
  }
  return verifyPassword(password, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: JWT_ALGORITHMS,
  }) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid access token type');
  }
  return payload;
}

export function createRefreshTokenPair(userId: string): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  jti: string;
} {
  const jti = randomBytes(16).toString('hex');
  const token = jwt.sign({ sub: userId, userId, type: 'refresh', jti }, env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
  const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt,
    jti,
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: JWT_ALGORITHMS,
  }) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  return payload;
}

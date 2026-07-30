import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../domain/errors/app-error.js';
import { verifyAccessToken, type AccessTokenPayload } from '../../infrastructure/auth/token-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AccessTokenPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }

  try {
    request.auth = verifyAccessToken(header.slice(7));
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function requireAuth(request: FastifyRequest): AccessTokenPayload {
  if (!request.auth) {
    throw new UnauthorizedError('Unauthorized');
  }
  return request.auth;
}

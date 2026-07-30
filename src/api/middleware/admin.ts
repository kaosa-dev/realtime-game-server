import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors/app-error.js';
import { env } from '../../shared/config/env.js';

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function assertAdminKey(provided: string | string[] | undefined): void {
  if (!env.ADMIN_API_KEY) {
    throw new ForbiddenError(
      'Admin mutations are disabled. Set ADMIN_API_KEY to enable privileged endpoints.',
    );
  }

  if (typeof provided !== 'string' || provided.length === 0) {
    throw new UnauthorizedError('Missing x-admin-key header');
  }

  if (!safeEqualString(provided, env.ADMIN_API_KEY)) {
    throw new ForbiddenError('Invalid admin key');
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  assertAdminKey(request.headers['x-admin-key']);
}

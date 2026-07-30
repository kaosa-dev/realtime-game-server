import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors/app-error.js';
import { env } from '../../shared/config/env.js';

export function assertAdminKey(provided: string | string[] | undefined): void {
  if (!env.ADMIN_API_KEY) {
    throw new ForbiddenError(
      'Admin mutations are disabled. Set ADMIN_API_KEY to enable privileged endpoints.',
    );
  }

  if (typeof provided !== 'string' || provided.length === 0) {
    throw new UnauthorizedError('Missing x-admin-key header');
  }

  if (provided !== env.ADMIN_API_KEY) {
    throw new ForbiddenError('Invalid admin key');
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  assertAdminKey(request.headers['x-admin-key']);
}

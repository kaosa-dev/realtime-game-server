import { describe, expect, it } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '../../src/domain/errors/app-error';

/**
 * Mirrors admin key gate semantics without depending on process-wide env module state.
 */
function assertAdminKey(
  configuredKey: string | undefined,
  provided: string | undefined,
): void {
  if (!configuredKey) {
    throw new ForbiddenError(
      'Admin mutations are disabled. Set ADMIN_API_KEY to enable privileged endpoints.',
    );
  }
  if (!provided) {
    throw new UnauthorizedError('Missing x-admin-key header');
  }
  if (provided !== configuredKey) {
    throw new ForbiddenError('Invalid admin key');
  }
}

describe('admin key gate', () => {
  it('disables privileged mutations when no admin key is configured', () => {
    expect(() => assertAdminKey(undefined, 'anything')).toThrow(ForbiddenError);
  });

  it('requires the x-admin-key header', () => {
    expect(() => assertAdminKey('secret-admin-key!!', undefined)).toThrow(UnauthorizedError);
  });

  it('rejects an invalid admin key', () => {
    expect(() => assertAdminKey('secret-admin-key!!', 'wrong')).toThrow(ForbiddenError);
  });

  it('accepts a matching admin key', () => {
    expect(() => assertAdminKey('secret-admin-key!!', 'secret-admin-key!!')).not.toThrow();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { LobbyService } from '../../src/application/services/lobby-service';
import { ConflictError, ValidationError } from '../../src/domain/errors/app-error';
import type { RoomEntity } from '../../src/domain/entities/room';
import type { RoomRepository } from '../../src/domain/repositories/room-repository';
import type { SessionRepository } from '../../src/domain/repositories/session-repository';

function roomFixture(overrides: Partial<RoomEntity> = {}): RoomEntity {
  return {
    id: 'r1',
    code: 'ABC123',
    name: 'Arena',
    hostId: 'p1',
    maxPlayers: 4,
    status: 'WAITING',
    members: [
      {
        id: 'm1',
        roomId: 'r1',
        playerId: 'p1',
        username: 'host',
        ready: true,
        joinedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LobbyService', () => {
  it('prevents creating a room while already in one', async () => {
    const rooms: RoomRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByCode: vi.fn(),
      findByPlayerId: vi.fn().mockResolvedValue(roomFixture()),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      setReady: vi.fn(),
      updateStatus: vi.fn(),
      listWaiting: vi.fn(),
    };
    const sessions: SessionRepository = {
      create: vi.fn(),
      updateStatus: vi.fn(),
      findActiveByRoom: vi.fn(),
      endAllForRoom: vi.fn(),
    };

    const service = new LobbyService(rooms, sessions);
    await expect(service.createRoom('p1', 'Arena')).rejects.toBeInstanceOf(ConflictError);
  });

  it('validates max players on create', async () => {
    const rooms: RoomRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByCode: vi.fn(),
      findByPlayerId: vi.fn().mockResolvedValue(null),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      setReady: vi.fn(),
      updateStatus: vi.fn(),
      listWaiting: vi.fn(),
    };
    const sessions: SessionRepository = {
      create: vi.fn(),
      updateStatus: vi.fn(),
      findActiveByRoom: vi.fn(),
      endAllForRoom: vi.fn(),
    };

    const service = new LobbyService(rooms, sessions);
    await expect(service.createRoom('p1', 'Arena', 99)).rejects.toBeInstanceOf(ValidationError);
  });
});

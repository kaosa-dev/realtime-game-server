import type { RoomEntity, RoomMemberEntity, RoomStatus } from '../../domain/entities/room.js';
import { ConflictError, NotFoundError } from '../../domain/errors/app-error.js';
import type {
  CreateRoomInput,
  RoomRepository,
} from '../../domain/repositories/room-repository.js';
import { prisma } from './prisma.js';

type RoomWithMembers = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    id: string;
    roomId: string;
    playerId: string;
    ready: boolean;
    joinedAt: Date;
    player: { username: string };
  }>;
};

function mapMember(row: RoomWithMembers['members'][number]): RoomMemberEntity {
  return {
    id: row.id,
    roomId: row.roomId,
    playerId: row.playerId,
    username: row.player.username,
    ready: row.ready,
    joinedAt: row.joinedAt,
  };
}

function mapRoom(row: RoomWithMembers): RoomEntity {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    hostId: row.hostId,
    maxPlayers: row.maxPlayers,
    status: row.status,
    members: row.members.map(mapMember),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const memberInclude = {
  members: {
    include: { player: { select: { username: true } } },
    orderBy: { joinedAt: 'asc' as const },
  },
};

export class PrismaRoomRepository implements RoomRepository {
  async create(input: CreateRoomInput): Promise<RoomEntity> {
    const room = await prisma.room.create({
      data: {
        code: input.code,
        name: input.name,
        hostId: input.hostId,
        maxPlayers: input.maxPlayers,
        members: {
          create: {
            playerId: input.hostId,
            ready: false,
          },
        },
      },
      include: memberInclude,
    });
    return mapRoom(room);
  }

  async findById(id: string): Promise<RoomEntity | null> {
    const room = await prisma.room.findUnique({
      where: { id },
      include: memberInclude,
    });
    return room ? mapRoom(room) : null;
  }

  async findByCode(code: string): Promise<RoomEntity | null> {
    const room = await prisma.room.findUnique({
      where: { code },
      include: memberInclude,
    });
    return room ? mapRoom(room) : null;
  }

  async findByPlayerId(playerId: string): Promise<RoomEntity | null> {
    const membership = await prisma.roomMember.findFirst({
      where: {
        playerId,
        room: { status: { in: ['WAITING', 'IN_PROGRESS'] } },
      },
      include: {
        room: { include: memberInclude },
      },
    });
    return membership ? mapRoom(membership.room) : null;
  }

  async addMember(roomId: string, playerId: string): Promise<RoomEntity> {
    return prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: memberInclude,
      });
      if (!room) {
        throw new NotFoundError('Room');
      }
      if (room.status !== 'WAITING') {
        throw new ConflictError('Room is not accepting players');
      }
      if (room.members.length >= room.maxPlayers) {
        throw new ConflictError('Room is full');
      }
      if (room.members.some((m) => m.playerId === playerId)) {
        throw new ConflictError('Already in room');
      }

      await tx.roomMember.create({
        data: { roomId, playerId },
      });

      const updated = await tx.room.findUniqueOrThrow({
        where: { id: roomId },
        include: memberInclude,
      });
      return mapRoom(updated);
    });
  }

  async removeMember(roomId: string, playerId: string): Promise<RoomEntity | null> {
    return prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: memberInclude,
      });
      if (!room) {
        throw new NotFoundError('Room');
      }

      await tx.roomMember.deleteMany({
        where: { roomId, playerId },
      });

      const remaining = await tx.roomMember.count({ where: { roomId } });
      if (remaining === 0) {
        await tx.room.update({
          where: { id: roomId },
          data: { status: 'CLOSED' },
        });
        return null;
      }

      let hostId = room.hostId;
      if (room.hostId === playerId) {
        const nextHost = await tx.roomMember.findFirst({
          where: { roomId },
          orderBy: { joinedAt: 'asc' },
        });
        if (nextHost) {
          hostId = nextHost.playerId;
          await tx.room.update({
            where: { id: roomId },
            data: { hostId },
          });
        }
      }

      const updated = await tx.room.findUniqueOrThrow({
        where: { id: roomId },
        include: memberInclude,
      });
      return mapRoom(updated);
    });
  }

  async setReady(roomId: string, playerId: string, ready: boolean): Promise<RoomEntity> {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_playerId: { roomId, playerId } },
    });
    if (!membership) {
      throw new NotFoundError('Room membership');
    }

    await prisma.roomMember.update({
      where: { id: membership.id },
      data: { ready },
    });

    const room = await prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      include: memberInclude,
    });
    return mapRoom(room);
  }

  async updateStatus(roomId: string, status: RoomStatus): Promise<RoomEntity> {
    const room = await prisma.room.update({
      where: { id: roomId },
      data: { status },
      include: memberInclude,
    });
    return mapRoom(room);
  }

  async listWaiting(limit = 20): Promise<RoomEntity[]> {
    const rooms = await prisma.room.findMany({
      where: { status: 'WAITING' },
      include: memberInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rooms.map(mapRoom);
  }
}

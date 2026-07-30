import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSession } from '../../src/infrastructure/game/game-session';

describe('GameSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks and emits snapshots', () => {
    const session = new GameSession('room-1');
    const snapshots: unknown[] = [];
    session.on('snapshot', (message) => snapshots.push(message));
    session.addPlayer('p1', 'nova');
    session.start();

    vi.advanceTimersByTime(100);
    session.stop();

    expect(session.getTick()).toBeGreaterThan(0);
    expect(snapshots.length).toBeGreaterThan(0);
    expect((snapshots[0] as { type: string }).type).toBe('snapshot');
  });

  it('processes movement inputs authoritatively', () => {
    const session = new GameSession('room-1');
    session.addPlayer('p1', 'nova');
    const before = session.getPlayer('p1')!.position.x;

    session.enqueueInput('p1', {
      seq: 1,
      dt: 0.05,
      move: { x: 1, y: 0, z: 0 },
      look: { x: 0, y: 0, z: 0 },
    });

    session.start();
    vi.advanceTimersByTime(50);
    session.stop();

    const after = session.getPlayer('p1')!.position.x;
    expect(after).toBeGreaterThan(before);
  });
});

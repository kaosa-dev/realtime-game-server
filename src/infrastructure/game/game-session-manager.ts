import { GameSession } from './game-session.js';

export class GameSessionManager {
  private readonly sessions = new Map<string, GameSession>();

  getOrCreate(roomId: string): GameSession {
    let session = this.sessions.get(roomId);
    if (!session) {
      session = new GameSession(roomId);
      session.start();
      this.sessions.set(roomId, session);
    }
    return session;
  }

  get(roomId: string): GameSession | undefined {
    return this.sessions.get(roomId);
  }

  destroy(roomId: string): void {
    const session = this.sessions.get(roomId);
    if (!session) return;
    session.stop();
    this.sessions.delete(roomId);
  }

  destroyAll(): void {
    for (const roomId of this.sessions.keys()) {
      this.destroy(roomId);
    }
  }
}

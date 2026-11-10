import { PublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";

export interface ActivePresence {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  lastSeenAt: string;
  connected: boolean;
}

interface PresenceEntry {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  lastSeenAt: number;
  connections: number;
}

const DEFAULT_ACTIVE_MS = 90_000;

export class PresenceService {
  private readonly entries = new Map<string, PresenceEntry>();

  touch(user: PublicUser, now = Date.now()): void {
    const current = this.entries.get(user.id);
    this.entries.set(user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastSeenAt: now,
      connections: current?.connections ?? 0,
    });
  }

  connect(user: PublicUser, now = Date.now()): void {
    const current = this.entries.get(user.id);
    this.entries.set(user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastSeenAt: now,
      connections: (current?.connections ?? 0) + 1,
    });
  }

  disconnect(userId: string, now = Date.now()): void {
    const current = this.entries.get(userId);
    if (!current) {
      return;
    }
    const connections = Math.max(0, current.connections - 1);
    if (connections === 0 && now - current.lastSeenAt > DEFAULT_ACTIVE_MS) {
      this.entries.delete(userId);
      return;
    }
    this.entries.set(userId, { ...current, connections, lastSeenAt: Math.max(current.lastSeenAt, now) });
  }

  listActive(options?: { role?: UserRole; maxAgeMs?: number; now?: number }): {
    count: number;
    users: ActivePresence[];
  } {
    const now = options?.now ?? Date.now();
    const maxAgeMs = options?.maxAgeMs ?? DEFAULT_ACTIVE_MS;
    const users = [...this.entries.values()]
      .filter((entry) => {
        if (options?.role && entry.role !== options.role) {
          return false;
        }
        return entry.connections > 0 || now - entry.lastSeenAt <= maxAgeMs;
      })
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .map((entry) => ({
        userId: entry.userId,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
        connected: entry.connections > 0,
      }));
    return { count: users.length, users };
  }
}

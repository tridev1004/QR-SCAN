import { BroadcastRecord, BroadcastRepository } from "../domain/repositories/BroadcastRepository";

export class InMemoryBroadcastRepository implements BroadcastRepository {
  private readonly records = new Map<string, BroadcastRecord>();

  async create(record: BroadcastRecord): Promise<BroadcastRecord> {
    this.records.set(record.id, record);
    return record;
  }

  async listActive(now: Date): Promise<BroadcastRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.expiresAt.getTime() > now.getTime())
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async stop(id: string, now: Date): Promise<BroadcastRecord | null> {
    const record = this.records.get(id);
    if (!record || record.expiresAt.getTime() <= now.getTime()) {
      return null;
    }
    const stopped = { ...record, expiresAt: now };
    this.records.set(id, stopped);
    return stopped;
  }
}

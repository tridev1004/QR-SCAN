export interface BroadcastRecord {
  id: string;
  message: string;
  createdAt: Date;
  expiresAt: Date;
  createdByUserId: string;
}

export interface BroadcastRepository {
  create(record: BroadcastRecord): Promise<BroadcastRecord>;
  listActive(now: Date): Promise<BroadcastRecord[]>;
  stop(id: string, now: Date): Promise<BroadcastRecord | null>;
}

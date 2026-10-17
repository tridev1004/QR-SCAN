import { randomUUID } from "crypto";
import { NotFoundError } from "../../domain/errors/DomainError";
import { BroadcastRecord, BroadcastRepository } from "../../domain/repositories/BroadcastRepository";
import { PaymentEventBus } from "../../infrastructure/realtime/PaymentEventBus";

export const MAX_BROADCAST_MINUTES = 7 * 24 * 60;

export interface BroadcastNotice {
  id: string;
  message: string;
  createdAt: string;
  expiresAt: string;
}

function toNotice(record: BroadcastRecord): BroadcastNotice {
  return {
    id: record.id,
    message: record.message,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
  };
}

export async function listActiveBroadcasts(broadcasts: BroadcastRepository, now: Date): Promise<BroadcastNotice[]> {
  return (await broadcasts.listActive(now)).map(toNotice);
}

export async function publishBroadcast(
  broadcasts: BroadcastRepository,
  events: PaymentEventBus,
  input: { message: string; durationMinutes: number; createdByUserId: string; now: Date },
): Promise<BroadcastNotice> {
  const createdAt = input.now;
  const expiresAt = new Date(createdAt.getTime() + input.durationMinutes * 60_000);
  const saved = await broadcasts.create({
    id: randomUUID(),
    message: input.message.trim(),
    createdAt,
    expiresAt,
    createdByUserId: input.createdByUserId,
  });
  const notice = toNotice(saved);
  events.publish({ type: "broadcast", data: { ...notice, active: true } });
  return notice;
}

export async function stopBroadcast(
  broadcasts: BroadcastRepository,
  events: PaymentEventBus,
  id: string,
  now: Date,
): Promise<void> {
  const saved = await broadcasts.stop(id, now);
  if (!saved) {
    throw new NotFoundError("Broadcast not found");
  }
  events.publish({ type: "broadcast", data: { ...toNotice(saved), active: false } });
}

import { describe, expect, it } from "vitest";
import { PaymentEventBus } from "../../infrastructure/realtime/PaymentEventBus";
import { InMemoryBroadcastRepository } from "../../test/InMemoryBroadcastRepository";
import { listActiveBroadcasts, publishBroadcast, stopBroadcast } from "./Broadcasts";

describe("broadcasts", () => {
  it("shows a message until its duration ends and hides it when stopped", async () => {
    const broadcasts = new InMemoryBroadcastRepository();
    const events = new PaymentEventBus();
    const seen: string[] = [];
    events.subscribe((event) => {
      if (event.type === "broadcast") seen.push(`${event.data.active}:${event.data.message}`);
    });
    const now = new Date("2026-10-17T08:00:00.000Z");
    const notice = await publishBroadcast(broadcasts, events, {
      message: "  Shift starts at 2  ",
      durationMinutes: 15,
      createdByUserId: "admin",
      now,
    });

    expect(notice.message).toBe("Shift starts at 2");
    expect(notice.expiresAt).toBe("2026-10-17T08:15:00.000Z");
    expect(await listActiveBroadcasts(broadcasts, new Date("2026-10-17T08:10:00.000Z"))).toHaveLength(1);
    expect(await listActiveBroadcasts(broadcasts, new Date("2026-10-17T08:15:00.000Z"))).toHaveLength(0);

    const second = await publishBroadcast(broadcasts, events, {
      message: "Still here",
      durationMinutes: 120,
      createdByUserId: "admin",
      now,
    });
    await stopBroadcast(broadcasts, events, second.id, new Date("2026-10-17T08:05:00.000Z"));
    const stillShowing = await listActiveBroadcasts(broadcasts, new Date("2026-10-17T08:06:00.000Z"));
    expect(stillShowing.map((item) => item.message)).toEqual(["Shift starts at 2"]);
    expect(await listActiveBroadcasts(broadcasts, new Date("2026-10-17T08:15:00.000Z"))).toHaveLength(0);
    expect(seen).toEqual(["true:Shift starts at 2", "true:Still here", "false:Still here"]);
  });
});
import { describe, expect, it } from "vitest";
import { nextReconnectDelay, parseSseBuffer, runPaymentEventLoop } from "./sse";
import { applyPaymentEvent } from "../state/paymentEvents";
import { PaymentSession } from "../types/payment.types";

function session(id: string, code: string): PaymentSession {
  return {
    id,
    code,
    status: "WAITING_FOR_PAYMENT",
    assignedEmployeeId: "rahul",
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    history: [],
  };
}

describe("payment events", () => {
  it("leaves the other sessions untouched when one succeeds", () => {
    const next = applyPaymentEvent(
      [session("1", "PAY-001"), session("2", "PAY-002"), session("3", "PAY-003")],
      { type: "payment-status", data: { paymentSessionId: "2", status: "FAILED", assignedEmployeeId: "rahul" } },
      { id: "rahul", role: "EMPLOYEE" },
    );
    expect(next.map((item) => item.status)).toEqual(["WAITING_FOR_PAYMENT", "FAILED", "WAITING_FOR_PAYMENT"]);
  });

  it("shows a newly captured QR to an employee", () => {
    const next = applyPaymentEvent(
      [],
      {
        type: "payment-created",
        data: session("9", "PAY-009"),
      },
      { id: "rahul", role: "EMPLOYEE" },
    );
    expect(next.map((item) => item.code)).toEqual(["PAY-009"]);
  });

  it("shows an open QR to every employee and removes it after someone else reserves it", () => {
    const open: PaymentSession = { ...session("9", "PAY-009"), assignedEmployeeId: undefined, broadcast: true };
    const shown = applyPaymentEvent([], { type: "payment-created", data: open }, { id: "aman", role: "EMPLOYEE" });
    expect(shown.map((item) => item.id)).toEqual(["9"]);
    const reserved = applyPaymentEvent(
      shown,
      { type: "payment-assigned", data: { ...open, broadcast: false, assignedEmployeeId: "rahul" } },
      { id: "aman", role: "EMPLOYEE" },
    );
    expect(reserved).toEqual([]);
    const kept = applyPaymentEvent(
      shown,
      { type: "payment-assigned", data: { ...open, broadcast: false, assignedEmployeeId: "rahul" } },
      { id: "rahul", role: "EMPLOYEE" },
    );
    expect(kept.map((item) => item.assignedEmployeeId)).toEqual(["rahul"]);
  });

  it("shows an admin who reserved an open QR without replacing the other sessions", () => {
    const open: PaymentSession = { ...session("9", "PAY-009"), assignedEmployeeId: undefined, broadcast: true };
    const next = applyPaymentEvent(
      [session("1", "PAY-001"), open],
      { type: "payment-assigned", data: { ...open, broadcast: false, assignedEmployeeId: "aman" } },
      { id: "admin", role: "ADMIN" },
    );
    expect(next.find((item) => item.id === "9")?.assignedEmployeeId).toBe("aman");
    expect(next.find((item) => item.id === "1")?.assignedEmployeeId).toBe("rahul");
  });
});

describe("sse client", () => {
  it("parses typed events and ignores comments", () => {
    const parsed = parseSseBuffer(": ping\n\nevent: payment-status\ndata: {\"paymentSessionId\":\"1\"}\n\npartial");
    expect(parsed.events).toEqual([{ event: "payment-status", data: "{\"paymentSessionId\":\"1\"}" }]);
    expect(parsed.rest).toBe("partial");
  });

  it("reconnects after the stream closes", async () => {
    const controller = new AbortController();
    let opens = 0;
    const seen: string[] = [];
    const payload = `event: payment-status\ndata: ${JSON.stringify({
      paymentSessionId: "1",
      status: "SUCCESS",
      assignedEmployeeId: "rahul",
    })}\n\n`;

    await runPaymentEventLoop({
      signal: controller.signal,
      sleep: async () => undefined,
      onEvent: (event) => {
        if (event.type === "payment-status") seen.push(event.data.status);
      },
      open: async () => {
        opens += 1;
        if (opens > 1) {
          controller.abort();
        }
        const stream = new ReadableStream<Uint8Array>({
          start(streamController) {
            if (opens === 1) {
              streamController.enqueue(new TextEncoder().encode(payload));
            }
            streamController.close();
          },
        });
        return new Response(stream, { status: 200 });
      },
    });

    expect(opens).toBe(2);
    expect(seen).toEqual(["SUCCESS"]);
    expect(nextReconnectDelay(1)).toBe(500);
    expect(nextReconnectDelay(8)).toBe(10_000);
  });
});

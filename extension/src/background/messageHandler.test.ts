import { describe, expect, it, vi } from "vitest";
import { createMessageHandler } from "./messageHandler";
import { HeldQr } from "../shared/messages";
import { SessionRegistry } from "../storage/sessionStore";

function setup(loadAssignee: () => Promise<string | null> = async () => "emp-1") {
  const creates: Array<{ qrFingerprint: string; assignedEmployeeId?: string; broadcast?: boolean }> = [];
  const updates: Array<{ id: string; status: string }> = [];
  const registry = new SessionRegistry();
  let sequence = 0;
  let held: HeldQr | null = null;
  const handle = createMessageHandler({
    registry,
    loadConfig: async () => ({ apiBaseUrl: "http://localhost:4000", token: "token" }),
    loadAssignee,
    loadHeld: async () => held,
    saveHeld: async (qr) => {
      held = qr;
    },
    save: async () => undefined,
    newLocalId: () => `local-${++sequence}`,
    api: {
      createPaymentSession: vi.fn(async (_config, body: { qrFingerprint: string; assignedEmployeeId?: string; broadcast?: boolean }) => {
        creates.push(body);
        return { paymentSessionId: `backend-${creates.length}`, status: "QR_READY" };
      }),
      updatePaymentStatus: vi.fn(async (_config, id: string, status: string) => {
        updates.push({ id, status });
        return { paymentSessionId: id, status };
      }),
      heartbeat: vi.fn(async () => undefined),
      listActiveEmployees: vi.fn(async () => []),
    },
  });
  return { handle, creates, updates, registry };
}

function observed(fingerprint: string) {
  return {
    type: "QR_OBSERVED" as const,
    payload: {
      qrFingerprint: fingerprint,
      qrImage: `data:image/png;base64,${fingerprint}`,
      expiresAt: "2026-10-01T12:04:40.000Z",
      sourceUrl: "https://console.cloud.google.com/billing",
    },
  };
}

describe("extension session mapping", () => {
  it("creates one backend session per QR and leaves the others alone", async () => {
    const { handle, creates, updates } = setup();
    for (const fingerprint of ["a", "b", "c", "d", "e"]) {
      const held = await handle(observed(fingerprint));
      expect(held).toMatchObject({ ok: true, held: true });
      const result = await handle({ type: "SEND_QR" });
      expect(result.ok).toBe(true);
    }
    const duplicate = await handle(observed("a"));
    expect(creates.map((item) => item.qrFingerprint)).toEqual(["a", "b", "c", "d", "e"]);
    expect(duplicate).toMatchObject({ backendPaymentSessionId: "backend-1" });
    expect(updates.filter((update) => update.status === "WAITING_FOR_PAYMENT")).toHaveLength(5);

    await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "a", success: true, failure: false, expired: false },
    });
    await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "a", success: true, failure: false, expired: false },
    });
    await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "b", success: false, failure: true, expired: false },
    });

    expect(updates.filter((update) => update.status === "SUCCESS")).toEqual([{ id: "backend-1", status: "SUCCESS" }]);
    expect(updates.filter((update) => update.status === "FAILED")).toEqual([{ id: "backend-2", status: "FAILED" }]);
  });

  it("opens a new session when the same QR comes back after failure", async () => {
    const { handle, creates } = setup();
    await handle(observed("again"));
    await handle({ type: "SEND_QR" });
    await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "again", success: false, failure: true, expired: false },
    });
    await handle({
      type: "QR_OBSERVED",
      payload: {
        qrFingerprint: "again",
        qrImage: "data:image/png;base64,again",
        expiresAt: "2026-10-01T12:09:40.000Z",
        sourceUrl: "https://console.cloud.google.com/billing",
      },
    });
    const next = await handle({ type: "SEND_QR" });
    expect(creates.map((item) => item.qrFingerprint)).toEqual(["again", "again"]);
    expect(next).toMatchObject({ ok: true, backendPaymentSessionId: "backend-2" });
  });

  it("does not call the backend before sign-in", async () => {
    const registry = new SessionRegistry();
    const create = vi.fn();
    const handle = createMessageHandler({
      registry,
      api: {
        createPaymentSession: create,
        updatePaymentStatus: vi.fn(),
        heartbeat: vi.fn(),
        listActiveEmployees: vi.fn(async () => []),
      },
      loadConfig: async () => null,
      loadAssignee: async () => "emp-1",
      loadHeld: async () => null,
      saveHeld: async () => undefined,
      save: async () => undefined,
      newLocalId: () => "local",
    });
    const result = await handle({
      type: "QR_OBSERVED",
      payload: {
        qrFingerprint: "abc",
        qrImage: "data:image/png;base64,abc",
        expiresAt: "2026-10-01T12:04:40.000Z",
        sourceUrl: "",
      },
    });
    expect(result).toEqual({ ok: false, error: "Sign in from the extension popup" });
    expect(create).not.toHaveBeenCalled();
  });

  it("sends the QR captured from the page even after an earlier one was sent", async () => {
    const { handle, creates } = setup();
    await handle(observed("one"));
    await handle({ type: "SEND_QR" });
    const second = await handle({
      type: "SEND_QR",
      payload: {
        qrFingerprint: "two",
        qrImage: "data:image/png;base64,two",
        expiresAt: "2026-10-01T12:04:40.000Z",
      },
    });
    expect(second).toMatchObject({ ok: true, backendPaymentSessionId: "backend-2" });
    expect(creates.map((item) => item.qrFingerprint)).toEqual(["one", "two"]);

    const repeat = await handle({
      type: "SEND_QR",
      payload: {
        qrFingerprint: "two",
        qrImage: "data:image/png;base64,two",
        expiresAt: "2026-10-01T12:04:40.000Z",
      },
    });
    expect(repeat).toMatchObject({ ok: true, alreadySent: true, backendPaymentSessionId: "backend-2" });
    expect(creates).toHaveLength(2);
  });

  it("sends a held QR to every active employee when nobody is selected", async () => {
    const { handle, creates } = setup(async () => null);
    const held = await handle(observed("abc"));
    expect(held).toMatchObject({ ok: true, held: true });
    expect(creates).toEqual([]);
    const sent = await handle({ type: "SEND_QR" });
    expect(sent).toMatchObject({ ok: true, broadcast: true });
    expect(creates).toEqual([expect.objectContaining({ qrFingerprint: "abc", broadcast: true })]);
    expect(creates[0]?.assignedEmployeeId).toBeUndefined();
  });

  it("marks the latest open session successful when the confirmation has no fingerprint", async () => {
    const { handle, updates } = setup();
    await handle(observed("live"));
    await handle({ type: "SEND_QR" });
    const result = await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "", success: true, failure: false, expired: false },
    });
    expect(result).toMatchObject({ ok: true, backendPaymentSessionId: "backend-1" });
    expect(updates).toContainEqual({ id: "backend-1", status: "SUCCESS" });
  });
});

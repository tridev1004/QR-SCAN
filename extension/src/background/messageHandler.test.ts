import { describe, expect, it, vi } from "vitest";
import { createMessageHandler } from "./messageHandler";
import { SessionRegistry } from "../storage/sessionStore";

function setup() {
  const creates: string[] = [];
  const updates: Array<{ id: string; status: string }> = [];
  const registry = new SessionRegistry();
  let sequence = 0;
  const handle = createMessageHandler({
    registry,
    loadConfig: async () => ({ apiBaseUrl: "http://localhost:4000", token: "token" }),
    loadAssignee: async () => "emp-1",
    save: async () => undefined,
    newLocalId: () => `local-${++sequence}`,
    api: {
      createPaymentSession: vi.fn(async (_config, body: { qrFingerprint: string; assignedEmployeeId: string }) => {
        creates.push(body.qrFingerprint);
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

describe("extension session mapping", () => {
  it("creates one backend session per QR and leaves the others alone", async () => {
    const { handle, creates, updates } = setup();
    for (const fingerprint of ["a", "b", "c", "d", "e"]) {
      const result = await handle({
        type: "QR_OBSERVED",
        payload: {
          qrFingerprint: fingerprint,
          qrImage: `data:image/png;base64,${fingerprint}`,
          expiresAt: "2026-10-01T12:04:40.000Z",
          sourceUrl: "https://console.cloud.google.com/billing",
        },
      });
      expect(result.ok).toBe(true);
    }
    const duplicate = await handle({
      type: "QR_OBSERVED",
      payload: {
        qrFingerprint: "a",
        qrImage: "data:image/png;base64,a",
        expiresAt: "2026-10-01T12:04:40.000Z",
        sourceUrl: "https://console.cloud.google.com/billing",
      },
    });
    expect(creates).toEqual(["a", "b", "c", "d", "e"]);
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
    await handle({
      type: "QR_OBSERVED",
      payload: {
        qrFingerprint: "again",
        qrImage: "data:image/png;base64,again",
        expiresAt: "2026-10-01T12:04:40.000Z",
        sourceUrl: "https://console.cloud.google.com/billing",
      },
    });
    await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "again", success: false, failure: true, expired: false },
    });
    const next = await handle({
      type: "QR_OBSERVED",
      payload: {
        qrFingerprint: "again",
        qrImage: "data:image/png;base64,again",
        expiresAt: "2026-10-01T12:09:40.000Z",
        sourceUrl: "https://console.cloud.google.com/billing",
      },
    });
    expect(creates).toEqual(["again", "again"]);
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

  it("does not send a QR until an active employee is chosen", async () => {
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
      loadConfig: async () => ({ apiBaseUrl: "http://localhost:4000", token: "token" }),
      loadAssignee: async () => null,
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
    expect(result).toEqual({ ok: false, error: "Choose an active employee in the popup" });
    expect(create).not.toHaveBeenCalled();
  });

  it("marks the latest open session successful when the confirmation has no fingerprint", async () => {
    const { handle, updates } = setup();
    await handle({
      type: "QR_OBSERVED",
      payload: {
        qrFingerprint: "live",
        qrImage: "data:image/png;base64,live",
        expiresAt: "2026-10-01T12:04:40.000Z",
        sourceUrl: "https://console.cloud.google.com/billing",
      },
    });
    const result = await handle({
      type: "PAGE_STATUS",
      payload: { qrFingerprint: "", success: true, failure: false, expired: false },
    });
    expect(result).toMatchObject({ ok: true, backendPaymentSessionId: "backend-1" });
    expect(updates).toContainEqual({ id: "backend-1", status: "SUCCESS" });
  });
});

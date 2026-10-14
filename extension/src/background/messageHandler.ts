import { createApiClient } from "./apiClient";
import { ExtensionMessage, HeldQr, WorkerResponse } from "../shared/messages";
import { PaymentStatus, isTerminalStatus } from "../shared/types";
import { SessionRegistry } from "../storage/sessionStore";

type Api = ReturnType<typeof createApiClient>;

export interface WorkerDeps {
  registry: SessionRegistry;
  api: Api;
  loadConfig: () => Promise<{ apiBaseUrl: string; token: string } | null>;
  loadAssignee: () => Promise<string | null>;
  loadHeld: () => Promise<HeldQr | null>;
  saveHeld: (qr: HeldQr | null) => Promise<void>;
  save: () => Promise<void>;
  newLocalId: () => string;
}

export function createMessageHandler(deps: WorkerDeps) {
  const inFlight = new Set<string>();
  const pendingStatus = new Map<string, ExtensionMessage & { type: "PAGE_STATUS" }>();

  async function applyStatus(message: ExtensionMessage & { type: "PAGE_STATUS" }): Promise<WorkerResponse> {
    const fingerprint = message.payload.qrFingerprint;
    const tracked = fingerprint
      ? deps.registry.getByFingerprint(fingerprint)
      : deps.registry.list().filter((session) => !isTerminalStatus(session.status)).at(-1);
    if (!tracked) {
      if (fingerprint) {
        pendingStatus.set(fingerprint, message);
      }
      return { ok: true, pending: true };
    }
    if (isTerminalStatus(tracked.status)) {
      return { ok: true, backendPaymentSessionId: tracked.backendPaymentSessionId };
    }
    const { success, failure, expired } = message.payload;
    if (success === failure && success) {
      return { ok: true, backendPaymentSessionId: tracked.backendPaymentSessionId };
    }
    const next: PaymentStatus | null = success ? "SUCCESS" : failure ? "FAILED" : expired ? "EXPIRED" : null;
    if (!next) {
      return { ok: true, backendPaymentSessionId: tracked.backendPaymentSessionId };
    }
    const config = await deps.loadConfig();
    if (!config) {
      return { ok: false, error: "Sign in from the extension popup" };
    }
    await deps.api.updatePaymentStatus(config, tracked.backendPaymentSessionId, next);
    deps.registry.updateStatus(tracked.backendPaymentSessionId, next);
    await deps.save();
    return { ok: true, backendPaymentSessionId: tracked.backendPaymentSessionId };
  }

  return async function handleExtensionMessage(message: ExtensionMessage): Promise<WorkerResponse> {
    if (message.type === "PAGE_STATUS") {
      return applyStatus(message);
    }
    if (message.type === "SCAN_STATUS") {
      return { ok: true };
    }

    if (message.type === "SEND_QR") {
      return sendHeldQr();
    }

    const fingerprint = message.payload.qrFingerprint;
    const existing = deps.registry.getByFingerprint(fingerprint);
    if (existing) {
      if (existing.status === "QR_READY") {
        const config = await deps.loadConfig();
        if (config) {
          await deps.api.updatePaymentStatus(config, existing.backendPaymentSessionId, "WAITING_FOR_PAYMENT");
          deps.registry.updateStatus(existing.backendPaymentSessionId, "WAITING_FOR_PAYMENT");
          await deps.save();
        }
      }
      return { ok: true, backendPaymentSessionId: existing.backendPaymentSessionId };
    }
    if (inFlight.has(fingerprint)) {
      return { ok: true, pending: true };
    }

    const config = await deps.loadConfig();
    if (!config) {
      return { ok: false, error: "Sign in from the extension popup" };
    }
    await deps.saveHeld({
      qrFingerprint: fingerprint,
      qrImage: message.payload.qrImage,
      expiresAt: message.payload.expiresAt,
    });
    return { ok: true, held: true };

    async function sendHeldQr(): Promise<WorkerResponse> {
      const held = await deps.loadHeld();
      if (!held) {
        return { ok: false, error: "No QR is ready to send" };
      }
      const already = deps.registry.getByFingerprint(held.qrFingerprint);
      if (already) {
        return { ok: true, backendPaymentSessionId: already.backendPaymentSessionId };
      }
      if (inFlight.has(held.qrFingerprint)) {
        return { ok: true, pending: true };
      }
      const config = await deps.loadConfig();
      if (!config) {
        return { ok: false, error: "Sign in from the extension popup" };
      }
      const assignedEmployeeId = await deps.loadAssignee();
      const broadcast = !assignedEmployeeId;
      inFlight.add(held.qrFingerprint);
      try {
        const localSessionId = deps.newLocalId();
        const created = await deps.api.createPaymentSession(config, {
          localSessionId,
          ...(broadcast ? { broadcast: true } : { assignedEmployeeId: assignedEmployeeId ?? "" }),
          qrFingerprint: held.qrFingerprint,
          qrImage: held.qrImage,
          expiresAt: held.expiresAt,
        });
        deps.registry.add({
          localSessionId,
          backendPaymentSessionId: created.paymentSessionId,
          qrFingerprint: held.qrFingerprint,
          status: "QR_READY",
          expiresAt: held.expiresAt,
        });
        await deps.api.updatePaymentStatus(config, created.paymentSessionId, "WAITING_FOR_PAYMENT");
        deps.registry.updateStatus(created.paymentSessionId, "WAITING_FOR_PAYMENT");
        await deps.save();
        await deps.saveHeld(null);
        const pending = pendingStatus.get(held.qrFingerprint);
        if (pending) {
          pendingStatus.delete(held.qrFingerprint);
          await applyStatus(pending);
        }
        return { ok: true, backendPaymentSessionId: created.paymentSessionId, broadcast };
      } finally {
        inFlight.delete(held.qrFingerprint);
      }
    }
  };
}

import { createApiClient } from "./apiClient";
import { createMessageHandler } from "./messageHandler";
import { labelForScan } from "../content/scanReport";
import { ExtensionMessage, HeldQr } from "../shared/messages";
import { SessionRegistry } from "../storage/sessionStore";
import { loadApiConfig, loadTrackedSessions, saveTrackedSessions } from "../storage/chromeSessionStore";
import { injectWatcher, isWatchedUrl } from "../shared/injectWatcher";

const registry = new SessionRegistry();
const api = createApiClient();
const handle = createMessageHandler({
  registry,
  api,
  loadConfig: loadApiConfig,
  loadAssignee: async () => {
    const stored = await chrome.storage.session.get(["selectedEmployeeId"]);
    return typeof stored.selectedEmployeeId === "string" && stored.selectedEmployeeId
      ? stored.selectedEmployeeId
      : null;
  },
  loadHeld: async () => {
    const stored = await chrome.storage.session.get("heldQr");
    const value = stored.heldQr;
    if (!value || typeof value !== "object") {
      return null;
    }
    const held = value as Partial<HeldQr>;
    if (!held.qrFingerprint || !held.qrImage || !held.expiresAt) {
      return null;
    }
    return { qrFingerprint: held.qrFingerprint, qrImage: held.qrImage, expiresAt: held.expiresAt };
  },
  saveHeld: async (qr) => {
    if (!qr) {
      await chrome.storage.session.remove("heldQr");
      return;
    }
    await chrome.storage.session.set({ heldQr: qr });
  },
  save: () => saveTrackedSessions(registry),
  newLocalId: () => crypto.randomUUID(),
});

const ready = loadTrackedSessions()
  .then((sessions) => registry.replace(sessions))
  .catch(() => undefined);

let captureLevel = 0;
const captureReady = chrome.storage.session.get(["lastCaptureLevel"]).then((stored) => {
  captureLevel = typeof stored.lastCaptureLevel === "number" ? stored.lastCaptureLevel : 0;
});

async function rememberCapture(level: number, text: string) {
  await captureReady;
  if (level < captureLevel) {
    return;
  }
  captureLevel = level;
  await chrome.storage.session.set({ lastCapture: text, lastCaptureLevel: level });
}

const frameQr = new Map<number, { visible: boolean; at: number }>();

function anotherFrameStillHasQr(frameId: number | undefined): boolean {
  const cutoff = Date.now() - 5000;
  for (const [id, state] of frameQr) {
    if (id === frameId) {
      continue;
    }
    if (state.visible && state.at >= cutoff) {
      return true;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === "SCAN_STATUS" && sender.frameId !== undefined) {
    frameQr.set(sender.frameId, {
      visible: message.payload.heading && message.payload.image,
      at: Date.now(),
    });
  }
  if (
    message.type === "PAGE_STATUS" &&
    (message.payload.success || message.payload.failure) &&
    anotherFrameStillHasQr(sender.frameId)
  ) {
    sendResponse({ ok: true });
    return true;
  }
  ready
    .then(() => handle(message))
    .then(async (result) => {
      if (message.type === "QR_OBSERVED") {
        captureLevel = 0;
        const text = result.ok && result.held ? "QR ready. Press Send." : result.ok ? "" : result.error ?? "Could not keep the QR";
        if (text) {
          await rememberCapture(3, text);
        }
      }
      if (message.type === "SEND_QR") {
        captureLevel = 0;
        const stored = await chrome.storage.session.get(["selectedEmployeeName"]);
        const who = typeof stored.selectedEmployeeName === "string" ? stored.selectedEmployeeName : "";
        const text = !result.ok
          ? result.error ?? "Could not send the QR"
          : result.broadcast
            ? "QR sent to all active employees"
            : `QR sent to ${who || "the selected employee"}`;
        await rememberCapture(3, text);
      }
      if (message.type === "SCAN_STATUS") {
        const next = labelForScan(message.payload);
        await rememberCapture(next.level, next.text);
      }
      if (message.type === "PAGE_STATUS" && result.ok && !result.pending) {
        if (message.payload.success) {
          await rememberCapture(4, "Payment successful");
        } else if (message.payload.failure) {
          await rememberCapture(4, "Payment failed");
        }
      }
      sendResponse(result);
    })
    .catch(async (error: unknown) => {
      const text = error instanceof Error ? error.message : "Extension error";
      await chrome.storage.session.set({ lastCapture: text });
      sendResponse({ ok: false, error: text });
    });
  return true;
});

async function injectOpenTabs() {
  const tabs = await chrome.tabs.query({
    url: [
      "https://console.cloud.google.com/*",
      "https://payments.google.com/*",
      "https://pay.google.com/*",
      "https://accounts.google.com/*",
    ],
  });
  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
    for (const frame of frames ?? []) {
      if (!isWatchedUrl(frame.url)) {
        continue;
      }
      await injectWatcher(tab.id, frame.frameId).catch(() => undefined);
    }
  }
}

void injectOpenTabs();

chrome.webNavigation.onCommitted.addListener((details) => {
  frameQr.delete(details.frameId);
  if (!isWatchedUrl(details.url)) {
    return;
  }
  void injectWatcher(details.tabId, details.frameId).catch(() => undefined);
});

chrome.alarms.create("upi-monitor-heartbeat", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {
  void (async () => {
    const config = await loadApiConfig();
    const ids = registry.activeIds();
    if (!config || ids.length === 0) {
      return;
    }
    await api.heartbeat(config, ids);
  })();
});

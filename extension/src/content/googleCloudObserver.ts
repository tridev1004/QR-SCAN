import { ExtensionMessage, HeldQr, WorkerResponse } from "../shared/messages";
import { debounce } from "./debounce";
import { detectExpired, detectFailure, detectSuccess } from "./statusDetector";
import { describeScan } from "./scanReport";
import { expiresAtFromTimer, parseTimerToSeconds, readCountdown } from "./timerDetector";
import { findQrImage, fingerprintQrImage, isQrScreen, safePageUrl } from "./qrDetector";
import { readAccountEmail } from "./accountEmail";
import { forEachShadowRoot } from "./domQuery";

const FALLBACK_EXPIRY_MS = 5 * 60 * 1000;

const CLOSE_DELAY_MS = 5_200;

export function startGoogleCloudObserver(options: {
  document: Document;
  send: (message: ExtensionMessage) => void | Promise<WorkerResponse | void>;
  now?: () => number;
  debounceMs?: number;
  closeDelayMs?: number;
}): () => void {
  const now = options.now ?? (() => Date.now());
  const seenExpiry = new Map<string, string>();
  const settled = new Set<string>();
  let leftAfterSettle = false;
  let armedFingerprint: string | null = null;
  let lastFingerprint: string | null = null;
  let lastStatusKey = "";
  let lastSummary = "";
  let lastEmail = "";
  let scanning = false;
  let queued = false;
  let stopped = false;
  let disconnect = () => undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const clearClose = () => {
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };

  const scheduleClose = (fingerprint: string) => {
    if (closeTimer !== undefined || !fingerprint || settled.has(fingerprint)) {
      return;
    }
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      if (
        stopped ||
        settled.has(fingerprint) ||
        isQrScreen(options.document) ||
        detectSuccess(options.document) ||
        detectFailure(options.document)
      ) {
        return;
      }
      armedFingerprint = null;
      seenExpiry.delete(fingerprint);
      settled.add(fingerprint);
      lastStatusKey = `${fingerprint}:closed`;
      options.send({
        type: "PAGE_STATUS",
        payload: {
          qrFingerprint: fingerprint,
          success: false,
          failure: true,
          expired: false,
          ...(lastEmail ? { accountEmail: lastEmail } : {}),
        },
      });
    }, options.closeDelayMs ?? CLOSE_DELAY_MS);
  };

  const scan = async (forceStatus = false) => {
    if (scanning) {
      queued = true;
      return;
    }
    scanning = true;
    try {
      observeTree(options.document);
      const accountEmail = readAccountEmail(options.document) || lastEmail || "";
      if (accountEmail && accountEmail !== lastEmail) {
        lastEmail = accountEmail;
        options.send({ type: "ACCOUNT_SEEN", payload: { email: accountEmail } });
      }
      const frameUrl = options.document.defaultView?.location.href ?? "";
      const report = describeScan(options.document, frameUrl);
      const summary = `${report.frameUrl}:${report.heading}:${report.image}:${report.timer ?? ""}`;
      if (forceStatus || summary !== lastSummary) {
        lastSummary = summary;
        options.send({ type: "SCAN_STATUS", payload: report });
      }
      const qr = isQrScreen(options.document) ? findQrImage(options.document) : null;
      if (qr) {
        clearClose();
        const src = qr.getAttribute("src") ?? "";
        const fingerprint = await fingerprintQrImage(src);
        if (leftAfterSettle && settled.has(fingerprint)) {
          settled.delete(fingerprint);
          lastStatusKey = "";
        }
        leftAfterSettle = false;
        lastFingerprint = fingerprint;
        if (!seenExpiry.has(fingerprint)) {
          const timerText = readCountdown(options.document);
          const expiresAt =
            (timerText && expiresAtFromTimer(timerText, now())) || new Date(now() + FALLBACK_EXPIRY_MS).toISOString();
          seenExpiry.set(fingerprint, expiresAt);
        }
        if (armedFingerprint !== fingerprint) {
          const response = await options.send({
            type: "QR_OBSERVED",
            payload: {
              qrFingerprint: fingerprint,
              qrImage: src,
              expiresAt: seenExpiry.get(fingerprint) ?? new Date(now() + FALLBACK_EXPIRY_MS).toISOString(),
              sourceUrl: safePageUrl(frameUrl),
              ...(accountEmail ? { accountEmail } : {}),
            },
          });
          if (!response || (response.ok && !response.pending)) {
            armedFingerprint = fingerprint;
          }
        }
      } else {
        armedFingerprint = null;
        if (settled.size > 0) {
          leftAfterSettle = true;
        }
      }

      const fingerprint = lastFingerprint ?? "";
      const qrGone = !isQrScreen(options.document);
      const success = detectSuccess(options.document) && qrGone;
      const failure = detectFailure(options.document) && qrGone;
      if (!fingerprint && !success && !failure) {
        return;
      }
      const timerText = readCountdown(options.document);
      const expired = detectExpired(options.document) || parseTimerToSeconds(timerText ?? "") === 0;
      if (success && failure) {
        return;
      }
      if (!success && !failure && !expired) {
        if (qrGone) {
          scheduleClose(fingerprint);
        }
        return;
      }
      clearClose();
      if (fingerprint && settled.has(fingerprint)) {
        return;
      }
      const statusKey = `${fingerprint}:${success}:${failure}:${expired}`;
      if (statusKey === lastStatusKey) {
        return;
      }
      lastStatusKey = statusKey;
      armedFingerprint = null;
      seenExpiry.delete(fingerprint);
      if (fingerprint) {
        settled.add(fingerprint);
      }
      options.send({
        type: "PAGE_STATUS",
        payload: {
          qrFingerprint: fingerprint,
          success,
          failure: failure && !expired,
          expired,
          ...(accountEmail || lastEmail ? { accountEmail: accountEmail || lastEmail } : {}),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("invalidated") || !chrome.runtime?.id) {
        queued = false;
        stopped = true;
        disconnect();
        return;
      }
      console.warn("[upi-monitor]", message || "Could not read the QR");
    } finally {
      scanning = false;
      if (queued && !stopped) {
        queued = false;
        void scan();
      }
    }
  };

  const debounced = debounce(() => {
    void scan();
  }, options.debounceMs ?? 200);

  const Observer = options.document.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const observer = new Observer(() => debounced.call());
  const observed = new WeakSet<Node>();
  const observeOptions = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  };

  const observeTree = (root: ParentNode) => {
    const withBody = root as ParentNode & { body?: Node | null };
    const target = (withBody.body ?? root) as Node;
    if (!observed.has(target)) {
      observed.add(target);
      observer.observe(target, observeOptions);
    }
    forEachShadowRoot(root, observeTree);
  };

  observeTree(options.document);
  void scan();
  const pulse = options.document.defaultView?.setInterval(() => {
    void scan(true);
  }, 2000);

  disconnect = () => {
    stopped = true;
    clearClose();
    debounced.cancel();
    observer.disconnect();
    if (pulse !== undefined) {
      options.document.defaultView?.clearInterval(pulse);
    }
  };

  return disconnect;
}

export async function captureVisibleQr(document: Document, now = Date.now()): Promise<HeldQr | null> {
  if (!isQrScreen(document)) {
    return null;
  }
  const qr = findQrImage(document);
  const src = qr?.getAttribute("src") ?? "";
  if (!qr || !src) {
    return null;
  }
  const timerText = readCountdown(document);
  const expiresAt = (timerText && expiresAtFromTimer(timerText, now)) || new Date(now + FALLBACK_EXPIRY_MS).toISOString();
  const accountEmail = readAccountEmail(document);
  return {
    qrFingerprint: await fingerprintQrImage(src),
    qrImage: src,
    expiresAt,
    ...(accountEmail ? { accountEmail } : {}),
  };
}

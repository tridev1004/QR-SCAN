import { ExtensionMessage, WorkerResponse } from "../shared/messages";
import { debounce } from "./debounce";
import { detectExpired, detectFailure, detectSuccess } from "./statusDetector";
import { describeScan } from "./scanReport";
import { expiresAtFromTimer, parseTimerToSeconds, readCountdown } from "./timerDetector";
import { findQrImage, fingerprintQrImage, isQrScreen, safePageUrl } from "./qrDetector";
import { forEachShadowRoot } from "./domQuery";

const FALLBACK_EXPIRY_MS = 5 * 60 * 1000;

export function startGoogleCloudObserver(options: {
  document: Document;
  send: (message: ExtensionMessage) => void | Promise<WorkerResponse | void>;
  now?: () => number;
  debounceMs?: number;
}): () => void {
  const now = options.now ?? (() => Date.now());
  const seenExpiry = new Map<string, string>();
  const accepted = new Set<string>();
  let lastFingerprint: string | null = null;
  let lastStatusKey = "";
  let lastSummary = "";
  let scanning = false;
  let queued = false;
  let stopped = false;
  let disconnect = () => undefined;

  const scan = async (forceStatus = false) => {
    if (scanning) {
      queued = true;
      return;
    }
    scanning = true;
    try {
      observeTree(options.document);
      const frameUrl = options.document.defaultView?.location.href ?? "";
      const report = describeScan(options.document, frameUrl);
      const summary = `${report.frameUrl}:${report.heading}:${report.image}:${report.timer ?? ""}`;
      if (forceStatus || summary !== lastSummary) {
        lastSummary = summary;
        options.send({ type: "SCAN_STATUS", payload: report });
      }
      const qr = isQrScreen(options.document) ? findQrImage(options.document) : null;
      if (qr) {
        const src = qr.getAttribute("src") ?? "";
        const fingerprint = await fingerprintQrImage(src);
        lastFingerprint = fingerprint;
        if (!seenExpiry.has(fingerprint)) {
          const timerText = readCountdown(options.document);
          const expiresAt =
            (timerText && expiresAtFromTimer(timerText, now())) || new Date(now() + FALLBACK_EXPIRY_MS).toISOString();
          seenExpiry.set(fingerprint, expiresAt);
        }
        if (!accepted.has(fingerprint)) {
          const response = await options.send({
            type: "QR_OBSERVED",
            payload: {
              qrFingerprint: fingerprint,
              qrImage: src,
              expiresAt: seenExpiry.get(fingerprint) ?? new Date(now() + FALLBACK_EXPIRY_MS).toISOString(),
              sourceUrl: safePageUrl(frameUrl),
            },
          });
          if (!response || (response.ok && !response.pending)) {
            accepted.add(fingerprint);
          }
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
        return;
      }
      const statusKey = `${fingerprint}:${success}:${failure}:${expired}`;
      if (statusKey === lastStatusKey) {
        return;
      }
      lastStatusKey = statusKey;
      accepted.delete(fingerprint);
      seenExpiry.delete(fingerprint);
      options.send({
        type: "PAGE_STATUS",
        payload: { qrFingerprint: fingerprint, success, failure, expired },
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
    debounced.cancel();
    observer.disconnect();
    if (pulse !== undefined) {
      options.document.defaultView?.clearInterval(pulse);
    }
  };

  return disconnect;
}

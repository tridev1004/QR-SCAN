import { describeScan } from "./scanReport";
import { captureVisibleQr, startGoogleCloudObserver } from "./googleCloudObserver";
import { WorkerResponse } from "../shared/messages";

const runtime = globalThis as typeof globalThis & { __upiMonitorStarted?: boolean };
if (!runtime.__upiMonitorStarted) {
  runtime.__upiMonitorStarted = true;
  console.info("[upi-monitor] watching", location.host);

  chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
    if (message?.type === "REPORT_SCAN") {
      sendResponse(describeScan(document, location.href));
      return;
    }
    if (message?.type === "CAPTURE_QR") {
      void captureVisibleQr(document).then(sendResponse);
      return true;
    }
  });

  startGoogleCloudObserver({
    document,
    send(message) {
      if (!chrome.runtime?.id) {
        throw new Error("Extension context invalidated.");
      }
      return chrome.runtime.sendMessage(message).then(
        (response: WorkerResponse | undefined) => {
          if (response && response.ok === false && response.error) {
            console.warn("[upi-monitor]", response.error);
          }
          return response;
        },
        (error: unknown) => {
          const text = error instanceof Error ? error.message : "";
          if (!text.toLowerCase().includes("invalidated")) {
            console.warn("[upi-monitor]", text || "Could not reach the extension");
          }
          throw error instanceof Error ? error : new Error(text || "Could not reach the extension");
        },
      );
    },
  });
}

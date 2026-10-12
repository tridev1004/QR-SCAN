import { ScanReport } from "../shared/messages";
import { safePageUrl, findQrImage, isQrScreen } from "./qrDetector";
import { readCountdown } from "./timerDetector";

export function describeScan(root: ParentNode, frameUrl: string): ScanReport {
  const heading = isQrScreen(root);
  return {
    frameUrl: safePageUrl(frameUrl),
    heading,
    image: heading && findQrImage(root) !== null,
    timer: heading ? readCountdown(root) : null,
  };
}

export function labelForScan(report: ScanReport): { level: number; text: string } {
  let host = "this page";
  try {
    host = new URL(report.frameUrl).host || host;
  } catch {
    host = "this page";
  }
  if (report.heading && report.image && report.timer) {
    return { level: 2, text: `QR seen on ${host}.` };
  }
  if (report.heading && report.image) {
    return { level: 2, text: `QR seen on ${host}. Timer was not readable, so expiry is 5 minutes.` };
  }
  if (report.heading) {
    return { level: 1, text: `UPI screen is on ${host}, but the QR image is not readable.` };
  }
  return { level: 0, text: `Watching ${host} until this tab is closed. No UPI QR in this frame yet.` };
}

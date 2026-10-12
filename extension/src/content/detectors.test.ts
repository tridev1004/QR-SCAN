import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startGoogleCloudObserver } from "./googleCloudObserver";
import { findQrImage, fingerprintQrImage, isQrScreen } from "./qrDetector";
import { detectFailure, detectSuccess, matchesAnyIndicator } from "./statusDetector";
import { expiresAtFromTimer, parseTimerToSeconds, readCountdown } from "./timerDetector";
import { debounce } from "./debounce";

const QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function page(html: string): Document {
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

const qrScreen = `
  <h1>Scan QR code to use UPI</h1>
  <img alt="Amazon" src="https://example.test/amazon.png" />
  <img alt="GPay" src="https://example.test/gpay.png" />
  <img alt="Paytm" src="https://example.test/paytm.png" />
  <img alt="PhonePe" src="https://example.test/phonepe.png" />
  <img alt="QR code" src="${QR}" />
  <span role="timer">4:40</span>
`;

describe("QR detection", () => {
  it("selects the UPI QR and ignores payment app icons", () => {
    const document = page(qrScreen);
    const qr = findQrImage(document);
    expect(qr?.getAttribute("alt")).toBe("QR code");
    expect(qr?.getAttribute("src")).toBe(QR);
    expect(isQrScreen(document)).toBe(true);
  });

  it("finds the QR when Google renders it inside a shadow root", () => {
    const document = page("<div id='host'></div>");
    const host = document.querySelector<HTMLElement>("#host");
    const shadow = host?.attachShadow({ mode: "open" });
    shadow!.innerHTML = qrScreen;
    expect(isQrScreen(document)).toBe(true);
    expect(findQrImage(document)?.getAttribute("alt")).toBe("QR code");
  });
  it("does not treat a data-url icon as the QR", () => {
    const document = page(`<img alt="GPay" src="${QR}" /><h1>Scan QR code to use UPI</h1>`);
    expect(findQrImage(document)).toBeNull();
  });

  it("requires the UPI heading", () => {
    const document = page(`<h1>Something else</h1><img alt="QR code" src="${QR}" />`);
    expect(isQrScreen(document)).toBe(false);
  });

  it("creates a stable fingerprint and a different one for a new image", async () => {
    const first = await fingerprintQrImage(QR);
    const second = await fingerprintQrImage(QR);
    const third = await fingerprintQrImage(`${QR}different`);
    expect(first).toHaveLength(64);
    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });
});

describe("timer", () => {
  it("parses the displayed countdown once", () => {
    expect(parseTimerToSeconds("4:40")).toBe(280);
    expect(parseTimerToSeconds("0:00")).toBe(0);
    expect(parseTimerToSeconds("nope")).toBeNull();
    expect(expiresAtFromTimer("4:40", Date.parse("2026-10-01T12:00:00.000Z"))).toBe("2026-10-01T12:04:40.000Z");
  });

  it("reads a countdown written beside the heading when the timer role is missing", () => {
    const document = page(`
      <div>
        <h1>Scan QR code to use UPI</h1>
        <img alt="QR code" src="${QR}" />
        <p>Complete this action within 4:07</p>
      </div>
    `);
    expect(readCountdown(document)).toBe("4:07");
  });
});

describe("status detector", () => {
  it("does not invent success or failure when the QR disappears", () => {
    const document = page("<h1>Google Cloud</h1>");
    expect(detectSuccess(document)).toBe(false);
    expect(detectFailure(document)).toBe(false);
  });

  it("treats the prepayment confirmation as success", () => {
    const document = page("<h1>One-time prepayment required</h1><button>OK</button>");
    expect(detectSuccess(document)).toBe(true);
  });

  it("treats the cancelled transaction screen as failure", () => {
    const document = page(
      "<h1>Transaction wasn\u2019t completed</h1><p>Something went wrong with this payment. [OR_MIVEM_25]</p><button>Try again</button>",
    );
    expect(detectFailure(document)).toBe(true);
    expect(detectSuccess(document)).toBe(false);
  });

  it("matches an indicator only when one is configured", () => {
    const document = page("<h1>Payment received</h1>");
    expect(matchesAnyIndicator(document, [])).toBe(false);
    expect(matchesAnyIndicator(document, ["text:Payment received"])).toBe(true);
  });
});

describe("observer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces bursts and opens one session per distinct QR", async () => {
    const document = page(qrScreen);
    const sent: string[] = [];
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 30,
      now: () => Date.parse("2026-10-01T12:00:00.000Z"),
      send: (message) => {
        if (message.type === "QR_OBSERVED") sent.push(message.payload.qrFingerprint);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(sent).toHaveLength(1);
    const first = sent[0];

    const image = document.querySelector<HTMLImageElement>('img[alt="QR code"]');
    expect(image).toBeTruthy();
    image?.setAttribute("src", `${QR}next`);
    expect(image?.getAttribute("src")).toContain("next");
    document.body.setAttribute("data-step", "next-qr");
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(sent).toHaveLength(2);
    expect(sent[1]).not.toBe(first);
    stop();
  });

  it("still sends the QR when the countdown is plain text", async () => {
    const document = page(`
      <div>
        <h1>Scan QR code to use UPI</h1>
        <img alt="QR code" src="${QR}" />
        <p>Complete this action within 4:07</p>
      </div>
    `);
    const sent: string[] = [];
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 20,
      now: () => Date.parse("2026-10-01T12:00:00.000Z"),
      send: (message) => {
        if (message.type === "QR_OBSERVED") sent.push(message.payload.expiresAt);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sent).toEqual(["2026-10-01T12:04:07.000Z"]);
    stop();
  });

  it("reports success when the prepayment confirmation replaces the QR", async () => {
    const document = page(qrScreen);
    const sent: string[] = [];
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 20,
      now: () => Date.parse("2026-10-01T12:00:00.000Z"),
      send: (message) => {
        if (message.type === "PAGE_STATUS" && message.payload.success) sent.push(message.payload.qrFingerprint);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    document.body.innerHTML = "<h1>One-time prepayment required</h1>";
    document.body.setAttribute("data-step", "done");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(64);
    stop();
  });

  it("reports failure when Google shows that the transaction was not completed", async () => {
    const document = page(qrScreen);
    const sent: boolean[] = [];
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 20,
      now: () => Date.parse("2026-10-01T12:00:00.000Z"),
      send: (message) => {
        if (message.type === "PAGE_STATUS") sent.push(message.payload.failure);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    document.body.innerHTML =
      "<h1>Transaction wasn't completed</h1><p>Something went wrong with this payment.</p>";
    document.body.setAttribute("data-step", "failed");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(sent).toEqual([true]);
    stop();
  });

  it("keeps offering the same QR until an employee is chosen", async () => {
    const document = page(qrScreen);
    let accepted = false;
    const sent: string[] = [];
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 20,
      now: () => Date.parse("2026-10-01T12:00:00.000Z"),
      send: (message) => {
        if (message.type !== "QR_OBSERVED") {
          return;
        }
        sent.push(message.payload.qrFingerprint);
        return accepted
          ? { ok: true as const }
          : { ok: false as const, error: "Choose an active employee in the popup" };
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sent).toHaveLength(1);
    document.body.setAttribute("data-step", "still-waiting");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sent).toHaveLength(2);
    accepted = true;
    document.body.setAttribute("data-step", "chosen");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sent).toHaveLength(3);
    document.body.setAttribute("data-step", "done");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sent).toHaveLength(3);
    stop();
  });

  it("sends the QR again after the payment fails and the modal returns", async () => {
    const document = page(qrScreen);
    const sent: string[] = [];
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 20,
      now: () => Date.parse("2026-10-01T12:00:00.000Z"),
      send: (message) => {
        if (message.type === "QR_OBSERVED") sent.push(message.payload.qrFingerprint);
        return { ok: true as const };
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(sent).toHaveLength(1);
    document.body.innerHTML = "<h1>Transaction wasn't completed</h1>";
    document.body.setAttribute("data-step", "failed");
    await new Promise((resolve) => setTimeout(resolve, 80));
    document.body.innerHTML = qrScreen;
    document.body.setAttribute("data-step", "reopened");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(sent).toHaveLength(2);
    stop();
  });

  it("stops after the extension is reloaded", async () => {
    const document = page("<h1>Google Cloud</h1>");
    let calls = 0;
    const stop = startGoogleCloudObserver({
      document,
      debounceMs: 20,
      send: () => {
        calls += 1;
        throw new Error("Extension context invalidated.");
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    const stoppedAt = calls;
    document.body.setAttribute("data-step", "later");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(stoppedAt).toBeGreaterThan(0);
    expect(calls).toBe(stoppedAt);
    stop();
  });
});

describe("debounce", () => {
  it("runs once after a burst", () => {
    vi.useFakeTimers();
    let calls = 0;
    const debounced = debounce(() => {
      calls += 1;
    }, 200);
    debounced.call();
    debounced.call();
    debounced.call();
    vi.advanceTimersByTime(199);
    expect(calls).toBe(0);
    vi.advanceTimersByTime(1);
    expect(calls).toBe(1);
    vi.useRealTimers();
  });
});

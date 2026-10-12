import { PaymentStreamEvent } from "../types/payment.types";

export interface SseMessage {
  event: string;
  data: string;
}

export function nextReconnectDelay(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** Math.max(0, attempt - 1));
}

export function parseSseBuffer(buffer: string): { events: SseMessage[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: SseMessage[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith(":")) {
        continue;
      }
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
  }

  return { events, rest };
}

export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: PaymentStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;
    for (const message of parsed.events) {
      onEvent({ type: message.event, data: JSON.parse(message.data) } as PaymentStreamEvent);
    }
  }
}

export async function runPaymentEventLoop(options: {
  open: () => Promise<Response>;
  onEvent: (event: PaymentStreamEvent) => void;
  signal: AbortSignal;
  sleep: (ms: number) => Promise<void>;
}): Promise<void> {
  let attempt = 0;
  while (!options.signal.aborted) {
    try {
      const response = await options.open();
      if (!response.ok || !response.body) {
        throw new Error("Unable to subscribe to payment events");
      }
      attempt = 0;
      await readSseStream(response.body, options.onEvent);
    } catch {
      if (options.signal.aborted) {
        return;
      }
    }
    if (options.signal.aborted) {
      return;
    }
    attempt += 1;
    await options.sleep(nextReconnectDelay(attempt));
  }
}

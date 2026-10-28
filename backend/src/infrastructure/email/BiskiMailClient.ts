import { logger } from "../../shared/logger/logger";

export interface MailVerifyClient {
  verifyAddress(address: string): Promise<void>;
}

export function createBiskiMailClient(origin: string, pin: string, fetchImpl: typeof fetch = fetch): MailVerifyClient {
  const base = String(origin || "").replace(/\/$/, "");
  const secret = String(pin || "").trim();

  return {
    async verifyAddress(address: string) {
      const email = String(address || "").trim().toLowerCase();
      if (!base || !secret || !email) {
        return;
      }
      const response = await fetchImpl(base + "/api/pool/verify-by-address", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Admin-Pin": secret,
        },
        body: JSON.stringify({ address: email }),
      });
      if (response.ok || response.status === 404) {
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Could not verify mailbox");
    },
  };
}

export async function verifyMailboxQuietly(client: MailVerifyClient | undefined, address: string | undefined) {
  const email = String(address || "").trim().toLowerCase();
  if (!client || !email) {
    return;
  }
  try {
    await client.verifyAddress(email);
  } catch (error) {
    logger.error("mailbox verify failed", {
      address: email,
      message: error instanceof Error ? error.message : "Error",
    });
  }
}

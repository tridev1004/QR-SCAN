import { logger } from "../../shared/logger/logger";

export interface MailVerifyClient {
  verifyAddress(address: string): Promise<void>;
}

export function createBiskiMailClient(origin: string, pin: string, fetchImpl: typeof fetch = fetch): MailVerifyClient {
  const base = String(origin || "").replace(/\/$/, "");
  const secret = String(pin || "").trim();
  const enabled = Boolean(base && secret);

  if (!enabled) {
    logger.warn("biski mail verify disabled", {
      reason: !base ? "BISKI_OTP_ORIGIN missing" : "BISKI_ADMIN_PIN missing",
      origin: base || null,
    });
  } else {
    logger.info("biski mail verify enabled", { origin: base });
  }

  return {
    async verifyAddress(address: string) {
      const email = String(address || "").trim().toLowerCase();
      if (!email) {
        return;
      }
      if (!enabled) {
        logger.warn("biski mail verify skipped", {
          address: email,
          reason: "BISKI_ADMIN_PIN or BISKI_OTP_ORIGIN not configured on this server",
        });
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
      if (response.ok) {
        logger.info("biski mail verified", { address: email });
        return;
      }
      if (response.status === 404) {
        logger.info("biski mail verify skipped", {
          address: email,
          reason: "address not in biski pool",
        });
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Could not verify mailbox (${response.status})`);
    },
  };
}

export async function verifyMailboxQuietly(client: MailVerifyClient | undefined, address: string | undefined) {
  const email = String(address || "").trim().toLowerCase();
  if (!client) {
    return;
  }
  if (!email) {
    logger.warn("biski mail verify skipped", { reason: "payment has no accountEmail" });
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

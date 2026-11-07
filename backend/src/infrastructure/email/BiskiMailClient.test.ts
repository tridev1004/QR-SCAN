import { describe, expect, it, vi } from "vitest";
import { createBiskiMailClient, verifyMailboxQuietly } from "./BiskiMailClient";

describe("BiskiMailClient", () => {
  it("does not call Biski when the admin pin is empty", async () => {
    const fetchImpl = vi.fn();
    const client = createBiskiMailClient("https://biski-otp.example", "", fetchImpl as unknown as typeof fetch);
    await client.verifyAddress("one@biski.org");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts verify-by-address with the admin pin", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createBiskiMailClient("https://biski-otp.example/", "biski-admin", fetchImpl as unknown as typeof fetch);
    await client.verifyAddress(" One@Biski.org ");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://biski-otp.example/api/pool/verify-by-address",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Admin-Pin": "biski-admin" }),
        body: JSON.stringify({ address: "one@biski.org" }),
      }),
    );
  });

  it("skips quietly when the payment has no account email", async () => {
    const verifyAddress = vi.fn();
    await verifyMailboxQuietly({ verifyAddress }, "");
    expect(verifyAddress).not.toHaveBeenCalled();
  });
});

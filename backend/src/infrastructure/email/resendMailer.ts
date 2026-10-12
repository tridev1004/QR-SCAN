import { logger } from "../../shared/logger/logger";
import { verificationEmailHtml } from "./verificationEmail";
import { Mailer, VerificationEmail } from "./Mailer";

export function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async sendVerification(message: VerificationEmail) {
      if (!apiKey) {
        throw new Error("Email verification is not configured");
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: "Confirm your UPI QR Monitor account",
          html: verificationEmailHtml(message.name, message.verifyUrl),
        }),
      });
      if (!response.ok) {
        logger.error("verification email failed", { status: response.status });
        throw new Error("Could not send the verification email");
      }
    },
  };
}

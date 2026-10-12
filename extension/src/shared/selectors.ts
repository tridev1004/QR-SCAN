/**
 * The only place that knows how the Google Cloud UPI screen is marked up.
 * Update these values when Google changes the QR DOM. Do not add generated ids or classes.
 *
 * An indicator is either a CSS selector or the prefix "text:" plus visible text.
 * Success is the heading shown after the UPI prepayment is accepted.
 * Failure is the heading shown when Google cancels the payment.
 */
export const googleCloudSelectors = {
  qrImage: 'img[alt="QR code"][src^="data:image/png;base64,"]',
  timer: '[role="timer"]',
  qrHeadingText: "Scan QR code to use UPI",
  successIndicators: ["text:One-time prepayment required"] as readonly string[],
  failureIndicators: ["text:Transaction wasn't completed"] as readonly string[],
  expiredIndicators: [] as readonly string[],
} as const;

export function PaymentQr({ src }: { src?: string | null }) {
  if (!src) {
    return <p className="muted">QR is no longer available</p>;
  }
  return <img className="qr-image" src={src} alt="UPI QR code" />;
}

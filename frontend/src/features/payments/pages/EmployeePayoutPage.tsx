import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { paymentApi } from "../api/paymentApi";

const UPI_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function EmployeePayoutPage() {
  const [upiId, setUpiId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);
  const [savingQr, setSavingQr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    paymentApi
      .ownPayout()
      .then((result) => {
        if (cancelled) return;
        setUpiId(result.upiId ?? "");
        setPreview(result.qrImage);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load your payout details");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveUpi() {
    const next = upiId.trim();
    setError("");
    setMessage("");
    if (next && !UPI_PATTERN.test(next)) {
      setError("Enter a UPI ID like name@bank.");
      return;
    }
    setSavingUpi(true);
    try {
      await paymentApi.saveUpiId(next);
      setUpiId(next);
      setMessage(next ? "UPI ID saved." : "UPI ID cleared.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the UPI ID");
    } finally {
      setSavingUpi(false);
    }
  }

  async function onFile(file: File | undefined) {
    setError("");
    setMessage("");
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setError("Upload a PNG or JPEG image.");
      return;
    }
    if (file.size > 280_000) {
      setError("Use an image under 280 KB.");
      return;
    }
    const qrImage = await readFile(file);
    setSavingQr(true);
    try {
      await paymentApi.uploadPayoutQr(qrImage);
      setPreview(qrImage);
      setMessage("Payment QR saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the QR");
    } finally {
      setSavingQr(false);
    }
  }

  return (
    <section className="max-w-lg">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Employee</p>
          <h1>Payout</h1>
          <p className="muted">Add the UPI ID or QR the admin should pay.</p>
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <label className="grid gap-1 text-sm text-muted-foreground">
          UPI ID
          <input
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            value={upiId}
            placeholder="name@bank"
            autoComplete="off"
            onChange={(event) => setUpiId(event.target.value)}
          />
        </label>
        <Button type="button" disabled={savingUpi} onClick={() => void saveUpi()}>
          {savingUpi ? "Saving…" : "Save UPI ID"}
        </Button>
        <label className="block cursor-pointer">
          <input className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => void onFile(event.target.files?.[0])} />
          <span className={cn(buttonVariants({ variant: "outline" }), "w-full")}>{savingQr ? "Saving…" : preview ? "Replace QR" : "Upload QR"}</span>
        </label>
        {preview ? <img className="w-full max-w-sm rounded-lg border border-border bg-white object-contain" alt="Your payment QR" src={preview} /> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });
}

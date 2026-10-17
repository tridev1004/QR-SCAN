import { useState } from "react";
import { Button } from "@/components/ui/button";
import { paymentApi } from "../api/paymentApi";
import { useBroadcasts } from "../hooks/useBroadcasts";

const PRESETS = [
  { id: "5", label: "5 min", minutes: 5 },
  { id: "15", label: "15 min", minutes: 15 },
  { id: "120", label: "2 hours", minutes: 120 },
  { id: "360", label: "6 hours", minutes: 360 },
  { id: "custom", label: "Custom", minutes: 0 },
];

export function AdminBroadcastsPage() {
  const broadcasts = useBroadcasts();
  const [message, setMessage] = useState("");
  const [preset, setPreset] = useState("5");
  const [customMinutes, setCustomMinutes] = useState("30");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const durationMinutes = preset === "custom" ? Number(customMinutes) : Number(preset);
    if (!message.trim()) {
      setError("Write the message employees should see.");
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 7 * 24 * 60) {
      setError("Enter a whole number of minutes, up to 7 days.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await paymentApi.sendBroadcast({ message: message.trim(), durationMinutes });
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the broadcast");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Broadcast</h1>
          <p className="muted">Employees see this message on their dashboard until the time you choose runs out.</p>
        </div>
      </div>
      <form
        className="mb-6 grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="grid gap-1 text-sm text-muted-foreground">
          Message
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <Button key={item.id} type="button" variant={preset === item.id ? "default" : "outline"} onClick={() => setPreset(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
        {preset === "custom" ? (
          <label className="grid max-w-40 gap-1 text-sm text-muted-foreground">
            Minutes
            <input
              className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
              inputMode="numeric"
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
            />
          </label>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={busy} className="w-fit">
          {busy ? "Sending…" : "Send broadcast"}
        </Button>
      </form>
      <h2 className="mb-3 text-sm font-medium text-foreground">Showing now</h2>
      {broadcasts.length === 0 ? <p className="muted">No broadcast is showing.</p> : null}
      <div className="grid gap-3">
        {broadcasts.map((item) => (
          <article key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{item.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">Until {formatUntil(item.expiresAt)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void paymentApi.stopBroadcast(item.id).catch((caught: unknown) => {
                  setError(caught instanceof Error ? caught.message : "Could not stop the broadcast");
                });
              }}
            >
              Stop
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatUntil(value: string): string {
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });
}

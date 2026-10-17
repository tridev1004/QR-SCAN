import { useEffect, useState } from "react";
import { EmployeeQrBoard } from "../components/EmployeeQrBoard";
import { HindiText } from "../components/HindiText";
import { isTerminal } from "../types/payment.types";
import { ListPager } from "../components/ListPager";
import { useBroadcasts } from "../hooks/useBroadcasts";
import { usePayments } from "../hooks/usePayments";

const PAGE_SIZE = 8;

export function EmployeePaymentsPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const broadcasts = useBroadcasts();
  const { live, payments, earnings, cooldownUntil, total, hasMore, loading, error, reserve } = usePayments("employee", {
    limit: PAGE_SIZE,
    offset,
    q: q || undefined,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setQ(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Employee</p>
          <h1>Your QRs</h1>
          <p className="muted">New QRs show up here as soon as they are sent. Earnings count every passed QR.</p>
        </div>
      </div>
      {broadcasts.map((item) => (
        <p key={item.id} className="mb-3 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em]">Broadcast</span>
          <span className="whitespace-pre-wrap">{item.message}</span>
          <span className="mt-1 block text-xs text-sky-800">Showing until {new Date(item.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</span>
        </p>
      ))}
      {cooldownUntil ? (
        <HindiText
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          english={`Your account is paused until ${new Date(cooldownUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} after two failed or expired QRs in a row. You will not receive new QRs until then.`}
          hindi={`लगातार दो फेल या एक्सपायर QR के बाद आपका खाता ${new Date(cooldownUntil).toLocaleString("hi-IN", { timeZone: "Asia/Kolkata" })} तक रुका हुआ है। तब तक आपको नए QR नहीं मिलेंगे।`}
        />
      ) : (
        <HindiText
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          english="If two QRs fail or expire in a row, your account is paused for 3 hours and you will not receive new QRs during that time."
          hindi="अगर लगातार दो QR फेल या एक्सपायर होते हैं, तो आपका खाता 3 घंटे के लिए रोक दिया जाएगा और उस दौरान आपको नए QR नहीं मिलेंगे।"
        />
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {earnings || live.length > 0 ? (
        <EmployeeQrBoard
          live={cooldownUntil ? live.filter((payment) => Boolean(payment.assignedEmployeeId)) : live}
          history={payments}
          earnings={
            earnings ?? { successRewardInr: 0, passedCount: 0, failedCount: 0, earnedInr: 0 }
          }
          onReserve={reserve}
          reserveLocked={live.filter((payment) => payment.assignedEmployeeId && !isTerminal(payment.status)).length >= 2}
          historyControls={
            <label className="mt-4 grid max-w-xs gap-1 text-sm text-muted-foreground">
              Search past QRs
              <input
                className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
                value={search}
                placeholder="Session code"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          }
        />
      ) : loading ? (
        <p>Loading QR codes…</p>
      ) : null}
      {earnings ? (
      <ListPager
        offset={offset}
        count={payments.length}
        total={total}
        hasMore={hasMore}
        onPrevious={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
        onNext={() => setOffset((current) => current + PAGE_SIZE)}
      />
      ) : null}
    </section>
  );
}

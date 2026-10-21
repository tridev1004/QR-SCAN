import { FormEvent, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { paymentApi } from "../payments/api/paymentApi";

export function AdminCreateEmployeePage() {
  const { onEmployeeCreated } = useOutletContext<{ onEmployeeCreated?: () => void }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "EXTENSION_USER" | "PAYER" | "SESSION_VIEWER">("EMPLOYEE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await paymentApi.createEmployee({ name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("EMPLOYEE");
      setNotice(createdNotice(role));
      onEmployeeCreated?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-lg">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>New account</h1>
          <p className="muted">Employees use the dashboard. Extension users sign in from the extension. Payer and Session viewer sign in on the admin page, with only Payouts or Sessions.</p>
        </div>
      </div>
      <form className="grid gap-3 rounded-xl border border-border bg-card p-4" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Role
          <select
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            value={role}
            onChange={(event) => setRole(event.target.value as "EMPLOYEE" | "EXTENSION_USER" | "PAYER" | "SESSION_VIEWER")}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="EXTENSION_USER">Extension user</option>
            <option value="PAYER">Payer</option>
            <option value="SESSION_VIEWER">Session viewer</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Name
          <input
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            value={name}
            autoComplete="off"
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Email
          <input
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            type="email"
            value={email}
            autoComplete="off"
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Password
          <input
            className="h-9 rounded-lg border border-input bg-background px-2 text-foreground"
            type="password"
            minLength={6}
            value={password}
            autoComplete="new-password"
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Add employee"}
        </Button>
      </form>
    </section>
  );
}

function createdNotice(role: "EMPLOYEE" | "EXTENSION_USER" | "PAYER" | "SESSION_VIEWER"): string {
  if (role === "EXTENSION_USER") return "Extension user created. They sign in from the extension.";
  if (role === "PAYER") return "Payer created. They sign in on the admin page and only see Payouts.";
  if (role === "SESSION_VIEWER") return "Session viewer created. They sign in on the admin page and only see Sessions.";
  return "Employee created. They start at ₹40 per passed QR.";
}

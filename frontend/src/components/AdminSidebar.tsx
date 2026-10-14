import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { LogOut, QrCode, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { paymentApi } from "../features/payments/api/paymentApi";

export function AdminSidebar({
  name,
  onSignOut,
  onEmployeeCreated,
}: {
  name: string;
  onSignOut: () => void;
  onEmployeeCreated?: () => void;
}) {
  const onEmployees = useLocation().pathname.startsWith("/admin/users");

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-card px-3 py-4",
        onEmployees ? "w-72" : "w-60",
      )}
    >
      <div className="px-2 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">UPI QR</p>
        <p className="text-lg font-semibold text-foreground">Monitor</p>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Admin">
        <SidebarLink to="/admin/users" end icon={<Users />}>
          Employees
        </SidebarLink>
        <SidebarLink to="/admin/payments" icon={<QrCode />}>
          Sessions
        </SidebarLink>
      </nav>
      {onEmployees ? (
        <CreateEmployeeForm onCreated={onEmployeeCreated} />
      ) : (
        <div className="flex-1" />
      )}
      <div className="mt-4 border-t border-border pt-3">
        <p className="truncate px-2 pb-2 text-sm text-muted-foreground">{name}</p>
        <button type="button" className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")} onClick={onSignOut}>
          <LogOut />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function CreateEmployeeForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await paymentApi.createEmployee({ name, email, password });
      setName("");
      setEmail("");
      setPassword("");
      setNotice("Employee created");
      onCreated?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="mt-4 grid flex-1 content-start gap-2 overflow-y-auto border-t border-border pt-4" onSubmit={onSubmit}>
      <p className="px-1 text-sm font-medium text-foreground">New employee</p>
      <p className="px-1 text-xs text-muted-foreground">Starts at ₹40 per passed QR.</p>
      <label className="grid gap-1 px-1 text-xs text-muted-foreground">
        Name
        <input
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          value={name}
          autoComplete="off"
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid gap-1 px-1 text-xs text-muted-foreground">
        Email
        <input
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          type="email"
          value={email}
          autoComplete="off"
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="grid gap-1 px-1 text-xs text-muted-foreground">
        Password
        <input
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          type="password"
          minLength={6}
          value={password}
          autoComplete="new-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {notice ? <p className="px-1 text-xs text-muted-foreground">{notice}</p> : null}
      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving} className="mx-1">
        {saving ? "Creating…" : "Add employee"}
      </Button>
    </form>
  );
}

function SidebarLink({
  to,
  end,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      data-slot="button"
      className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "secondary" : "ghost" }), "justify-start")}
    >
      {icon}
      {children}
    </NavLink>
  );
}

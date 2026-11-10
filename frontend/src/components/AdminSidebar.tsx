import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Activity, BarChart3, IndianRupee, LogOut, Megaphone, MonitorSmartphone, QrCode, UserPlus, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { UserRole } from "../auth/AuthContext";
import { api } from "../api/client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminSidebar({
  name,
  role,
  onSignOut,
}: {
  name: string;
  role: UserRole;
  onSignOut: () => void;
}) {
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const links: Array<{ to: string; end?: boolean; icon: ReactNode; label: string; badge?: number | null }> =
    role === "PAYER"
      ? [{ to: "/admin/payouts", icon: <IndianRupee />, label: "Payouts" }]
      : role === "SESSION_VIEWER"
        ? [{ to: "/admin/payments", icon: <QrCode />, label: "Sessions" }]
        : [
            { to: "/admin/users", end: true, icon: <Users />, label: "Employees" },
            { to: "/admin/users/new", icon: <UserPlus />, label: "New employee" },
            { to: "/admin/payments", icon: <QrCode />, label: "Sessions" },
            { to: "/admin/payouts", icon: <IndianRupee />, label: "Payouts" },
            { to: "/admin/extensions", icon: <MonitorSmartphone />, label: "Extensions" },
            { to: "/admin/statistics", icon: <BarChart3 />, label: "Statistics" },
            { to: "/admin/active", icon: <Activity />, label: "Active now", badge: activeCount },
            { to: "/admin/broadcasts", icon: <Megaphone />, label: "Broadcast" },
          ];

  useEffect(() => {
    if (role !== "ADMIN") {
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const result = await api<{ employeeCount: number }>("/api/admin/presence");
        if (!cancelled) {
          setActiveCount(result.employeeCount);
        }
      } catch {
        if (!cancelled) {
          setActiveCount(null);
        }
      }
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role]);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-4">
      <div className="px-2 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">QRSCAN</p>
        <p className="text-lg font-semibold text-foreground">Admin</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
        {links.map((link) => (
          <SidebarLink key={link.to} to={link.to} end={link.end} icon={link.icon} badge={link.badge}>
            {link.label}
          </SidebarLink>
        ))}
      </nav>
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

function SidebarLink({
  to,
  end,
  icon,
  children,
  badge,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: string;
  badge?: number | null;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      data-slot="button"
      className={({ isActive }) =>
        cn(buttonVariants({ variant: isActive ? "secondary" : "ghost" }), "justify-start gap-2")
      }
    >
      {icon}
      <span className="flex-1 text-left">{children}</span>
      {typeof badge === "number" ? (
        <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

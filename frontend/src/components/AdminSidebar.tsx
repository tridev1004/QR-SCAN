import type { ReactNode } from "react";
import { IndianRupee, LogOut, QrCode, UserPlus, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminSidebar({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-4">
      <div className="px-2 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">UPI QR</p>
        <p className="text-lg font-semibold text-foreground">Monitor</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
        <SidebarLink to="/admin/users" end icon={<Users />}>
          Employees
        </SidebarLink>
        <SidebarLink to="/admin/users/new" icon={<UserPlus />}>
          New employee
        </SidebarLink>
        <SidebarLink to="/admin/payments" icon={<QrCode />}>
          Sessions
        </SidebarLink>
        <SidebarLink to="/admin/payouts" icon={<IndianRupee />}>
          Payouts
        </SidebarLink>
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

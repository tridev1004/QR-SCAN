import { useState, type ReactNode } from "react";
import { IndianRupee, LogOut, Menu, QrCode, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmployeeSidebar({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 md:hidden">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">UPI QR</p>
          <p className="truncate text-sm font-semibold text-foreground">Monitor</p>
        </div>
        <button
          type="button"
          data-slot="button"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open ? <button type="button" className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-border bg-card px-3 py-4 transition-transform md:sticky md:top-0 md:z-0 md:h-screen md:w-60 md:max-w-none md:translate-x-0 md:shrink-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="hidden px-2 pb-5 md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">UPI QR</p>
          <p className="text-lg font-semibold text-foreground">Monitor</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Employee">
          <SidebarLink to="/dashboard" icon={<QrCode />} onNavigate={() => setOpen(false)}>
            My sessions
          </SidebarLink>
          <SidebarLink to="/payout" icon={<IndianRupee />} onNavigate={() => setOpen(false)}>
            Payout
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
    </>
  );
}

function SidebarLink({
  to,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: ReactNode;
  children: string;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      data-slot="button"
      onClick={onNavigate}
      className={({ isActive }) => cn(buttonVariants({ variant: isActive ? "secondary" : "ghost" }), "justify-start")}
    >
      {icon}
      {children}
    </NavLink>
  );
}

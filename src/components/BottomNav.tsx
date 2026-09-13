import { Link, useRouterState } from "@tanstack/react-router";
import { Layers, Wallet } from "lucide-react";

const items = [
  { to: "/", label: "Stake", Icon: Layers },
  { to: "/wallet", label: "Wallet", Icon: Wallet },
] as const;

export default function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="ios-tabbar safe-bottom fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-4 pt-2 pb-2">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className="tap-scale flex flex-1 flex-col items-center gap-1 rounded-xl py-1"
            >
              <Icon
                className={
                  active
                     ? "h-5 w-5 text-primary"
                     : "h-5 w-5 text-muted-foreground"
                }
                strokeWidth={active ? 2.1 : 1.7}
              />
              <span
                className={
                  active
                    ? "text-[11px] font-medium text-primary"
                    : "text-[11px] font-medium text-muted-foreground"
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

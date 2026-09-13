import { Link, useRouterState } from "@tanstack/react-router";
import { CircleDollarSign, CreditCard } from "lucide-react";

const items = [
  { to: "/", label: "Stake", Icon: CircleDollarSign },
  { to: "/wallet", label: "Wallet", Icon: CreditCard },
] as const;

export default function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-4 pb-2">
      <div className="ios-tabbar mx-auto flex max-w-sm items-stretch justify-around rounded-[26px] p-1.5">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={active ? "nav-item nav-item-active" : "nav-item"}
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

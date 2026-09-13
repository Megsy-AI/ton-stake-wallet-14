import { Link, useRouterState } from "@tanstack/react-router";
import { ChartNoAxesCombined, CircleDollarSign, WalletMinimal } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/", label: "Stake", Icon: CircleDollarSign },
  { to: "/trading", label: "AI Trade", Icon: ChartNoAxesCombined },
  { to: "/wallet", label: "Wallet", Icon: WalletMinimal },
] as const;

export default function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-5 pb-3">
      <div className="ios-tabbar mx-auto flex max-w-sm items-stretch rounded-[24px] p-1.5">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={active ? "nav-item nav-item-active" : "nav-item text-muted-foreground"}
            >
              {active ? (
                <motion.span
                  layoutId="active-nav"
                  className="absolute inset-0 -z-10 rounded-[18px] bg-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon
                className={
                  active
                     ? "h-[19px] w-[19px] text-primary-foreground"
                       : "h-[19px] w-[19px] text-muted-foreground"
                }
                strokeWidth={active ? 2.1 : 1.7}
              />
              <span
                className={
                  active
                    ? "text-[11px] font-semibold text-primary-foreground"
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

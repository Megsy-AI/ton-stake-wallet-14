import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { Toaster } from "@/components/ui/sonner";
import BottomNav from "@/components/BottomNav";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const TONCONNECT_MANIFEST =
  "https://project--7dc6fd40-9d95-4c66-b704-d5545481c4ac-dev.lovable.app/api/public/tonconnect-manifest";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-lg font-medium text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="tap-scale inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Go to staking
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tap-scale inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { title: "EGRAM" },
      { name: "description", content: "Stake TON-network assets and track confirmed positions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js", async: true }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);

  useEffect(() => {
    setManifestUrl(TONCONNECT_MANIFEST);
    const tg = (window as unknown as { Telegram?: { WebApp?: Record<string, unknown> } }).Telegram
      ?.WebApp as
      | { ready?: () => void; expand?: () => void; setHeaderColor?: (c: string) => void }
      | undefined;
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  const content = (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen pb-24">
        {/* Required: nested routes render here. */}
        <Outlet />
      </div>
      <BottomNav />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );

  if (!manifestUrl) return content;

  return <TonConnectUIProvider manifestUrl={manifestUrl}>{content}</TonConnectUIProvider>;
}

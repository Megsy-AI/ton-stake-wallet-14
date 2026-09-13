import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tonconnect-manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.searchParams.get("origin") || url.origin;
        return new Response(
          JSON.stringify({
            url: origin,
            name: "Gram Staking",
            iconUrl: `${origin}/favicon.png`,
            termsOfUseUrl: origin,
            privacyPolicyUrl: origin,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=60",
            },
          },
        );
      },
    },
  },
});

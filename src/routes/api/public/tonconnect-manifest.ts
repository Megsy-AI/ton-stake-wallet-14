import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_ORIGIN =
  "https://project--7dc6fd40-9d95-4c66-b704-d5545481c4ac-dev.lovable.app";
const ICON_URL =
  "https://project--7dc6fd40-9d95-4c66-b704-d5545481c4ac-dev.lovable.app/__l5e/assets-v1/3f60f578-cc9d-417a-bf12-9a11158da1bb/gram.png";

export const Route = createFileRoute("/api/public/tonconnect-manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.hostname === "localhost" ? url.origin : PUBLIC_ORIGIN;
        return new Response(
          JSON.stringify({
            url: origin,
            name: "EGRAM",
            iconUrl: ICON_URL,
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

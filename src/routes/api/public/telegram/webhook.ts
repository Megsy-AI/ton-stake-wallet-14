import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://t.me/Rielmbot/app";
const COMMUNITY_URL = "https://t.me/goacco";

const WELCOME = [
  "Welcome to EGRAM.",
  "",
  "Stake GRAM, TON, USDT and NOT on the TON network and earn a tiered yearly rate that grows with your amount, from 12% up to 45%.",
  "",
  "Connect your TON wallet, choose an amount, and your position starts immediately.",
].join("\n");

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("Not configured", { status: 500 });

        const update = (await request.json()) as {
          message?: { chat?: { id?: number }; text?: string };
        };
        const chatId = update.message?.chat?.id;
        const text = update.message?.text ?? "";
        if (!chatId) return Response.json({ ok: true });

        const send = (body: string) =>
          fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: body,
              reply_markup: {
                inline_keyboard: [[{ text: "Open EGRAM", url: APP_URL }]],
              },
            }),
          });

        if (text.startsWith("/stake")) {
          await send(
            [
              "Staking tiers",
              "",
              "Core: 1 - 49 TON, 12% per year, 30 days",
              "Plus: 50 - 199 TON, 18% per year, 60 days",
              "Prime: 200 - 999 TON, 26% per year, 90 days",
              "Elite: 1,000 - 4,999 TON, 34% per year, 120 days",
              "Titan: 5,000+ TON, 45% per year, 180 days",
            ].join("\n"),
          );
          return Response.json({ ok: true });
        }

        if (text.startsWith("/wallet")) {
          await send("Open the app to see your wallet, positions and rewards.");
          return Response.json({ ok: true });
        }

        if (text.startsWith("/start")) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: WELCOME,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Open EGRAM", url: APP_URL }],
                  [{ text: "Community", url: COMMUNITY_URL }],
                ],
              },
            }),
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

const APP_URL = "https://t.me/Rielmbot/app";
const COMMUNITY_URL = "https://t.me/goacco";

const WELCOME = [
  "Welcome to Gram Staking.",
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

        if (text.startsWith("/start")) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: WELCOME,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Open Gram Staking", url: APP_URL }],
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

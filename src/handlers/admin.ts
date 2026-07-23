import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getOwnerSettings,
  updateOwnerSettings,
  getAllContributions,
  toCsv,
  getTotalPoolBalance,
} from "../storage.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "⚙️ Admin", data: "admin:panel", order: 50 });

function isAdmin(ctx: Ctx): boolean {
  if (!ctx.from) return false;
  const adminId = process.env.ADMIN_CHAT_ID;
  if (!adminId) return true; // No admin restriction in dev
  return ctx.from.id === Number(adminId);
}

const composer = new Composer<Ctx>();

// /admin command entry
composer.command("admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("You don't have permission to access admin controls.");
    return;
  }
  ctx.session.step = "idle";
  await showAdminPanel(ctx);
});

// Admin panel via menu button
composer.callbackQuery("admin:panel", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isAdmin(ctx)) {
    await ctx.reply("You don't have permission to access admin controls.");
    return;
  }
  ctx.session.step = "idle";
  await showAdminPanel(ctx);
});

async function showAdminPanel(ctx: Ctx) {
  const settings = await getOwnerSettings();
  const { total, currencies } = await getTotalPoolBalance();
  const contributions = await getAllContributions();

  const currencyBreakdown = Object.entries(currencies)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `  ${c}: ${v}`)
    .join("\n");

  const addressDisplay = settings.destination_address || "Not set";
  const supportedDisplay = settings.supported_currencies.join(", ");

  const lines = [
    "Admin Panel",
    "",
    `Pool balance: ${total}${currencyBreakdown ? "\n" + currencyBreakdown : ""}`,
    `Total contributions: ${contributions.length}`,
    "",
    `Destination: ${addressDisplay}`,
    `Currencies: ${supportedDisplay}`,
    "",
    "What would you like to do?",
  ];

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("Set address", "admin:set_address"), inlineButton("Set currencies", "admin:set_currencies")],
      [inlineButton("Export CSV", "admin:csv"), inlineButton("Back to menu", "menu:main")],
    ]),
  });
}

// Set address flow
composer.callbackQuery("admin:set_address", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "admin:set_address";
  await ctx.reply("Send me the new destination wallet address:");
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "admin:set_address") return next();
  const address = ctx.message.text.trim();
  if (address.length < 5) {
    await ctx.reply("That doesn't look like a valid address. Please try again:");
    return;
  }
  await updateOwnerSettings({ destination_address: address });
  ctx.session.step = "idle";
  await ctx.reply(`Destination address updated to:\n${address}`, {
    reply_markup: inlineKeyboard([[inlineButton("Back to admin", "admin:panel")]]),
  });
});

// Set currencies flow
composer.callbackQuery("admin:set_currencies", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "admin:set_currency";
  const settings = await getOwnerSettings();
  await ctx.reply(
    `Current currencies: ${settings.supported_currencies.join(", ")}\n\nSend me the new comma-separated list (e.g. ETH, USDT, USDC):`,
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "admin:set_currency") return next();
  const input = ctx.message.text.trim();
  const currencies = input.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (currencies.length === 0) {
    await ctx.reply("Please provide at least one currency:");
    return;
  }
  await updateOwnerSettings({ supported_currencies: currencies });
  ctx.session.step = "idle";
  await ctx.reply(`Currencies updated to: ${currencies.join(", ")}`, {
    reply_markup: inlineKeyboard([[inlineButton("Back to admin", "admin:panel")]]),
  });
});

// CSV export
composer.callbackQuery("admin:csv", async (ctx) => {
  await ctx.answerCallbackQuery();
  const contributions = await getAllContributions();

  if (contributions.length === 0) {
    await ctx.reply("No contributions to export yet.", {
      reply_markup: inlineKeyboard([[inlineButton("Back to admin", "admin:panel")]]),
    });
    return;
  }

  const csv = toCsv(contributions);
  await ctx.reply(`CSV Export (${contributions.length} contributions):\n\n\`\`\`\n${csv}\n\`\`\``, {
    parse_mode: "Markdown",
    reply_markup: inlineKeyboard([[inlineButton("Back to admin", "admin:panel")]]),
  });
});

export default composer;

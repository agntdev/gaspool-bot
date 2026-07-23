import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getTotalPoolBalance } from "../storage.js";

// Register main menu items for each feature
registerMainMenuItem({ label: "💰 Contribute", data: "contribute:start", order: 10 });
registerMainMenuItem({ label: "📊 My Balance", data: "balance:view", order: 20 });

const WELCOME = "Welcome to the Gas Pool! Tap a button below to get started.";

function formatWelcomeSummary(total: number, currencies: Record<string, number>): string {
  const lines = [WELCOME];
  if (total > 0) {
    const parts = Object.entries(currencies)
      .filter(([, v]) => v > 0)
      .map(([c, v]) => `${v} ${c}`);
    lines.push(`\nPool balance: ${total.toFixed(2)} (${parts.join(", ")})`);
  } else {
    lines.push("\nNo contributions yet — tap Contribute to be the first.");
  }
  return lines.join("\n");
}

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  ctx.session.step = "idle";
  const { total, currencies } = await getTotalPoolBalance();
  await ctx.reply(formatWelcomeSummary(total, currencies), {
    reply_markup: mainMenuKeyboard(),
  });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  const { total, currencies } = await getTotalPoolBalance();
  await ctx.editMessageText(formatWelcomeSummary(total, currencies), {
    reply_markup: mainMenuKeyboard(),
  });
});

export default composer;

import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUserContributions, getUserTotalContribution } from "../storage.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("balance:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id;
  const contributions = await getUserContributions(userId);
  const total = await getUserTotalContribution(userId);

  if (contributions.length === 0) {
    await ctx.reply("No contributions yet. Tap Contribute to send your first payment.", {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
    return;
  }

  const lines = [`Your contributions: ${total.toFixed(2)}\n`];
  for (const c of contributions.slice(-10)) {
    const date = new Date(c.timestamp).toLocaleDateString();
    lines.push(`• ${c.amount} ${c.currency} on ${date}`);
  }
  if (contributions.length > 10) {
    lines.push(`\nShowing last 10 of ${contributions.length} contributions.`);
  }

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

export default composer;

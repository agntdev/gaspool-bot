import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const HELP =
  "This bot tracks contributions to a shared gas pool.\n\n" +
  "Tap /start to open the menu, then pick what you want from the buttons:\n\n" +
  "• Contribute — send crypto to the pool\n" +
  "• My Balance — see your contribution history\n" +
  "• Admin — manage the pool (owner only)";

const backToMenu = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP);
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { reply_markup: backToMenu });
});

export default composer;

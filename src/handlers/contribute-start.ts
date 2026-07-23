import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getOwnerSettings,
  setPayer,
  getPayer,
  addContribution,
  trackContributionId,
} from "../storage.js";

const composer = new Composer<Ctx>();

// Entry: show destination address and supported currencies
composer.callbackQuery("contribute:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  const settings = await getOwnerSettings();
  const currencies = settings.supported_currencies.join(", ");

  if (!settings.destination_address) {
    await ctx.reply("No destination address configured yet. Ask the pool owner to set one via Admin.", {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.step = "contribute:awaiting_amount";
  await ctx.reply(
    `Send your contribution to:\n\n${settings.destination_address}\n\nSupported currencies: ${currencies}\n\nHow much did you send? Enter the amount (e.g. 0.5).`,
    {
      reply_markup: inlineKeyboard([[inlineButton("Cancel", "contribute:cancel")]]),
    },
  );
});

// Cancel contribution flow
composer.callbackQuery("contribute:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  ctx.session.contribute = undefined;
  await ctx.editMessageText("Contribution cancelled.", {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

// Handle amount input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "contribute:awaiting_amount") return next();

  const text = ctx.message.text.trim();
  const amount = parseFloat(text);
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("Please enter a valid positive number (e.g. 0.5).");
    return;
  }

  ctx.session.contribute = { amount };
  ctx.session.step = "contribute:awaiting_currency";

  const settings = await getOwnerSettings();
  const buttons = settings.supported_currencies.map((c) => [
    inlineButton(c, `contribute:currency:${c}`),
  ]);
  buttons.push([inlineButton("Cancel", "contribute:cancel")]);

  await ctx.reply(`Amount: ${amount}. Which currency did you send?`, {
    reply_markup: inlineKeyboard(buttons),
  });
});

// Handle currency selection
composer.callbackQuery(/^contribute:currency:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const currency = ctx.match[1];
  const settings = await getOwnerSettings();

  if (!settings.supported_currencies.includes(currency)) {
    await ctx.reply(`Unsupported currency. Use one of: ${settings.supported_currencies.join(", ")}`);
    return;
  }

  if (!ctx.session.contribute) {
    await ctx.reply("Something went wrong. Tap Contribute to start again.", {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.contribute.currency = currency;
  ctx.session.step = "contribute:awaiting_txhash";

  await ctx.reply(
    `Amount: ${ctx.session.contribute.amount} ${currency}\n\nPaste the transaction hash (TX hash) from your wallet:`,
    {
      reply_markup: inlineKeyboard([[inlineButton("Cancel", "contribute:cancel")]]),
    },
  );
});

// Handle TX hash input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "contribute:awaiting_txhash") return next();

  const txHash = ctx.message.text.trim();
  if (txHash.length < 10) {
    await ctx.reply("That doesn't look like a valid TX hash. Please paste the full hash.");
    return;
  }

  if (!ctx.session.contribute) {
    await ctx.reply("Something went wrong. Tap Contribute to start again.", {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.contribute.tx_hash = txHash;
  ctx.session.step = "contribute:confirming";

  const { amount, currency } = ctx.session.contribute;
  await ctx.reply(
    `Confirm your contribution:\n\nAmount: ${amount} ${currency}\nTX Hash: ${txHash}\n\nIs this correct?`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Confirm", "contribute:confirm:yes"), inlineButton("Cancel", "contribute:cancel")],
      ]),
    },
  );
});

// Confirm contribution
composer.callbackQuery("contribute:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = ctx.session.contribute;
  if (!data || !data.amount || !data.currency || !data.tx_hash) {
    await ctx.reply("Contribution data incomplete. Start again from the menu.", {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
    ctx.session.step = "idle";
    ctx.session.contribute = undefined;
    return;
  }

  const userId = ctx.from.id;
  const displayName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : "");

  // Ensure payer exists
  let payer = await getPayer(userId);
  if (!payer) {
    payer = { telegram_id: userId, display_name: displayName, first_seen: Date.now() };
    await setPayer(payer);
  }

  const contribution = {
    id: `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    payer_id: userId,
    amount: data.amount,
    currency: data.currency,
    timestamp: Date.now(),
    tx_hash: data.tx_hash,
  };

  await trackContributionId(contribution.id);
  await addContribution(contribution);

  ctx.session.step = "idle";
  ctx.session.contribute = undefined;

  await ctx.editMessageText(
    `Contribution recorded!\n\nAmount: ${contribution.amount} ${contribution.currency}\nTX Hash: ${contribution.tx_hash}\n\nYou can check your total balance anytime from the menu.`,
    { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) },
  );
});

export default composer;

import { Composer } from "grammy";
import { createBot, type BotContext } from "./toolkit/index.js";
import type { StorageAdapter } from "grammy";

export type FlowStep =
  | "idle"
  | "contribute:awaiting_amount"
  | "contribute:awaiting_currency"
  | "contribute:awaiting_txhash"
  | "contribute:confirming"
  | "admin:set_address"
  | "admin:set_currency";

export interface Session {
  step?: FlowStep;
  contribute?: {
    amount?: number;
    currency?: string;
    tx_hash?: string;
  };
}

export type Ctx = BotContext<Session>;

export interface BuildBotOptions {
  handlers?: Composer<Ctx>[];
  storage?: StorageAdapter<Session>;
}

/**
 * buildBot — assembles the bot, AUTO-LOADS every feature handler from
 * src/handlers/, then registers the global fallback.
 */
export async function buildBot(token: string, opts: BuildBotOptions = {}) {
  const bot = createBot<Session>(token, {
    initial: () => ({ step: "idle" }),
    storage: opts.storage,
  });

  const handlers = opts.handlers ?? (await loadHandlersFromDisk());
  for (const h of handlers) bot.use(h);

  bot.on("message", (ctx) =>
    ctx.reply("Sorry, I didn't understand that. Try /help."),
  );

  return bot;
}

async function loadHandlersFromDisk(): Promise<Composer<Ctx>[]> {
  const { readdirSync } = await import("node:fs");
  const dir = new URL("./handlers/", import.meta.url);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (f) =>
        (f.endsWith(".js") || f.endsWith(".ts")) &&
        !f.endsWith(".d.ts") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    files = [];
  }
  const out: Composer<Ctx>[] = [];
  for (const file of files.sort()) {
    const mod = (await import(new URL(file, dir).href)) as {
      default?: Composer<Ctx>;
    };
    if (!mod.default) {
      throw new Error(`handler ${file} must default-export a grammY Composer`);
    }
    out.push(mod.default);
  }
  return out;
}

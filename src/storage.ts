/**
 * Durable storage for domain data (payers, contributions, owner settings).
 * Uses an in-memory Map for dev/test. In production, this would use Redis.
 * Durable data MUST survive handler restarts within a process — but NOT
 * across process restarts (that's Redis).
 */
const store = new Map<string, unknown>();

async function get<T>(key: string): Promise<T | undefined> {
  return store.get(key) as T | undefined;
}

async function set<T>(key: string, value: T): Promise<void> {
  store.set(key, value);
}

// --- Types ---

export interface Payer {
  telegram_id: number;
  display_name: string;
  first_seen: number;
}

export interface Contribution {
  id: string;
  payer_id: number;
  amount: number;
  currency: string;
  timestamp: number;
  tx_hash: string;
}

export interface OwnerSettings {
  destination_address: string;
  admin_chat_id: number | null;
  supported_currencies: string[];
  balance_threshold_alert: number;
}

// --- Payer operations ---

export async function getPayer(telegramId: number): Promise<Payer | undefined> {
  return get<Payer>(`payer:${telegramId}`);
}

export async function setPayer(payer: Payer): Promise<void> {
  await set(`payer:${payer.telegram_id}`, payer);
}

// --- Contribution operations ---

export async function addContribution(contribution: Contribution): Promise<void> {
  await set(`contrib:${contribution.id}`, contribution);
  const indexKey = `contributions_by_user:${contribution.payer_id}`;
  const ids = (await get<string[]>(indexKey)) ?? [];
  ids.push(contribution.id);
  await set(indexKey, ids);
}

export async function getContribution(id: string): Promise<Contribution | undefined> {
  return get<Contribution>(`contrib:${id}`);
}

export async function findContributionByTxHash(txHash: string): Promise<Contribution | undefined> {
  const allKey = "contrib:all_ids";
  const ids = (await get<string[]>(allKey)) ?? [];
  for (const id of ids) {
    const c = await get<Contribution>(`contrib:${id}`);
    if (c && c.tx_hash === txHash) return c;
  }
  return undefined;
}

export async function getUserContributions(telegramId: number): Promise<Contribution[]> {
  const indexKey = `contributions_by_user:${telegramId}`;
  const ids = (await get<string[]>(indexKey)) ?? [];
  const contributions: Contribution[] = [];
  for (const id of ids) {
    const c = await get<Contribution>(`contrib:${id}`);
    if (c) contributions.push(c);
  }
  return contributions;
}

export async function getTotalPoolBalance(): Promise<{ total: number; currencies: Record<string, number> }> {
  const allKey = "contrib:all_ids";
  const ids = (await get<string[]>(allKey)) ?? [];
  let total = 0;
  const currencies: Record<string, number> = {};
  for (const id of ids) {
    const c = await get<Contribution>(`contrib:${id}`);
    if (c) {
      total += c.amount;
      currencies[c.currency] = (currencies[c.currency] ?? 0) + c.amount;
    }
  }
  return { total, currencies };
}

export async function getAllContributions(): Promise<Contribution[]> {
  const allKey = "contrib:all_ids";
  const ids = (await get<string[]>(allKey)) ?? [];
  const contributions: Contribution[] = [];
  for (const id of ids) {
    const c = await get<Contribution>(`contrib:${id}`);
    if (c) contributions.push(c);
  }
  return contributions;
}

export async function getUserTotalContribution(telegramId: number): Promise<number> {
  const contributions = await getUserContributions(telegramId);
  return contributions.reduce((sum, c) => sum + c.amount, 0);
}

// --- Owner settings ---

const SETTINGS_KEY = "owner_settings";

const DEFAULT_SETTINGS: OwnerSettings = {
  destination_address: "",
  admin_chat_id: null,
  supported_currencies: ["ETH", "USDT", "USDC", "BTC"],
  balance_threshold_alert: 1000,
};

export async function getOwnerSettings(): Promise<OwnerSettings> {
  return (await get<OwnerSettings>(SETTINGS_KEY)) ?? { ...DEFAULT_SETTINGS };
}

export async function updateOwnerSettings(partial: Partial<OwnerSettings>): Promise<void> {
  const current = await getOwnerSettings();
  await set(SETTINGS_KEY, { ...current, ...partial });
}

// --- Index helpers for contribution tracking ---

export async function trackContributionId(id: string): Promise<void> {
  const allKey = "contrib:all_ids";
  const ids = (await get<string[]>(allKey)) ?? [];
  ids.push(id);
  await set(allKey, ids);
}

// --- CSV export ---

export function toCsv(contributions: Contribution[]): string {
  const header = "ID,Amount,Currency,Date,From,TX Hash\n";
  const rows = contributions.map((c) =>
    [c.id, c.amount, c.currency, new Date(c.timestamp).toISOString(), c.payer_id, c.tx_hash].join(","),
  );
  return header + rows.join("\n");
}

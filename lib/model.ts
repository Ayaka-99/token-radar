// Token-launch valuation model: implied_value_usd = tvl_usd * M_eff, where
// M_eff = clamp(M_base * F_scale * F_growth * F_age * F_chain, 0.047, 1.047).
// Category base multiples (M_base) use Bühlmann shrinkage (k=10) of empirical
// snapshot mcap/TVL medians toward the global median (0.214).

import { farmSteps } from './farm.ts';

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ScoreParts {
  bm: number;
  sf: number;
  gf: number;
  af: number;
  cf: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  ageDays: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  parts: ScoreParts;
  farm_steps: string[];
}

export interface SectorStat {
  category: string;
  n: number;
  median: number;
  base: number;
}

export interface ModelConstants {
  global_median: number;
  k: number;
  n_min: number;
  m_min: number;
  m_max: number;
  floor_usd: number;
  tokens: number;
}

export interface BoardSummary {
  board_size: number;
  watchlist_size: number;
  discovery_size: number;
  as_of: string;
  categoryMultiples: Record<string, number>;
  sectors: SectorStat[];
  model: ModelConstants;
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const GLOBAL_MEDIAN = 0.214;
const SHRINKAGE_K = 10;
const MIN_CATEGORY_SAMPLES = 5;
const M_MIN = 0.047;
const M_MAX = 1.047;
const MIN_IMPLIED_USD = 1_000_000;
const MAX_IMPLIED_USD = 1e14;
const MAJOR_CHAINS = new Set(['Ethereum', 'Solana', 'Base', 'Arbitrum', 'Binance']);
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Liquid Staking',
  'Bridge',
  'Canonical Bridge',
  'Liquid Restaking',
  'Restaked BTC',
]);
const EXCLUDED_NAME_WORDS = /\b(wrapped|staked|staking)\b/i;
const EXCLUDED_NAME_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const EXCLUDED_NAME_VERSION = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

let activeCategoryMultiples: Record<string, number> = {};

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function roundSig(val: number, sig: number = 3): number {
  if (!Number.isFinite(val) || val === 0) return 0;
  return Number(val.toPrecision(sig));
}

function median(values: number[]): number {
  if (values.length === 0) return GLOBAL_MEDIAN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseUtcDate(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(startYmd: string | null, endYmd: string): number | null {
  const startMs = parseUtcDate(startYmd);
  const endMs = parseUtcDate(endYmd);
  if (startMs === null || endMs === null) return null;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

export function computeSectorStats(snapshot: Snapshot): SectorStat[] {
  const byCategory = new Map<string, number[]>();
  const allCategories = new Set<string>();

  for (const p of snapshot.protocols) {
    const cat = p.category ?? 'Uncategorized';
    allCategories.add(cat);
    const isTokenized = (p.gecko_id !== null && p.gecko_id !== '') || (p.symbol !== null && p.symbol !== '');
    if (isTokenized && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      const list = byCategory.get(cat);
      if (list) list.push(ratio);
      else byCategory.set(cat, [ratio]);
    }
  }

  const stats: SectorStat[] = [];
  for (const cat of [...allCategories].sort()) {
    const ratios = byCategory.get(cat) ?? [];
    const n = ratios.length;
    const med = n === 0 ? 0 : median(ratios);
    const base =
      n < MIN_CATEGORY_SAMPLES
        ? GLOBAL_MEDIAN
        : roundSig((n * med + SHRINKAGE_K * GLOBAL_MEDIAN) / (n + SHRINKAGE_K), 3);
    stats.push({
      category: cat,
      n,
      median: med,
      base,
    });
  }
  return stats;
}

export function computeCategoryMultiples(snapshot: Snapshot): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of computeSectorStats(snapshot)) {
    result[s.category] = s.base;
  }
  return result;
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new SnapshotError(`Invalid JSON: ${(err as Error).message}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SnapshotError('Snapshot root must be an object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.as_of !== 'string' || parseUtcDate(obj.as_of) === null) {
    throw new SnapshotError('Snapshot as_of must be a valid YYYY-MM-DD string');
  }
  if (typeof obj.source !== 'string' || obj.source.length === 0) {
    throw new SnapshotError('Snapshot source must be a non-empty string');
  }
  if (typeof obj.floor_usd !== 'number' || !Number.isFinite(obj.floor_usd)) {
    throw new SnapshotError('Snapshot floor_usd must be a finite number');
  }
  if (!Array.isArray(obj.watchlist) || !obj.watchlist.every((s) => typeof s === 'string')) {
    throw new SnapshotError('Snapshot watchlist must be an array of strings');
  }
  if (!Array.isArray(obj.protocols) || obj.protocols.length === 0) {
    throw new SnapshotError('Snapshot protocols must be a non-empty array');
  }

  const protocols: SnapshotProtocol[] = obj.protocols.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new SnapshotError(`Protocol at index ${idx} is not an object`);
    }
    const p = item as Record<string, unknown>;
    if (typeof p.slug !== 'string' || p.slug.length === 0) {
      throw new SnapshotError(`Protocol at index ${idx} has invalid slug`);
    }
    if (typeof p.name !== 'string' || p.name.length === 0) {
      throw new SnapshotError(`Protocol ${p.slug} has invalid name`);
    }
    if (p.category !== null && typeof p.category !== 'string') {
      throw new SnapshotError(`Protocol ${p.slug} has invalid category`);
    }
    if (!Array.isArray(p.chains) || !p.chains.every((c) => typeof c === 'string')) {
      throw new SnapshotError(`Protocol ${p.slug} has invalid chains`);
    }
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd < 0) {
      throw new SnapshotError(`Protocol ${p.slug} has invalid tvl_usd`);
    }
    if (p.change_7d !== null && (typeof p.change_7d !== 'number' || !Number.isFinite(p.change_7d))) {
      throw new SnapshotError(`Protocol ${p.slug} has invalid change_7d`);
    }
    if (p.mcap_usd !== null && (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd))) {
      throw new SnapshotError(`Protocol ${p.slug} has invalid mcap_usd`);
    }
    if (p.listed_at !== null && typeof p.listed_at !== 'string') {
      throw new SnapshotError(`Protocol ${p.slug} has invalid listed_at`);
    }
    if (p.gecko_id !== null && typeof p.gecko_id !== 'string') {
      throw new SnapshotError(`Protocol ${p.slug} has invalid gecko_id`);
    }
    if (p.symbol !== null && typeof p.symbol !== 'string') {
      throw new SnapshotError(`Protocol ${p.slug} has invalid symbol`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains as string[],
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
    };
  });

  const snapshot: Snapshot = {
    as_of: obj.as_of,
    source: obj.source,
    floor_usd: obj.floor_usd,
    protocols,
    watchlist: obj.watchlist as string[],
  };
  activeCategoryMultiples = computeCategoryMultiples(snapshot);
  return snapshot;
}

export function score(
  p: SnapshotProtocol,
  asOf: string,
  categoryMultiples: Record<string, number> = activeCategoryMultiples
): { value: number; parts: ScoreParts; ageDays: number | null } {
  const cat = p.category ?? 'Uncategorized';
  const rawBm = categoryMultiples[cat] ?? GLOBAL_MEDIAN;
  const bm = roundSig(rawBm, 3);

  const rawSf = Math.min(1.182, Math.pow(Math.max(p.tvl_usd, 50_000_000) / 152_800_000, -0.15));
  const sf = roundSig(rawSf, 3);

  const g = clamp(p.change_7d ?? 0, -30, 50);
  const rawGf = g >= 0 ? 1 + 0.2 * Math.sqrt(g / 50) : 1 - 0.2 * Math.sqrt(-g / 30);
  const gf = roundSig(rawGf, 3);

  const ageDays = daysBetween(p.listed_at, asOf);
  const rawAf =
    ageDays === null
      ? 1.0
      : 0.9 + (0.25 * Math.log(1 + Math.min(ageDays, 1563) / 225)) / Math.log(1 + 1563 / 225);
  const af = roundSig(rawAf, 3);

  let nMaj = 0;
  for (const c of p.chains) {
    if (MAJOR_CHAINS.has(c)) nMaj++;
  }
  const nChains = Math.min(Math.max(p.chains.length, 1), 10);
  const rawCf = 1 + 0.03 * Math.min(nMaj, 3) + 0.035 * Math.log(nChains);
  const cf = roundSig(rawCf, 3);

  const mEff = clamp(bm * sf * gf * af * cf, M_MIN, M_MAX);
  const value = clamp(Math.round(p.tvl_usd * mEff), MIN_IMPLIED_USD, MAX_IMPLIED_USD);

  return {
    value,
    parts: { bm, sf, gf, af, cf },
    ageDays,
  };
}

function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null && p.mcap_usd === null;
}

function isEligibleDiscovery(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (EXCLUDED_NAME_WORDS.test(p.name)) return false;
  if (EXCLUDED_NAME_PREFIX.test(p.name)) return false;
  if (EXCLUDED_NAME_VERSION.test(p.name)) return false;
  return true;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; summary: BoardSummary } {
  const sectors = computeSectorStats(snapshot);
  const categoryMultiples: Record<string, number> = {};
  let tokens = 0;
  for (const s of sectors) {
    categoryMultiples[s.category] = s.base;
    tokens += s.n;
  }
  activeCategoryMultiples = categoryMultiples;

  const bySlug = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) {
    bySlug.set(p.slug, p);
  }

  const watchlistSet = new Set(snapshot.watchlist);
  const selected: Array<{
    protocol: SnapshotProtocol;
    watchlist: boolean;
    value: number;
    parts: ScoreParts;
    ageDays: number | null;
  }> = [];

  for (const slug of snapshot.watchlist) {
    const p = bySlug.get(slug);
    if (!p) {
      throw new SnapshotError(`Watchlist slug "${slug}" not found in snapshot protocols`);
    }
    const scored = score(p, snapshot.as_of, categoryMultiples);
    selected.push({
      protocol: p,
      watchlist: true,
      value: scored.value,
      parts: scored.parts,
      ageDays: scored.ageDays,
    });
  }

  const discoveryCandidates: Array<{
    protocol: SnapshotProtocol;
    watchlist: boolean;
    value: number;
    parts: ScoreParts;
    ageDays: number | null;
  }> = [];

  for (const p of snapshot.protocols) {
    if (watchlistSet.has(p.slug)) continue;
    if (!isEligibleDiscovery(p)) continue;
    const scored = score(p, snapshot.as_of, categoryMultiples);
    discoveryCandidates.push({
      protocol: p,
      watchlist: false,
      value: scored.value,
      parts: scored.parts,
      ageDays: scored.ageDays,
    });
  }

  discoveryCandidates.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (b.protocol.tvl_usd !== a.protocol.tvl_usd) return b.protocol.tvl_usd - a.protocol.tvl_usd;
    return a.protocol.slug.localeCompare(b.protocol.slug);
  });

  const discoveryCount = Math.max(0, 120 - selected.length);
  const discoveryPicked = discoveryCandidates.slice(0, discoveryCount);
  const combined = [...selected, ...discoveryPicked];

  combined.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (b.protocol.tvl_usd !== a.protocol.tvl_usd) return b.protocol.tvl_usd - a.protocol.tvl_usd;
    return a.protocol.slug.localeCompare(b.protocol.slug);
  });

  const board: BoardRow[] = [];
  let prevValue = Infinity;

  for (let i = 0; i < combined.length; i++) {
    const item = combined[i];
    const p = item.protocol;
    const category = p.category ?? 'Uncategorized';
    const rounded = Math.round(item.value);
    const finalValue =
      i === 0
        ? Math.min(MAX_IMPLIED_USD, Math.max(MIN_IMPLIED_USD, rounded))
        : Math.max(1, Math.min(rounded, prevValue - 1));
    prevValue = finalValue;

    const steps = farmSteps({
      slug: p.slug,
      name: p.name,
      category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      ageDays: item.ageDays,
      implied_value_usd: finalValue,
    });

    board.push({
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      ageDays: item.ageDays,
      watchlist: item.watchlist,
      implied_value_usd: finalValue,
      parts: item.parts,
      farm_steps: steps,
    });
  }

  return {
    board,
    summary: {
      board_size: board.length,
      watchlist_size: selected.length,
      discovery_size: discoveryPicked.length,
      as_of: snapshot.as_of,
      categoryMultiples,
      sectors,
      model: {
        global_median: GLOBAL_MEDIAN,
        k: SHRINKAGE_K,
        n_min: MIN_CATEGORY_SAMPLES,
        m_min: M_MIN,
        m_max: M_MAX,
        floor_usd: snapshot.floor_usd,
        tokens,
      },
    },
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (!Array.isArray(board) || board.length !== 120) {
    return `Expected exactly 120 board rows, got ${Array.isArray(board) ? board.length : 'non-array'}`;
  }

  const validSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seenSlugs = new Set<string>();

  for (let i = 0; i < board.length; i++) {
    const row = board[i];
    const expectedRank = i + 1;
    if (row.rank !== expectedRank) {
      return `Row ${i} has rank ${row.rank}, expected ${expectedRank}`;
    }
    if (!validSlugs.has(row.slug)) {
      return `Row rank ${row.rank} slug "${row.slug}" is not in snapshot protocols`;
    }
    if (seenSlugs.has(row.slug)) {
      return `Duplicate slug "${row.slug}" at rank ${row.rank}`;
    }
    seenSlugs.add(row.slug);

    const val = row.implied_value_usd;
    if (!Number.isInteger(val) || val < 1 || val > MAX_IMPLIED_USD) {
      return `Row rank ${row.rank} implied_value_usd ${val} is not a positive integer <= 1e14`;
    }
    if (i > 0 && val >= board[i - 1].implied_value_usd) {
      return `Row rank ${row.rank} implied_value_usd (${val}) is not strictly less than rank ${i} (${board[i - 1].implied_value_usd})`;
    }

    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `Row rank ${row.rank} must have 3-12 farm_steps`;
    }
    for (const step of row.farm_steps) {
      if (typeof step !== 'string') {
        return `Row rank ${row.rank} has a non-string farm_step`;
      }
      const len = step.trim().length;
      if (len < 20 || len > 600) {
        return `Row rank ${row.rank} has farm_step of trimmed length ${len} (must be 20-600)`;
      }
    }
  }

  for (const wSlug of snapshot.watchlist) {
    if (!seenSlugs.has(wSlug)) {
      return `Watchlist slug "${wSlug}" is missing from the board`;
    }
  }

  return null;
}

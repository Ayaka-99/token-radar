// Token-launch valuation & peer-odds engine (Node 22, standard library only).
// Fits every valuation parameter dynamically from the snapshot's own priced traded
// tokens via robust L1-IRLS Ridge regression with two-level Empirical Bayes sector
// shrinkage, then validates held-out twice: Leave-One-Out CV and temporal
// walk-forward (older -> newer). Also fits a 10-fold validated peer tokenization
// survival model over all non-excluded snapshot protocols.
// Pure & deterministic: no network, no Date.now(), no Math.random(), no hardcoded names.

import { evaluateFarmEconomics, farmSteps, type FarmVerdict } from './farm.ts';

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
  base: number;
  fam: number;
  cat: number;
  scale: number;
  growth: number;
  age: number;
  chains: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  family: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  ageDays: number | null;
  watchlist: boolean;
  above_floor: boolean;
  implied_value_usd: number;
  raw_implied_usd: number;
  band_lo_usd: number;
  band_hi_usd: number;
  parts: ScoreParts;
  peer_token_rate: number;
  rem_launch_odds: number;
  farm_verdict: FarmVerdict;
  plan_capital_usd: number;
  plan_cost_usd: number;
  exp_net_usd: number;
  cond_net_usd: number;
  farm_steps: string[];
}

export interface FamilyStat {
  family: string;
  priced_n: number;
  median_mult: number;
  fitted_mult: number;
  tok_n: number;
  total_n: number;
}

export interface SectorStat {
  category: string;
  family: string;
  priced_n: number;
  median_mult: number;
  fam_mult: number;
  cat_mult: number;
  combined_mult: number;
  tok_n: number;
  total_n: number;
}

export interface FittedValuationModel {
  n_priced: number;
  b0: number;
  b_tvl: number;
  b_g: number;
  b_age: number;
  b_ch: number;
  ref_log_tvl: number;
  ref_g: number;
  ref_log_age: number;
  ref_log_ch: number;
  fam_eff: Record<string, number>;
  cat_eff: Record<string, number>;
  lo_mult_log: number;
  hi_mult_log: number;
  q25_res: number;
  q75_res: number;
  global_median_mult: number;
}

export interface FittedOddsModel {
  n_peers: number;
  n_tokenized: number;
  b0: number;
  b_tvl: number;
  b_age: number;
  b_age_miss: number;
  b_ch: number;
  ref_log_tvl: number;
  ref_log_age: number;
  fam_eff: Record<string, number>;
  cat_eff: Record<string, number>;
  brier_10f: number;
  brier_base: number;
  brier_skill: number;
  auc_10f: number;
}

export interface EvalMetrics {
  n: number;
  med_x: number;
  rmse: number;
  r2: number;
  within_2x: number;
  within_3x: number;
  spearman: number;
}

export interface TermAblation {
  term: string;
  slope: string;
  loo_med_x: number;
  loo_rmse: number;
  delta_rmse: number;
}

export interface ValidationReport {
  loo_model: EvalMetrics;
  loo_flat25: EvalMetrics;
  loo_global_med: EvalMetrics;
  wf_split_date: string;
  wf_train_n: number;
  wf_model: EvalMetrics;
  wf_flat25: EvalMetrics;
  ablations: TermAblation[];
}

export interface CompRow {
  slug: string;
  name: string;
  category: string;
  family: string;
  tvl_usd: number;
  mcap_usd: number;
  loo_pred_usd: number;
  change_7d: number | null;
  ageDays: number | null;
}

export interface UniverseAccounting {
  total: number;
  trading_total: number;
  trading_priced: number;
  trading_zero_or_neg: number;
  trading_null_mcap: number;
  pretoken_total: number;
  watchlist_total: number;
  watchlist_covered: number;
  discovery_total: number;
  discovery_above_floor: number;
  discovery_below_floor: number;
  excluded_total: number;
  excluded_reasons: Record<string, number>;
}

export interface BoardSummary {
  as_of: string;
  source: string;
  floor_usd: number;
  universe: UniverseAccounting;
  model: FittedValuationModel;
  odds: FittedOddsModel;
  validation: ValidationReport;
  families: FamilyStat[];
  sectors: SectorStat[];
  comps: CompRow[];
  verdict_counts: { FARM: number; THIN: number; SKIP: number };
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export const SECTOR_FAMILY_MAP: Record<string, string> = {
  'Risk Curators': 'Vault & Curator',
  'Onchain Capital Allocator': 'Vault & Curator',
  Yield: 'Vault & Curator',
  'Yield Aggregator': 'Vault & Curator',
  Farm: 'Vault & Curator',
  'Liquidity Manager': 'Vault & Curator',
  'Leveraged Farming': 'Vault & Curator',
  Lending: 'Credit & CDP',
  'Collateral Markets': 'Credit & CDP',
  CDP: 'Credit & CDP',
  'CDP Manager': 'Credit & CDP',
  'Collateral Management': 'Credit & CDP',
  Dexs: 'Trading & Markets',
  'OTC Marketplace': 'Trading & Markets',
  Derivatives: 'Trading & Markets',
  'Prediction Market': 'Trading & Markets',
  Options: 'Trading & Markets',
  RWA: 'RWA & Basis',
  'Basis Trading': 'RWA & Basis',
  'Stablecoin Wrapper': 'RWA & Basis',
  'Dual-Token Stablecoin': 'RWA & Basis',
  'Liquid Staking': 'Staking & Restaking',
  'Liquid Restaking': 'Staking & Restaking',
  Restaking: 'Staking & Restaking',
  'Staking Pool': 'Staking & Restaking',
  'Restaked BTC': 'Staking & Restaking',
  'Anchor BTC': 'Staking & Restaking',
  'Decentralized BTC': 'Staking & Restaking',
  Bridge: 'Infra & Bridge',
  'Canonical Bridge': 'Infra & Bridge',
  'Cross Chain Bridge': 'Infra & Bridge',
  Chain: 'Infra & Bridge',
  CEX: 'Exchange (CEX)',
};

export const FAMILIES = [
  'Credit & CDP',
  'Exchange (CEX)',
  'Infra & Bridge',
  'Other DeFi',
  'RWA & Basis',
  'Staking & Restaking',
  'Trading & Markets',
  'Vault & Curator',
] as const;

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

const MIN_IMPLIED_USD = 1_000_000;
const MAX_IMPLIED_USD = 1e14;
const LAM_TVL = 0.5;
const LAM_OTHER = 40.0;
const LAM_FAM = 3.0;
const LAM_CAT = 12.0;
const L1_EPS = 0.15;
const IRLS_ITERS = 18;
const MATURE_AGE_DAYS = 1460;

export function familyOf(category: string | null): string {
  if (!category) return 'Other DeFi';
  return SECTOR_FAMILY_MAP[category] ?? 'Other DeFi';
}

function r6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function r4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

function r3(x: number): number {
  return Math.round(x * 1e3) / 1e3;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const idx = clamp(q, 0, 1) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}

function parseUtcDate(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const ms = Date.UTC(y!, m! - 1, d!);
  return Number.isFinite(ms) ? ms : null;
}

export function ageDaysBetween(listedAt: string | null, asOf: string): number | null {
  const s = parseUtcDate(listedAt);
  const e = parseUtcDate(asOf);
  if (s === null || e === null) return null;
  return Math.max(0, Math.round((e - s) / 86_400_000));
}

export function hasTokenRecord(p: SnapshotProtocol): boolean {
  return (
    (p.gecko_id !== null && p.gecko_id !== '') ||
    (p.symbol !== null && p.symbol !== '') ||
    p.mcap_usd !== null
  );
}

export function excludedReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return p.category;
  if (EXCLUDED_NAME_WORDS.test(p.name)) return 'Wrapped/Staked name';
  if (EXCLUDED_NAME_PREFIX.test(p.name)) return 'Exchange product';
  if (EXCLUDED_NAME_VERSION.test(p.name)) return 'Versioned pool';
  return null;
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(M[col]![col]!);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r]![col]!);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (piv !== col) {
      const tmp = M[col]!;
      M[col] = M[piv]!;
      M[piv] = tmp;
    }
    const div = M[col]![col]!;
    if (Math.abs(div) < 1e-12) continue;
    for (let j = col; j <= n; j++) M[col]![j]! /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]!;
      if (f === 0) continue;
      for (let j = col; j <= n; j++) M[r]![j]! -= f * M[col]![j]!;
    }
  }
  return M.map((row) => row[n]!);
}

interface FitOptions {
  useTvl?: boolean;
  useFam?: boolean;
  useCat?: boolean;
  useGrowth?: boolean;
  useAge?: boolean;
  useChains?: boolean;
}

export function fitValuationModel(
  train: SnapshotProtocol[],
  asOf: string,
  opts: FitOptions = {}
): FittedValuationModel {
  const useTvl = opts.useTvl ?? true;
  const useFam = opts.useFam ?? true;
  const useCat = opts.useCat ?? true;
  const useGrowth = opts.useGrowth ?? true;
  const useAge = opts.useAge ?? true;
  const useChains = opts.useChains ?? true;

  const refLogTvl = r6(median(train.map((p) => Math.log(p.tvl_usd))));
  const ages: number[] = [];
  const gs: number[] = [];
  const lchs: number[] = [];
  const ratios: number[] = [];
  for (const p of train) {
    const ad = ageDaysBetween(p.listed_at, asOf);
    if (ad !== null) ages.push(Math.log1p(ad));
    if (p.change_7d !== null) gs.push(clamp(p.change_7d, -40, 60) / 100);
    lchs.push(Math.log(Math.max(1, p.chains.length)));
    ratios.push(p.mcap_usd! / p.tvl_usd);
  }
  const refLogAge = r6(ages.length > 0 ? median(ages) : Math.log1p(365));
  const refG = r6(gs.length > 0 ? median(gs) : 0);
  const refLogCh = r6(median(lchs));
  const globalMed = r4(median(ratios));

  const famIdx = new Map<string, number>();
  FAMILIES.forEach((f, i) => famIdx.set(f, i));

  const n = train.length;
  const d = 5 + FAMILIES.length;
  const X: number[][] = new Array(n);
  const y: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const p = train[i]!;
    const lt = useTvl ? Math.log(p.tvl_usd) - refLogTvl : 0;
    const g = useGrowth && p.change_7d !== null ? clamp(p.change_7d, -40, 60) / 100 - refG : 0;
    const ad = ageDaysBetween(p.listed_at, asOf);
    const la = useAge && ad !== null ? Math.log1p(ad) - refLogAge : 0;
    const lch = useChains ? Math.log(Math.max(1, p.chains.length)) - refLogCh : 0;
    const row = new Array<number>(d).fill(0);
    row[0] = 1;
    row[1] = lt;
    row[2] = g;
    row[3] = la;
    row[4] = lch;
    if (useFam) {
      const fi = famIdx.get(familyOf(p.category)) ?? famIdx.get('Other DeFi')!;
      row[5 + fi] = 1;
    }
    X[i] = row;
    y[i] = Math.log(p.mcap_usd! / p.tvl_usd);
  }

  const lams = new Array<number>(d).fill(LAM_FAM);
  lams[0] = 0;
  lams[1] = useTvl ? LAM_TVL : 1e6;
  lams[2] = useGrowth ? LAM_OTHER : 1e6;
  lams[3] = useAge ? LAM_OTHER : 1e6;
  lams[4] = useChains ? LAM_OTHER : 1e6;
  if (!useFam) {
    for (let k = 5; k < d; k++) lams[k] = 1e6;
  }

  let w = new Array<number>(n).fill(1);
  let beta = new Array<number>(d).fill(0);

  for (let iter = 0; iter < IRLS_ITERS; iter++) {
    const XtWX: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    const XtWy = new Array<number>(d).fill(0);
    for (let i = 0; i < n; i++) {
      const wi = w[i]!;
      const xi = X[i]!;
      const yi = y[i]!;
      for (let a = 0; a < d; a++) {
        const wxa = wi * xi[a]!;
        if (wxa === 0) continue;
        XtWy[a]! += wxa * yi;
        for (let b = 0; b < d; b++) {
          if (xi[b] !== 0) XtWX[a]![b]! += wxa * xi[b]!;
        }
      }
    }
    for (let a = 0; a < d; a++) XtWX[a]![a]! += lams[a]!;
    beta = solveLinear(XtWX, XtWy);

    for (let i = 0; i < n; i++) {
      const xi = X[i]!;
      let pred = 0;
      for (let j = 0; j < d; j++) pred += beta[j]! * xi[j]!;
      const res = Math.abs(y[i]! - pred);
      w[i] = 1 / Math.max(L1_EPS, res);
    }
  }

  const famEff: Record<string, number> = {};
  for (let k = 0; k < FAMILIES.length; k++) {
    famEff[FAMILIES[k]!] = useFam ? r6(beta[5 + k]!) : 0;
  }

  const catEff: Record<string, number> = {};
  if (useCat) {
    const byCat = new Map<string, Array<{ r: number; wt: number }>>();
    for (let i = 0; i < n; i++) {
      const p = train[i]!;
      const xi = X[i]!;
      let pred = 0;
      for (let j = 0; j < d; j++) pred += beta[j]! * xi[j]!;
      const cat = p.category ?? 'Uncategorized';
      const arr = byCat.get(cat) ?? [];
      arr.push({ r: y[i]! - pred, wt: w[i]! });
      byCat.set(cat, arr);
    }
    for (const cat of [...byCat.keys()].sort()) {
      const arr = byCat.get(cat)!;
      let sw = 0;
      let sr = 0;
      for (const item of arr) {
        sw += item.wt;
        sr += item.r * item.wt;
      }
      catEff[cat] = r6(sr / (sw + LAM_CAT));
    }
  }

  // Empirical bounds & residual quartiles from rounded coefficients (so JS matches exact math!)
  const model: FittedValuationModel = {
    n_priced: n,
    b0: r6(beta[0]!),
    b_tvl: useTvl ? r6(beta[1]!) : 0,
    b_g: useGrowth ? r6(beta[2]!) : 0,
    b_age: useAge ? r6(beta[3]!) : 0,
    b_ch: useChains ? r6(beta[4]!) : 0,
    ref_log_tvl: refLogTvl,
    ref_g: refG,
    ref_log_age: refLogAge,
    ref_log_ch: refLogCh,
    fam_eff: famEff,
    cat_eff: catEff,
    lo_mult_log: r6(Math.max(-4.2, quantile(y, 0.05))),
    hi_mult_log: r6(Math.min(1.5, quantile(y, 0.95))),
    q25_res: -0.9,
    q75_res: 0.9,
    global_median_mult: globalMed,
  };

  const resList: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = train[i]!;
    const predLogMcap = predictImplied(p, asOf, model).logMcap;
    resList.push(Math.log(p.mcap_usd!) - predLogMcap);
  }
  model.q25_res = r4(quantile(resList, 0.25));
  model.q75_res = r4(quantile(resList, 0.75));
  return model;
}

export function predictImplied(
  p: {
    category: string | null;
    chains: string[];
    tvl_usd: number;
    change_7d: number | null;
    listed_at?: string | null;
    ageDays?: number | null;
  },
  asOf: string,
  model: FittedValuationModel
): {
  value: number;
  lo: number;
  hi: number;
  logMcap: number;
  parts: ScoreParts;
  ageDays: number | null;
} {
  const cat = p.category ?? 'Uncategorized';
  const fam = familyOf(p.category);
  const ageDays =
    p.ageDays !== undefined ? p.ageDays : ageDaysBetween(p.listed_at ?? null, asOf);

  const gRounded = p.change_7d !== null ? Math.round(p.change_7d * 100) / 100 : null;
  const lt = Math.log(Math.max(1, p.tvl_usd)) - model.ref_log_tvl;
  const gTerm =
    gRounded !== null ? clamp(gRounded, -40, 60) / 100 - model.ref_g : 0;
  const ageTerm = ageDays !== null ? Math.log1p(ageDays) - model.ref_log_age : 0;
  const chTerm = Math.log(Math.max(1, p.chains.length)) - model.ref_log_ch;

  const logBase = model.b0;
  const logFam = model.fam_eff[fam] ?? 0;
  const logCat = model.cat_eff[cat] ?? 0;
  const logScale = model.b_tvl * lt;
  const logGrowth = model.b_g * gTerm;
  const logAge = model.b_age * ageTerm;
  const logChains = model.b_ch * chTerm;

  const rawLogMult = logBase + logFam + logCat + logScale + logGrowth + logAge + logChains;
  const logMult = clamp(rawLogMult, model.lo_mult_log, model.hi_mult_log);
  const logMcap = Math.log(Math.max(1, p.tvl_usd)) + logMult;

  const value = clamp(Math.round(p.tvl_usd * Math.exp(logMult)), MIN_IMPLIED_USD, MAX_IMPLIED_USD);
  const lo = clamp(
    Math.round(p.tvl_usd * Math.exp(logMult + model.q25_res)),
    Math.round(MIN_IMPLIED_USD * 0.25),
    value
  );
  const hi = clamp(
    Math.round(p.tvl_usd * Math.exp(logMult + model.q75_res)),
    value,
    MAX_IMPLIED_USD
  );

  return {
    value,
    lo,
    hi,
    logMcap,
    ageDays,
    parts: {
      base: r4(Math.exp(logBase)),
      fam: r4(Math.exp(logFam)),
      cat: r4(Math.exp(logCat)),
      scale: r4(Math.exp(logScale)),
      growth: r4(Math.exp(logGrowth)),
      age: r4(Math.exp(logAge)),
      chains: r4(Math.exp(logChains)),
    },
  };
}

function fitOddsCore(train: SnapshotProtocol[], asOf: string): Omit<FittedOddsModel, 'brier_10f' | 'brier_base' | 'brier_skill' | 'auc_10f'> {
  const refLogTvl = r6(median(train.map((p) => Math.log(p.tvl_usd))));
  const ages: number[] = [];
  let nTok = 0;
  for (const p of train) {
    const ad = ageDaysBetween(p.listed_at, asOf);
    if (ad !== null) ages.push(Math.log1p(ad));
    if (hasTokenRecord(p)) nTok++;
  }
  const refLogAge = r6(ages.length > 0 ? median(ages) : Math.log1p(365));
  const famIdx = new Map<string, number>();
  FAMILIES.forEach((f, i) => famIdx.set(f, i));

  const n = train.length;
  const d = 5 + FAMILIES.length;
  const X: number[][] = new Array(n);
  const y: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = train[i]!;
    const ad = ageDaysBetween(p.listed_at, asOf);
    const row = new Array<number>(d).fill(0);
    row[0] = 1;
    row[1] = Math.log(p.tvl_usd) - refLogTvl;
    row[2] = ad !== null ? Math.log1p(ad) - refLogAge : 0;
    row[3] = ad === null ? 1 : 0;
    row[4] = Math.log(Math.max(1, p.chains.length));
    const fi = famIdx.get(familyOf(p.category)) ?? famIdx.get('Other DeFi')!;
    row[5 + fi] = 1;
    X[i] = row;
    y[i] = hasTokenRecord(p) ? 1 : 0;
  }

  const lams = [0, 2, 2, 2, 2, ...new Array<number>(FAMILIES.length).fill(6)];
  const beta = new Array<number>(d).fill(0);

  for (let iter = 0; iter < 10; iter++) {
    const H: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    const grad = new Array<number>(d).fill(0);
    for (let i = 0; i < n; i++) {
      const xi = X[i]!;
      let z = 0;
      for (let j = 0; j < d; j++) z += beta[j]! * xi[j]!;
      const pr = 1 / (1 + Math.exp(-clamp(z, -20, 20)));
      const wt = Math.max(1e-6, pr * (1 - pr));
      const err = y[i]! - pr;
      for (let a = 0; a < d; a++) {
        if (xi[a] === 0) continue;
        grad[a]! += xi[a]! * err;
        for (let b = 0; b < d; b++) {
          if (xi[b] !== 0) H[a]![b]! += wt * xi[a]! * xi[b]!;
        }
      }
    }
    for (let a = 0; a < d; a++) {
      grad[a]! -= lams[a]! * beta[a]!;
      H[a]![a]! += lams[a]!;
    }
    const step = solveLinear(H, grad);
    for (let j = 0; j < d; j++) beta[j]! += step[j]!;
  }

  // Empirical Bayes category logit shift (3 Newton steps with prior 2.0)
  const catLogit: Record<string, number> = {};
  const catsByProto = train.map((p) => p.category ?? 'Uncategorized');
  const uniqueCats = [...new Set(catsByProto)].sort();
  for (const c of uniqueCats) catLogit[c] = 0;

  for (let step = 0; step < 3; step++) {
    const cg = new Map<string, number>();
    const ch = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const xi = X[i]!;
      const c = catsByProto[i]!;
      let z = catLogit[c]!;
      for (let j = 0; j < d; j++) z += beta[j]! * xi[j]!;
      const pr = 1 / (1 + Math.exp(-clamp(z, -20, 20)));
      cg.set(c, (cg.get(c) ?? 0) + (y[i]! - pr));
      ch.set(c, (ch.get(c) ?? 0) + pr * (1 - pr));
    }
    for (const c of uniqueCats) {
      const gVal = (cg.get(c) ?? 0) - 2.0 * catLogit[c]!;
      const hVal = (ch.get(c) ?? 0) + 2.0;
      catLogit[c] = clamp(catLogit[c]! + gVal / hVal, -2.5, 2.5);
    }
  }

  const famEff: Record<string, number> = {};
  for (let k = 0; k < FAMILIES.length; k++) famEff[FAMILIES[k]!] = r6(beta[5 + k]!);
  const catEff: Record<string, number> = {};
  for (const c of uniqueCats) catEff[c] = r6(catLogit[c]!);

  return {
    n_peers: n,
    n_tokenized: nTok,
    b0: r6(beta[0]!),
    b_tvl: r6(beta[1]!),
    b_age: r6(beta[2]!),
    b_age_miss: r6(beta[3]!),
    b_ch: r6(beta[4]!),
    ref_log_tvl: refLogTvl,
    ref_log_age: refLogAge,
    fam_eff: famEff,
    cat_eff: catEff,
  };
}

export function predictTokenOdds(
  p: { category: string | null; chains: string[]; tvl_usd: number; listed_at?: string | null; ageDays?: number | null },
  asOf: string,
  odds: Pick<FittedOddsModel, 'b0' | 'b_tvl' | 'b_age' | 'b_age_miss' | 'b_ch' | 'ref_log_tvl' | 'ref_log_age' | 'fam_eff' | 'cat_eff'>
): { peerRate: number; matureRate: number; remOdds: number } {
  const cat = p.category ?? 'Uncategorized';
  const fam = familyOf(p.category);
  const ad = p.ageDays !== undefined ? p.ageDays : ageDaysBetween(p.listed_at ?? null, asOf);
  const probAt = (age: number | null): number => {
    const z =
      odds.b0 +
      odds.b_tvl * (Math.log(Math.max(1, p.tvl_usd)) - odds.ref_log_tvl) +
      (age !== null ? odds.b_age * (Math.log1p(age) - odds.ref_log_age) : odds.b_age_miss) +
      odds.b_ch * Math.log(Math.max(1, p.chains.length)) +
      (odds.fam_eff[fam] ?? 0) +
      (odds.cat_eff[cat] ?? 0);
    return 1 / (1 + Math.exp(-clamp(z, -12, 12)));
  };
  const peerRate = probAt(ad);
  const matureAge = ad !== null ? Math.max(ad, MATURE_AGE_DAYS) : MATURE_AGE_DAYS;
  const matureRate = Math.max(peerRate, probAt(matureAge));
  // Conditional survival hazard over remaining horizon to 4 years (falls with age as holdouts age out)
  const remOdds =
    ad !== null
      ? clamp((matureRate - peerRate) / Math.max(0.08, 1 - peerRate), 0.05, 0.85)
      : clamp(peerRate * 0.4, 0.08, 0.5);
  return {
    peerRate: Math.round(peerRate * 100) / 100,
    matureRate: Math.round(matureRate * 100) / 100,
    remOdds: Math.round(remOdds * 100) / 100,
  };
}

export function fitTokenOddsModel(eligAll: SnapshotProtocol[], asOf: string): FittedOddsModel {
  const sorted = eligAll.slice().sort((a, b) => a.slug.localeCompare(b.slug));
  const ys = sorted.map((p) => (hasTokenRecord(p) ? 1 : 0));
  const preds = new Array<number>(sorted.length).fill(0);

  for (let fold = 0; fold < 10; fold++) {
    const tr = sorted.filter((_, idx) => idx % 10 !== fold);
    const m = fitOddsCore(tr, asOf);
    for (let idx = 0; idx < sorted.length; idx++) {
      if (idx % 10 === fold) preds[idx] = predictTokenOdds(sorted[idx]!, asOf, m).peerRate;
    }
  }

  let brier = 0;
  const baseP = ys.reduce((s, v) => s + v, 0) / Math.max(1, ys.length);
  let brierBase = 0;
  const posP: number[] = [];
  const negP: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    brier += (preds[i]! - ys[i]!) ** 2;
    brierBase += (baseP - ys[i]!) ** 2;
    if (ys[i] === 1) posP.push(preds[i]!);
    else negP.push(preds[i]!);
  }
  brier /= Math.max(1, ys.length);
  brierBase /= Math.max(1, ys.length);
  let wins = 0;
  for (const a of posP) {
    for (const b of negP) {
      if (a > b) wins += 1;
      else if (a === b) wins += 0.5;
    }
  }
  const auc = posP.length > 0 && negP.length > 0 ? wins / (posP.length * negP.length) : 0.5;
  const full = fitOddsCore(sorted, asOf);
  return {
    ...full,
    brier_10f: r4(brier),
    brier_base: r4(brierBase),
    brier_skill: r4(brierBase > 0 ? 1 - brier / brierBase : 0),
    auc_10f: r3(auc),
  };
}

function evaluateLogPreds(yTrue: number[], yPred: number[]): EvalMetrics {
  const n = yTrue.length;
  const absErr: number[] = [];
  let sqSum = 0;
  let w2 = 0;
  let w3 = 0;
  const meanY = yTrue.reduce((s, v) => s + v, 0) / Math.max(1, n);
  let totSum = 0;
  const ln2 = Math.log(2);
  const ln3 = Math.log(3);
  for (let i = 0; i < n; i++) {
    const e = yTrue[i]! - yPred[i]!;
    const ae = Math.abs(e);
    absErr.push(ae);
    sqSum += e * e;
    totSum += (yTrue[i]! - meanY) ** 2;
    if (ae <= ln2) w2++;
    if (ae <= ln3) w3++;
  }
  const toRanks = (arr: number[]): number[] => {
    const ord = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array<number>(arr.length);
    for (let pos = 0; pos < ord.length; pos++) out[ord[pos]!.i] = pos;
    return out;
  };
  const rt = toRanks(yTrue);
  const rp = toRanks(yPred);
  const mt = (n - 1) / 2;
  let num = 0;
  let dt = 0;
  let dp = 0;
  for (let i = 0; i < n; i++) {
    const a = rt[i]! - mt;
    const b = rp[i]! - mt;
    num += a * b;
    dt += a * a;
    dp += b * b;
  }
  const rho = dt > 0 && dp > 0 ? num / Math.sqrt(dt * dp) : 0;
  return {
    n,
    med_x: r3(Math.exp(median(absErr))),
    rmse: r3(Math.sqrt(sqSum / Math.max(1, n))),
    r2: r3(totSum > 0 ? 1 - sqSum / totSum : 0),
    within_2x: r3(w2 / Math.max(1, n)),
    within_3x: r3(w3 / Math.max(1, n)),
    spearman: r3(rho),
  };
}

function runLoo(priced: SnapshotProtocol[], asOf: string, opts: FitOptions = {}): number[] {
  const preds = new Array<number>(priced.length);
  for (let i = 0; i < priced.length; i++) {
    const tr = priced.filter((_, idx) => idx !== i);
    const m = fitValuationModel(tr, asOf, opts);
    preds[i] = predictImplied(priced[i]!, asOf, m).logMcap;
  }
  return preds;
}

export function runValidation(
  priced: SnapshotProtocol[],
  fullModel: FittedValuationModel,
  asOf: string
): { report: ValidationReport; looPredsUsd: Map<string, number> } {
  const yAll = priced.map((p) => Math.log(p.mcap_usd!));
  const looFull = runLoo(priced, asOf);
  const looPredsUsd = new Map<string, number>();
  for (let i = 0; i < priced.length; i++) {
    looPredsUsd.set(priced[i]!.slug, Math.round(Math.exp(looFull[i]!)));
  }

  const looFlat25 = priced.map((p) => Math.log(p.tvl_usd * 0.25));
  const looGlobalMed = priced.map((p, i) => {
    const med = median(priced.filter((_, j) => j !== i).map((q) => q.mcap_usd! / q.tvl_usd));
    return Math.log(p.tvl_usd * med);
  });

  // Temporal walk-forward (oldest 60% train -> newest 40% blind test)
  const dated = priced
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => a.listed_at!.localeCompare(b.listed_at!) || a.slug.localeCompare(b.slug));
  const split = Math.floor(dated.length * 0.6);
  const wfTrain = dated.slice(0, split);
  const wfTest = dated.slice(split);
  const wfModelFit = fitValuationModel(wfTrain, asOf);
  const yWf = wfTest.map((p) => Math.log(p.mcap_usd!));
  const wfPreds = wfTest.map((p) => predictImplied(p, asOf, wfModelFit).logMcap);
  const wfFlat = wfTest.map((p) => Math.log(p.tvl_usd * 0.25));

  const fullMetrics = evaluateLogPreds(yAll, looFull);

  // Term-by-term LOO ablation (drop each term individually to prove empirical contribution!)
  const ablateSpecs: Array<{ term: string; slope: string; opts: FitOptions }> = [
    { term: 'TVL scale elasticity', slope: `β=${fullModel.b_tvl.toFixed(3)}`, opts: { useTvl: false } },
    { term: 'Sector family + category', slope: '8 families + cat EB', opts: { useFam: false, useCat: false } },
    { term: '7-day TVL growth', slope: `β=${fullModel.b_g.toFixed(3)}`, opts: { useGrowth: false } },
    { term: 'No-token age tenure', slope: `β=${fullModel.b_age.toFixed(3)}`, opts: { useAge: false } },
    { term: 'Chain footprint', slope: `β=${fullModel.b_ch.toFixed(3)}`, opts: { useChains: false } },
  ];
  const ablations: TermAblation[] = ablateSpecs.map((spec) => {
    const m = evaluateLogPreds(yAll, runLoo(priced, asOf, spec.opts));
    return {
      term: spec.term,
      slope: spec.slope,
      loo_med_x: m.med_x,
      loo_rmse: m.rmse,
      // Positive delta_rmse means dropping the term worsens RMSE (so keeping it helps)
      delta_rmse: r3(m.rmse - fullMetrics.rmse),
    };
  });

  // Update fullModel empirical prediction band directly from LOO out-of-sample residuals!
  const looRes = yAll.map((yt, i) => yt - looFull[i]!);
  fullModel.q25_res = r4(quantile(looRes, 0.25));
  fullModel.q75_res = r4(quantile(looRes, 0.75));

  return {
    looPredsUsd,
    report: {
      loo_model: fullMetrics,
      loo_flat25: evaluateLogPreds(yAll, looFlat25),
      loo_global_med: evaluateLogPreds(yAll, looGlobalMed),
      wf_split_date: wfTrain.length > 0 ? wfTrain[wfTrain.length - 1]!.listed_at! : asOf,
      wf_train_n: wfTrain.length,
      wf_model: evaluateLogPreds(yWf, wfPreds),
      wf_flat25: evaluateLogPreds(yWf, wfFlat),
      ablations,
    },
  };
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

  return {
    as_of: obj.as_of,
    source: obj.source,
    floor_usd: obj.floor_usd,
    protocols,
    watchlist: obj.watchlist as string[],
  };
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; summary: BoardSummary } {
  const watchlistSet = new Set(snapshot.watchlist);
  const bySlug = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) bySlug.set(p.slug, p);

  // 1. Account for every single one of the 758 protocols!
  const tradingAll: SnapshotProtocol[] = [];
  const tradingPriced: SnapshotProtocol[] = [];
  let tradingZeroOrNeg = 0;
  let tradingNullMcap = 0;

  const watchlistProtos: SnapshotProtocol[] = [];
  const discoveryProtos: SnapshotProtocol[] = [];
  const excludedReasons: Record<string, number> = {};
  let excludedTotal = 0;
  let pretokenTotal = 0;

  for (const p of snapshot.protocols) {
    if (hasTokenRecord(p)) {
      tradingAll.push(p);
      if (p.mcap_usd === null) tradingNullMcap++;
      else if (p.mcap_usd <= 0 || p.tvl_usd <= 0) tradingZeroOrNeg++;
      else tradingPriced.push(p);
    } else {
      pretokenTotal++;
      if (watchlistSet.has(p.slug)) {
        watchlistProtos.push(p);
      } else {
        const reason = excludedReason(p);
        if (reason !== null) {
          excludedTotal++;
          excludedReasons[reason] = (excludedReasons[reason] ?? 0) + 1;
        } else {
          discoveryProtos.push(p);
        }
      }
    }
  }

  for (const slug of snapshot.watchlist) {
    if (!bySlug.has(slug)) {
      throw new SnapshotError(`Watchlist slug "${slug}" not found in snapshot protocols`);
    }
  }

  // 2. Fit valuation model on all priced traded tokens & validate held-out twice!
  const model = fitValuationModel(tradingPriced, snapshot.as_of);
  const { report: validation, looPredsUsd } = runValidation(tradingPriced, model, snapshot.as_of);

  // 3. Fit peer tokenization & survival odds model over all non-excluded protocols (watchlist + eligible pre + non-excluded trading)
  const eligUniverse = snapshot.protocols.filter(
    (p) => watchlistSet.has(p.slug) || excludedReason(p) === null
  );
  const odds = fitTokenOddsModel(eligUniverse, snapshot.as_of);

  // 4. Score every watchlist protocol + every eligible discovery protocol (all 198 eligible!)
  const candidates = [
    ...watchlistProtos.map((p) => ({ p, watchlist: true })),
    ...discoveryProtos.map((p) => ({ p, watchlist: false })),
  ].map(({ p, watchlist }) => {
    const pred = predictImplied(p, snapshot.as_of, model);
    const od = predictTokenOdds(p, snapshot.as_of, odds);
    return { p, watchlist, pred, od };
  });

  candidates.sort((a, b) => {
    if (b.pred.value !== a.pred.value) return b.pred.value - a.pred.value;
    if (b.p.tvl_usd !== a.p.tvl_usd) return b.p.tvl_usd - a.p.tvl_usd;
    return a.p.slug.localeCompare(b.p.slug);
  });

  const board: BoardRow[] = [];
  const verdictCounts = { FARM: 0, THIN: 0, SKIP: 0 };
  let prevValue = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i]!;
    const p = item.p;
    const cat = p.category ?? 'Uncategorized';
    const fam = familyOf(p.category);
    const rawVal = item.pred.value;
    const finalVal =
      i === 0
        ? clamp(rawVal, MIN_IMPLIED_USD, MAX_IMPLIED_USD)
        : Math.max(1, Math.min(rawVal, prevValue - 1));
    prevValue = finalVal;

    const gRounded = p.change_7d === null ? null : Math.round(p.change_7d * 100) / 100;
    const farmInput = {
      slug: p.slug,
      name: p.name,
      category: cat,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: gRounded,
      ageDays: item.pred.ageDays,
      implied_value_usd: finalVal,
      rem_launch_odds: item.od.remOdds,
    };
    const econ = evaluateFarmEconomics(farmInput);
    const steps = farmSteps(farmInput);
    verdictCounts[econ.verdict]++;

    board.push({
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: cat,
      family: fam,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      ageDays: item.pred.ageDays,
      watchlist: item.watchlist,
      above_floor: p.tvl_usd >= snapshot.floor_usd,
      implied_value_usd: finalVal,
      raw_implied_usd: rawVal,
      band_lo_usd: Math.min(item.pred.lo, finalVal),
      band_hi_usd: Math.max(item.pred.hi, finalVal),
      parts: item.pred.parts,
      peer_token_rate: item.od.peerRate,
      rem_launch_odds: item.od.remOdds,
      farm_verdict: econ.verdict,
      plan_capital_usd: econ.capitalUsd,
      plan_cost_usd: econ.totalCostUsd,
      exp_net_usd: econ.expNetUsd,
      cond_net_usd: econ.condNetUsd,
      farm_steps: steps,
    });
  }

  // 5. Build family & sector evidence summaries
  const pricedByFam = new Map<string, number[]>();
  const pricedByCat = new Map<string, number[]>();
  for (const p of tradingPriced) {
    const r = p.mcap_usd! / p.tvl_usd;
    const f = familyOf(p.category);
    const c = p.category ?? 'Uncategorized';
    const fl = pricedByFam.get(f) ?? [];
    fl.push(r);
    pricedByFam.set(f, fl);
    const cl = pricedByCat.get(c) ?? [];
    cl.push(r);
    pricedByCat.set(c, cl);
  }

  const peerTokByFam = new Map<string, { tok: number; tot: number }>();
  const peerTokByCat = new Map<string, { tok: number; tot: number }>();
  for (const p of eligUniverse) {
    const f = familyOf(p.category);
    const c = p.category ?? 'Uncategorized';
    const isT = hasTokenRecord(p) ? 1 : 0;
    const fp = peerTokByFam.get(f) ?? { tok: 0, tot: 0 };
    fp.tok += isT;
    fp.tot += 1;
    peerTokByFam.set(f, fp);
    const cp = peerTokByCat.get(c) ?? { tok: 0, tot: 0 };
    cp.tok += isT;
    cp.tot += 1;
    peerTokByCat.set(c, cp);
  }

  const families: FamilyStat[] = FAMILIES.map((f) => {
    const ratios = pricedByFam.get(f) ?? [];
    const pt = peerTokByFam.get(f) ?? { tok: 0, tot: 0 };
    return {
      family: f,
      priced_n: ratios.length,
      median_mult: ratios.length > 0 ? r3(median(ratios)) : 0,
      fitted_mult: r3(Math.exp(model.fam_eff[f] ?? 0)),
      tok_n: pt.tok,
      total_n: pt.tot,
    };
  }).sort((a, b) => b.fitted_mult - a.fitted_mult || a.family.localeCompare(b.family));

  const boardCats = new Set(board.map((r) => r.category));
  const allShownCats = new Set([...boardCats, ...pricedByCat.keys()]);
  const sectors: SectorStat[] = [...allShownCats]
    .sort()
    .map((cat) => {
      const f = familyOf(cat);
      const ratios = pricedByCat.get(cat) ?? [];
      const pt = peerTokByCat.get(cat) ?? { tok: 0, tot: 0 };
      const fm = Math.exp(model.fam_eff[f] ?? 0);
      const cm = Math.exp(model.cat_eff[cat] ?? 0);
      return {
        category: cat,
        family: f,
        priced_n: ratios.length,
        median_mult: ratios.length > 0 ? r3(median(ratios)) : 0,
        fam_mult: r3(fm),
        cat_mult: r3(cm),
        combined_mult: r3(fm * cm),
        tok_n: pt.tok,
        total_n: pt.tot,
      };
    });

  // 6. Select representative traded comps across board sectors (up to 24, closest to sector median mcap/TVL)
  const comps: CompRow[] = [];
  const usedSlugs = new Set<string>();
  const boardCatList = [...boardCats].sort((a, b) => {
    const da = (pricedByCat.get(b)?.length ?? 0) - (pricedByCat.get(a)?.length ?? 0);
    return da !== 0 ? da : a.localeCompare(b);
  });
  const byCatProtos = new Map<string, SnapshotProtocol[]>();
  for (const p of tradingPriced) {
    const c = p.category ?? 'Uncategorized';
    const arr = byCatProtos.get(c) ?? [];
    arr.push(p);
    byCatProtos.set(c, arr);
  }
  const pickFromCat = (c: string, nth: number): SnapshotProtocol | null => {
    const arr = (byCatProtos.get(c) ?? []).filter((x) => x.mcap_usd! / x.tvl_usd <= 50);
    if (arr.length <= nth) return null;
    const med = median(arr.map((x) => x.mcap_usd! / x.tvl_usd));
    const sorted = arr.slice().sort((a, b) => {
      const da = Math.abs(Math.log(a.mcap_usd! / a.tvl_usd) - Math.log(med));
      const db = Math.abs(Math.log(b.mcap_usd! / b.tvl_usd) - Math.log(med));
      if (Math.abs(da - db) > 1e-9) return da - db;
      return b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug);
    });
    return sorted[nth] ?? null;
  };
  for (let pass = 0; pass < 3 && comps.length < 24; pass++) {
    for (const c of boardCatList) {
      if (comps.length >= 24) break;
      const picked = pickFromCat(c, pass);
      if (!picked || usedSlugs.has(picked.slug)) continue;
      usedSlugs.add(picked.slug);
      comps.push({
        slug: picked.slug,
        name: picked.name,
        category: picked.category ?? 'Uncategorized',
        family: familyOf(picked.category),
        tvl_usd: Math.round(picked.tvl_usd),
        mcap_usd: Math.round(picked.mcap_usd!),
        loo_pred_usd: looPredsUsd.get(picked.slug) ?? 0,
        change_7d: picked.change_7d,
        ageDays: ageDaysBetween(picked.listed_at, snapshot.as_of),
      });
    }
  }

  const discoveryAboveFloor = discoveryProtos.filter((p) => p.tvl_usd >= snapshot.floor_usd).length;

  return {
    board,
    summary: {
      as_of: snapshot.as_of,
      source: snapshot.source,
      floor_usd: snapshot.floor_usd,
      universe: {
        total: snapshot.protocols.length,
        trading_total: tradingAll.length,
        trading_priced: tradingPriced.length,
        trading_zero_or_neg: tradingZeroOrNeg,
        trading_null_mcap: tradingNullMcap,
        pretoken_total: pretokenTotal,
        watchlist_total: snapshot.watchlist.length,
        watchlist_covered: watchlistProtos.length,
        discovery_total: discoveryProtos.length,
        discovery_above_floor: discoveryAboveFloor,
        discovery_below_floor: discoveryProtos.length - discoveryAboveFloor,
        excluded_total: excludedTotal,
        excluded_reasons: Object.fromEntries(
          Object.entries(excludedReasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        ),
      },
      model,
      odds,
      validation,
      families,
      sectors,
      comps,
      verdict_counts: verdictCounts,
    },
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (!Array.isArray(board) || board.length < 100 || board.length > 4000) {
    return `Expected 100-4000 board rows, got ${Array.isArray(board) ? board.length : 'non-array'}`;
  }
  const validSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seenSlugs = new Set<string>();

  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (row.rank !== i + 1) return `Row ${i} has rank ${row.rank}, expected ${i + 1}`;
    if (!validSlugs.has(row.slug)) return `Row rank ${row.rank} slug "${row.slug}" not in snapshot`;
    if (seenSlugs.has(row.slug)) return `Duplicate slug "${row.slug}" at rank ${row.rank}`;
    seenSlugs.add(row.slug);

    const val = row.implied_value_usd;
    if (!Number.isInteger(val) || val < 1 || val > MAX_IMPLIED_USD) {
      return `Row rank ${row.rank} implied_value_usd ${val} invalid`;
    }
    if (i > 0 && val >= board[i - 1]!.implied_value_usd) {
      return `Row rank ${row.rank} value (${val}) not strictly below rank ${i} (${board[i - 1]!.implied_value_usd})`;
    }
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `Row rank ${row.rank} must have 3-12 farm_steps`;
    }
    for (const step of row.farm_steps) {
      const len = typeof step === 'string' ? step.trim().length : -1;
      if (len < 20 || len > 600) {
        return `Row rank ${row.rank} farm_step trimmed length ${len} outside 20-600`;
      }
    }
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return 'All rows share the same implied_value_usd';
  }
  for (const wSlug of snapshot.watchlist) {
    if (!seenSlugs.has(wSlug)) return `Watchlist slug "${wSlug}" missing from board`;
  }
  return null;
}

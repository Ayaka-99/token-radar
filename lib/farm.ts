/**
 * lib/farm.ts — Deterministic farming playbooks, comparable token selections,
 * and dashboard data script serialization.
 * Pure functions only: no network, no Date.now(), no Math.random().
 */

import type { Snapshot, BoardRow } from './model.ts';

export interface FarmInput {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  ageDays: number | null;
  implied_value_usd: number;
}

export interface FarmStep {
  title: string;
  body: string;
  cost: string;
  time: string;
}

export const GAS_USD: Record<string, number> = {
  Ethereum: 2,
  Bitcoin: 1.5,
  Tron: 1,
  Avalanche: 0.1,
  Arbitrum: 0.05,
  Optimism: 0.05,
  'zkSync Era': 0.05,
  Starknet: 0.05,
  Binance: 0.08,
  Base: 0.03,
  Mantle: 0.03,
  Polygon: 0.02,
  Ink: 0.02,
  Unichain: 0.02,
  Monad: 0.02,
  Berachain: 0.02,
  Katana: 0.02,
  Sei: 0.01,
  Solana: 0.01,
  'Hyperliquid L1': 0.01,
  Sui: 0.01,
  Aptos: 0.01,
  Stellar: 0.01,
  Plasma: 0.01,
  Tempo: 0.01,
  Ripple: 0.01,
  Flare: 0.01,
  Algorand: 0.01,
  Arc: 0.01,
  Stable: 0.01,
  Morph: 0.02,
  'Robinhood Chain': 0.02,
  'Plume Mainnet': 0.02,
};

export const DEFAULT_GAS_USD = 0.5;

export function getGasUsd(chain: string): number {
  return GAS_USD[chain] ?? DEFAULT_GAS_USD;
}

export type FamilyId =
  | 'curator'
  | 'yield'
  | 'lending'
  | 'cdp'
  | 'exchange'
  | 'perpetuals'
  | 'rwa'
  | 'basis'
  | 'staking'
  | 'bitcoin'
  | 'chain'
  | 'generic';

export const CATEGORY_TO_FAMILY: Record<string, FamilyId> = {
  'Risk Curators': 'curator',
  'Onchain Capital Allocator': 'curator',
  Yield: 'yield',
  'Yield Aggregator': 'yield',
  Farm: 'yield',
  'Liquidity Manager': 'yield',
  'Leveraged Farming': 'yield',
  Lending: 'lending',
  'Collateral Markets': 'lending',
  CDP: 'cdp',
  'CDP Manager': 'cdp',
  Dexs: 'exchange',
  'OTC Marketplace': 'exchange',
  Derivatives: 'perpetuals',
  'Prediction Market': 'perpetuals',
  RWA: 'rwa',
  'Basis Trading': 'basis',
  'Stablecoin Wrapper': 'basis',
  'Dual-Token Stablecoin': 'basis',
  'Staking Pool': 'staking',
  Restaking: 'staking',
  'Anchor BTC': 'bitcoin',
  'Decentralized BTC': 'bitcoin',
  Chain: 'chain',
  'Cross Chain Bridge': 'chain',
};

export interface FamilyProfile {
  asset: string;
  entry: string;
  weekly: string;
  risk: string;
  exit: string;
  exitTime: string;
}

export const FAMILY_PROFILES: Record<FamilyId, FamilyProfile> = {
  curator: {
    asset: 'USDC or WETH',
    entry: 'deposit into the largest stablecoin vault {N} curates',
    weekly: "check the vault's market allocation and claim any rewards it streams",
    risk: 'A curated vault inherits bad debt from every market it lends into; read its market list and keep one curator under 20% of your stables',
    exit: 'withdraw; big exits can wait on idle liquidity',
    exitTime: '1–2 days',
  },
  yield: {
    asset: "the vault's deposit asset (usually USDC or ETH)",
    entry: "deposit into {N}'s highest-TVL vault or pool",
    weekly: 'claim accrued rewards and re-deposit them',
    risk: 'Yield vaults stack strategy risk on contract risk; read the strategy before sizing up',
    exit: 'withdraw; unwinding strategies can take hours',
    exitTime: 'same day',
  },
  lending: {
    asset: 'blue-chip collateral (ETH, BTC wrapper or USDC)',
    entry: 'supply collateral on {N} and borrow a stablecoin at under 35% LTV',
    weekly: 'repay part of the loan and re-borrow so supply and borrow both accrue',
    risk: 'A borrow is liquidated if collateral falls; keep the health factor above 1.8 and set a price alert',
    exit: 'repay the debt, then withdraw collateral',
    exitTime: 'same day',
  },
  cdp: {
    asset: 'accepted collateral (ETH, LSTs or a BTC wrapper)',
    entry: 'open a {N} position and mint its stablecoin at a collateral ratio above 200%',
    weekly: 'park the minted stablecoin in the savings module and top up collateral if the ratio slips',
    risk: 'Redemptions and liquidations hit the lowest ratios first; stay far above the minimum',
    exit: 'repay the minted debt and withdraw collateral',
    exitTime: 'same day',
  },
  exchange: {
    asset: 'two liquid assets for a major pair',
    entry: 'add liquidity on {N} in its deepest pair and make 3 small swaps',
    weekly: 'swap once and re-centre the range so the position stays in range',
    risk: 'Impermanent loss can exceed fees on volatile pairs; prefer a stable or correlated pair',
    exit: 'withdraw liquidity and claim fees',
    exitTime: 'same day',
  },
  perpetuals: {
    asset: 'USDC margin',
    entry: 'open and close small offsetting positions on {N} at 1–2x',
    weekly: 'trade a modest volume; activity programs reward volume, not size',
    risk: 'Fees and funding add up; above 2x one wick can liquidate you',
    exit: 'close positions and withdraw margin',
    exitTime: 'same day',
  },
  rwa: {
    asset: 'USDC',
    entry: "pass {N}'s KYC, then subscribe to its tokenized fund",
    weekly: 'check the NAV and any reward accrual',
    risk: 'Subscriptions may be limited to verified or non-US wallets, and redemptions settle on business days',
    exit: 'request redemption',
    exitTime: '1–3 business days',
  },
  basis: {
    asset: 'USDC or USDT',
    entry: "mint {N}'s yield-bearing stablecoin and stake it",
    weekly: 'check the reward rate; funding-based yield can turn negative',
    risk: 'Basis yield needs positive funding and a sound custodian; a depeg or negative funding hits stakers first',
    exit: 'unstake (cooldowns can run 7 days) and redeem',
    exitTime: 'up to 7 days',
  },
  staking: {
    asset: "the chain's native token or ETH",
    entry: 'stake through {N} and keep the liquid receipt token',
    weekly: 'check operator performance and claim rewards',
    risk: 'Slashing and a receipt-token discount are the main risks, and unbonding locks capital',
    exit: 'unstake through the protocol queue',
    exitTime: '1–14 days',
  },
  bitcoin: {
    asset: 'BTC',
    entry: 'deposit BTC into {N} and hold the receipt token',
    weekly: 'check the receipt holds its BTC peg and claim rewards',
    risk: 'BTC wrappers rely on custody or bridge security, and redemptions can queue',
    exit: 'redeem back to native BTC',
    exitTime: '1–3 days',
  },
  chain: {
    asset: 'ETH or USDC',
    entry: 'bridge in through the canonical bridge and use 3 native apps on {N}: a swap, a lend and a liquidity position',
    weekly: 'make one action in a different native app',
    risk: 'Canonical bridge exits can take 7 days; keep only what you will use there',
    exit: 'bridge back out',
    exitTime: 'up to 7 days',
  },
  generic: {
    asset: 'USDC',
    entry: "deposit into {N}'s main product",
    weekly: 'interact once (deposit, claim or vote)',
    risk: 'Young contracts carry the most risk; start at the low end of the capital range',
    exit: 'withdraw',
    exitTime: 'same day',
  },
};

export const HOLD_WEEKS = 4;
export const AIRDROP_SHARE = 0.05;

export function getPrincipalRange(tvl_usd: number): string {
  if (tvl_usd >= 500_000_000) return '$1,000–$2,000';
  if (tvl_usd >= 100_000_000) return '$500–$1,000';
  if (tvl_usd >= 30_000_000) return '$250–$500';
  return '$100–$250';
}

export function fmtUsd(x: number): string {
  if (!Number.isFinite(x) || x < 0) return '$0.00';
  if (x < 10) return `$${x.toFixed(2)}`;
  if (x < 1000) return `$${Math.round(x)}`;
  const rounded = Math.round(x / 10) * 10;
  return `$${rounded.toLocaleString('en-US')}`;
}

export function fmtShortUsd(x: number): string {
  if (!Number.isFinite(x) || x < 0) return '$0.00';
  if (x >= 1_000_000_000) return `$${(x / 1_000_000_000).toFixed(2)}B`;
  if (x >= 1_000_000) return `$${(x / 1_000_000).toFixed(1)}M`;
  return fmtUsd(x);
}

export function pickChains(chains: string[]): {
  firstChain: string;
  primary: string;
  secondary: string | null;
} {
  const listed = chains.filter(Boolean).slice(0, 3);
  if (listed.length === 0) {
    return { firstChain: 'Ethereum', primary: 'Ethereum', secondary: null };
  }
  const firstChain = listed[0];
  const firstGas = getGasUsd(firstChain);
  let primary = firstChain;
  let primaryGas = firstGas;

  for (let i = 1; i < listed.length; i++) {
    const c = listed[i];
    const g = getGasUsd(c);
    if (g <= firstGas / 3 && g < primaryGas) {
      primary = c;
      primaryGas = g;
    }
  }

  let secondary: string | null = null;
  let secondaryGas = Infinity;
  for (const c of listed) {
    if (c === primary) continue;
    const g = getGasUsd(c);
    if (g < secondaryGas) {
      secondary = c;
      secondaryGas = g;
    }
  }

  return { firstChain, primary, secondary };
}

export function buildFarmPlan(input: FarmInput): FarmStep[] {
  const family: FamilyId = CATEGORY_TO_FAMILY[input.category] ?? 'generic';
  const profile = FAMILY_PROFILES[family];
  const { firstChain, primary, secondary } = pickChains(input.chains);
  const firstGas = getGasUsd(firstChain);
  const primaryGas = getGasUsd(primary);
  const secondaryGas = secondary ? getGasUsd(secondary) : 0;
  const capital = getPrincipalRange(input.tvl_usd);

  const isMomentum = input.change_7d !== null && input.change_7d > 5;
  const isStaging = input.change_7d !== null && input.change_7d < -10;
  const entryCalls = isStaging ? 4 : 2;
  const enterTime = isStaging ? '7 days' : '15 min';

  const totalCalls = 1 + entryCalls + HOLD_WEEKS + 2 + (secondary ? 3 : 0);
  const totalGas =
    primaryGas * (1 + entryCalls + HOLD_WEEKS + 2) + (secondary ? secondaryGas * 3 : 0);

  const steps: FarmStep[] = [];

  // 1. Fund
  const cheaperNote =
    primary !== firstChain
      ? ` (${primary} is cheaper than ${firstChain} at ${fmtUsd(firstGas)}/call.)`
      : '';
  steps.push({
    title: 'Fund',
    body: `Send ${capital} in ${profile.asset} to a fresh wallet on ${primary}, plus ${fmtUsd(totalGas * 1.5)} of gas tokens for the ${totalCalls} calls this plan makes.${cheaperNote}`,
    cost: `${fmtUsd(primaryGas)} transfer`,
    time: '10 min',
  });

  // 2. Enter
  const entryReplaced = profile.entry.replace(/\{N\}/g, input.name);
  const entryCap = entryReplaced.charAt(0).toUpperCase() + entryReplaced.slice(1);
  let enterExtra = '';
  if (isMomentum) {
    enterExtra = ` Do it within 48 hours: TVL grew ${input.change_7d!.toFixed(1)}% in 7 days, so a later entry gets a smaller pro-rata share.`;
  } else if (isStaging) {
    enterExtra = ` Split it into 3 tranches over 7 days: TVL fell ${Math.abs(input.change_7d!).toFixed(1)}% in 7 days, so confirm the outflow has stopped before adding.`;
  }
  steps.push({
    title: 'Enter',
    body: `${entryCap} on ${primary}.${enterExtra}`,
    cost: `${fmtUsd(primaryGas * entryCalls)} (${entryCalls} calls)`,
    time: enterTime,
  });

  // 3. Second chain (optional)
  if (secondary) {
    steps.push({
      title: 'Second chain',
      body: `Bridge a quarter of the position to ${secondary} and repeat the entry there; ${input.name} lists ${input.chains.length} chains and use on more than one is a common eligibility criterion.`,
      cost: `${fmtUsd(secondaryGas * 3)} + bridge fee`,
      time: '1 day',
    });
  }

  // 4. Hold
  let ageSentence: string;
  if (input.ageDays === null || input.ageDays === undefined) {
    ageSentence = 'Its listing date is unknown, so tenure cannot be judged.';
  } else if (input.ageDays >= 365) {
    ageSentence = `${input.name} has run ${Math.round(input.ageDays)} days with no token recorded; long programs tend to reward tenure, so hold through at least one more snapshot.`;
  } else {
    ageSentence = `${input.name} has run ${Math.round(input.ageDays)} days with no token recorded; early depositors usually weigh more in a first snapshot.`;
  }
  steps.push({
    title: 'Hold',
    body: `Leave the position for 4 weeks: snapshot programs usually weigh size times time, so churn costs you. ${ageSentence}`,
    cost: '$0',
    time: '4 weeks',
  });

  // 5. Weekly touch
  steps.push({
    title: 'Weekly touch',
    body: `Once a week, ${profile.weekly}.`,
    cost: `${fmtUsd(primaryGas * 4)} (4 calls)`,
    time: '5 min a week',
  });

  // 6. Risk check
  steps.push({
    title: 'Risk check',
    body: `${profile.risk}.`,
    cost: '$0',
    time: '10 min before entering',
  });

  // 7. Exit
  steps.push({
    title: 'Exit',
    body: `When you stop farming, ${profile.exit}.`,
    cost: `${fmtUsd(primaryGas * 2)} (2 calls)`,
    time: profile.exitTime,
  });

  // 8. Budget
  const earningsRate =
    input.tvl_usd > 0 ? (input.implied_value_usd / input.tvl_usd) * AIRDROP_SHARE : 0;
  const per1000 = 1000 * earningsRate;
  const breakEven = earningsRate > 0 ? totalGas / earningsRate : 0;
  steps.push({
    title: 'Budget',
    body: `${totalCalls} calls cost ${fmtUsd(totalGas)} in gas; with ${capital} on a ${fmtShortUsd(input.implied_value_usd)} implied value, 5% pro-rata is ${fmtUsd(per1000)} per $1,000 held (break-even ${fmtUsd(breakEven)}). Illustrative, not a forecast.`,
    cost: `${fmtUsd(totalGas)} gas`,
    time: 'about 5 weeks',
  });

  return steps;
}

export function serializeFarmStep(step: FarmStep): string {
  return `${step.title}: ${step.body} Cost: ${step.cost}. Time: ${step.time}.`;
}

export function farmSteps(input: FarmInput): string[] {
  return buildFarmPlan(input).map(serializeFarmStep);
}

export interface Comp {
  s: string;
  n: string;
  c: string;
  t: number;
  m: number;
}

const EXCLUDED_BOARD_CATS = new Set([
  'CEX',
  'Chain',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Foundation',
  'RWA',
]);

function medianVal(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function selectComps(snapshot: Snapshot): Comp[] {
  const protocols = snapshot.protocols || [];
  const boardCategories = new Set<string>();
  const tokenizedByCat = new Map<
    string,
    Array<{ slug: string; name: string; cat: string; tvl: number; mcap: number; mult: number }>
  >();

  for (const p of protocols) {
    const cat = p.category || '';
    if (!cat || EXCLUDED_BOARD_CATS.has(cat)) continue;

    const hasToken = Boolean(
      (p.gecko_id && String(p.gecko_id).trim() !== '') ||
        (p.symbol && String(p.symbol).trim() !== '' && p.symbol !== '-')
    );

    if (!hasToken && p.tvl_usd >= 1_000_000) {
      boardCategories.add(cat);
    }

    if (hasToken && p.tvl_usd > 0 && p.mcap_usd !== null && p.mcap_usd > 0) {
      const mult = p.mcap_usd / p.tvl_usd;
      if (mult > 0 && mult < 100) {
        let arr = tokenizedByCat.get(cat);
        if (!arr) {
          arr = [];
          tokenizedByCat.set(cat, arr);
        }
        arr.push({
          slug: p.slug,
          name: p.name,
          cat,
          tvl: p.tvl_usd,
          mcap: p.mcap_usd,
          mult,
        });
      }
    }
  }

  const catList = Array.from(boardCategories)
    .filter((c) => (tokenizedByCat.get(c)?.length ?? 0) > 0)
    .sort((a, b) => {
      const diff = (tokenizedByCat.get(b)?.length ?? 0) - (tokenizedByCat.get(a)?.length ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });

  const rankedByCat = new Map<string, Comp[]>();
  for (const cat of catList) {
    const items = tokenizedByCat.get(cat)!;
    const mults = items.map((x) => x.mult).sort((a, b) => a - b);
    const med = medianVal(mults);
    const sorted = items.slice().sort((a, b) => {
      const da = Math.abs(a.mult - med);
      const db = Math.abs(b.mult - med);
      if (Math.abs(da - db) > 1e-12) return da - db;
      if (b.tvl !== a.tvl) return b.tvl - a.tvl;
      return a.slug.localeCompare(b.slug);
    });
    rankedByCat.set(
      cat,
      sorted.slice(0, 2).map((x) => ({
        s: x.slug,
        n: x.name,
        c: x.cat,
        t: Math.round(x.tvl),
        m: Math.round(x.mcap),
      }))
    );
  }

  const result: Comp[] = [];
  for (const cat of catList) {
    if (result.length >= 20) break;
    const picks = rankedByCat.get(cat)!;
    if (picks.length >= 1) result.push(picks[0]);
  }
  for (const cat of catList) {
    if (result.length >= 20) break;
    const picks = rankedByCat.get(cat)!;
    if (picks.length >= 2) result.push(picks[1]);
  }

  return result;
}

function sig3(x: number): number {
  if (!Number.isFinite(x) || x === 0) return 0;
  return Number(x.toPrecision(3));
}

export type SectorEvidenceTuple = [string, number, number, number];
export type CompTuple = [string, string, number, number];

export function buildDataScript(
  board: BoardRow[],
  comps: Comp[],
  asOf: string,
  sectorEvidence?: SectorEvidenceTuple[]
): string {
  if (!asOf || typeof asOf !== 'string') {
    throw new Error('asOf (YYYY-MM-DD) is required');
  }
  const sortedRows = board.slice().sort((a, b) => a.rank - b.rank);

  const constants = {
    global_median: 0.214,
    clamp_floor: 0.047,
    clamp_ceiling: 1.047,
    k: 10,
    n_min: 5,
  };

  const sectors: SectorEvidenceTuple[] =
    sectorEvidence ??
    Array.from(new Set(sortedRows.map((r) => r.category)))
      .sort()
      .map((cat) => {
        const row = sortedRows.find((r) => r.category === cat)!;
        const bm = sig3(row.parts.bm);
        return [cat, 0, bm, bm];
      });

  const compTuples: CompTuple[] = comps.map((c) => [c.n, c.c, c.t, c.m]);

  const rowLines = sortedRows.map((row) =>
    JSON.stringify({
      r: row.rank,
      s: row.slug,
      n: row.name,
      c: row.category,
      w: row.watchlist ? 1 : 0,
      t: Math.round(row.tvl_usd),
      g:
        row.change_7d === null || row.change_7d === undefined
          ? null
          : row.change_7d,
      d: row.ageDays === null || row.ageDays === undefined ? null : row.ageDays,
      h: row.chains,
      v: Math.round(row.implied_value_usd),
      p: [
        sig3(row.parts.bm),
        sig3(row.parts.sf),
        sig3(row.parts.gf),
        sig3(row.parts.af),
        sig3(row.parts.cf),
      ],
    })
  );

  return [
    `window.BOARD = {`,
    `  "as_of": ${JSON.stringify(asOf)},`,
    `  "n": ${sortedRows.length},`,
    `  "constants": ${JSON.stringify(constants)},`,
    `  "sectors": ${JSON.stringify(sectors)},`,
    `  "comps": ${JSON.stringify(compTuples)},`,
    `  "rows": [`,
    rowLines.map((l) => `    ${l}`).join(',\n'),
    `  ]`,
    `};`,
  ].join('\n');
}

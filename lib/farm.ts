/**
 * lib/farm.ts — Deterministic farming playbooks, comparable token selections,
 * and dashboard data script serialization.
 * Pure functions only: no network, no Date.now(), no Math.random().
 */

export interface FarmInput {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  ageDays: number | null;
}

export const GAS_TABLE: Record<string, string> = {
  Ethereum: "$8",
  Solana: "$0.01",
  Base: "$0.05",
  Arbitrum: "$0.10",
  Optimism: "$0.10",
  Binance: "$0.15",
  Avalanche: "$0.30",
  Polygon: "$0.05",
  "Hyperliquid L1": "$0.01",
  Monad: "$0.02",
  Ink: "$0.05",
  Tempo: "$0.05",
};

export const DEFAULT_GAS = "$0.50";

export function getGas(chain: string): string {
  return GAS_TABLE[chain] ?? DEFAULT_GAS;
}

export function getPrincipalRange(tvl_usd: number): string {
  if (tvl_usd >= 500_000_000) return "$1,000–$2,000";
  if (tvl_usd >= 100_000_000) return "$500–$1,000";
  if (tvl_usd >= 30_000_000) return "$200–$500";
  return "$100–$200";
}

export const CATEGORY_TEMPLATES: Record<string, string[]> = {
  Dexs: [
    "Fund a dedicated wallet on {chain} with {principal} in liquid assets plus native gas (~{gas} per tx) — takes about 10 minutes.",
    "Execute 3–5 spot swaps on {name} on {chain} across major pairs using {principal} volume (gas ~{gas}) — about 15 minutes.",
    "Provide {principal} into an active concentrated or standard liquidity pool on {name} on {chain} (gas ~{gas}) and hold for 2–4 weeks.",
    "Bridge or route a secondary position onto {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) to record multi-market swap activity — 1–2 days.",
    "Claim accrued LP fees and rebalance your {name} liquidity range on {chain} weekly (gas ~{gas}) over 2–4 weeks to maintain active epochs.",
    "Vote on any active gauge or fee-tier governance snapshots on {chain} with {principal} staked weight (gas ~{gas}) — about 10 minutes per week.",
  ],
  Lending: [
    "Bridge or transfer {principal} of blue-chip collateral onto {chain} and reserve native gas (~{gas} per tx) — about 10 minutes.",
    "Supply {principal} into the highest-utilization lending market on {name} on {chain} (gas ~{gas}) — about 10 minutes.",
    "Borrow 30%–40% against your supplied collateral on {name} on {chain} (gas ~{gas}) and keep health factor above 1.8 for 2–4 weeks.",
    "Supply a secondary tranche of {principal} on {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) to register cross-deployment lending volume — 1–2 days.",
    "Repay a portion of debt and re-borrow on {chain} every 7 days (gas ~{gas}) to log recurring borrower interactions.",
    "Monitor liquidation buffers and accrue continuous supply/borrow points on {name} on {chain} (gas ~{gas} on exit) over 2–4 weeks.",
  ],
  RWA: [
    "Complete any required wallet verification and fund {principal} in stablecoins on {chain} (gas ~{gas}) — about 15 minutes.",
    "Mint or subscribe {principal} of tokenized RWA shares directly through {name} on {chain} (gas ~{gas}) — 1–2 days for settlement.",
    "Hold the minted {name} RWA asset in a self-custody wallet on {chain} for 2–4 weeks to accumulate time-weighted holding multipliers (gas ~{gas}).",
    "Bridge or deploy a companion {principal} tranche on {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) where composable pools exist — about 20 minutes.",
    "Deposit your {name} RWA receipt tokens into an integrated DeFi lending or LP market on {chain} (gas ~{gas}) for 7 days.",
    "Redeem or roll a small test tranche on {chain} (gas ~{gas}) after 2–4 weeks to record full lifecycle mint-and-redeem history.",
  ],
  "Risk Curators": [
    "Prepare {principal} in underlying lending assets (USDC, USDT, or WETH) on {chain} with gas reserves (~{gas}) — about 10 minutes.",
    "Deposit {principal} into a flagship vault curated by {name} on {chain} (gas ~{gas}) — about 10 minutes.",
    "Maintain your {name} curated vault deposit on {chain} untouched for 2–4 weeks to capture continuous epoch snapshots (gas ~{gas}).",
    "Allocate a secondary {principal} position into a {name} vault on {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) — 1–2 days.",
    "Use the {name} vault receipt token as collateral in a partner market on {chain} if supported (gas ~{gas}) for 7 days.",
    "Harvest rewards and rebalance between high-yield curated vaults on {chain} (gas ~{gas}) every 2–4 weeks.",
  ],
  Yield: [
    "Acquire {principal} of yield-bearing base assets on {chain} and set aside native gas (~{gas} per tx) — about 10 minutes.",
    "Deposit {principal} into {name} yield vaults or principal/yield split pools on {chain} (gas ~{gas}) — about 15 minutes.",
    "Provide liquidity to a {name} yield pool on {chain} with {principal} (gas ~{gas}) and keep staked for 2–4 weeks.",
    "Bridge a portion of capital to {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) to farm {name} multi-chain yield multipliers — 1–2 days.",
    "Claim accrued yield and restake rewards back into {name} on {chain} weekly (gas ~{gas}) over 7 days to 4 weeks.",
    "Roll maturing yield positions into the next {name} epoch on {chain} (gas ~{gas}) — about 10 minutes per maturity.",
  ],
  "Basis Trading": [
    "Fund {principal} in stablecoins on {chain} and reserve gas (~{gas} per transaction) — about 10 minutes.",
    "Mint delta-neutral synthetic units on {name} on {chain} using {principal} collateral (gas ~{gas}) — about 15 minutes.",
    "Stake the minted {name} synthetic asset into the protocol yield or points contract on {chain} (gas ~{gas}) for 2–4 weeks.",
    "Deploy a secondary {principal} basis position on {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) to capture cross-chain incentives — 1–2 days.",
    "Pair un-staked {name} synthetic tokens in a liquidity pool on {chain} (gas ~{gas}) for 7 days to earn boosted multiplier shards.",
    "Monitor funding rate epochs and claim or compound rewards on {chain} (gas ~{gas}) every 2–4 weeks.",
  ],
  "Onchain Capital Allocator": [
    "Transfer {principal} in core deposit assets onto {chain} with sufficient gas (~{gas}) — about 10 minutes.",
    "Deposit {principal} into {name} automated allocation vaults on {chain} (gas ~{gas}) — about 15 minutes.",
    "Hold the {name} vault receipt token on {chain} for 2–4 weeks to qualify for time-weighted allocator points (gas ~{gas}).",
    "Route an additional {principal} deposit into {name} on {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
    "Stake or lock the receipt token in {name} boost gauges on {chain} (gas ~{gas}) for 7 days.",
    "Execute a partial rebalance or reward claim on {chain} (gas ~{gas}) after 2–4 weeks to verify active wallet participation.",
  ],
  Chain: [
    "Bridge {principal} in ETH or stablecoins from {chain2} to {chain} via the canonical bridge (gas ~{gas2} on {chain2} and ~{gas} on {chain}) — about 15 minutes.",
    "Swap {principal} across at least 3 native DEX pools on {name} ({chain}, gas ~{gas}) — about 15 minutes.",
    "Supply {principal} into a native lending or LP protocol on {chain} (gas ~{gas}) and maintain the position for 2–4 weeks.",
    "Mint an onchain domain, badge, or low-cost NFT on {chain} (gas ~{gas}) to diversify contract interactions — about 10 minutes.",
    "Execute weekly transactions on {chain} (swaps, lending, or votes, gas ~{gas}) across 4 distinct calendar weeks (2–4 weeks total).",
    "Bridge a small test amount back between {chain} and {chain2} (gas ~{gas} and ~{gas2}) over 1–2 days to record bilateral bridge usage.",
  ],
  CDP: [
    "Fund a wallet on {chain} with {principal} in accepted collateral (ETH, LSTs, or BTC wrappers) plus gas (~{gas}) — about 10 minutes.",
    "Open a collateralized debt position on {name} on {chain} by depositing {principal} and minting the protocol stablecoin (gas ~{gas}) — about 15 minutes.",
    "Keep your {name} CDP collateral ratio safely above 200% on {chain} and hold the minted debt open for 2–4 weeks (gas ~{gas}).",
    "Deposit the minted stablecoin into the {name} stability pool or savings module on {chain} (gas ~{gas}) for 7 days.",
    "Bridge or mint a companion {principal} CDP position on {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) — 1–2 days.",
    "Adjust collateral or debt slightly on {chain} every 7 days (gas ~{gas}) to generate recurring protocol touchpoints over 2–4 weeks.",
  ],
  Restaking: [
    "Acquire {principal} in ETH, LSTs, or supported restaking collateral on {chain} with gas (~{gas}) — about 10 minutes.",
    "Restake {principal} into {name} on {chain} to mint liquid restaking tokens or delegate to an operator (gas ~{gas}) — about 15 minutes.",
    "Hold your restaked {name} position on {chain} continuously for 2–4 weeks to accrue uninterrupted restaking points (gas ~{gas}).",
    "Bridge or deploy {principal} of {name} restaked assets onto {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
    "Supply the {name} receipt token into a partner lending or pendle-style yield pool on {chain} (gas ~{gas}) for 7 days.",
    "Claim operator rewards or restaking epoch snapshots on {chain} (gas ~{gas}) every 2–4 weeks.",
  ],
  "Staking Pool": [
    "Prepare {principal} in native chain tokens on {chain} along with transaction gas (~{gas}) — about 10 minutes.",
    "Stake {principal} into {name} on {chain} to receive liquid staking tokens (gas ~{gas}) — about 10 minutes.",
    "Hold the {name} liquid staking token on {chain} for 2–4 weeks to accumulate staking loyalty points (gas ~{gas}).",
    "Provide {principal} of your {name} staked token into a DEX liquidity pair on {chain} (gas ~{gas}) for 7 days.",
    "Bridge a portion of staked tokens to {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) to participate in cross-chain DeFi pools — 1–2 days.",
    "Vote in any {name} validator gauge or governance proposal on {chain} (gas ~{gas}) over a 2–4 week cycle.",
  ],
  "Collateral Markets": [
    "Transfer {principal} of collateral assets onto {chain} and keep native gas ready (~{gas}) — about 10 minutes.",
    "Deposit {principal} into {name} isolated collateral vaults on {chain} (gas ~{gas}) — about 15 minutes.",
    "Borrow against your {name} collateral at a conservative LTV on {chain} (gas ~{gas}) and maintain the position for 2–4 weeks.",
    "Open a secondary collateral market position on {chain2} with {principal} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
    "Provide liquidity to the {name} liquidation or stability backstop pool on {chain} (gas ~{gas}) for 7 days.",
    "Rebalance collateral health and claim rewards on {chain} (gas ~{gas}) after 2–4 weeks.",
  ],
  "Stablecoin Wrapper": [
    "Fund {principal} in USDC or USDT on {chain} with native gas (~{gas}) — about 10 minutes.",
    "Wrap or mint {principal} into {name} wrapper tokens on {chain} (gas ~{gas}) — about 10 minutes.",
    "Hold and stake {principal} of {name} wrapped stablecoins in the savings module on {chain} (gas ~{gas}) for 2–4 weeks.",
    "Bridge {name} wrapped stablecoins from {chain} to {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
    "Supply {principal} of the wrapped token into a partner DEX or lending pool on {chain} (gas ~{gas}) for 7 days.",
    "Unwrap and re-wrap a small tranche on {chain} (gas ~{gas}) after 2–4 weeks to log bidirectional contract activity.",
  ],
  "Governance Incentives": [
    "Acquire {principal} in supported governance or ve-derivative tokens on {chain} plus gas (~{gas}) — about 15 minutes.",
    "Lock or stake {principal} into {name} incentive vaults on {chain} (gas ~{gas}) — about 15 minutes.",
    "Cast gauge or bribe votes through {name} on {chain} every epoch (gas ~{gas}) across 2–4 weeks.",
    "Bridge or allocate {principal} into {name} pools on {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) — 1–2 days.",
    "Claim bribe emissions and re-compound into {name} on {chain} after 7 days (gas ~{gas}).",
    "Maintain active voting weight on {name} on {chain} for 2–4 weeks to qualify for retroactive governance snapshots (gas ~{gas}).",
  ],
  Insurance: [
    "Prepare {principal} in stablecoins or ETH on {chain} with gas reserves (~{gas}) — about 10 minutes.",
    "Supply {principal} into {name} underwriting or risk-capital pools on {chain} (gas ~{gas}) — about 15 minutes.",
    "Keep your underwriting capital staked in {name} on {chain} for 2–4 weeks to earn premium yield and points (gas ~{gas}).",
    "Purchase a small cover policy on {name} on {chain} (gas ~{gas}) for 7 days to record both buyer and underwriter activity.",
    "Deploy a secondary {principal} underwriting tranche on {chain2} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
    "Claim underwriting rewards and roll capital into the next {name} epoch on {chain} (gas ~{gas}) after 2–4 weeks.",
  ],
  CeDeFi: [
    "Fund {principal} in stablecoins or major assets on {chain} and reserve gas (~{gas}) — about 10 minutes.",
    "Deposit {principal} into {name} onchain custody/strategy vaults on {chain} (gas ~{gas}) — about 15 minutes.",
    "Mint the {name} liquid receipt token on {chain} and hold it in your wallet for 2–4 weeks (gas ~{gas}).",
    "Bridge or allocate {principal} of {name} receipt tokens onto {chain2} (gas ~{gas} on {chain}, ~{gas2} on {chain2}) — 1–2 days.",
    "Stake the receipt token in {name} farming pools or partner money markets on {chain} (gas ~{gas}) for 7 days.",
    "Request a partial settlement or reward claim on {chain} (gas ~{gas}) after 2–4 weeks to complete a full deposit cycle.",
  ],
};

export const FALLBACK_TEMPLATE: string[] = [
  "Fund a wallet on {chain} with {principal} in liquid capital plus native gas (~{gas} per tx) — takes about 10 minutes.",
  "Deposit or supply {principal} into {name} core contracts on {chain} (gas ~{gas}) — about 15 minutes.",
  "Maintain your active {principal} position on {name} on {chain} for 2–4 weeks to capture recurring snapshot epochs (gas ~{gas}).",
  "Execute a secondary interaction with {name} on {chain2} using {principal} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
  "Claim accrued rewards, rebalance, or vote on {name} on {chain} every 7 days (gas ~{gas}) over 2–4 weeks.",
];

export function farmSteps(input: FarmInput): string[] {
  const chain = input.chains.length > 0 && input.chains[0] ? input.chains[0] : "Ethereum";
  const chain2 = input.chains.length > 1 && input.chains[1] ? input.chains[1] : chain;
  const gas = getGas(chain);
  const gas2 = getGas(chain2);
  const principal = getPrincipalRange(input.tvl_usd);
  const template = CATEGORY_TEMPLATES[input.category] ?? FALLBACK_TEMPLATE;

  const fill = (tpl: string): string =>
    tpl
      .replace(/\{name\}/g, input.name)
      .replace(/\{chain2\}/g, chain2)
      .replace(/\{chain\}/g, chain)
      .replace(/\{principal\}/g, principal)
      .replace(/\{gas2\}/g, gas2)
      .replace(/\{gas\}/g, gas)
      .trim();

  const steps: string[] = template.map(fill);

  if (input.change_7d !== null && input.change_7d > 5) {
    steps.push(
      `Momentum alert: ${input.name} TVL is growing fast (+${input.change_7d.toFixed(1)}% over 7d); deploy your ${principal} position on ${chain} (gas ~${gas}) within 1–2 days to enter before the next points snapshot.`
    );
  } else if (input.change_7d !== null && input.change_7d < -10) {
    steps.push(
      `Drawdown caution: ${input.name} TVL is down ${input.change_7d.toFixed(1)}% over 7d; start small with the lower end of ${principal} on ${chain} (gas ~${gas}) and scale in gradually over 7 days.`
    );
  }

  if (input.ageDays !== null && input.ageDays > 365) {
    steps.push(
      `Longevity note: ${input.name} has run over a year (${Math.round(input.ageDays)} days) without a token; sustain consistent weekly transactions with ${principal} on ${chain} (gas ~${gas}) over 2–4 weeks to qualify for loyalty tiers.`
    );
  }

  return steps;
}

import type { Snapshot, BoardRow } from './model.ts';

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

    if (!hasToken && !p.parentProtocol && p.tvl_usd >= 1_000_000) {
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

  // Sort categories by board candidate count or alphabetically for determinism,
  // picking 1 per category first then a 2nd from the largest categories up to 20
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

export function buildDataScript(board: BoardRow[], comps: Comp[], asOf: string): string {
  if (!asOf || typeof asOf !== 'string') {
    throw new Error('asOf (YYYY-MM-DD) is required');
  }
  const sortedRows = board.slice().sort((a, b) => a.rank - b.rank);
  const rows = sortedRows.map((row) => ({
    r: row.rank,
    s: row.slug,
    n: row.name,
    c: row.category,
    w: row.watchlist ? 1 : 0,
    t: Math.round(row.tvl_usd),
    g: row.change_7d === null || row.change_7d === undefined ? null : Math.round(row.change_7d * 10) / 10,
    d: row.ageDays === null || row.ageDays === undefined ? null : row.ageDays,
    k: row.chains.length,
    h: row.chains.slice(0, 3),
    v: Math.round(row.implied_value_usd),
    p: [
      sig3(row.parts.bm),
      sig3(row.parts.sf),
      sig3(row.parts.gf),
      sig3(row.parts.af),
      sig3(row.parts.cf),
    ],
  }));

  const payload = {
    as_of: asOf,
    n: rows.length,
    rows,
    comps,
  };

  return `window.BOARD = ${JSON.stringify(payload)};`;
}

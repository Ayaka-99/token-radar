// Deterministic plan-sized farm playbooks, net-EV verdicts (FARM / THIN / SKIP),
// and compact dashboard data serialization (kept well under dossier 64 KiB cap).
// Pure functions only: no network, no Date.now(), no Math.random().

import type { BoardRow, BoardSummary } from './model.ts';

export type FarmVerdict = 'FARM' | 'THIN' | 'SKIP';

export interface FarmInput {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  ageDays: number | null;
  implied_value_usd: number;
  rem_launch_odds: number;
}

export interface FarmStep {
  title: string;
  body: string;
  cost: string;
  time: string;
}

export interface FarmEconomics {
  firstChain: string;
  primaryChain: string;
  secondaryChain: string | null;
  capitalUsd: number;
  holdWeeks: number;
  totalCalls: number;
  gasUsd: number;
  frictionUsd: number;
  cashCostUsd: number;
  oppCostUsd: number;
  totalCostUsd: number;
  condGrossUsd: number;
  expGrossUsd: number;
  condNetUsd: number;
  expNetUsd: number;
  breakEvenCondUsd: number;
  breakEvenExpUsd: number;
  verdict: FarmVerdict;
}

export const GAS_USD: Record<string, number> = {
  Ethereum: 2.0,
  Bitcoin: 1.5,
  Tron: 1.0,
  Avalanche: 0.1,
  Binance: 0.08,
  Arbitrum: 0.05,
  Optimism: 0.05,
  'zkSync Era': 0.05,
  Starknet: 0.05,
  Base: 0.03,
  Mantle: 0.03,
  Polygon: 0.02,
  Ink: 0.02,
  Unichain: 0.02,
  Monad: 0.02,
  Berachain: 0.02,
  Katana: 0.02,
  Morph: 0.02,
  'Robinhood Chain': 0.02,
  'Plume Mainnet': 0.02,
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
  Bittensor: 0.02,
  Provenance: 0.05,
  Noble: 0.01,
  BSquared: 0.02,
  Mezo: 0.02,
  RISE: 0.01,
  XION: 0.01,
  Manta: 0.03,
};

export const DEFAULT_GAS_USD = 0.25;
export const AIRDROP_SHARE = 0.05;
export const RISK_FREE_APR = 0.04;

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
  Options: 'perpetuals',
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
  feeBps: number; // protocol swap/mint/spread friction in bps of capital
}

export const FAMILY_PROFILES: Record<FamilyId, FamilyProfile> = {
  curator: {
    asset: 'USDC or WETH',
    entry: 'deposit into the deepest stablecoin vault {N} curates',
    weekly: 'audit vault market allocation and claim any streamed incentives',
    risk: 'Curated vaults inherit bad debt from every underlying lending market; cap one curator under 20% of stables',
    exit: 'redeem vault shares; large exits can wait on idle liquidity',
    exitTime: '1–2 days',
    feeBps: 5,
  },
  yield: {
    asset: 'USDC or ETH',
    entry: "deposit into {N}'s highest-TVL vault or pool",
    weekly: 'claim accrued yield and compound once',
    risk: 'Yield strategies stack underlying protocol risk on contract risk; verify audit and withdrawal queue first',
    exit: 'withdraw vault shares and claim residual rewards',
    exitTime: 'same day',
    feeBps: 10,
  },
  lending: {
    asset: 'blue-chip collateral (ETH, BTC wrapper or USDC)',
    entry: 'supply collateral on {N} and borrow a stablecoin below 35% LTV',
    weekly: 'repay 10% of the loan and re-borrow so supply and borrow both log activity',
    risk: 'Collateral drawdowns trigger liquidation; keep health factor above 1.8 with a price alert',
    exit: 'repay borrow balance in full, then withdraw collateral',
    exitTime: 'same day',
    feeBps: 15,
  },
  cdp: {
    asset: 'accepted collateral (ETH, LSTs or BTC wrapper)',
    entry: 'open a {N} vault and mint its stablecoin above 200% collateral ratio',
    weekly: 'stake minted stablecoin in the savings pool and top up collateral if ratio slips',
    risk: 'Redemptions and liquidations hit the lowest collateral ratios first; stay well above the floor',
    exit: 'repay minted debt and withdraw collateral',
    exitTime: 'same day',
    feeBps: 25,
  },
  exchange: {
    asset: 'two liquid assets for a major pair',
    entry: "provide liquidity in {N}'s deepest correlated pair and execute 3 small swaps",
    weekly: 'run one swap and re-center range if price drifts out of bounds',
    risk: 'Impermanent loss can outpace fees on volatile pairs; stick to stable or correlated pairs',
    exit: 'remove LP position and collect swap fees',
    exitTime: 'same day',
    feeBps: 30,
  },
  perpetuals: {
    asset: 'USDC margin',
    entry: 'deposit margin on {N} and open/close small 1–2x delta-neutral trades',
    weekly: 'generate steady weekly volume at 1–2x; points reward consistent volume over leverage',
    risk: 'Taker fees, funding swings and sudden wicks liquidate positions above 2x',
    exit: 'close open positions and withdraw USDC margin',
    exitTime: 'same day',
    feeBps: 45,
  },
  rwa: {
    asset: 'USDC',
    entry: "complete {N}'s KYC onboarding and subscribe to its tokenized yield fund",
    weekly: 'verify NAV accrual and check reward distribution eligibility',
    risk: 'Subscriptions may require KYC/non-US eligibility and redemptions settle only on business days',
    exit: 'submit fund redemption request to USDC',
    exitTime: '1–3 business days',
    feeBps: 15,
  },
  basis: {
    asset: 'USDC or USDT',
    entry: "mint {N}'s yield-bearing stablecoin and stake it for points",
    weekly: 'check funding-rate yield; negative perp funding compresses or reverses payouts',
    risk: 'Basis strategies depend on positive funding and custodian solvency; a depeg hits stakers first',
    exit: 'initiate unstake cooldown (up to 7 days) and redeem',
    exitTime: 'up to 7 days',
    feeBps: 20,
  },
  staking: {
    asset: 'native chain token or ETH',
    entry: 'stake through {N} and hold the liquid receipt token in wallet',
    weekly: 'review validator/operator uptime and claim staking incentives',
    risk: 'Slashing, operator downtime and receipt-token secondary discounts are the main risks',
    exit: 'enter unstaking queue or swap receipt token',
    exitTime: '1–14 days',
    feeBps: 15,
  },
  bitcoin: {
    asset: 'BTC',
    entry: 'deposit BTC into {N} and hold the minted receipt token',
    weekly: 'verify BTC peg health and claim accrued protocol rewards',
    risk: 'BTC wrappers rely on bridge or custodian security and redemptions can queue',
    exit: 'burn receipt token to redeem native BTC',
    exitTime: '1–3 days',
    feeBps: 25,
  },
  chain: {
    asset: 'ETH or USDC',
    entry: 'bridge via canonical bridge into {N} and run 3 native actions (swap, lend, LP)',
    weekly: 'execute one transaction in a distinct native app on {N}',
    risk: 'Canonical bridge exits can take up to 7 days; size only what you can lock',
    exit: 'unwind native positions and bridge back out',
    exitTime: 'up to 7 days',
    feeBps: 30,
  },
  generic: {
    asset: 'USDC',
    entry: "deposit into {N}'s primary active pool or product",
    weekly: 'make one on-chain interaction (deposit, claim or governance action)',
    risk: 'Newer contracts carry higher smart-contract risk; keep sizing conservative',
    exit: 'withdraw principal and claim pending rewards',
    exitTime: 'same day',
    feeBps: 15,
  },
};

export function getPlanCapital(tvlUsd: number): number {
  if (tvlUsd >= 500_000_000) return 1000;
  if (tvlUsd >= 100_000_000) return 500;
  if (tvlUsd >= 30_000_000) return 300;
  return 200;
}

export function getHoldWeeks(ageDays: number | null): number {
  if (ageDays !== null && ageDays < 180) return 6;
  return 4;
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
  if (listed.length === 0) return { firstChain: 'Ethereum', primary: 'Ethereum', secondary: null };
  const firstChain = listed[0]!;
  const firstGas = getGasUsd(firstChain);
  let primary = firstChain;
  let primaryGas = firstGas;
  for (let i = 1; i < listed.length; i++) {
    const c = listed[i]!;
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

export function evaluateFarmEconomics(input: FarmInput, capitalOverride?: number): FarmEconomics {
  const fam: FamilyId = CATEGORY_TO_FAMILY[input.category] ?? 'generic';
  const profile = FAMILY_PROFILES[fam];
  const { firstChain, primary, secondary: rawSecondary } = pickChains(input.chains);
  const capitalUsd = capitalOverride ?? getPlanCapital(input.tvl_usd);
  const secondary =
    rawSecondary && (getGasUsd(rawSecondary) < 1.0 || capitalUsd >= 1000) ? rawSecondary : null;
  const holdWeeks = getHoldWeeks(input.ageDays);
  const isStaging = input.change_7d !== null && input.change_7d < -10;
  const entryCalls = isStaging ? 4 : 2;

  const pGas = getGasUsd(primary);
  const sGas = secondary ? getGasUsd(secondary) : 0;
  const primaryCalls = 1 + entryCalls + holdWeeks + 2;
  const secondaryCalls = secondary ? 3 : 0;
  const totalCalls = primaryCalls + secondaryCalls;
  const gasUsd = Math.round((pGas * primaryCalls + sGas * secondaryCalls) * 100) / 100;

  const bridgeFee = secondary ? (primary === 'Ethereum' || secondary === 'Ethereum' ? 4.0 : 1.0) : 0;
  const protocolFee = (capitalUsd * profile.feeBps) / 10_000;
  const frictionUsd = Math.round((bridgeFee + protocolFee) * 100) / 100;
  const cashCostUsd = Math.round((gasUsd + frictionUsd) * 100) / 100;
  const oppCostUsd = Math.round(capitalUsd * RISK_FREE_APR * (holdWeeks / 52) * 100) / 100;
  const totalCostUsd = Math.round((cashCostUsd + oppCostUsd) * 100) / 100;

  const condRate = input.tvl_usd > 0 ? (input.implied_value_usd / input.tvl_usd) * AIRDROP_SHARE : 0;
  const expRate = condRate * Math.max(0.05, Math.min(1, input.rem_launch_odds));
  const condGrossUsd = Math.round(capitalUsd * condRate * 100) / 100;
  const expGrossUsd = Math.round(capitalUsd * expRate * 100) / 100;
  const condNetUsd = Math.round((condGrossUsd - cashCostUsd) * 100) / 100;
  const expNetUsd = Math.round((expGrossUsd - cashCostUsd) * 100) / 100;

  const fixedCost = gasUsd + bridgeFee;
  const unitDrag = profile.feeBps / 10_000;
  const breakEvenCondUsd = condRate > unitDrag ? Math.round(fixedCost / (condRate - unitDrag)) : 0;
  const breakEvenExpUsd = expRate > unitDrag ? Math.round(fixedCost / (expRate - unitDrag)) : 0;

  let verdict: FarmVerdict;
  if (expNetUsd >= 1.5 && expGrossUsd >= cashCostUsd * 1.35) {
    verdict = 'FARM';
  } else if (condNetUsd > 0) {
    verdict = 'THIN';
  } else {
    verdict = 'SKIP';
  }

  return {
    firstChain,
    primaryChain: primary,
    secondaryChain: secondary,
    capitalUsd,
    holdWeeks,
    totalCalls,
    gasUsd,
    frictionUsd,
    cashCostUsd,
    oppCostUsd,
    totalCostUsd,
    condGrossUsd,
    expGrossUsd,
    condNetUsd,
    expNetUsd,
    breakEvenCondUsd,
    breakEvenExpUsd,
    verdict,
  };
}

export function buildFarmPlan(input: FarmInput, capitalOverride?: number): FarmStep[] {
  const fam: FamilyId = CATEGORY_TO_FAMILY[input.category] ?? 'generic';
  const profile = FAMILY_PROFILES[fam];
  const econ = evaluateFarmEconomics(input, capitalOverride);
  const firstGas = getGasUsd(econ.firstChain);
  const pGas = getGasUsd(econ.primaryChain);
  const sGas = econ.secondaryChain ? getGasUsd(econ.secondaryChain) : 0;
  const isMomentum = input.change_7d !== null && input.change_7d > 5;
  const isStaging = input.change_7d !== null && input.change_7d < -10;
  const entryCalls = isStaging ? 4 : 2;
  const enterTime = isStaging ? '7 days' : '15 min';

  const steps: FarmStep[] = [];

  // 1. Fund
  const routeNote =
    econ.primaryChain !== econ.firstChain
      ? ` (${econ.primaryChain} saves gas vs ${econ.firstChain} at ${fmtUsd(firstGas)}/call.)`
      : '';
  steps.push({
    title: 'Fund',
    body: `Send ${fmtUsd(econ.capitalUsd)} in ${profile.asset} to a dedicated wallet on ${econ.primaryChain}, plus ${fmtUsd(econ.gasUsd * 1.5)} in native gas for ${econ.totalCalls} calls.${routeNote}`,
    cost: `${fmtUsd(pGas)} transfer`,
    time: '10 min',
  });

  // 2. Enter
  const entryAction = profile.entry.replace(/\{N\}/g, input.name);
  const entryCap = entryAction.charAt(0).toUpperCase() + entryAction.slice(1);
  let timingNote = '';
  if (isMomentum) {
    timingNote = ` Enter within 48 hours: TVL rose +${input.change_7d!.toFixed(1)}% in 7d, diluting later entrants.`;
  } else if (isStaging) {
    timingNote = ` Stage in 3 tranches over 7 days: TVL fell ${Math.abs(input.change_7d!).toFixed(1)}% in 7d, so confirm outflows stabilize.`;
  }
  steps.push({
    title: 'Enter',
    body: `${entryCap} on ${econ.primaryChain}.${timingNote}`,
    cost: `${fmtUsd(pGas * entryCalls)} gas (${entryCalls} calls)`,
    time: enterTime,
  });

  // 3. Second chain (multi-chain only)
  if (econ.secondaryChain) {
    const bFee = econ.primaryChain === 'Ethereum' || econ.secondaryChain === 'Ethereum' ? 4 : 1;
    steps.push({
      title: 'Second chain',
      body: `Bridge ${fmtUsd(Math.round(econ.capitalUsd * 0.25))} to ${econ.secondaryChain} and repeat the core action; ${input.name} spans ${input.chains.length} chains and multi-chain activity often qualifies separately.`,
      cost: `${fmtUsd(sGas * 3)} gas + ~${fmtUsd(bFee)} bridge`,
      time: '20 min',
    });
  }

  // 4. Hold
  let tenureNote: string;
  if (input.ageDays === null) {
    tenureNote = 'Listing date is unreported, so use a standard 4-week snapshot window.';
  } else if (input.ageDays < 180) {
    tenureNote = `Only ${Math.round(input.ageDays)}d tracked with no token; hold 6 weeks to anchor early-cohort multipliers.`;
  } else {
    tenureNote = `${Math.round(input.ageDays)}d tracked with no token; hold 4 weeks across at least one full snapshot epoch.`;
  }
  steps.push({
    title: 'Hold',
    body: `Keep capital deployed for ${econ.holdWeeks} weeks without churning (time-weighted points). ${tenureNote}`,
    cost: `${fmtUsd(econ.oppCostUsd)} opp. cost (4% APR)`,
    time: `${econ.holdWeeks} weeks`,
  });

  // 5. Weekly touch
  const weeklyAction = profile.weekly.replace(/\{N\}/g, input.name);
  steps.push({
    title: 'Weekly touch',
    body: `Once per week, ${weeklyAction}.`,
    cost: `${fmtUsd(pGas * econ.holdWeeks)} (${econ.holdWeeks} calls)`,
    time: '5 min/wk',
  });

  // 6. Risk check
  steps.push({
    title: 'Risk check',
    body: `${profile.risk}.`,
    cost: '$0',
    time: '10 min pre-entry',
  });

  // 7. Exit
  steps.push({
    title: 'Exit',
    body: `To unwind, ${profile.exit}.`,
    cost: `${fmtUsd(pGas * 2)} (2 calls)`,
    time: profile.exitTime,
  });

  // 8. Budget & Verdict
  const oddsPct = Math.round(input.rem_launch_odds * 100);
  const netSign = econ.expNetUsd >= 0 ? '+' : '-';
  const beNote =
    econ.breakEvenCondUsd > 0
      ? `cond. break-even ${fmtUsd(econ.breakEvenCondUsd)}`
      : 'fees exceed pro-rata yield';
  steps.push({
    title: `Verdict: ${econ.verdict}`,
    body: `At ${fmtUsd(econ.capitalUsd)}, cash cost is ${fmtUsd(econ.cashCostUsd)} (${fmtUsd(econ.gasUsd)} gas + ${fmtUsd(econ.frictionUsd)} fees; ${fmtUsd(econ.oppCostUsd)} 4% ref opp. cost). 5% pro-rata of ${fmtShortUsd(input.implied_value_usd)} pays ${fmtUsd(econ.condGrossUsd)} if launched (${fmtUsd(econ.expGrossUsd)} at ${oddsPct}% peer odds, net ${netSign}${fmtUsd(Math.abs(econ.expNetUsd))}; ${beNote}). Illustrative.`,
    cost: `${fmtUsd(econ.cashCostUsd)} cash`,
    time: `${econ.holdWeeks + 1} weeks`,
  });

  return steps;
}

export function serializeFarmStep(step: FarmStep): string {
  let s = `${step.title}: ${step.body} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 595) s = `${s.slice(0, 592)}...`;
  return s;
}

export function farmSteps(input: FarmInput): string[] {
  return buildFarmPlan(input).map(serializeFarmStep);
}

// Compact summary script written to dashboard/z-summary.js (~4.5 KB) so ALL dashboard
// files fit 100% whole inside buildDossier's 65,536-byte text cap with zero truncation.
export function buildSummaryScript(board: BoardRow[], summary: BoardSummary): string {
  const boardCats = new Set(board.map((r) => r.category));
  const keptCatEff: Record<string, number> = {};
  for (const [k, v] of Object.entries(summary.model.cat_eff)) {
    if (boardCats.has(k)) keptCatEff[k] = v;
  }
  const compactFamilies = summary.families.map((f) => [
    f.family,
    f.priced_n,
    f.median_mult,
    f.fitted_mult,
    f.tok_n,
    f.total_n,
  ]);
  const compactComps = summary.comps.slice(0, 20).map((c) => [
    c.name,
    c.category,
    c.tvl_usd,
    c.mcap_usd,
    c.loo_pred_usd,
  ]);
  const payload = {
    as_of: summary.as_of,
    floor: summary.floor_usd,
    u: summary.universe,
    m: { ...summary.model, cat_eff: keptCatEff },
    o: {
      n: summary.odds.n_peers,
      nt: summary.odds.n_tokenized,
      brier: summary.odds.brier_10f,
      base: summary.odds.brier_base,
      skill: summary.odds.brier_skill,
      auc: summary.odds.auc_10f,
    },
    val: summary.validation,
    vc: summary.verdict_counts,
    fams: compactFamilies,
    comps: compactComps,
  };
  return `window.SUMMARY=${JSON.stringify(payload)};\n`;
}

// Full 198-row dataset written to /output/data.js (beside dashboard/, matching the starter).
export function buildRowsScript(board: BoardRow[], summary: BoardSummary): string {
  const sortedRows = board.slice().sort((a, b) => a.rank - b.rank);
  const catList = Array.from(new Set(sortedRows.map((r) => r.category))).sort();
  const catIdx = new Map<string, number>();
  catList.forEach((c, i) => catIdx.set(c, i));

  const chSet = new Set<string>();
  for (const r of sortedRows) {
    for (const c of r.chains.slice(0, 5)) chSet.add(c);
  }
  const chList = Array.from(chSet).sort();
  const chIdx = new Map<string, number>();
  chList.forEach((c, i) => chIdx.set(c, i));

  const compactRows = sortedRows.map((r) => {
    const base: Array<number | string | null | number[]> = [
      r.rank,
      r.slug,
      r.name,
      catIdx.get(r.category) ?? 0,
      r.watchlist ? 1 : 0,
      Math.round(r.tvl_usd),
      r.change_7d === null ? null : Math.round(r.change_7d * 100) / 100,
      r.ageDays,
      r.chains.slice(0, 5).map((c) => chIdx.get(c) ?? 0),
      r.chains.length,
      r.implied_value_usd,
      Math.round(r.peer_token_rate * 100),
      Math.round(r.rem_launch_odds * 100),
    ];
    const sd = r.raw_implied_usd - r.implied_value_usd;
    if (sd !== 0) base.push(sd);
    return base;
  });

  const compactSectors = summary.sectors
    .filter((s) => catIdx.has(s.category))
    .map((s) => [catIdx.get(s.category)!, s.priced_n, s.median_mult, s.tok_n, s.total_n]);

  return `window.BOARD_ROWS=${JSON.stringify({ cats: catList, chs: chList, secs: compactSectors, rows: compactRows })};\n`;
}

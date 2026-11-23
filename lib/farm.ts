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
  chainCount?: number;
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
  oppCostRefUsd: number;
  condGrossUsd: number;
  expGrossUsd: number;
  condNetUsd: number;
  expNetUsd: number;
  expAprPct: number;
  breakEvenCondUsd: number;
  breakEvenExpUsd: number;
  verdict: FarmVerdict;
}

// Per-transaction gas estimates covering every chain on the pre-token board.
const GAS_TIERS: Array<[number, string[]]> = [
  [2.0, ['Ethereum']],
  [1.5, ['Bitcoin']],
  [1.0, ['Tron']],
  [0.3, ['RSK']],
  [0.1, ['Avalanche', 'Stacks']],
  [0.08, ['Binance']],
  [0.05, ['Arbitrum', 'Optimism', 'zkSync Era', 'Starknet', 'Provenance']],
  [0.04, ['Linea', 'Scroll', 'Blast']],
  [0.03, ['Base', 'Mantle', 'Manta', 'Hemi', 'Citrea']],
  [
    0.02,
    [
      'Polygon', 'Ink', 'Unichain', 'Monad', 'Berachain', 'Katana', 'Morph',
      'Robinhood Chain', 'Plume Mainnet', 'Bittensor', 'BSquared', 'Mezo',
      'Op_Bnb', 'Sophon', 'World Chain', 'Reya Network', 'Fluent', 'Pharos',
      'Canton', 'Story', 'Etherlink', 'Strato', 'Hibachi', 'Babylon Genesis',
      'Bifrost Network', 'ZIGChain', 'Aleo', 'CORE',
    ],
  ],
  [
    0.01,
    [
      'Sei', 'Solana', 'Hyperliquid L1', 'Sui', 'Aptos', 'Stellar', 'Plasma',
      'Tempo', 'Ripple', 'Flare', 'Algorand', 'Arc', 'Stable', 'Noble',
      'RISE', 'XION', 'Celo', 'Ronin', 'Klaytn', 'Flow', 'Qubic',
    ],
  ],
];

export const GAS_USD: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const [usd, list] of GAS_TIERS) {
    for (const c of list) m[c] = usd;
  }
  return m;
})();

export const DEFAULT_GAS_USD = 0.15;
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
  | 'otc'
  | 'perpetuals'
  | 'prediction'
  | 'rwa'
  | 'basis'
  | 'staking'
  | 'bitcoin'
  | 'chain'
  | 'insurance'
  | 'payments'
  | 'cedefi'
  | 'indexes'
  | 'governance'
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
  'Uncollateralized Lending': 'lending',
  CDP: 'cdp',
  'CDP Manager': 'cdp',
  'Collateral Management': 'cdp',
  Dexs: 'exchange',
  'OTC Marketplace': 'otc',
  Derivatives: 'perpetuals',
  Options: 'perpetuals',
  'Interest Rate Derivatives': 'perpetuals',
  'Prediction Market': 'prediction',
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
  Insurance: 'insurance',
  Payments: 'payments',
  'Crypto Card Issuer': 'payments',
  CeDeFi: 'cedefi',
  Indexes: 'indexes',
  'Governance Incentives': 'governance',
};

export interface FamilyProfile {
  asset: string;
  entry: string;
  weekly: string;
  risk: string;
  exit: string;
  exitTime: string;
  feeBps: number;
  yieldBearing: boolean;
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
    yieldBearing: true,
  },
  yield: {
    asset: 'USDC or ETH',
    entry: "deposit into {N}'s highest-TVL vault or pool",
    weekly: 'claim accrued yield and compound once',
    risk: 'Yield strategies stack underlying protocol risk on contract risk; verify audit and withdrawal queue first',
    exit: 'withdraw vault shares and claim residual rewards',
    exitTime: 'same day',
    feeBps: 10,
    yieldBearing: true,
  },
  lending: {
    asset: 'blue-chip collateral (ETH, BTC wrapper or USDC)',
    entry: 'supply collateral on {N} and borrow a stablecoin below 35% LTV',
    weekly: 'repay 10% of the loan and re-borrow so supply and borrow both log activity',
    risk: 'Collateral drawdowns trigger liquidation; keep health factor above 1.8 with a price alert',
    exit: 'repay borrow balance in full, then withdraw collateral',
    exitTime: 'same day',
    feeBps: 15,
    yieldBearing: true,
  },
  cdp: {
    asset: 'accepted collateral (ETH, LSTs or BTC wrapper)',
    entry: 'open a {N} vault and mint its stablecoin above 200% collateral ratio',
    weekly: 'stake minted stablecoin in the savings pool and top up collateral if ratio slips',
    risk: 'Redemptions and liquidations hit the lowest collateral ratios first; stay well above the floor',
    exit: 'repay minted debt and withdraw collateral',
    exitTime: 'same day',
    feeBps: 20,
    yieldBearing: true,
  },
  exchange: {
    asset: 'two liquid assets for a major pair',
    entry: "provide liquidity in {N}'s deepest correlated pair and execute 3 small swaps",
    weekly: 'run one swap and re-center range if price drifts out of bounds',
    risk: 'Impermanent loss can outpace fees on volatile pairs; stick to stable or correlated pairs',
    exit: 'remove LP position and collect swap fees',
    exitTime: 'same day',
    feeBps: 25,
    yieldBearing: true,
  },
  otc: {
    asset: 'USDC',
    entry: 'complete venue onboarding on {N} and post maker limit orders in its deepest spot pair',
    weekly: 'refresh two maker fills or rotate idle liquidity across active OTC books',
    risk: 'Orderbook and OTC venues carry counterparty, settlement and KYC eligibility limits',
    exit: 'cancel open orders and withdraw settled USDC balance',
    exitTime: 'same day',
    feeBps: 20,
    yieldBearing: false,
  },
  perpetuals: {
    asset: 'USDC margin',
    entry: 'deposit margin on {N} and open/close small 1–2x delta-neutral trades',
    weekly: 'generate steady weekly volume at 1–2x; points reward consistent volume over leverage',
    risk: 'Taker fees, funding swings and sudden wicks liquidate positions above 2x',
    exit: 'close open positions and withdraw USDC margin',
    exitTime: 'same day',
    feeBps: 40,
    yieldBearing: false,
  },
  prediction: {
    asset: 'USDC',
    entry: 'provide two-sided maker liquidity or buy paired YES/NO limit orders in liquid {N} markets',
    weekly: 'rotate into 2–3 high-volume markets resolving within 30 days to build unique-market volume',
    risk: 'Binary resolution, oracle disputes and thin books can lock or wipe unhedged positions',
    exit: 'close or redeem resolved shares back to USDC',
    exitTime: 'same day',
    feeBps: 20,
    yieldBearing: false,
  },
  rwa: {
    asset: 'USDC',
    entry: "complete {N}'s KYC onboarding and subscribe to its tokenized yield fund",
    weekly: 'verify NAV accrual and check reward distribution eligibility',
    risk: 'Subscriptions may require KYC/non-US eligibility and redemptions settle only on business days',
    exit: 'submit fund redemption request to USDC',
    exitTime: '1–3 business days',
    feeBps: 15,
    yieldBearing: true,
  },
  basis: {
    asset: 'USDC or USDT',
    entry: "mint {N}'s yield-bearing stablecoin and stake it for points",
    weekly: 'check funding-rate yield; negative perp funding compresses or reverses payouts',
    risk: 'Basis strategies depend on positive funding and custodian solvency; a depeg hits stakers first',
    exit: 'initiate unstake cooldown (up to 7 days) and redeem',
    exitTime: 'up to 7 days',
    feeBps: 20,
    yieldBearing: true,
  },
  staking: {
    asset: 'native chain token or ETH',
    entry: 'stake through {N} and hold the liquid receipt token in wallet',
    weekly: 'review validator/operator uptime and claim staking incentives',
    risk: 'Slashing, operator downtime and receipt-token secondary discounts are the main risks',
    exit: 'enter unstaking queue or swap receipt token',
    exitTime: '1–14 days',
    feeBps: 15,
    yieldBearing: true,
  },
  bitcoin: {
    asset: 'BTC',
    entry: 'deposit BTC into {N} and hold the minted receipt token',
    weekly: 'verify BTC peg health and claim accrued protocol rewards',
    risk: 'BTC wrappers rely on bridge or custodian security and redemptions can queue',
    exit: 'burn receipt token to redeem native BTC',
    exitTime: '1–3 days',
    feeBps: 25,
    yieldBearing: true,
  },
  chain: {
    asset: 'ETH or USDC',
    entry: 'bridge via canonical bridge into {N} and run 3 native actions (swap, lend, LP)',
    weekly: 'execute one transaction in a distinct native app on {N}',
    risk: 'Canonical bridge exits can take up to 7 days; size only what you can lock',
    exit: 'unwind native positions and bridge back out',
    exitTime: 'up to 7 days',
    feeBps: 25,
    yieldBearing: false,
  },
  insurance: {
    asset: 'USDC or ETH',
    entry: "underwrite coverage in {N}'s highest-capacity pool with clean claims history",
    weekly: 'monitor active cover utilization, pending claims and streamed underwriting yield',
    risk: 'Major covered-protocol exploits draw down underwriting capital and pause withdrawals',
    exit: 'request withdrawal notice and redeem after cooldown window',
    exitTime: '3–7 days',
    feeBps: 15,
    yieldBearing: true,
  },
  payments: {
    asset: 'USDC or BTC',
    entry: "open a funded channel or account on {N} and execute 3 distinct payment transfers",
    weekly: 'route one merchant or peer payment to sustain active-account history',
    risk: 'Custodial limits, channel liquidity imbalance and regional compliance gates can restrict access',
    exit: 'settle open channels or balances back to self-custody wallet',
    exitTime: 'same day',
    feeBps: 15,
    yieldBearing: false,
  },
  cedefi: {
    asset: 'USDC or USDT',
    entry: "complete {N}'s account onboarding and allocate into its primary on-chain yield sleeve",
    weekly: 'verify proof-of-reserves reporting and claim accrued rewards',
    risk: 'CeDeFi blends off-chain custodian solvency with smart-contract risk; cap sizing strictly',
    exit: 'submit withdrawal to self-custody wallet',
    exitTime: '1–2 days',
    feeBps: 15,
    yieldBearing: true,
  },
  indexes: {
    asset: 'USDC or ETH',
    entry: "mint or buy {N}'s flagship index basket and stake it in the protocol gauge",
    weekly: 'check basket rebalance weights and claim any gauge incentives',
    risk: 'Index baskets carry full constituent market beta plus rebalancing slippage',
    exit: 'unstake and redeem index shares for underlying assets or USDC',
    exitTime: 'same day',
    feeBps: 25,
    yieldBearing: true,
  },
  governance: {
    asset: 'USDC or partner governance token',
    entry: 'lock or delegate a small position on {N} and cast an epoch gauge vote',
    weekly: 'vote in the weekly incentive epoch and claim bribe distributions',
    risk: 'Vote-escrow locks cannot exit early and underlying token volatility can exceed bribes',
    exit: 'claim final epoch rewards and withdraw once lock expires',
    exitTime: 'at lock expiry',
    feeBps: 20,
    yieldBearing: true,
  },
  generic: {
    asset: 'USDC',
    entry: "deposit into {N}'s primary active pool or product",
    weekly: 'make one on-chain interaction (deposit, claim or governance action)',
    risk: 'Newer contracts carry higher smart-contract risk; keep sizing conservative',
    exit: 'withdraw principal and claim pending rewards',
    exitTime: 'same day',
    feeBps: 15,
    yieldBearing: true,
  },
};

export function getPlanCapital(tvlUsd: number): number {
  if (tvlUsd >= 500_000_000) return 5000;
  if (tvlUsd >= 100_000_000) return 2500;
  if (tvlUsd >= 30_000_000) return 1000;
  return 500;
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
    rawSecondary && (getGasUsd(rawSecondary) < 1.0 || capitalUsd >= 2500) ? rawSecondary : null;
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
  const oppCostRefUsd = Math.round(capitalUsd * RISK_FREE_APR * (holdWeeks / 52) * 100) / 100;

  const condRate = input.tvl_usd > 0 ? (input.implied_value_usd / input.tvl_usd) * AIRDROP_SHARE : 0;
  const expRate = condRate * Math.max(0.05, Math.min(1, input.rem_launch_odds));
  const condGrossUsd = Math.round(capitalUsd * condRate * 100) / 100;
  const expGrossUsd = Math.round(capitalUsd * expRate * 100) / 100;
  const condNetUsd = Math.round((condGrossUsd - cashCostUsd) * 100) / 100;
  const expNetUsd = Math.round((expGrossUsd - cashCostUsd) * 100) / 100;
  const expAprPct =
    capitalUsd > 0 ? Math.round(((expNetUsd / capitalUsd) * (52 / holdWeeks)) * 1000) / 10 : 0;

  const fixedCost = gasUsd + bridgeFee;
  const unitDrag = profile.feeBps / 10_000;
  const breakEvenCondUsd = condRate > unitDrag ? Math.round(fixedCost / (condRate - unitDrag)) : 0;
  const breakEvenExpUsd = expRate > unitDrag ? Math.round(fixedCost / (expRate - unitDrag)) : 0;

  let verdict: FarmVerdict;
  if (expNetUsd >= 3.0 && expGrossUsd >= cashCostUsd * 1.4) {
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
    oppCostRefUsd,
    condGrossUsd,
    expGrossUsd,
    condNetUsd,
    expNetUsd,
    expAprPct,
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
  const chainTotal = input.chainCount ?? input.chains.length;

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
  const feeUsd = Math.round(((econ.capitalUsd * profile.feeBps) / 10_000) * 100) / 100;
  steps.push({
    title: 'Enter',
    body: `${entryCap} on ${econ.primaryChain}.${timingNote}`,
    cost: `${fmtUsd(pGas * entryCalls)} gas + ${fmtUsd(feeUsd)} (${profile.feeBps} bps)`,
    time: enterTime,
  });

  // 3. Second chain (multi-chain only)
  if (econ.secondaryChain) {
    const bFee = econ.primaryChain === 'Ethereum' || econ.secondaryChain === 'Ethereum' ? 4 : 1;
    steps.push({
      title: 'Second chain',
      body: `Bridge ${fmtUsd(Math.round(econ.capitalUsd * 0.25))} to ${econ.secondaryChain} and repeat the core action; ${input.name} spans ${chainTotal} chains and multi-chain activity often qualifies separately.`,
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
  const oppNote = profile.yieldBearing
    ? `$0 cash (ref ${fmtUsd(econ.oppCostRefUsd)} @ 4%, offset by base yield)`
    : `$0 cash (ref ${fmtUsd(econ.oppCostRefUsd)} idle @ 4% APR)`;
  steps.push({
    title: 'Hold',
    body: `Keep capital deployed for ${econ.holdWeeks} weeks without churning (time-weighted points). ${tenureNote}`,
    cost: oppNote,
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

  // 8. Budget & Verdict (100% consistent with cashCostUsd & expNetUsd)
  const oddsPct = Math.round(input.rem_launch_odds * 100);
  const netSign = econ.expNetUsd >= 0 ? '+' : '-';
  const aprTxt = `${econ.expAprPct >= 0 ? '+' : ''}${econ.expAprPct.toFixed(1)}% exp APR`;
  const beNote =
    econ.breakEvenCondUsd > 0
      ? `cond. break-even ${fmtUsd(econ.breakEvenCondUsd)}`
      : 'fees exceed pro-rata yield';
  steps.push({
    title: `Verdict: ${econ.verdict}`,
    body: `At ${fmtUsd(econ.capitalUsd)}, cash cost is ${fmtUsd(econ.cashCostUsd)} (${fmtUsd(econ.gasUsd)} gas + ${fmtUsd(econ.frictionUsd)} fees). 5% pro-rata of ${fmtShortUsd(input.implied_value_usd)} pays ${fmtUsd(econ.condGrossUsd)} if launched (${fmtUsd(econ.expGrossUsd)} at ${oddsPct}% peer odds, net ${netSign}${fmtUsd(Math.abs(econ.expNetUsd))} / ${aprTxt}; ${beNote}). Illustrative.`,
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

export function farmSteps(input: FarmInput, capitalOverride?: number): string[] {
  return buildFarmPlan(input, capitalOverride).map(serializeFarmStep);
}

// Compact summary script written to dashboard/z-summary.js (~3.5 KB) so ALL dashboard
// source files fit 100% whole inside buildDossier's 65,536-byte text cap with zero cut.
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
  const compactAge = summary.age_curve.map((b) => [b.label, b.minDays, b.maxDays, b.tok_n, b.total_n, b.rate]);
  const compactAbl = summary.validation.ablations.map((a) => ({
    term: a.term,
    slope: a.slope,
    delta_med_x: a.delta_med_x,
    odds_delta_auc: a.odds_delta_auc,
    role: a.role,
  }));
  const u = summary.universe;
  const payload = {
    as_of: summary.as_of,
    floor: summary.floor_usd,
    u: {
      total: u.total,
      trading_total: u.trading_total,
      trading_model_priced: u.trading_model_priced,
      trading_excl_priced: u.trading_excl_priced,
      trading_unpriced: u.trading_unpriced,
      watchlist_total: u.watchlist_total,
      watchlist_covered: u.watchlist_covered,
      discovery_total: u.discovery_total,
      excluded_total: u.excluded_total,
      excluded_reasons: u.excluded_reasons,
    },
    m: { ...summary.model, cat_eff: keptCatEff },
    o: {
      n: summary.odds.n_peers,
      nt: summary.odds.n_tokenized,
      brier: summary.odds.brier_10f,
      base: summary.odds.brier_base,
      skill: summary.odds.brier_skill,
      auc: summary.odds.auc_10f,
    },
    val: {
      lm: {
        n: summary.validation.loo_model.n,
        mx: summary.validation.loo_model.med_x,
        rm: summary.validation.loo_model.rmse,
        w2: summary.validation.loo_model.within_2x,
        w3: summary.validation.loo_model.within_3x,
      },
      lf: summary.validation.loo_flat25.med_x,
      lg: summary.validation.loo_global_med.med_x,
      ws: summary.validation.wf_split_date,
      wt: summary.validation.wf_train_n,
      wm: {
        n: summary.validation.wf_model.n,
        mx: summary.validation.wf_model.med_x,
        w3: summary.validation.wf_model.within_3x,
      },
      wf: summary.validation.wf_flat25.med_x,
      ab: compactAbl.map((a) => [a.term, a.slope, a.delta_med_x, a.odds_delta_auc, a.role]),
    },
    fams: compactFamilies,
    age: compactAge,
  };
  return `window.SUMMARY=${JSON.stringify(payload)};\n`;
}

// Full pre-token rows + ALL 416 trading protocols written to /output/data.js (beside dashboard/,
// outside the 64 KiB dossier source cap) so dashboard/model.js can LIVE-REFIT the exact 92-comp
// L1-IRLS Ridge model in the browser and Tab 2 can search/filter every trading protocol.
export function buildRowsScript(board: BoardRow[], summary: BoardSummary): string {
  const sortedRows = board.slice().sort((a, b) => a.rank - b.rank);
  const catSet = new Set<string>();
  for (const r of sortedRows) catSet.add(r.category);
  for (const c of summary.all_trading) catSet.add(c.category);
  const catList = Array.from(catSet).sort();
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
      r.tvl_usd,
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

  // All trading tokens: [slug, name, symbol, catIdx, tvl, mcap, looPred, g7d, ageDays, chCount, statusCode(2=model,1=excl,0=unpriced)]
  const compactTrading = summary.all_trading.map((c) => [
    c.slug,
    c.name,
    c.symbol ?? '',
    catIdx.get(c.category) ?? 0,
    c.tvl_usd,
    c.mcap_usd,
    c.loo_pred_usd,
    c.change_7d,
    c.ageDays,
    c.chainCount,
    c.status === 'model' ? 2 : c.status === 'excluded' ? 1 : 0,
  ]);

  return `window.BOARD_ROWS=${JSON.stringify({
    cats: catList,
    chs: chList,
    gas: GAS_USD,
    secs: compactSectors,
    rows: compactRows,
    trading: compactTrading,
  })};\n`;
}

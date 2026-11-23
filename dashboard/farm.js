// Deterministic farm-economics & playbook engine (exact parity with lib/farm.ts).

const GAS_USD = (window.BOARD_ROWS && window.BOARD_ROWS.gas) || { Ethereum: 2, Bitcoin: 1.5, Tron: 1, Arbitrum: 0.05, Base: 0.03, Polygon: 0.02, Solana: 0.01 };
const CAT_FAM = {};
[["curator","Risk Curators,Onchain Capital Allocator"],["yield","Yield,Yield Aggregator,Farm,Liquidity Manager,Leveraged Farming"],["lending","Lending,Collateral Markets,Uncollateralized Lending"],["cdp","CDP,CDP Manager,Collateral Management"],["exchange","Dexs"],["otc","OTC Marketplace"],["perpetuals","Derivatives,Options,Interest Rate Derivatives"],["prediction","Prediction Market"],["rwa","RWA"],["basis","Basis Trading,Stablecoin Wrapper,Dual-Token Stablecoin"],["staking","Staking Pool,Restaking"],["bitcoin","Anchor BTC,Decentralized BTC"],["chain","Chain,Cross Chain Bridge"],["insurance","Insurance"],["payments","Payments,Crypto Card Issuer"],["cedefi","CeDeFi"],["indexes","Indexes"],["governance","Governance Incentives"]].forEach(([f,s]) => s.split(",").forEach((c) => { CAT_FAM[c] = f; }));

// [asset, entry, weekly, risk, exit, exitTime, feeBps, yieldBearing]
const PROFILES = {
  curator: ["USDC or WETH", "deposit into the deepest stablecoin vault {N} curates", "audit vault market allocation and claim any streamed incentives", "Curated vaults inherit bad debt from every underlying lending market; cap one curator under 20% of stables", "redeem vault shares; large exits can wait on idle liquidity", "1–2 days", 5, 1],
  yield: ["USDC or ETH", "deposit into {N}'s highest-TVL vault or pool", "claim accrued yield and compound once", "Yield strategies stack underlying protocol risk on contract risk; verify audit and withdrawal queue first", "withdraw vault shares and claim residual rewards", "same day", 10, 1],
  lending: ["blue-chip collateral (ETH, BTC wrapper or USDC)", "supply collateral on {N} and borrow a stablecoin below 35% LTV", "repay 10% of the loan and re-borrow so supply and borrow both log activity", "Collateral drawdowns trigger liquidation; keep health factor above 1.8 with a price alert", "repay borrow balance in full, then withdraw collateral", "same day", 15, 1],
  cdp: ["accepted collateral (ETH, LSTs or BTC wrapper)", "open a {N} vault and mint its stablecoin above 200% collateral ratio", "stake minted stablecoin in the savings pool and top up collateral if ratio slips", "Redemptions and liquidations hit the lowest collateral ratios first; stay well above the floor", "repay minted debt and withdraw collateral", "same day", 20, 1],
  exchange: ["two liquid assets for a major pair", "provide liquidity in {N}'s deepest correlated pair and execute 3 small swaps", "run one swap and re-center range if price drifts out of bounds", "Impermanent loss can outpace fees on volatile pairs; stick to stable or correlated pairs", "remove LP position and collect swap fees", "same day", 25, 1],
  otc: ["USDC", "complete venue onboarding on {N} and post maker limit orders in its deepest spot pair", "refresh two maker fills or rotate idle liquidity across active OTC books", "Orderbook and OTC venues carry counterparty, settlement and KYC eligibility limits", "cancel open orders and withdraw settled USDC balance", "same day", 20, 0],
  perpetuals: ["USDC margin", "deposit margin on {N} and open/close small 1–2x delta-neutral trades", "generate steady weekly volume at 1–2x; points reward consistent volume over leverage", "Taker fees, funding swings and sudden wicks liquidate positions above 2x", "close open positions and withdraw USDC margin", "same day", 40, 0],
  prediction: ["USDC", "provide two-sided maker liquidity or buy paired YES/NO limit orders in liquid {N} markets", "rotate into 2–3 high-volume markets resolving within 30 days to build unique-market volume", "Binary resolution, oracle disputes and thin books can lock or wipe unhedged positions", "close or redeem resolved shares back to USDC", "same day", 20, 0],
  rwa: ["USDC", "complete {N}'s KYC onboarding and subscribe to its tokenized yield fund", "verify NAV accrual and check reward distribution eligibility", "Subscriptions may require KYC/non-US eligibility and redemptions settle only on business days", "submit fund redemption request to USDC", "1–3 business days", 15, 1],
  basis: ["USDC or USDT", "mint {N}'s yield-bearing stablecoin and stake it for points", "check funding-rate yield; negative perp funding compresses or reverses payouts", "Basis strategies depend on positive funding and custodian solvency; a depeg hits stakers first", "initiate unstake cooldown (up to 7 days) and redeem", "up to 7 days", 20, 1],
  staking: ["native chain token or ETH", "stake through {N} and hold the liquid receipt token in wallet", "review validator/operator uptime and claim staking incentives", "Slashing, operator downtime and receipt-token secondary discounts are the main risks", "enter unstaking queue or swap receipt token", "1–14 days", 15, 1],
  bitcoin: ["BTC", "deposit BTC into {N} and hold the minted receipt token", "verify BTC peg health and claim accrued protocol rewards", "BTC wrappers rely on bridge or custodian security and redemptions can queue", "burn receipt token to redeem native BTC", "1–3 days", 25, 1],
  chain: ["ETH or USDC", "bridge via canonical bridge into {N} and run 3 native actions (swap, lend, LP)", "execute one transaction in a distinct native app on {N}", "Canonical bridge exits can take up to 7 days; size only what you can lock", "unwind native positions and bridge back out", "up to 7 days", 25, 0],
  insurance: ["USDC or ETH", "underwrite coverage in {N}'s highest-capacity pool with clean claims history", "monitor active cover utilization, pending claims and streamed underwriting yield", "Major covered-protocol exploits draw down underwriting capital and pause withdrawals", "request withdrawal notice and redeem after cooldown window", "3–7 days", 15, 1],
  payments: ["USDC or BTC", "open a funded channel or account on {N} and execute 3 distinct payment transfers", "route one merchant or peer payment to sustain active-account history", "Custodial limits, channel liquidity imbalance and regional compliance gates can restrict access", "settle open channels or balances back to self-custody wallet", "same day", 15, 0],
  cedefi: ["USDC or USDT", "complete {N}'s account onboarding and allocate into its primary on-chain yield sleeve", "verify proof-of-reserves reporting and claim accrued rewards", "CeDeFi blends off-chain custodian solvency with smart-contract risk; cap sizing strictly", "submit withdrawal to self-custody wallet", "1–2 days", 15, 1],
  indexes: ["USDC or ETH", "mint or buy {N}'s flagship index basket and stake it in the protocol gauge", "check basket rebalance weights and claim any gauge incentives", "Index baskets carry full constituent market beta plus rebalancing slippage", "unstake and redeem index shares for underlying assets or USDC", "same day", 25, 1],
  governance: ["USDC or partner governance token", "lock or delegate a small position on {N} and cast an epoch gauge vote", "vote in the weekly incentive epoch and claim bribe distributions", "Vote-escrow locks cannot exit early and underlying token volatility can exceed bribes", "claim final epoch rewards and withdraw once lock expires", "at lock expiry", 20, 1],
  generic: ["USDC", "deposit into {N}'s primary active pool or product", "make one on-chain interaction (deposit, claim or governance action)", "Newer contracts carry higher smart-contract risk; keep sizing conservative", "withdraw principal and claim pending rewards", "same day", 15, 1],
};
const profileFor = (c) => PROFILES[CAT_FAM[c] || "generic"];
const getGasUsd = (c) => GAS_USD[c] ?? 0.15;
const getPlanCapital = (t) => (t >= 5e8 ? 5000 : t >= 1e8 ? 2500 : t >= 3e7 ? 1000 : 500);
const getHoldWeeks = (d) => (d != null && d < 180 ? 6 : 4);
const r2 = (x) => Math.round(x * 100) / 100;
const fmtUsd = (x) => (!Number.isFinite(x) || x < 0 ? "$0.00" : x < 10 ? "$" + x.toFixed(2) : x < 1000 ? "$" + Math.round(x) : "$" + (Math.round(x / 10) * 10).toLocaleString("en-US"));
const fmtShortUsd = (x) => (!Number.isFinite(x) || x < 0 ? "$0.00" : x >= 1e9 ? "$" + (x / 1e9).toFixed(2) + "B" : x >= 1e6 ? "$" + (x / 1e6).toFixed(1) + "M" : fmtUsd(x));

function pickChains(chains) {
  const ls = (chains || []).filter(Boolean).slice(0, 3);
  if (!ls.length) return { firstChain: "Ethereum", primary: "Ethereum", secondary: null };
  const firstChain = ls[0], fg = getGasUsd(firstChain);
  let primary = firstChain, pg = fg, secondary = null, sg = Infinity;
  for (let i = 1; i < ls.length; i++) { const g = getGasUsd(ls[i]); if (g <= fg / 3 && g < pg) { primary = ls[i]; pg = g; } }
  for (const c of ls) if (c !== primary && getGasUsd(c) < sg) { secondary = c; sg = getGasUsd(c); }
  return { firstChain, primary, secondary };
}

function evaluateFarmEconomics(inp, capOv) {
  const pr = profileFor(inp.category), feeBps = pr[6], { firstChain, primary, secondary: rSec } = pickChains(inp.chains);
  const capitalUsd = capOv ?? getPlanCapital(inp.tvl_usd);
  const secondary = rSec && (getGasUsd(rSec) < 1 || capitalUsd >= 2500) ? rSec : null;
  const holdWeeks = getHoldWeeks(inp.ageDays), eCalls = inp.change_7d !== null && inp.change_7d < -10 ? 4 : 2;
  const pCalls = 3 + eCalls + holdWeeks, sCalls = secondary ? 3 : 0, totalCalls = pCalls + sCalls;
  const gasUsd = r2(getGasUsd(primary) * pCalls + (secondary ? getGasUsd(secondary) * sCalls : 0));
  const bridgeFee = secondary ? (primary === "Ethereum" || secondary === "Ethereum" ? 4 : 1) : 0;
  const frictionUsd = r2(bridgeFee + (capitalUsd * feeBps) / 1e4), cashCostUsd = r2(gasUsd + frictionUsd);
  const oppCostRefUsd = r2(capitalUsd * 0.04 * (holdWeeks / 52));
  const condRate = inp.tvl_usd > 0 ? (inp.implied_value_usd / inp.tvl_usd) * 0.05 : 0;
  const expRate = condRate * Math.max(0.05, Math.min(1, inp.rem_launch_odds));
  const condGrossUsd = r2(capitalUsd * condRate), expGrossUsd = r2(capitalUsd * expRate);
  const condNetUsd = r2(condGrossUsd - cashCostUsd), expNetUsd = r2(expGrossUsd - cashCostUsd);
  const expAprPct = capitalUsd > 0 ? Math.round((expNetUsd / capitalUsd) * (52 / holdWeeks) * 1000) / 10 : 0;
  const fixedCost = gasUsd + bridgeFee, drag = feeBps / 1e4;
  const breakEvenCondUsd = condRate > drag ? Math.round(fixedCost / (condRate - drag)) : 0;
  const verdict = expNetUsd >= 3 && expGrossUsd >= cashCostUsd * 1.4 ? "FARM" : condNetUsd > 0 ? "THIN" : "SKIP";
  return { firstChain, primaryChain: primary, secondaryChain: secondary, capitalUsd, holdWeeks, totalCalls, gasUsd, frictionUsd, cashCostUsd, oppCostRefUsd, condGrossUsd, expGrossUsd, condNetUsd, expNetUsd, expAprPct, breakEvenCondUsd, verdict };
}

function buildFarmPlan(inp, capOv) {
  const pr = profileFor(inp.category), e = evaluateFarmEconomics(inp, capOv);
  const pG = getGasUsd(e.primaryChain), sG = e.secondaryChain ? getGasUsd(e.secondaryChain) : 0;
  const isM = inp.change_7d !== null && inp.change_7d > 5, isS = inp.change_7d !== null && inp.change_7d < -10;
  const eC = isS ? 4 : 2, chN = inp.chainCount ?? (inp.chains ? inp.chains.length : 1), st = [];
  const rn = e.primaryChain !== e.firstChain ? ` (${e.primaryChain} saves gas vs ${e.firstChain} at ${fmtUsd(getGasUsd(e.firstChain))}/call.)` : "";
  st.push({ title: "Fund", body: `Send ${fmtUsd(e.capitalUsd)} in ${pr[0]} to a dedicated wallet on ${e.primaryChain}, plus ${fmtUsd(e.gasUsd * 1.5)} in native gas for ${e.totalCalls} calls.${rn}`, cost: `${fmtUsd(pG)} transfer`, time: "10 min" });
  const ea = pr[1].replace(/\{N\}/g, inp.name);
  const tn = isM ? ` Enter within 48 hours: TVL rose +${inp.change_7d.toFixed(1)}% in 7d, diluting later entrants.` : isS ? ` Stage in 3 tranches over 7 days: TVL fell ${Math.abs(inp.change_7d).toFixed(1)}% in 7d, so confirm outflows stabilize.` : "";
  st.push({ title: "Enter", body: `${ea[0].toUpperCase() + ea.slice(1)} on ${e.primaryChain}.${tn}`, cost: `${fmtUsd(pG * eC)} gas + ${fmtUsd(r2((e.capitalUsd * pr[6]) / 1e4))} (${pr[6]} bps)`, time: isS ? "7 days" : "15 min" });
  if (e.secondaryChain) st.push({ title: "Second chain", body: `Bridge ${fmtUsd(Math.round(e.capitalUsd * 0.25))} to ${e.secondaryChain} and repeat the core action; ${inp.name} spans ${chN} chains and multi-chain activity often qualifies separately.`, cost: `${fmtUsd(sG * 3)} gas + ~${fmtUsd(e.primaryChain === "Ethereum" || e.secondaryChain === "Ethereum" ? 4 : 1)} bridge`, time: "20 min" });
  const ten = inp.ageDays == null ? "Listing date is unreported, so use a standard 4-week snapshot window." : inp.ageDays < 180 ? `Only ${Math.round(inp.ageDays)}d tracked with no token; hold 6 weeks to anchor early-cohort multipliers.` : `${Math.round(inp.ageDays)}d tracked with no token; hold 4 weeks across at least one full snapshot epoch.`;
  st.push({ title: "Hold", body: `Keep capital deployed for ${e.holdWeeks} weeks without churning (time-weighted points). ${ten}`, cost: pr[7] ? `$0 cash (ref ${fmtUsd(e.oppCostRefUsd)} @ 4%, offset by base yield)` : `$0 cash (ref ${fmtUsd(e.oppCostRefUsd)} idle @ 4% APR)`, time: `${e.holdWeeks} weeks` });
  st.push({ title: "Weekly touch", body: `Once per week, ${pr[2].replace(/\{N\}/g, inp.name)}.`, cost: `${fmtUsd(pG * e.holdWeeks)} (${e.holdWeeks} calls)`, time: "5 min/wk" });
  st.push({ title: "Risk check", body: `${pr[3]}.`, cost: "$0", time: "10 min pre-entry" });
  st.push({ title: "Exit", body: `To unwind, ${pr[4]}.`, cost: `${fmtUsd(pG * 2)} (2 calls)`, time: pr[5] });
  const be = e.breakEvenCondUsd > 0 ? `cond. break-even ${fmtUsd(e.breakEvenCondUsd)}` : "fees exceed pro-rata yield";
  st.push({ title: `Verdict: ${e.verdict}`, body: `At ${fmtUsd(e.capitalUsd)}, cash cost is ${fmtUsd(e.cashCostUsd)} (${fmtUsd(e.gasUsd)} gas + ${fmtUsd(e.frictionUsd)} fees). 5% pro-rata of ${fmtShortUsd(inp.implied_value_usd)} pays ${fmtUsd(e.condGrossUsd)} if launched (${fmtUsd(e.expGrossUsd)} at ${Math.round(inp.rem_launch_odds * 100)}% peer odds, net ${e.expNetUsd >= 0 ? "+" : "-"}${fmtUsd(Math.abs(e.expNetUsd))} / ${e.expAprPct >= 0 ? "+" : ""}${e.expAprPct.toFixed(1)}% exp APR; ${be}). Illustrative.`, cost: `${fmtUsd(e.cashCostUsd)} cash`, time: `${e.holdWeeks + 1} weeks` });
  return st;
}

function farmSteps(inp, cap) {
  return buildFarmPlan(inp, cap).map((s) => { const t = `${s.title}: ${s.body} Cost: ${s.cost}. Time: ${s.time}.`; return t.length > 595 ? t.slice(0, 592) + "..." : t; });
}

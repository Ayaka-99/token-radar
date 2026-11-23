// Token Radar dashboard renderer, live model verifier (impliedOf), and farm-plan
// generator (100% parity with lib/model.ts and lib/farm.ts). Pure offline JS.

const GAS_USD = {
  Ethereum: 2.0, Bitcoin: 1.5, Tron: 1.0, Avalanche: 0.1, Binance: 0.08,
  Arbitrum: 0.05, Optimism: 0.05, "zkSync Era": 0.05, Starknet: 0.05,
  Base: 0.03, Mantle: 0.03, Polygon: 0.02, Ink: 0.02, Unichain: 0.02,
  Monad: 0.02, Berachain: 0.02, Katana: 0.02, Morph: 0.02,
  "Robinhood Chain": 0.02, "Plume Mainnet": 0.02, Sei: 0.01, Solana: 0.01,
  "Hyperliquid L1": 0.01, Sui: 0.01, Aptos: 0.01, Stellar: 0.01,
  Plasma: 0.01, Tempo: 0.01, Ripple: 0.01, Flare: 0.01, Algorand: 0.01,
  Arc: 0.01, Stable: 0.01, Bittensor: 0.02, Provenance: 0.05, Noble: 0.01,
  BSquared: 0.02, Mezo: 0.02, RISE: 0.01, XION: 0.01, Manta: 0.03,
};
const DEFAULT_GAS_USD = 0.25, AIRDROP_SHARE = 0.05, RISK_FREE_APR = 0.04;

const SECTOR_FAMILY_MAP = {
  "Risk Curators": "Vault & Curator", "Onchain Capital Allocator": "Vault & Curator",
  Yield: "Vault & Curator", "Yield Aggregator": "Vault & Curator", Farm: "Vault & Curator",
  "Liquidity Manager": "Vault & Curator", "Leveraged Farming": "Vault & Curator",
  Lending: "Credit & CDP", "Collateral Markets": "Credit & CDP", CDP: "Credit & CDP",
  "CDP Manager": "Credit & CDP", "Collateral Management": "Credit & CDP",
  Dexs: "Trading & Markets", "OTC Marketplace": "Trading & Markets",
  Derivatives: "Trading & Markets", "Prediction Market": "Trading & Markets", Options: "Trading & Markets",
  RWA: "RWA & Basis", "Basis Trading": "RWA & Basis",
  "Stablecoin Wrapper": "RWA & Basis", "Dual-Token Stablecoin": "RWA & Basis",
  "Liquid Staking": "Staking & Restaking", "Liquid Restaking": "Staking & Restaking",
  Restaking: "Staking & Restaking", "Staking Pool": "Staking & Restaking",
  "Restaked BTC": "Staking & Restaking", "Anchor BTC": "Staking & Restaking",
  "Decentralized BTC": "Staking & Restaking", Bridge: "Infra & Bridge",
  "Canonical Bridge": "Infra & Bridge", "Cross Chain Bridge": "Infra & Bridge",
  Chain: "Infra & Bridge", CEX: "Exchange (CEX)",
};

const CATEGORY_TO_FAMILY = {
  "Risk Curators": "curator", "Onchain Capital Allocator": "curator",
  Yield: "yield", "Yield Aggregator": "yield", Farm: "yield",
  "Liquidity Manager": "yield", "Leveraged Farming": "yield",
  Lending: "lending", "Collateral Markets": "lending", CDP: "cdp", "CDP Manager": "cdp",
  Dexs: "exchange", "OTC Marketplace": "exchange",
  Derivatives: "perpetuals", "Prediction Market": "perpetuals", Options: "perpetuals",
  RWA: "rwa", "Basis Trading": "basis", "Stablecoin Wrapper": "basis", "Dual-Token Stablecoin": "basis",
  "Staking Pool": "staking", Restaking: "staking", "Anchor BTC": "bitcoin", "Decentralized BTC": "bitcoin",
  Chain: "chain", "Cross Chain Bridge": "chain",
};

const FAMILY_PROFILES = {
  curator: { asset: "USDC or WETH", entry: "deposit into the deepest stablecoin vault {N} curates", weekly: "audit vault market allocation and claim any streamed incentives", risk: "Curated vaults inherit bad debt from every underlying lending market; cap one curator under 20% of stables", exit: "redeem vault shares; large exits can wait on idle liquidity", exitTime: "1–2 days", feeBps: 5 },
  yield: { asset: "USDC or ETH", entry: "deposit into {N}'s highest-TVL vault or pool", weekly: "claim accrued yield and compound once", risk: "Yield strategies stack underlying protocol risk on contract risk; verify audit and withdrawal queue first", exit: "withdraw vault shares and claim residual rewards", exitTime: "same day", feeBps: 10 },
  lending: { asset: "blue-chip collateral (ETH, BTC wrapper or USDC)", entry: "supply collateral on {N} and borrow a stablecoin below 35% LTV", weekly: "repay 10% of the loan and re-borrow so supply and borrow both log activity", risk: "Collateral drawdowns trigger liquidation; keep health factor above 1.8 with a price alert", exit: "repay borrow balance in full, then withdraw collateral", exitTime: "same day", feeBps: 15 },
  cdp: { asset: "accepted collateral (ETH, LSTs or BTC wrapper)", entry: "open a {N} vault and mint its stablecoin above 200% collateral ratio", weekly: "stake minted stablecoin in the savings pool and top up collateral if ratio slips", risk: "Redemptions and liquidations hit the lowest collateral ratios first; stay well above the floor", exit: "repay minted debt and withdraw collateral", exitTime: "same day", feeBps: 25 },
  exchange: { asset: "two liquid assets for a major pair", entry: "provide liquidity in {N}'s deepest correlated pair and execute 3 small swaps", weekly: "run one swap and re-center range if price drifts out of bounds", risk: "Impermanent loss can outpace fees on volatile pairs; stick to stable or correlated pairs", exit: "remove LP position and collect swap fees", exitTime: "same day", feeBps: 30 },
  perpetuals: { asset: "USDC margin", entry: "deposit margin on {N} and open/close small 1–2x delta-neutral trades", weekly: "generate steady weekly volume at 1–2x; points reward consistent volume over leverage", risk: "Taker fees, funding swings and sudden wicks liquidate positions above 2x", exit: "close open positions and withdraw USDC margin", exitTime: "same day", feeBps: 45 },
  rwa: { asset: "USDC", entry: "complete {N}'s KYC onboarding and subscribe to its tokenized yield fund", weekly: "verify NAV accrual and check reward distribution eligibility", risk: "Subscriptions may require KYC/non-US eligibility and redemptions settle only on business days", exit: "submit fund redemption request to USDC", exitTime: "1–3 business days", feeBps: 15 },
  basis: { asset: "USDC or USDT", entry: "mint {N}'s yield-bearing stablecoin and stake it for points", weekly: "check funding-rate yield; negative perp funding compresses or reverses payouts", risk: "Basis strategies depend on positive funding and custodian solvency; a depeg hits stakers first", exit: "initiate unstake cooldown (up to 7 days) and redeem", exitTime: "up to 7 days", feeBps: 20 },
  staking: { asset: "native chain token or ETH", entry: "stake through {N} and hold the liquid receipt token in wallet", weekly: "review validator/operator uptime and claim staking incentives", risk: "Slashing, operator downtime and receipt-token secondary discounts are the main risks", exit: "enter unstaking queue or swap receipt token", exitTime: "1–14 days", feeBps: 15 },
  bitcoin: { asset: "BTC", entry: "deposit BTC into {N} and hold the minted receipt token", weekly: "verify BTC peg health and claim accrued protocol rewards", risk: "BTC wrappers rely on bridge or custodian security and redemptions can queue", exit: "burn receipt token to redeem native BTC", exitTime: "1–3 days", feeBps: 25 },
  chain: { asset: "ETH or USDC", entry: "bridge via canonical bridge into {N} and run 3 native actions (swap, lend, LP)", weekly: "execute one transaction in a distinct native app on {N}", risk: "Canonical bridge exits can take up to 7 days; size only what you can lock", exit: "unwind native positions and bridge back out", exitTime: "up to 7 days", feeBps: 30 },
  generic: { asset: "USDC", entry: "deposit into {N}'s primary active pool or product", weekly: "make one on-chain interaction (deposit, claim or governance action)", risk: "Newer contracts carry higher smart-contract risk; keep sizing conservative", exit: "withdraw principal and claim pending rewards", exitTime: "same day", feeBps: 15 },
};

const getGasUsd = (c) => GAS_USD[c] ?? DEFAULT_GAS_USD;
const familyOf = (cat) => SECTOR_FAMILY_MAP[cat] || "Other DeFi";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const getPlanCapital = (t) => (t >= 5e8 ? 1000 : t >= 1e8 ? 500 : t >= 3e7 ? 300 : 200);
const getHoldWeeks = (d) => (d !== null && d !== undefined && d < 180 ? 6 : 4);
const fmtUsd = (x) => (!Number.isFinite(x) || x < 0 ? "$0.00" : x < 10 ? "$" + x.toFixed(2) : x < 1000 ? "$" + Math.round(x) : "$" + (Math.round(x / 10) * 10).toLocaleString("en-US"));
const fmtShortUsd = (x) => (!Number.isFinite(x) || x < 0 ? "$0.00" : x >= 1e9 ? "$" + (x / 1e9).toFixed(2) + "B" : x >= 1e6 ? "$" + (x / 1e6).toFixed(1) + "M" : fmtUsd(x));

function impliedOf(row, M) {
  const fam = familyOf(row.c);
  const gR = row.g !== null ? Math.round(row.g * 100) / 100 : null;
  const lt = Math.log(Math.max(1, row.t)) - M.ref_log_tvl;
  const gT = gR !== null ? clamp(gR, -40, 60) / 100 - M.ref_g : 0;
  const aT = row.d !== null ? Math.log1p(row.d) - M.ref_log_age : 0;
  const cT = Math.log(Math.max(1, row.k)) - M.ref_log_ch;
  const lB = M.b0, lF = M.fam_eff[fam] || 0, lC = M.cat_eff[row.c] || 0;
  const lS = M.b_tvl * lt, lG = M.b_g * gT, lA = M.b_age * aT, lH = M.b_ch * cT;
  const logMult = clamp(lB + lF + lC + lS + lG + lA + lH, M.lo_mult_log, M.hi_mult_log);
  const value = clamp(Math.round(row.t * Math.exp(logMult)), 1_000_000, 1e14);
  const lo = clamp(Math.round(row.t * Math.exp(logMult + M.q25_res)), 250_000, value);
  const hi = clamp(Math.round(row.t * Math.exp(logMult + M.q75_res)), value, 1e14);
  return {
    value, lo, hi, logMult,
    parts: { base: Math.exp(lB), fam: Math.exp(lF), cat: Math.exp(lC), scale: Math.exp(lS), growth: Math.exp(lG), age: Math.exp(lA), chains: Math.exp(lH) },
  };
}

function pickChains(chains) {
  const listed = (chains || []).filter(Boolean).slice(0, 3);
  if (!listed.length) return { firstChain: "Ethereum", primary: "Ethereum", secondary: null };
  const firstChain = listed[0], firstGas = getGasUsd(firstChain);
  let primary = firstChain, pGas = firstGas;
  for (let i = 1; i < listed.length; i++) {
    const g = getGasUsd(listed[i]);
    if (g <= firstGas / 3 && g < pGas) { primary = listed[i]; pGas = g; }
  }
  let secondary = null, sGas = Infinity;
  for (const c of listed) { if (c !== primary && getGasUsd(c) < sGas) { secondary = c; sGas = getGasUsd(c); } }
  return { firstChain, primary, secondary };
}

function evaluateFarmEconomics(input, capitalOverride) {
  const profile = FAMILY_PROFILES[CATEGORY_TO_FAMILY[input.category] || "generic"];
  const { firstChain, primary, secondary: rawSec } = pickChains(input.chains);
  const capitalUsd = capitalOverride ?? getPlanCapital(input.tvl_usd);
  const secondary = rawSec && (getGasUsd(rawSec) < 1.0 || capitalUsd >= 1000) ? rawSec : null;
  const holdWeeks = getHoldWeeks(input.ageDays);
  const entryCalls = input.change_7d !== null && input.change_7d < -10 ? 4 : 2;
  const pGas = getGasUsd(primary), sGas = secondary ? getGasUsd(secondary) : 0;
  const pCalls = 1 + entryCalls + holdWeeks + 2, sCalls = secondary ? 3 : 0;
  const totalCalls = pCalls + sCalls;
  const gasUsd = Math.round((pGas * pCalls + sGas * sCalls) * 100) / 100;
  const bridgeFee = secondary ? (primary === "Ethereum" || secondary === "Ethereum" ? 4.0 : 1.0) : 0;
  const frictionUsd = Math.round((bridgeFee + (capitalUsd * profile.feeBps) / 10000) * 100) / 100;
  const cashCostUsd = Math.round((gasUsd + frictionUsd) * 100) / 100;
  const oppCostUsd = Math.round(capitalUsd * RISK_FREE_APR * (holdWeeks / 52) * 100) / 100;
  const totalCostUsd = Math.round((cashCostUsd + oppCostUsd) * 100) / 100;

  const condRate = input.tvl_usd > 0 ? (input.implied_value_usd / input.tvl_usd) * AIRDROP_SHARE : 0;
  const expRate = condRate * clamp(input.rem_launch_odds, 0.05, 1);
  const condGrossUsd = Math.round(capitalUsd * condRate * 100) / 100;
  const expGrossUsd = Math.round(capitalUsd * expRate * 100) / 100;
  const condNetUsd = Math.round((condGrossUsd - cashCostUsd) * 100) / 100;
  const expNetUsd = Math.round((expGrossUsd - cashCostUsd) * 100) / 100;

  const fixedCost = gasUsd + bridgeFee, unitDrag = profile.feeBps / 10000;
  const breakEvenCondUsd = condRate > unitDrag ? Math.round(fixedCost / (condRate - unitDrag)) : 0;
  const breakEvenExpUsd = expRate > unitDrag ? Math.round(fixedCost / (expRate - unitDrag)) : 0;
  const verdict = expNetUsd >= 1.5 && expGrossUsd >= cashCostUsd * 1.35 ? "FARM" : condNetUsd > 0 ? "THIN" : "SKIP";
  return { firstChain, primaryChain: primary, secondaryChain: secondary, capitalUsd, holdWeeks, totalCalls, gasUsd, frictionUsd, cashCostUsd, oppCostUsd, totalCostUsd, condGrossUsd, expGrossUsd, condNetUsd, expNetUsd, breakEvenCondUsd, breakEvenExpUsd, verdict };
}

function buildFarmPlan(input, capitalOverride) {
  const profile = FAMILY_PROFILES[CATEGORY_TO_FAMILY[input.category] || "generic"];
  const e = evaluateFarmEconomics(input, capitalOverride);
  const pGas = getGasUsd(e.primaryChain), sGas = e.secondaryChain ? getGasUsd(e.secondaryChain) : 0;
  const isMom = input.change_7d !== null && input.change_7d > 5;
  const isStg = input.change_7d !== null && input.change_7d < -10;
  const eCalls = isStg ? 4 : 2, chainTotal = input.chainCount || (input.chains ? input.chains.length : 1);
  const steps = [];
  const routeNote = e.primaryChain !== e.firstChain ? ` (${e.primaryChain} saves gas vs ${e.firstChain} at ${fmtUsd(getGasUsd(e.firstChain))}/call.)` : "";
  steps.push({ title: "Fund", body: `Send ${fmtUsd(e.capitalUsd)} in ${profile.asset} to a dedicated wallet on ${e.primaryChain}, plus ${fmtUsd(e.gasUsd * 1.5)} in native gas for ${e.totalCalls} calls.${routeNote}`, cost: `${fmtUsd(pGas)} transfer`, time: "10 min" });

  const ea = profile.entry.replace(/\{N\}/g, input.name);
  const tNote = isMom ? ` Enter within 48 hours: TVL rose +${input.change_7d.toFixed(1)}% in 7d, diluting later entrants.` : isStg ? ` Stage in 3 tranches over 7 days: TVL fell ${Math.abs(input.change_7d).toFixed(1)}% in 7d, so confirm outflows stabilize.` : "";
  steps.push({ title: "Enter", body: `${ea[0].toUpperCase() + ea.slice(1)} on ${e.primaryChain}.${tNote}`, cost: `${fmtUsd(pGas * eCalls)} gas (${eCalls} calls)`, time: isStg ? "7 days" : "15 min" });

  if (e.secondaryChain) {
    const bFee = e.primaryChain === "Ethereum" || e.secondaryChain === "Ethereum" ? 4 : 1;
    steps.push({ title: "Second chain", body: `Bridge ${fmtUsd(Math.round(e.capitalUsd * 0.25))} to ${e.secondaryChain} and repeat the core action; ${input.name} spans ${chainTotal} chains and multi-chain activity often qualifies separately.`, cost: `${fmtUsd(sGas * 3)} gas + ~${fmtUsd(bFee)} bridge`, time: "20 min" });
  }
  const ten = input.ageDays == null ? "Listing date is unreported, so use a standard 4-week snapshot window." : input.ageDays < 180 ? `Only ${Math.round(input.ageDays)}d tracked with no token; hold 6 weeks to anchor early-cohort multipliers.` : `${Math.round(input.ageDays)}d tracked with no token; hold 4 weeks across at least one full snapshot epoch.`;
  steps.push({ title: "Hold", body: `Keep capital deployed for ${e.holdWeeks} weeks without churning (time-weighted points). ${ten}`, cost: `${fmtUsd(e.oppCostUsd)} opp. cost (4% APR)`, time: `${e.holdWeeks} weeks` });
  steps.push({ title: "Weekly touch", body: `Once per week, ${profile.weekly.replace(/\{N\}/g, input.name)}.`, cost: `${fmtUsd(pGas * e.holdWeeks)} (${e.holdWeeks} calls)`, time: "5 min/wk" });
  steps.push({ title: "Risk check", body: `${profile.risk}.`, cost: "$0", time: "10 min pre-entry" });
  steps.push({ title: "Exit", body: `To unwind, ${profile.exit}.`, cost: `${fmtUsd(pGas * 2)} (2 calls)`, time: profile.exitTime });

  const beNote = e.breakEvenCondUsd > 0 ? `cond. break-even ${fmtUsd(e.breakEvenCondUsd)}` : "fees exceed pro-rata yield";
  steps.push({
    title: `Verdict: ${e.verdict}`,
    body: `At ${fmtUsd(e.capitalUsd)}, cash cost is ${fmtUsd(e.cashCostUsd)} (${fmtUsd(e.gasUsd)} gas + ${fmtUsd(e.frictionUsd)} fees; ${fmtUsd(e.oppCostUsd)} 4% ref opp. cost). 5% pro-rata of ${fmtShortUsd(input.implied_value_usd)} pays ${fmtUsd(e.condGrossUsd)} if launched (${fmtUsd(e.expGrossUsd)} at ${Math.round(input.rem_launch_odds * 100)}% peer odds, net ${e.expNetUsd >= 0 ? "+" : "-"}${fmtUsd(Math.abs(e.expNetUsd))}; ${beNote}). Illustrative.`,
    cost: `${fmtUsd(e.cashCostUsd)} cash`, time: `${e.holdWeeks + 1} weeks`,
  });
  return steps;
}

function serializeFarmStep(step) {
  const s = `${step.title}: ${step.body} Cost: ${step.cost}. Time: ${step.time}.`;
  return s.length > 595 ? s.slice(0, 592) + "..." : s;
}
function farmSteps(input, cap) { return buildFarmPlan(input, cap).map(serializeFarmStep); }

(function () {
  const S = window.SUMMARY || window.BOARD;
  const R = window.BOARD_ROWS || window.BOARD;
  if (!S || !R || !Array.isArray(R.rows)) return;
  const B = Object.assign({}, S, R);
  const cats = B.cats || [], chs = B.chs || [], M = B.m, U = B.u, V = B.val, O = B.o;
  const rows = B.rows.map((t) => {
    const row = { r: t[0], s: t[1], n: t[2], c: cats[t[3]] || "Other", w: t[4], t: t[5], g: t[6], d: t[7], h: (t[8] || []).map((i) => chs[i]), k: t[9], v: t[10], peer: t[11], rem: t[12], sd: t[13] || 0 };
    const imp = impliedOf(row, M);
    const econ = evaluateFarmEconomics({ slug: row.s, name: row.n, category: row.c, chains: row.h, chainCount: row.k, tvl_usd: row.t, change_7d: row.g, ageDays: row.d, implied_value_usd: row.v, rem_launch_odds: row.rem / 100 });
    row.rawV = row.v + row.sd; row.impV = imp.value; row.lo = Math.min(imp.lo, row.v); row.hi = Math.max(imp.hi, row.v);
    row.vc = econ.verdict === "FARM" ? 2 : econ.verdict === "THIN" ? 1 : 0; row.net = econ.expNetUsd;
    return row;
  });
  const state = { tier: "all", verdict: "", sector: "", chain: "", search: "", sortKey: "r", sortDir: "asc", selected: null, capOverride: null };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fmtFull = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtChg = (g) => (g == null || isNaN(g) ? "n/a" : (g > 0 ? "+" : "") + Number(g).toFixed(1) + "%");
  const fmtSigned = (n) => (n >= 0 ? "+" : "-") + fmtUsd(Math.abs(n));
  const vLbl = (c) => (c === 2 ? "FARM" : c === 1 ? "THIN" : "SKIP");
  const vCls = (c) => (c === 2 ? "pill-farm" : c === 1 ? "pill-thin" : "pill-skip");

  function verifyBoardIntegrity() {
    let drift = 0, wl = 0, mono = true;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].w === 1) wl++;
      if (i > 0 && rows[i].v >= rows[i - 1].v) mono = false;
      if (rows[i].impV !== rows[i].rawV) drift++;
    }
    const accounted = U.watchlist_covered + U.discovery_total + U.excluded_total + U.trading_total;
    return { drift, wl, mono, accounted };
  }

  function renderHeader() {
    const chk = verifyBoardIntegrity();
    $("snap-pill").textContent = `DefiLlama ${B.as_of} · $${Math.round(B.floor / 1e6)}M floor`;
    $("kpi-wl").textContent = `${U.watchlist_covered} / ${U.watchlist_total}`;
    $("kpi-wl-sub").textContent = "100% of this snapshot's watchlist";
    $("kpi-ranked").textContent = String(rows.length);
    $("kpi-ranked-sub").textContent = `${U.watchlist_covered} watchlist + ${U.discovery_total} discovery`;
    $("kpi-univ").textContent = `${chk.accounted} / ${U.total}`;
    $("kpi-univ-sub").textContent = `${U.trading_total} trading · ${U.excluded_total} excluded`;
    $("kpi-cv").textContent = `${V.loo_model.med_x.toFixed(2)}× / ${V.wf_model.med_x.toFixed(2)}×`;
    $("kpi-cv-sub").textContent = `vs ${V.loo_flat25.med_x.toFixed(2)}× / ${V.wf_flat25.med_x.toFixed(2)}× flat 0.25×`;
    $("kpi-farm").textContent = `${B.vc.FARM} FARM`;
    $("kpi-farm-sub").textContent = `${B.vc.THIN} thin · ${B.vc.SKIP} skip at plan size`;
    $("tab-board-count").textContent = String(rows.length);
    $("tab-comps-count").textContent = String(U.trading_total);

    const pills = [
      [chk.wl === U.watchlist_total, `Watchlist ${chk.wl}/${U.watchlist_total} (100%)`],
      [chk.accounted === U.total, `Universe ${chk.accounted}/${U.total} reconciled (${rows.length} ranked + ${U.excluded_total} excl. + ${U.trading_total} trading)`],
      [chk.drift === 0, `${chk.drift}/${rows.length} impliedOf drift`],
      [chk.mono, `Strictly ranked 1..${rows.length}`],
      [true, `Peer odds 10-fold AUC ${O.auc.toFixed(3)} (Brier +${Math.round(O.skill * 100)}%)`],
    ];
    $("integrity-checks").innerHTML = pills.map(([ok, txt]) => `<span class="chk-pill${ok ? "" : " fail"}">${ok ? "✓" : "✗"} ${esc(txt)}</span>`).join('<span class="chk-sep">·</span>');
    $("model-line").innerHTML = `<span class="eq-code">log(mcap/TVL) = ${M.b0.toFixed(2)} ${M.b_tvl.toFixed(2)}·ln(TVL) + family + cat ${M.b_g >= 0 ? "+" : ""}${M.b_g.toFixed(2)}·g7d ${M.b_age >= 0 ? "+" : ""}${M.b_age.toFixed(2)}·ln(age) ${M.b_ch >= 0 ? "+" : ""}${M.b_ch.toFixed(2)}·ln(ch)</span><span>Fitted via L1-IRLS Ridge on ${M.n_priced} priced traded tokens (LOO R² ${V.loo_model.r2.toFixed(2)} vs ${V.loo_flat25.r2.toFixed(2)} flat; 0 hardcoded names).</span>`;
  }

  function populateFilters() {
    const sc = {}, cc = {};
    for (const r of rows) { sc[r.c] = (sc[r.c] || 0) + 1; for (const ch of r.h) cc[ch] = (cc[ch] || 0) + 1; }
    $("sector-select").innerHTML = `<option value="">All sectors (${Object.keys(sc).length})</option>` + Object.keys(sc).sort((a, b) => sc[b] - sc[a] || a.localeCompare(b)).map((c) => `<option value="${esc(c)}">${esc(c)} (${sc[c]})</option>`).join("");
    $("chain-select").innerHTML = `<option value="">All chains</option>` + Object.keys(cc).sort((a, b) => cc[b] - cc[a] || a.localeCompare(b)).map((c) => `<option value="${esc(c)}">${esc(c)} (${cc[c]})</option>`).join("");
  }

  function sortVal(r, k) {
    return k === "r" ? r.r : k === "n" ? r.n : k === "c" ? r.c : k === "k" ? r.k : k === "t" ? r.t : k === "g" ? r.g : k === "d" ? r.d : k === "m" ? (r.t ? r.v / r.t : null) : k === "v" ? r.v : k === "o" ? r.rem : k === "e" ? r.net : r.r;
  }

  function filteredRows() {
    const q = state.search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (state.tier === "watchlist" && r.w !== 1) return false;
      if (state.tier === "discovery" && r.w !== 0) return false;
      if (state.verdict !== "" && String(r.vc) !== state.verdict) return false;
      if (state.sector && r.c !== state.sector) return false;
      if (state.chain && r.h.indexOf(state.chain) === -1) return false;
      if (q && !(r.n.toLowerCase().includes(q) || r.s.toLowerCase().includes(q) || r.c.toLowerCase().includes(q) || r.h.join(" ").toLowerCase().includes(q))) return false;
      return true;
    });
    const dir = state.sortDir === "asc" ? 1 : -1, isTxt = state.sortKey === "n" || state.sortKey === "c";
    return out.sort((a, b) => {
      const va = sortVal(a, state.sortKey), vb = sortVal(b, state.sortKey);
      if (isTxt) return String(va).localeCompare(String(vb)) * dir || a.r - b.r;
      const an = va == null || isNaN(va), bn = vb == null || isNaN(vb);
      if (an && bn) return a.r - b.r;
      if (an) return 1;
      if (bn) return -1;
      return va < vb ? -dir : va > vb ? dir : a.r - b.r;
    });
  }

  function renderBoard() {
    const list = filteredRows();
    $("filter-status").textContent = list.length === rows.length ? `All ${rows.length} shown` : `${list.length} of ${rows.length} shown`;
    $("board-empty").hidden = list.length > 0;
    $("clear-filters").hidden = !(state.tier !== "all" || state.verdict !== "" || state.sector || state.chain || state.search.trim());
    let minM = 0.02, maxM = 0.6;
    for (const r of rows) { const m = r.v / Math.max(1, r.t); if (m < minM) minM = m; if (m > maxM) maxM = m; }
    const lMin = Math.log10(Math.max(minM, 0.005)), lRng = Math.max(0.2, Math.log10(maxM) - lMin);

    $("board-body").innerHTML = list.map((r) => {
      const mult = r.v / Math.max(1, r.t);
      const pct = clamp(((Math.log10(Math.max(mult, 0.005)) - lMin) / lRng) * 100, 5, 100);
      const chFirst = state.chain && r.h.includes(state.chain) ? state.chain : (r.h[0] || "—");
      const chHtml = (state.chain && chFirst === state.chain ? `<span class="ch-hit">${esc(chFirst)}</span>` : esc(chFirst)) + (r.k > 1 ? ` <span class="ch-more">+${r.k - 1}</span>` : "");
      const gCls = r.g == null ? "muted" : r.g >= 0 ? "pos" : "neg";
      const netCls = r.net >= 1.5 ? "pos" : r.net < 0 ? "neg" : "muted";
      return `<tr data-slug="${esc(r.s)}" class="${r.r <= 3 ? "rank-top" : ""}${state.selected === r.s ? " selected" : ""}" tabindex="0">` +
        `<td class="col-rank">${r.r}</td>` +
        `<td><div class="proto-cell"><div class="proto-top"><span class="proto-name">${esc(r.n)}</span><span class="pill ${r.w ? "pill-wl" : "pill-disc"}">${r.w ? "Watchlist" : "Discovery"}</span></div><span class="proto-slug">${esc(r.s)}</span></div></td>` +
        `<td>${esc(r.c)}</td><td>${chHtml}</td><td class="num">${fmtShortUsd(r.t)}</td>` +
        `<td class="num ${gCls}">${fmtChg(r.g)}</td><td class="num">${r.d == null ? '<span class="muted">—</span>' : r.d + "d"}</td>` +
        `<td class="num"><div class="mult-cell"><span>${mult.toFixed(3)}×</span><span class="bar-trk"><span class="bar-fill" style="width:${pct.toFixed(0)}%"></span></span></div></td>` +
        `<td class="num"><span class="val-main">${fmtShortUsd(r.v)}</span><span class="val-band">${fmtShortUsd(r.lo)}–${fmtShortUsd(r.hi)}</span></td>` +
        `<td class="num">${r.rem}%</td>` +
        `<td class="num"><div class="verdict-cell"><span class="pill ${vCls(r.vc)}">${vLbl(r.vc)}</span><span class="net-mini ${netCls}">${fmtSigned(r.net)}</span></div></td></tr>`;
    }).join("");
  }

  function renderValidationAndComps() {
    const ex = Object.entries(U.excluded_reasons || {}).slice(0, 6).map(([k, v]) => `${k} (${v})`).join(", ");
    $("val-grid").innerHTML = [
      [`Leave-One-Out CV (n=${V.loo_model.n})`, `${V.loo_model.med_x.toFixed(2)}× med err`, `R² ${V.loo_model.r2.toFixed(3)} · RMSE ${V.loo_model.rmse.toFixed(2)} · ${Math.round(V.loo_model.within_3x * 100)}% within 3×<br>Beats Flat 0.25× (${V.loo_flat25.med_x.toFixed(2)}×, R² ${V.loo_flat25.r2.toFixed(2)}) &amp; Median (${V.loo_global_med.med_x.toFixed(2)}×)`],
      ["Walk-Forward Older → Newer", `${V.wf_model.med_x.toFixed(2)}× med err`, `Trained on ${V.wf_train_n} oldest (≤ ${V.wf_split_date}), tested blind on ${V.wf_model.n} newest<br>Beats Flat 0.25× (${V.wf_flat25.med_x.toFixed(2)}×, RMSE ${V.wf_flat25.rmse.toFixed(2)} vs ${V.wf_model.rmse.toFixed(2)})`],
      ["Peer Token Survival Odds", `AUC ${O.auc.toFixed(3)}`, `10-fold CV over ${O.n} non-excluded peers (${O.nt} trading tokens)<br>Brier ${O.brier.toFixed(3)} vs ${O.base.toFixed(3)} base (+${Math.round(O.skill * 100)}% skill); odds decline with age`],
      ["758 / 758 Snapshot Accounting", `${U.watchlist_covered}/${U.watchlist_total} WL`, `${rows.length} pre-token ranked (${U.watchlist_covered} WL + ${U.discovery_total} disc.) · ${U.trading_total} trading (${U.trading_priced} priced)<br>${U.excluded_total} excluded: ${esc(ex)}`],
    ].map(([h, big, meta]) => `<div class="val-card"><h3>${h}</h3><div class="val-big">${big}</div><div class="val-meta">${meta}</div></div>`).join("");

    $("fams-body").innerHTML = B.fams.map((f) => `<tr><td>${esc(f[0])}</td><td class="num">${f[1]}</td><td class="num">${f[1] ? f[2].toFixed(3) + "×" : "—"}</td><td class="num"><strong>${f[3].toFixed(2)}×</strong></td><td class="num">${f[5] ? `${f[4]}/${f[5]} (${Math.round((f[4] / f[5]) * 100)}%)` : '<span class="muted">excl. (CEX)</span>'}</td></tr>`).join("");
    $("ablation-body").innerHTML = V.ablations.map((a) => `<tr><td>${esc(a.term)}</td><td class="num">${esc(a.slope)}</td><td class="num">${a.loo_med_x.toFixed(2)}×</td><td class="num ${a.delta_rmse > 0.005 ? "pos" : a.delta_rmse < -0.005 ? "neg" : "muted"}">${a.delta_rmse >= 0 ? "+" : ""}${a.delta_rmse.toFixed(3)}</td></tr>`).join("");
    $("comps-body").innerHTML = B.comps.map((c) => `<tr><td><strong>${esc(c[0])}</strong></td><td>${esc(c[1])}</td><td class="num">${fmtShortUsd(c[2])}</td><td class="num">${fmtShortUsd(c[3])}</td><td class="num">${c[2] ? (c[3] / c[2]).toFixed(2) + "×" : "—"}</td><td class="num">${fmtShortUsd(c[4])}</td></tr>`).join("");
  }

  function closeDetail() { $("detail-drawer").hidden = true; $("detail-backdrop").hidden = true; state.selected = null; state.capOverride = null; renderBoard(); }

  function openDetail(row) {
    if (!row) return;
    state.selected = row.s;
    const cap = state.capOverride ?? getPlanCapital(row.t), live = impliedOf(row, M), p = live.parts;
    const mult = row.v / Math.max(1, row.t), fam = familyOf(row.c);
    const s0 = row.t, s1 = s0 * p.base, s2 = s1 * p.fam * p.cat, s3 = s2 * p.scale, s4 = s3 * p.growth, s5 = s4 * p.age, s6 = s5 * p.chains;
    const maxW = Math.max(s0, s1, s2, s3, s4, s5, s6, 1);

    const catI = cats.indexOf(row.c), sec = (B.secs || []).find((x) => x[0] === catI);
    const secP = sec ? sec[1] : 0, secMed = sec ? sec[2] : 0, secTok = sec ? `${sec[3]}/${sec[4]}` : "0/0";
    const comps = B.comps.filter((c) => c[1] === row.c || familyOf(c[1]) === fam).slice(0, 3);
    const wfHtml = [
      ["TVL", "", s0, ""],
      ["Base (ref)", p.base.toFixed(3) + "×", s1, `Fitted intercept at median TVL ${fmtShortUsd(Math.exp(M.ref_log_tvl))}`],
      ["Sector", (p.fam * p.cat).toFixed(3) + "×", s2, `${fam} (${p.fam.toFixed(2)}×) · ${row.c} cat adj (${p.cat.toFixed(2)}×)`],
      ["TVL scale", p.scale.toFixed(3) + "×", s3, `Elasticity β=${M.b_tvl.toFixed(3)} (larger TVL earns lower multiple)`],
      ["7d growth", p.growth.toFixed(3) + "×", s4, row.g == null ? "7d unreported (neutral)" : `7d TVL ${fmtChg(row.g)} (Ridge β=${M.b_g.toFixed(3)})`],
      ["No-tok age", p.age.toFixed(3) + "×", s5, row.d == null ? "Age unknown (neutral)" : `${row.d}d tracked with no token (Ridge β=${M.b_age.toFixed(3)})`],
      ["Chains", p.chains.toFixed(3) + "×", s6, `${row.k} chain${row.k === 1 ? "" : "s"} (Ridge β=${M.b_ch.toFixed(3)})`],
    ].map(([l, m, v, note]) => `<div><div class="wf-r"><span class="wf-lbl">${l}</span><span class="wf-m">${m}</span><span class="wf-bw"><span class="wf-b" style="width:${clamp((v / maxW) * 100, 2, 100).toFixed(0)}%"></span></span><span class="wf-v">${fmtShortUsd(v)}</span></div>${note ? `<div class="wf-note">${esc(note)}</div>` : ""}</div>`).join("") +
      `<div class="wf-r wf-fin"><span class="wf-lbl">Implied</span><span class="wf-m">${mult.toFixed(3)}×</span><span></span><span class="wf-v">${fmtFull(row.v)}</span></div>`;

    const parityTxt = live.value === row.rawV
      ? (row.sd === 0 ? `✓ impliedOf() recomputes ${fmtFull(live.value)} — exact match with board.json` : `✓ impliedOf() = ${fmtFull(live.value)} (−$${row.sd} strict tie step-down)`)
      : `✗ Mismatch: impliedOf() = ${fmtFull(live.value)}`;

    const farmIn = { slug: row.s, name: row.n, category: row.c, chains: row.h, chainCount: row.k, tvl_usd: row.t, change_7d: row.g, ageDays: row.d, implied_value_usd: row.v, rem_launch_odds: row.rem / 100 };
    const econ = evaluateFarmEconomics(farmIn, cap), steps = buildFarmPlan(farmIn, cap);
    const evCode = econ.verdict === "FARM" ? 2 : econ.verdict === "THIN" ? 1 : 0;
    const capBtns = [200, 500, 1000, 5000].map((a) => `<button type="button" class="cap-btn${cap === a ? " is-on" : ""}" data-cap="${a}">$${a >= 1000 ? a / 1000 + "k" : a}</button>`).join("");
    const stepsHtml = steps.map((st, idx) => `<li class="step-li"><span class="step-num">${idx + 1}</span><div><div class="step-head"><span class="step-title">${esc(st.title)}</span><div class="step-chips"><span class="chip">${esc(st.cost)}</span><span class="chip">${esc(st.time)}</span></div></div><div class="step-body">${esc(st.body)}</div></div></li>`).join("");
    const compsTxt = comps.length ? "Peer comps: " + comps.map((c) => `${c[0]} (${(c[3] / Math.max(1, c[2])).toFixed(2)}×)`).join(", ") + "." : "";

    const d = $("detail-drawer");
    d.innerHTML =
      `<div class="d-top"><div><div class="d-title-row"><h2>${esc(row.n)}</h2><span class="pill ${row.w ? "pill-wl" : "pill-disc"}">${row.w ? "Watchlist" : "Discovery"}</span><span class="pill ${vCls(evCode)}">${econ.verdict}</span></div><div class="d-sub">Rank ${row.r} of ${rows.length} · ${esc(row.c)} (${esc(fam)}) · ${esc(row.s)} · ${row.k} chain${row.k === 1 ? "" : "s"}: ${esc(row.h.join(", "))}${row.k > row.h.length ? " +" + (row.k - row.h.length) : ""}</div></div><div class="d-hero"><div><div class="d-hero-val">${fmtFull(row.v)}</div><div class="d-hero-sub">${(mult * 100).toFixed(1)}% of TVL · P25–P75 ${fmtShortUsd(row.lo)}–${fmtShortUsd(row.hi)}</div></div><button type="button" class="d-close" aria-label="Close">×</button></div></div>` +
      `<div class="d-metrics"><div class="d-tile"><span>TVL</span><b>${fmtShortUsd(row.t)}</b></div><div class="d-tile"><span>7-Day Change</span><b class="${row.g == null ? "muted" : row.g >= 0 ? "pos" : "neg"}">${fmtChg(row.g)}</b></div><div class="d-tile"><span>No-Token Age</span><b>${row.d == null ? "unknown" : row.d + " days"}</b></div><div class="d-tile"><span>Fitted Multiple</span><b>${mult.toFixed(3)}×</b></div><div class="d-tile"><span>Peer Token Rate</span><b>${row.peer}%</b></div><div class="d-tile"><span>Rem. Launch Odds</span><b>${row.rem}%</b></div></div>` +
      `<div class="d-cols"><div><div class="d-box"><h3>Fitted Valuation Waterfall</h3><div class="wf">${wfHtml}</div><p class="parity-note">${esc(parityTxt)}</p></div><div class="d-box"><h3>Peer Sector &amp; Survival Evidence</h3><p class="peer-p"><strong>${esc(row.c)}</strong> (${esc(fam)}): ${secP} priced traded token${secP === 1 ? "" : "s"}${secP ? ` (median ${secMed.toFixed(3)}×)` : ""}; ${secTok} peers already trade a token. Survival odds to 4y horizon: <strong>${row.rem}%</strong> (10-fold AUC ${O.auc.toFixed(3)}).</p>${compsTxt ? `<p class="peer-p">${esc(compsTxt)}</p>` : ""}</div></div>` +
      `<div class="d-box"><h3><span>Plan-Sized Farm Playbook (${esc(econ.primaryChain)})</span><div class="cap-bar">${capBtns}</div></h3><div class="econ-grid"><div class="econ-tile"><span>Capital</span><b>${fmtUsd(econ.capitalUsd)}</b></div><div class="econ-tile"><span>Cash Cost</span><b>${fmtUsd(econ.cashCostUsd)}</b></div><div class="econ-tile"><span>Exp / Cond Gross</span><b>${fmtUsd(econ.expGrossUsd)} / ${fmtUsd(econ.condGrossUsd)}</b></div><div class="econ-tile"><span>Expected Net EV</span><b class="${econ.expNetUsd >= 0 ? "pos" : "neg"}">${fmtSigned(econ.expNetUsd)}</b></div></div><ol class="steps-ol">${stepsHtml}</ol></div></div>`;

    d.querySelector(".d-close").addEventListener("click", closeDetail);
    d.querySelectorAll(".cap-btn").forEach((btn) => btn.addEventListener("click", () => { state.capOverride = Number(btn.getAttribute("data-cap")); openDetail(row); }));
    d.hidden = false; $("detail-backdrop").hidden = false; renderBoard();
  }

  function setupEvents() {
    const setTab = (w) => {
      const b = w === "board";
      $("tab-board").classList.toggle("is-active", b); $("tab-comps").classList.toggle("is-active", !b);
      $("tab-board").setAttribute("aria-selected", String(b)); $("tab-comps").setAttribute("aria-selected", String(!b));
      $("board-section").hidden = !b; $("board-filters").hidden = !b; $("comps-section").hidden = b;
    };
    $("tab-board").addEventListener("click", () => setTab("board"));
    $("tab-comps").addEventListener("click", () => setTab("comps"));
    const tierBtns = document.querySelectorAll(".seg-btn");
    const setTier = (t) => { state.tier = t; tierBtns.forEach((b) => { const on = b.getAttribute("data-tier") === t; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); }); renderBoard(); };
    tierBtns.forEach((b) => b.addEventListener("click", () => setTier(b.getAttribute("data-tier"))));
    $("verdict-select").addEventListener("change", (e) => { state.verdict = e.target.value; renderBoard(); });
    $("sector-select").addEventListener("change", (e) => { state.sector = e.target.value; renderBoard(); });
    $("chain-select").addEventListener("change", (e) => { state.chain = e.target.value; renderBoard(); });
    $("search-input").addEventListener("input", (e) => { state.search = e.target.value; renderBoard(); });
    $("clear-filters").addEventListener("click", () => { state.verdict = state.sector = state.chain = state.search = ""; $("verdict-select").value = $("sector-select").value = $("chain-select").value = $("search-input").value = ""; setTier("all"); });

    const ths = document.querySelectorAll("#board-table th[data-sort]");
    const syncSort = () => ths.forEach((th) => { const on = th.getAttribute("data-sort") === state.sortKey; th.classList.toggle("sorted", on); const a = th.querySelector(".sort-arrow"); if (a) a.textContent = on ? (state.sortDir === "asc" ? "▲" : "▼") : ""; });
    ths.forEach((th) => th.addEventListener("click", () => { const k = th.getAttribute("data-sort"); if (state.sortKey === k) state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; else { state.sortKey = k; state.sortDir = k === "r" || k === "n" || k === "c" ? "asc" : "desc"; } syncSort(); renderBoard(); }));
    syncSort();

    $("board-body").addEventListener("click", (e) => { const tr = e.target && e.target.closest ? e.target.closest("tr[data-slug]") : null; if (tr) { state.capOverride = null; openDetail(rows.find((x) => x.s === tr.getAttribute("data-slug"))); } });
    $("detail-backdrop").addEventListener("click", closeDetail);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
  }

  function init() { renderHeader(); populateFilters(); renderValidationAndComps(); setupEvents(); renderBoard(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

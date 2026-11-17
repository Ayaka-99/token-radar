// Dashboard copy of the farm-step generator from lib/farm.ts,
// kept identical so the detail view shows the same steps as board.json.

const GAS_USD = {
  Ethereum: 2,
  Bitcoin: 1.5,
  Tron: 1,
  Avalanche: 0.1,
  Arbitrum: 0.05,
  Optimism: 0.05,
  "zkSync Era": 0.05,
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
  "Hyperliquid L1": 0.01,
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
  "Robinhood Chain": 0.02,
  "Plume Mainnet": 0.02,
};

const DEFAULT_GAS_USD = 0.5;

function getGasUsd(chain) {
  return GAS_USD[chain] ?? DEFAULT_GAS_USD;
}

function getGas(chain) {
  return fmtUsd(getGasUsd(chain));
}

const CATEGORY_TO_FAMILY = {
  "Risk Curators": "curator",
  "Onchain Capital Allocator": "curator",
  Yield: "yield",
  "Yield Aggregator": "yield",
  Farm: "yield",
  "Liquidity Manager": "yield",
  "Leveraged Farming": "yield",
  Lending: "lending",
  "Collateral Markets": "lending",
  CDP: "cdp",
  "CDP Manager": "cdp",
  Dexs: "exchange",
  "OTC Marketplace": "exchange",
  Derivatives: "perpetuals",
  "Prediction Market": "perpetuals",
  RWA: "rwa",
  "Basis Trading": "basis",
  "Stablecoin Wrapper": "basis",
  "Dual-Token Stablecoin": "basis",
  "Staking Pool": "staking",
  Restaking: "staking",
  "Anchor BTC": "bitcoin",
  "Decentralized BTC": "bitcoin",
  Chain: "chain",
  "Cross Chain Bridge": "chain",
};

const FAMILY_PROFILES = {
  curator: {
    asset: "USDC or WETH",
    entry: "deposit into the largest stablecoin vault {N} curates",
    weekly: "check the vault's market allocation and claim any rewards it streams",
    risk: "A curated vault inherits bad debt from every market it lends into; read its market list and keep one curator under 20% of your stables",
    exit: "withdraw; big exits can wait on idle liquidity",
    exitTime: "1–2 days",
  },
  yield: {
    asset: "the vault's deposit asset (usually USDC or ETH)",
    entry: "deposit into {N}'s highest-TVL vault or pool",
    weekly: "claim accrued rewards and re-deposit them",
    risk: "Yield vaults stack strategy risk on contract risk; read the strategy before sizing up",
    exit: "withdraw; unwinding strategies can take hours",
    exitTime: "same day",
  },
  lending: {
    asset: "blue-chip collateral (ETH, BTC wrapper or USDC)",
    entry: "supply collateral on {N} and borrow a stablecoin at under 35% LTV",
    weekly: "repay part of the loan and re-borrow so supply and borrow both accrue",
    risk: "A borrow is liquidated if collateral falls; keep the health factor above 1.8 and set a price alert",
    exit: "repay the debt, then withdraw collateral",
    exitTime: "same day",
  },
  cdp: {
    asset: "accepted collateral (ETH, LSTs or a BTC wrapper)",
    entry: "open a {N} position and mint its stablecoin at a collateral ratio above 200%",
    weekly: "park the minted stablecoin in the savings module and top up collateral if the ratio slips",
    risk: "Redemptions and liquidations hit the lowest ratios first; stay far above the minimum",
    exit: "repay the minted debt and withdraw collateral",
    exitTime: "same day",
  },
  exchange: {
    asset: "two liquid assets for a major pair",
    entry: "add liquidity on {N} in its deepest pair and make 3 small swaps",
    weekly: "swap once and re-centre the range so the position stays in range",
    risk: "Impermanent loss can exceed fees on volatile pairs; prefer a stable or correlated pair",
    exit: "withdraw liquidity and claim fees",
    exitTime: "same day",
  },
  perpetuals: {
    asset: "USDC margin",
    entry: "open and close small offsetting positions on {N} at 1–2x",
    weekly: "trade a modest volume; activity programs reward volume, not size",
    risk: "Fees and funding add up; above 2x one wick can liquidate you",
    exit: "close positions and withdraw margin",
    exitTime: "same day",
  },
  rwa: {
    asset: "USDC",
    entry: "pass {N}'s KYC, then subscribe to its tokenized fund",
    weekly: "check the NAV and any reward accrual",
    risk: "Subscriptions may be limited to verified or non-US wallets, and redemptions settle on business days",
    exit: "request redemption",
    exitTime: "1–3 business days",
  },
  basis: {
    asset: "USDC or USDT",
    entry: "mint {N}'s yield-bearing stablecoin and stake it",
    weekly: "check the reward rate; funding-based yield can turn negative",
    risk: "Basis yield needs positive funding and a sound custodian; a depeg or negative funding hits stakers first",
    exit: "unstake (cooldowns can run 7 days) and redeem",
    exitTime: "up to 7 days",
  },
  staking: {
    asset: "the chain's native token or ETH",
    entry: "stake through {N} and keep the liquid receipt token",
    weekly: "check operator performance and claim rewards",
    risk: "Slashing and a receipt-token discount are the main risks, and unbonding locks capital",
    exit: "unstake through the protocol queue",
    exitTime: "1–14 days",
  },
  bitcoin: {
    asset: "BTC",
    entry: "deposit BTC into {N} and hold the receipt token",
    weekly: "check the receipt holds its BTC peg and claim rewards",
    risk: "BTC wrappers rely on custody or bridge security, and redemptions can queue",
    exit: "redeem back to native BTC",
    exitTime: "1–3 days",
  },
  chain: {
    asset: "ETH or USDC",
    entry: "bridge in through the canonical bridge and use 3 native apps on {N}: a swap, a lend and a liquidity position",
    weekly: "make one action in a different native app",
    risk: "Canonical bridge exits can take 7 days; keep only what you will use there",
    exit: "bridge back out",
    exitTime: "up to 7 days",
  },
  generic: {
    asset: "USDC",
    entry: "deposit into {N}'s main product",
    weekly: "interact once (deposit, claim or vote)",
    risk: "Young contracts carry the most risk; start at the low end of the capital range",
    exit: "withdraw",
    exitTime: "same day",
  },
};

const HOLD_WEEKS = 4;
const AIRDROP_SHARE = 0.05;

function getPrincipalRange(tvl_usd) {
  if (tvl_usd >= 500_000_000) return "$1,000–$2,000";
  if (tvl_usd >= 100_000_000) return "$500–$1,000";
  if (tvl_usd >= 30_000_000) return "$250–$500";
  return "$100–$250";
}

function fmtUsd(x) {
  if (!Number.isFinite(x) || x < 0) return "$0.00";
  if (x < 10) return `$${x.toFixed(2)}`;
  if (x < 1000) return `$${Math.round(x)}`;
  const rounded = Math.round(x / 10) * 10;
  return `$${rounded.toLocaleString("en-US")}`;
}

function fmtShortUsd(x) {
  if (!Number.isFinite(x) || x < 0) return "$0.00";
  if (x >= 1_000_000_000) return `$${(x / 1_000_000_000).toFixed(2)}B`;
  if (x >= 1_000_000) return `$${(x / 1_000_000).toFixed(1)}M`;
  return fmtUsd(x);
}

function pickChains(chains) {
  const listed = chains.filter(Boolean).slice(0, 3);
  if (listed.length === 0) {
    return { firstChain: "Ethereum", primary: "Ethereum", secondary: null };
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

  let secondary = null;
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

function buildFarmPlan(input) {
  const family = CATEGORY_TO_FAMILY[input.category] ?? "generic";
  const profile = FAMILY_PROFILES[family];
  const { firstChain, primary, secondary } = pickChains(input.chains);
  const firstGas = getGasUsd(firstChain);
  const primaryGas = getGasUsd(primary);
  const secondaryGas = secondary ? getGasUsd(secondary) : 0;
  const capital = getPrincipalRange(input.tvl_usd);

  const isMomentum = input.change_7d !== null && input.change_7d > 5;
  const isStaging = input.change_7d !== null && input.change_7d < -10;
  const entryCalls = isStaging ? 4 : 2;
  const enterTime = isStaging ? "7 days" : "15 min";

  const totalCalls = 1 + entryCalls + HOLD_WEEKS + 2 + (secondary ? 3 : 0);
  const totalGas =
    primaryGas * (1 + entryCalls + HOLD_WEEKS + 2) + (secondary ? secondaryGas * 3 : 0);

  const steps = [];

  // 1. Fund
  const cheaperNote =
    primary !== firstChain
      ? ` (${primary} is cheaper than ${firstChain} at ${fmtUsd(firstGas)}/call.)`
      : "";
  steps.push({
    title: "Fund",
    body: `Send ${capital} in ${profile.asset} to a fresh wallet on ${primary}, plus ${fmtUsd(totalGas * 1.5)} of gas tokens for the ${totalCalls} calls this plan makes.${cheaperNote}`,
    cost: `${fmtUsd(primaryGas)} transfer`,
    time: "10 min",
  });

  // 2. Enter
  const entryReplaced = profile.entry.replace(/\{N\}/g, input.name);
  const entryCap = entryReplaced.charAt(0).toUpperCase() + entryReplaced.slice(1);
  let enterExtra = "";
  if (isMomentum) {
    enterExtra = ` Do it within 48 hours: TVL grew ${input.change_7d.toFixed(1)}% in 7 days, so a later entry gets a smaller pro-rata share.`;
  } else if (isStaging) {
    enterExtra = ` Split it into 3 tranches over 7 days: TVL fell ${Math.abs(input.change_7d).toFixed(1)}% in 7 days, so confirm the outflow has stopped before adding.`;
  }
  steps.push({
    title: "Enter",
    body: `${entryCap} on ${primary}.${enterExtra}`,
    cost: `${fmtUsd(primaryGas * entryCalls)} (${entryCalls} calls)`,
    time: enterTime,
  });

  // 3. Second chain (optional)
  if (secondary) {
    steps.push({
      title: "Second chain",
      body: `Bridge a quarter of the position to ${secondary} and repeat the entry there; ${input.name} lists ${input.chains.length} chains and use on more than one is a common eligibility criterion.`,
      cost: `${fmtUsd(secondaryGas * 3)} + bridge fee`,
      time: "1 day",
    });
  }

  // 4. Hold
  let ageSentence;
  if (input.ageDays === null || input.ageDays === undefined) {
    ageSentence = "Its listing date is unknown, so tenure cannot be judged.";
  } else if (input.ageDays >= 365) {
    ageSentence = `${input.name} has run ${Math.round(input.ageDays)} days with no token recorded; long programs tend to reward tenure, so hold through at least one more snapshot.`;
  } else {
    ageSentence = `${input.name} has run ${Math.round(input.ageDays)} days with no token recorded; early depositors usually weigh more in a first snapshot.`;
  }
  steps.push({
    title: "Hold",
    body: `Leave the position for 4 weeks: snapshot programs usually weigh size times time, so churn costs you. ${ageSentence}`,
    cost: "$0",
    time: "4 weeks",
  });

  // 5. Weekly touch
  steps.push({
    title: "Weekly touch",
    body: `Once a week, ${profile.weekly}.`,
    cost: `${fmtUsd(primaryGas * 4)} (4 calls)`,
    time: "5 min a week",
  });

  // 6. Risk check
  steps.push({
    title: "Risk check",
    body: `${profile.risk}.`,
    cost: "$0",
    time: "10 min before entering",
  });

  // 7. Exit
  steps.push({
    title: "Exit",
    body: `When you stop farming, ${profile.exit}.`,
    cost: `${fmtUsd(primaryGas * 2)} (2 calls)`,
    time: profile.exitTime,
  });

  // 8. Budget
  const impliedVal = Number(input.implied_value_usd || 0);
  const earningsRate =
    input.tvl_usd > 0 ? (impliedVal / input.tvl_usd) * AIRDROP_SHARE : 0;
  const per1000 = 1000 * earningsRate;
  const breakEven = earningsRate > 0 ? totalGas / earningsRate : 0;
  steps.push({
    title: "Budget",
    body: `${totalCalls} calls cost ${fmtUsd(totalGas)} in gas; with ${capital} on a ${fmtShortUsd(impliedVal)} implied value, 5% pro-rata is ${fmtUsd(per1000)} per $1,000 held (break-even ${fmtUsd(breakEven)}). Illustrative, not a forecast.`,
    cost: `${fmtUsd(totalGas)} gas`,
    time: "about 5 weeks",
  });

  return steps;
}

function serializeFarmStep(step) {
  return `${step.title}: ${step.body} Cost: ${step.cost}. Time: ${step.time}.`;
}

function farmSteps(input) {
  return buildFarmPlan(input).map(serializeFarmStep);
}

const MAJOR_CHAINS = new Set(["Ethereum", "Solana", "Base", "Arbitrum", "Binance"]);

const DEFAULT_MODEL = {
  median: 0.214,
  k: 10,
  min_sample: 5,
  clamp_min: 0.047,
  clamp_max: 1.047,
  floor: 1_000_000,
  tokens: 128,
};

(function () {
  var BOARD = window.BOARD || null;
  var rows = BOARD && Array.isArray(BOARD.rows) ? BOARD.rows : [];
  var comps = BOARD && Array.isArray(BOARD.comps) ? BOARD.comps : [];
  var sectors = BOARD && Array.isArray(BOARD.sectors) ? BOARD.sectors : [];
  var model = Object.assign({}, DEFAULT_MODEL, (BOARD && BOARD.model) || {});

  var state = {
    tier: "all",
    sector: "",
    chain: "",
    search: "",
    sortKey: "r",
    sortDir: "asc",
    lastFocusedSlug: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtShort(usd) {
    if (usd == null || isNaN(usd)) return "—";
    if (usd >= 1e9) return "$" + (usd / 1e9).toFixed(2) + "B";
    if (usd >= 1e6) return "$" + (usd / 1e6).toFixed(1) + "M";
    if (usd >= 1e3) return "$" + (usd / 1e3).toFixed(1) + "K";
    return "$" + Math.round(usd).toLocaleString("en-US");
  }

  function fmtFull(usd) {
    if (usd == null || isNaN(usd)) return "—";
    return "$" + Math.round(usd).toLocaleString("en-US");
  }

  function fmtChange(g) {
    if (g == null || isNaN(g)) return "n/a";
    var sign = g > 0 ? "+" : "";
    return sign + Number(g).toFixed(1) + "%";
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var mIdx = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (isNaN(mIdx) || mIdx < 0 || mIdx > 11 || isNaN(day)) return iso;
    return day + " " + months[mIdx] + " " + parts[0];
  }

  function renderFacts() {
    var dateEl = $("fact-snapshot");
    var countEl = $("fact-ranked");
    var splitEl = $("fact-ranked-split");
    var topEl = $("fact-top-value");
    var topNameEl = $("fact-top-name");
    var tokensEl = $("fact-comps");
    var badgeBoard = $("tab-board-count");
    var badgeComps = $("tab-comps-count");

    if (!BOARD || !rows.length) {
      if (dateEl) dateEl.textContent = "";
      if (countEl) countEl.textContent = "";
      if (splitEl) splitEl.textContent = "";
      if (topEl) topEl.textContent = "";
      if (topNameEl) topNameEl.textContent = "";
      if (tokensEl) tokensEl.textContent = "";
      if (badgeBoard) badgeBoard.textContent = "0";
      if (badgeComps) badgeComps.textContent = String(comps.length);
      return;
    }

    var watchlistCount = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].w === 1) watchlistCount++;
    }
    var discoveryCount = rows.length - watchlistCount;

    if (dateEl) dateEl.textContent = fmtDate(BOARD.as_of);
    if (countEl) countEl.textContent = String(BOARD.n || rows.length);
    if (splitEl) splitEl.textContent = watchlistCount + " watchlist, " + discoveryCount + " discovery";

    var topRow = rows[0];
    if (topEl) topEl.textContent = fmtShort(topRow.v);
    if (topNameEl) topNameEl.textContent = topRow.n || "";
    if (tokensEl) tokensEl.textContent = String(model.tokens);
    if (badgeBoard) badgeBoard.textContent = String(rows.length);
    if (badgeComps) badgeComps.textContent = String(comps.length);
  }

  function populateFilters() {
    var catSel = $("sector-select");
    if (catSel) {
      var catCounts = {};
      for (var i = 0; i < rows.length; i++) {
        var c = rows[i].c || "Other";
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
      var cats = Object.keys(catCounts).sort(function (a, b) {
        if (catCounts[b] !== catCounts[a]) return catCounts[b] - catCounts[a];
        return a.localeCompare(b);
      });
      var catHtml = '<option value="">All sectors</option>';
      for (var j = 0; j < cats.length; j++) {
        var cat = cats[j];
        catHtml += '<option value="' + escHtml(cat) + '">' + escHtml(cat) + " (" + catCounts[cat] + ")</option>";
      }
      catSel.innerHTML = catHtml;
    }

    var chainSel = $("chain-select");
    if (chainSel) {
      var chainCounts = {};
      for (var k = 0; k < rows.length; k++) {
        var chs = Array.isArray(rows[k].h) ? rows[k].h : [];
        for (var m = 0; m < chs.length; m++) {
          var ch = chs[m];
          if (ch) chainCounts[ch] = (chainCounts[ch] || 0) + 1;
        }
      }
      var chains = Object.keys(chainCounts).sort(function (a, b) {
        if (chainCounts[b] !== chainCounts[a]) return chainCounts[b] - chainCounts[a];
        return a.localeCompare(b);
      });
      var chHtml = '<option value="">All chains</option>';
      for (var n = 0; n < chains.length; n++) {
        var chName = chains[n];
        chHtml += '<option value="' + escHtml(chName) + '">' + escHtml(chName) + " (" + chainCounts[chName] + ")</option>";
      }
      chainSel.innerHTML = chHtml;
    }
  }

  function getSortVal(row, key) {
    if (key === "r") return row.r;
    if (key === "n") return row.n || "";
    if (key === "c") return row.c || "";
    if (key === "k") return Array.isArray(row.h) ? row.h.length : 0;
    if (key === "t") return row.t;
    if (key === "g") return row.g;
    if (key === "d") return row.d;
    if (key === "m") return row.t ? row.v / row.t : null;
    if (key === "v") return row.v;
    return row.r;
  }

  function getFilteredSortedRows() {
    var q = state.search.trim().toLowerCase();
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (state.tier === "watchlist" && r.w !== 1) continue;
      if (state.tier === "discovery" && r.w !== 0) continue;
      if (state.sector && r.c !== state.sector) continue;
      if (state.chain) {
        var chs = Array.isArray(r.h) ? r.h : [];
        if (chs.indexOf(state.chain) === -1) continue;
      }
      if (q) {
        var nameMatch = (r.n || "").toLowerCase().indexOf(q) !== -1;
        var slugMatch = (r.s || "").toLowerCase().indexOf(q) !== -1;
        if (!nameMatch && !slugMatch) continue;
      }
      out.push(r);
    }

    var key = state.sortKey;
    var dir = state.sortDir === "asc" ? 1 : -1;
    var isText = key === "n" || key === "c";

    out.sort(function (a, b) {
      var va = getSortVal(a, key);
      var vb = getSortVal(b, key);
      if (isText) {
        var cmp = String(va).localeCompare(String(vb));
        if (cmp !== 0) return cmp * dir;
        return a.r - b.r;
      }
      var aNull = va == null || isNaN(va);
      var bNull = vb == null || isNaN(vb);
      if (aNull && bNull) return a.r - b.r;
      if (aNull) return 1;
      if (bNull) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.r - b.r;
    });

    return out;
  }

  function renderBoard() {
    var tbody = $("board-body");
    if (!tbody) return;
    var list = getFilteredSortedRows();

    var shownEl = $("filter-status");
    if (shownEl) {
      if (list.length === rows.length) {
        shownEl.textContent = "All " + rows.length + " shown";
      } else {
        shownEl.textContent = list.length + " of " + rows.length + " shown";
      }
    }
    var emptyEl = $("board-empty");
    if (emptyEl) {
      emptyEl.hidden = list.length > 0;
    }
    var clearBtn = $("clear-filters");
    if (clearBtn) {
      var hasFilters = state.tier !== "all" || state.sector || state.chain || state.search.trim().length > 0;
      clearBtn.hidden = !hasFilters;
    }

    var minMult = 0.047;
    var maxMult = 1.047;
    for (var mIdx = 0; mIdx < rows.length; mIdx++) {
      if (rows[mIdx].t > 0) {
        var mVal = rows[mIdx].v / rows[mIdx].t;
        if (mVal > maxMult) maxMult = mVal;
        if (mVal < minMult) minMult = mVal;
      }
    }
    var logMin = Math.log10(Math.max(minMult, 0.001));
    var logMax = Math.log10(Math.max(maxMult, 0.002));
    var logRange = Math.max(logMax - logMin, 0.1);

    var html = "";
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var tag = r.w === 1
        ? '<span class="tag tag-watchlist">Watchlist</span>'
        : '<span class="tag tag-discovery">Discovery</span>';
      var chs = Array.isArray(r.h) ? r.h : [];
      var chainText = chs.length > 0 ? chs[0] + (chs.length > 1 ? ' <span class="chain-more">+' + (chs.length - 1) + "</span>" : "") : "—";
      var chgClass = r.g == null || isNaN(r.g) ? "muted" : r.g >= 0 ? "pos" : "neg";
      var ageText = r.d == null || isNaN(r.d) ? '<span class="muted">—</span>' : Math.round(r.d) + "d";
      var multNum = r.t ? r.v / r.t : null;
      var multText = multNum != null ? multNum.toFixed(3) + "×" : "—";
      var multPct = 0;
      if (multNum != null && multNum > 0) {
        var curLog = Math.log10(multNum);
        multPct = Math.max(4, Math.min(100, ((curLog - logMin) / logRange) * 100));
      }

      var isSelected = state.lastFocusedSlug === r.s ? " selected" : "";

      html +=
        '<tr data-slug="' + escHtml(r.s) + '" data-rank="' + r.r + '" class="' + (r.r <= 3 ? "rank-" + r.r : "") + isSelected + '" tabindex="0">' +
        '<td class="col-rank">' + r.r + "</td>" +
        '<td class="col-protocol">' +
          '<div class="protocol-cell">' +
            '<div class="proto-title-row"><span class="protocol-name">' + escHtml(r.n) + "</span> " + tag + "</div>" +
            '<span class="protocol-slug">' + escHtml(r.s) + "</span>" +
          "</div>" +
        "</td>" +
        '<td class="col-sector">' + escHtml(r.c) + "</td>" +
        '<td class="col-chains">' + chainText + "</td>" +
        '<td class="col-num">' + fmtShort(r.t) + "</td>" +
        '<td class="col-num ' + chgClass + '">' + fmtChange(r.g) + "</td>" +
        '<td class="col-num">' + ageText + "</td>" +
        '<td class="col-num col-multiple">' +
          '<div class="multiple-cell">' +
            '<span class="multiple-num">' + multText + "</span>" +
            '<span class="multiple-bar-track"><span class="multiple-bar-fill" style="width:' + multPct.toFixed(1) + '%"></span></span>' +
          "</div>" +
        "</td>" +
        '<td class="col-num col-implied"><strong class="implied-bold">' + fmtShort(r.v) + "</strong></td>" +
        "</tr>";
    }
    tbody.innerHTML = html;
  }

  function setupFilters() {
    var btnAll = $("tier-all");
    var btnWatch = $("tier-watchlist");
    var btnDisc = $("tier-discovery");
    var btns = [
      { el: btnAll, mode: "all" },
      { el: btnWatch, mode: "watchlist" },
      { el: btnDisc, mode: "discovery" },
    ];

    function setTier(mode) {
      state.tier = mode;
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].el) {
          var active = btns[i].mode === mode;
          btns[i].el.classList.toggle("is-pressed", active);
          btns[i].el.setAttribute("aria-pressed", active ? "true" : "false");
        }
      }
      renderBoard();
    }

    for (var i = 0; i < btns.length; i++) {
      (function (item) {
        if (item.el) {
          item.el.addEventListener("click", function () {
            setTier(item.mode);
          });
        }
      })(btns[i]);
    }

    var catSel = $("sector-select");
    if (catSel) {
      catSel.addEventListener("change", function () {
        state.sector = this.value;
        renderBoard();
      });
    }

    var chainSel = $("chain-select");
    if (chainSel) {
      chainSel.addEventListener("change", function () {
        state.chain = this.value;
        renderBoard();
      });
    }

    var searchInp = $("search-input");
    if (searchInp) {
      searchInp.addEventListener("input", function () {
        state.search = this.value;
        renderBoard();
      });
    }

    var clearBtn = $("clear-filters");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.sector = "";
        state.chain = "";
        state.search = "";
        if (catSel) catSel.value = "";
        if (chainSel) chainSel.value = "";
        if (searchInp) searchInp.value = "";
        setTier("all");
      });
    }
  }

  function setupSorting() {
    var boardTable = $("board-table");
    if (!boardTable) return;
    var headers = boardTable.querySelectorAll("th[data-sort]");

    function updateHeaderClasses() {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        var key = h.getAttribute("data-sort");
        var arrow = h.querySelector(".sort-arrow");
        if (key === state.sortKey) {
          h.classList.add("sorted");
          h.setAttribute("data-dir", state.sortDir);
          if (arrow) arrow.textContent = state.sortDir === "asc" ? " ▲" : " ▼";
        } else {
          h.classList.remove("sorted");
          h.removeAttribute("data-dir");
          if (arrow) arrow.textContent = "";
        }
      }
    }

    for (var i = 0; i < headers.length; i++) {
      headers[i].addEventListener("click", function () {
        var key = this.getAttribute("data-sort");
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "n" || key === "c" ? "asc" : "desc";
        }
        updateHeaderClasses();
        renderBoard();
      });
    }
    updateHeaderClasses();
  }

  function setupTabs() {
    var tabBoard = $("tab-board");
    var tabComps = $("tab-comps");
    var secBoard = $("board-section");
    var secFilters = $("board-filters");
    var secComps = $("comps-section");

    function activate(which) {
      var isBoard = which === "board";
      if (tabBoard) {
        tabBoard.setAttribute("aria-selected", isBoard ? "true" : "false");
        tabBoard.classList.toggle("is-active", isBoard);
      }
      if (tabComps) {
        tabComps.setAttribute("aria-selected", isBoard ? "false" : "true");
        tabComps.classList.toggle("is-active", !isBoard);
      }
      if (secBoard) secBoard.hidden = !isBoard;
      if (secFilters) secFilters.hidden = !isBoard;
      if (secComps) secComps.hidden = isBoard;
    }

    if (tabBoard) {
      tabBoard.addEventListener("click", function () {
        activate("board");
      });
    }
    if (tabComps) {
      tabComps.addEventListener("click", function () {
        activate("comps");
      });
    }
  }

  function renderCompsAndSectors() {
    var sectorBody = $("sectors-body");
    if (sectorBody) {
      var sortedSectors = sectors.slice().sort(function (a, b) {
        if (b.n !== a.n) return b.n - a.n;
        return String(a.c).localeCompare(String(b.c));
      });
      sectorBody.innerHTML = sortedSectors
        .map(function (s) {
          var medText = s.n === 0 ? "—" : Number(s.m).toFixed(3);
          var baseText = Number(s.b).toFixed(3) + (s.n < model.min_sample ? " global" : "");
          var baseClass = s.n < model.min_sample ? ' class="num muted"' : ' class="num"';
          return (
            "<tr>" +
            "<td>" + escHtml(s.c) + "</td>" +
            '<td class="num">' + s.n + "</td>" +
            '<td class="num">' + medText + "</td>" +
            "<td" + baseClass + ">" + baseText + "</td>" +
            "</tr>"
          );
        })
        .join("");
    }

    var compsBody = $("comps-body");
    if (compsBody) {
      compsBody.innerHTML = comps
        .map(function (c) {
          var ratio = c.t ? (c.m / c.t).toFixed(2) + "×" : "0.00×";
          return (
            "<tr>" +
            "<td>" + escHtml(c.n) + "</td>" +
            "<td>" + escHtml(c.c) + "</td>" +
            '<td class="num">' + fmtShort(c.t) + "</td>" +
            '<td class="num">' + fmtShort(c.m) + "</td>" +
            '<td class="num">' + ratio + "</td>" +
            "</tr>"
          );
        })
        .join("");
    }
  }

  function closeDetail() {
    var detail = $("detail-drawer");
    if (!detail || detail.hidden) return;
    detail.hidden = true;
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (state.lastFocusedSlug) {
      var rowEl = document.querySelector('#board-body tr[data-slug="' + state.lastFocusedSlug + '"]');
      if (rowEl) rowEl.focus();
    }
  }

  function openDetail(row) {
    var detail = $("detail-drawer");
    if (!detail || !row) return;
    state.lastFocusedSlug = row.s;
    if (window.location.hash !== "#" + row.s) {
      history.replaceState(null, "", "#" + row.s);
    }

    var tag = row.w === 1 ? "Watchlist" : "Discovery";
    var mult = row.t ? row.v / row.t : 0;
    var pctTvl = (mult * 100).toFixed(1);
    var chs = Array.isArray(row.h) ? row.h : [];
    var chgClass = row.g == null || isNaN(row.g) ? "muted" : row.g >= 0 ? "pos" : "neg";
    var ageHtml = row.d == null || isNaN(row.d) ? '<span class="muted">unknown</span>' : Math.round(row.d) + " days";

    var p = Array.isArray(row.p) ? row.p : [1, 1, 1, 1, 1];
    var fBase = Number(p[0] || 0);
    var fScale = Number(p[1] || 0);
    var fGrowth = Number(p[2] || 0);
    var fAge = Number(p[3] || 0);
    var fChains = Number(p[4] || 0);

    var r1 = row.t * fBase;
    var r2 = r1 * fScale;
    var r3 = r2 * fGrowth;
    var r4 = r3 * fAge;
    var r5 = r4 * fChains;
    var maxW = Math.max(row.t, r1, r2, r3, r4, r5, 1);

    var rawProd = fBase * fScale * fGrowth * fAge * fChains;
    var effMult = Math.max(model.clamp_min, Math.min(model.clamp_max, rawProd));
    var rawVal = Math.round(row.t * effMult);

    var secInfo = null;
    for (var sIdx = 0; sIdx < sectors.length; sIdx++) {
      if (sectors[sIdx].c === row.c) {
        secInfo = sectors[sIdx];
        break;
      }
    }
    var secN = secInfo ? secInfo.n : 0;
    var secMed = secInfo ? Number(secInfo.m).toFixed(3) : Number(model.median).toFixed(3);
    var secBase = secInfo ? Number(secInfo.b).toFixed(3) : Number(model.median).toFixed(3);

    var majorCount = 0;
    for (var cIdx = 0; cIdx < chs.length; cIdx++) {
      if (MAJOR_CHAINS.has(chs[cIdx])) majorCount++;
    }

    var reasons = {
      base: secN >= model.min_sample
        ? row.c + ": " + secN + " traded tokens, median mcap÷TVL " + secMed + ", shrunk toward " + model.median + " (k = " + model.k + ")"
        : "Under " + model.min_sample + " traded " + row.c + " tokens, so the global median " + model.median + " is used",
      scale: row.t <= 50_000_000
        ? "TVL " + fmtShort(row.t) + " is at or under $50M: capped at 1.182"
        : "TVL " + fmtShort(row.t) + " vs the $152.8M anchor: bigger pools earn less per dollar",
      growth: row.g == null || isNaN(row.g)
        ? "No 7-day change reported: neutral"
        : "7-day TVL change " + fmtChange(row.g) + (row.g > 50 || row.g < -30 ? ", clamped" : ""),
      age: row.d == null || isNaN(row.d)
        ? "Listing date unknown: neutral"
        : Math.round(row.d) + " days tracked with no token recorded",
      chains: chs.length + " chain" + (chs.length === 1 ? "" : "s") + ", " + majorCount + " major",
    };

    var wfRows = [
      { label: "TVL", mult: "", val: row.t, text: fmtShort(row.t), reason: "" },
      { label: "base", mult: fBase.toFixed(3) + "×", val: r1, text: fmtShort(r1), reason: reasons.base },
      { label: "scale", mult: fScale.toFixed(3) + "×", val: r2, text: fmtShort(r2), reason: reasons.scale },
      { label: "growth", mult: fGrowth.toFixed(3) + "×", val: r3, text: fmtShort(r3), reason: reasons.growth },
      { label: "age", mult: fAge.toFixed(3) + "×", val: r4, text: fmtShort(r4), reason: reasons.age },
      { label: "chains", mult: fChains.toFixed(3) + "×", val: r5, text: fmtShort(r5), reason: reasons.chains },
    ];

    var wfHtml = wfRows
      .map(function (w) {
        var barW = Math.max(0, Math.min(100, (w.val / maxW) * 100)).toFixed(1);
        return (
          '<div class="wf-item">' +
            '<div class="wf-row">' +
              '<span class="wf-name">' + escHtml(w.label) + "</span>" +
              '<span class="wf-mult">' + escHtml(w.mult) + "</span>" +
              '<span class="wf-bar-wrap"><span class="wf-bar" style="width:' + barW + '%"></span></span>' +
              '<span class="wf-val">' + escHtml(w.text) + "</span>" +
            "</div>" +
            (w.reason ? '<div class="wf-reason">' + escHtml(w.reason) + "</div>" : "") +
          "</div>"
        );
      })
      .join("");

    wfHtml +=
      '<div class="wf-item wf-final-item">' +
        '<div class="wf-row wf-final-row">' +
          '<span class="wf-name">Implied</span>' +
          '<span class="wf-mult">' + effMult.toFixed(3) + "×</span>" +
          '<span class="wf-bar-wrap"></span>' +
          '<span class="wf-val wf-val-final">' + fmtFull(row.v) + "</span>" +
        "</div>" +
      "</div>";

    var stepDownNote = "";
    if (rawVal !== row.v) {
      var diff = rawVal - row.v;
      stepDownNote =
        '<p class="step-note">TVL × ' +
        effMult.toFixed(4) +
        " = " +
        fmtFull(rawVal) +
        "; stepped down by " +
        fmtFull(diff) +
        " so rank " +
        row.r +
        " stays strictly below rank " +
        (row.r - 1) +
        ".</p>";
    }

    var secEv =
      secN > 0
        ? secN + " " + row.c + " protocol" + (secN === 1 ? " has" : "s have") + " a traded token with a market cap (median mcap÷TVL " + secMed + "). "
        : "No " + row.c + " protocol has a traded token with a market cap. ";
    secEv +=
      secN >= model.min_sample
        ? "Shrunk toward " + model.median + ", the sector base is " + secBase + "."
        : "Under " + model.min_sample + " is too few to trust, so the global median " + model.median + " is used.";

    var sectorComps = comps.filter(function (c) {
      return c.c === row.c;
    });
    if (sectorComps.length > 0) {
      secEv +=
        " Closest comps: " +
        sectorComps
          .map(function (c) {
            var r = c.t ? (c.m / c.t).toFixed(2) : "0.00";
            return c.n + " (" + r + "×)";
          })
          .join(", ") +
        ".";
    }

    var farmPlanObj = buildFarmPlan({
      slug: row.s,
      name: row.n,
      category: row.c,
      chains: chs,
      tvl_usd: row.t,
      change_7d: row.g,
      ageDays: row.d,
      implied_value_usd: row.v,
    });

    var primaryChain = chs.length > 0 && chs[0] ? chs[0] : "Ethereum";
    var capRange = getPrincipalRange(row.t);
    var capLow = row.t >= 500_000_000 ? 1000 : row.t >= 100_000_000 ? 500 : row.t >= 30_000_000 ? 200 : 100;
    var capHigh = row.t >= 500_000_000 ? 2000 : row.t >= 100_000_000 ? 1000 : row.t >= 30_000_000 ? 500 : 200;

    var earningsRate = row.t > 0 ? (row.v / row.t) * AIRDROP_SHARE : 0;
    var per1k = 1000 * earningsRate;
    var per1kStr = fmtUsd(per1k);

    var { firstChain: fChain, primary: pChain, secondary: sChain } = pickChains(chs);
    var pGas = getGasUsd(pChain);
    var sGas = sChain ? getGasUsd(sChain) : 0;
    var isStaging = row.g !== null && row.g < -10;
    var eCalls = isStaging ? 4 : 2;
    var farmCalls = 1 + eCalls + HOLD_WEEKS + 2 + (sChain ? 3 : 0);
    var fTotalGas = pGas * (1 + eCalls + HOLD_WEEKS + 2) + (sChain ? sGas * 3 : 0);
    var breakEven = earningsRate > 0 ? Math.round(fTotalGas / earningsRate) : 0;

    var stepsHtml = farmPlanObj
      .map(function (st, idx) {
        return (
          '<li class="farm-step-item">' +
            '<span class="farm-step-badge">' + (idx + 1) + "</span>" +
            '<div class="farm-step-content">' +
              '<div class="farm-step-title">' + escHtml(st.title) + "</div>" +
              '<div class="farm-step-body">' + escHtml(st.body) + "</div>" +
              '<div class="farm-step-chips">' +
                '<span class="farm-chip">' + escHtml(st.cost) + "</span>" +
                '<span class="farm-chip">' + escHtml(st.time) + "</span>" +
              "</div>" +
            "</div>" +
          "</li>"
        );
      })
      .join("");

    detail.innerHTML =
      '<div class="detail-header">' +
        "<div>" +
          "<h2>" + escHtml(row.n) + "</h2>" +
          '<div class="detail-sub">Rank ' + row.r + " of " + (BOARD.n || rows.length) + " · " + escHtml(tag) + " · " + escHtml(row.c) + " · " + escHtml(row.s) + "</div>" +
        "</div>" +
        '<button type="button" class="detail-close" aria-label="Close detail">×</button>' +
      "</div>" +
      '<div class="detail-hero-value">' +
        '<span class="hero-num">' + fmtFull(row.v) + "</span>" +
        '<span class="hero-qualifier">implied launch value, ' + pctTvl + "% of TVL</span>" +
      "</div>" +
      '<div class="detail-metrics">' +
        '<div class="detail-metric"><span class="detail-metric-label">TVL</span><span class="detail-metric-value">' + fmtShort(row.t) + "</span></div>" +
        '<div class="detail-metric"><span class="detail-metric-label">7-day change</span><span class="detail-metric-value ' + chgClass + '">' + fmtChange(row.g) + "</span></div>" +
        '<div class="detail-metric"><span class="detail-metric-label">No-token age</span><span class="detail-metric-value">' + ageHtml + "</span></div>" +
        '<div class="detail-metric"><span class="detail-metric-label">Multiple</span><span class="detail-metric-value">' + mult.toFixed(3) + "×</span></div>" +
      "</div>" +
      '<div class="detail-chains">' + chs.length + " chain" + (chs.length === 1 ? "" : "s") + ": " + escHtml(chs.join(", ")) + "</div>" +
      '<div class="detail-section">' +
        "<h3>How the value is built</h3>" +
        '<div class="waterfall-list">' + wfHtml + "</div>" +
        stepDownNote +
      "</div>" +
      '<div class="detail-section">' +
        "<h3>Sector evidence</h3>" +
        "<p>" + escHtml(secEv) + "</p>" +
      "</div>" +
      '<div class="detail-section">' +
        "<h3>Farm plan</h3>" +
        '<div class="farm-budget-grid">' +
          '<div class="farm-budget-tile"><span class="farm-budget-label">Capital</span><span class="farm-budget-value">' + escHtml(capRange) + "</span></div>" +
          '<div class="farm-budget-tile"><span class="farm-budget-label">Gas (' + farmCalls + ' calls)</span><span class="farm-budget-value">' + fmtUsd(fTotalGas) + "</span></div>" +
          '<div class="farm-budget-tile"><span class="farm-budget-label">Duration</span><span class="farm-budget-value">About 5 weeks</span></div>' +
          '<div class="farm-budget-tile"><span class="farm-budget-label">Gas break-even</span><span class="farm-budget-value">' + fmtFull(breakEven) + "</span></div>" +
        "</div>" +
        '<p class="farm-explainer">Farm on ' + escHtml(pChain) + ". Break-even is the deposit whose share of a 5% pro-rata airdrop of the implied value (" + escHtml(per1kStr) + " per $1,000) covers the gas.</p>" +
        '<ol class="farm-steps-list">' + stepsHtml + "</ol>" +
      "</div>";

    var closeBtn = detail.querySelector(".detail-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeDetail);
    }
    detail.hidden = false;
  }

  function findRowBySlug(slug) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].s === slug) return rows[i];
    }
    return null;
  }

  function init() {
    renderFacts();
    populateFilters();
    renderCompsAndSectors();
    setupTabs();
    setupFilters();
    setupSorting();
    renderBoard();

    var boardBody = $("board-body");
    if (boardBody) {
      boardBody.addEventListener("click", function (e) {
        var tr = e.target && e.target.closest ? e.target.closest("tr[data-slug]") : null;
        if (!tr) return;
        var row = findRowBySlug(tr.getAttribute("data-slug"));
        if (row) openDetail(row);
      });
      boardBody.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          var tr = e.target && e.target.closest ? e.target.closest("tr[data-slug]") : null;
          if (!tr) return;
          var row = findRowBySlug(tr.getAttribute("data-slug"));
          if (row) openDetail(row);
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDetail();
    });

    if (window.location.hash && window.location.hash.length > 1) {
      var slug = window.location.hash.slice(1);
      var match = findRowBySlug(slug);
      if (match) openDetail(match);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

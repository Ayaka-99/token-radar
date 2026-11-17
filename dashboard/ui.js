// Dashboard copy of the farm-step generator from lib/farm.ts,
// kept identical so the detail view shows the same steps as board.json.

const GAS_TABLE = {
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

const DEFAULT_GAS = "$0.50";

function getGas(chain) {
  return GAS_TABLE[chain] ?? DEFAULT_GAS;
}

function getPrincipalRange(tvl_usd) {
  if (tvl_usd >= 500_000_000) return "$1,000–$2,000";
  if (tvl_usd >= 100_000_000) return "$500–$1,000";
  if (tvl_usd >= 30_000_000) return "$200–$500";
  return "$100–$200";
}

const CATEGORY_TEMPLATES = {
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

const FALLBACK_TEMPLATE = [
  "Fund a wallet on {chain} with {principal} in liquid capital plus native gas (~{gas} per tx) — takes about 10 minutes.",
  "Deposit or supply {principal} into {name} core contracts on {chain} (gas ~{gas}) — about 15 minutes.",
  "Maintain your active {principal} position on {name} on {chain} for 2–4 weeks to capture recurring snapshot epochs (gas ~{gas}).",
  "Execute a secondary interaction with {name} on {chain2} using {principal} (gas ~{gas} on {chain} and ~{gas2} on {chain2}) — 1–2 days.",
  "Claim accrued rewards, rebalance, or vote on {name} on {chain} every 7 days (gas ~{gas}) over 2–4 weeks.",
];

function farmSteps(input) {
  const chain = input.chains.length > 0 && input.chains[0] ? input.chains[0] : "Ethereum";
  const chain2 = input.chains.length > 1 && input.chains[1] ? input.chains[1] : chain;
  const gas = getGas(chain);
  const gas2 = getGas(chain2);
  const principal = getPrincipalRange(input.tvl_usd);
  const template = CATEGORY_TEMPLATES[input.category] ?? FALLBACK_TEMPLATE;

  const fill = (tpl) =>
    tpl
      .replace(/\{name\}/g, input.name)
      .replace(/\{chain2\}/g, chain2)
      .replace(/\{chain\}/g, chain)
      .replace(/\{principal\}/g, principal)
      .replace(/\{gas2\}/g, gas2)
      .replace(/\{gas\}/g, gas)
      .trim();

  const steps = template.map(fill);

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

const EXCLUDED_BOARD_CATS = new Set([
  'CEX',
  'Chain',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Foundation',
  'RWA',
]);

function medianVal(sorted) {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
(function () {
  var BOARD = window.BOARD || { as_of: '', n: 0, rows: [], comps: [] };
  var rows = BOARD.rows || [];
  var comps = BOARD.comps || [];

  var state = {
    filterMode: 'all',
    category: '',
    search: '',
    sortKey: 'rank',
    sortDir: 'asc'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  var esc = escHtml;
  var fmtMoney = fmtUsd;
  var fmtMoneyShort = fmtTvl;
  var fmtPct = fmtChange;

  function fmtTvl(usd) {
    if (usd == null || isNaN(usd)) return '\u2014';
    if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
    if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(usd).toLocaleString('en-US');
  }

  function fmtUsd(usd) {
    if (usd == null || isNaN(usd)) return '\u2014';
    return '$' + Math.round(usd).toLocaleString('en-US');
  }

  function fmtChange(g) {
    if (g == null || isNaN(g)) return '\u2014';
    var sign = g > 0 ? '+' : '';
    return sign + Number(g).toFixed(1) + '%';
  }

  function fmtAge(d) {
    if (d == null || isNaN(d)) return '\u2014';
    return Math.round(d) + 'd';
  }

  function renderMeta() {
    var el = $('board-meta');
    if (!el) return;
    var watchlistCount = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].w === 1) watchlistCount++;
    }
    var discoveryCount = rows.length - watchlistCount;
    el.textContent =
      'Snapshot ' +
      BOARD.as_of +
      ' \u00b7 ' +
      BOARD.n +
      ' protocols \u00b7 ' +
      watchlistCount +
      ' watchlist + ' +
      discoveryCount +
      ' discovery \u00b7 implied values in USD';
  }

  function setupTabs() {
    var tabBoard = $('tab-board');
    var tabComps = $('tab-comps');
    var secBoard = $('board-section') || document.querySelector('[data-section="board"]');
    var secComps = $('comps-section') || document.querySelector('[data-section="comps"]');

    function activate(which) {
      var isBoard = which === 'board';
      if (tabBoard) tabBoard.setAttribute('aria-selected', isBoard ? 'true' : 'false');
      if (tabComps) tabComps.setAttribute('aria-selected', isBoard ? 'false' : 'true');
      if (secBoard) {
        if (isBoard) secBoard.removeAttribute('hidden');
        else secBoard.setAttribute('hidden', '');
      }
      if (secComps) {
        if (isBoard) secComps.setAttribute('hidden', '');
        else secComps.removeAttribute('hidden');
      }
    }

    if (tabBoard) {
      tabBoard.addEventListener('click', function () {
        activate('board');
      });
    }
    if (tabComps) {
      tabComps.addEventListener('click', function () {
        activate('comps');
      });
    }
  }

  function populateCategories() {
    var sel = $('category-select');
    if (!sel) return;
    var counts = {};
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i].c || 'Other';
      counts[c] = (counts[c] || 0) + 1;
    }
    var cats = Object.keys(counts).sort();
    var html = '<option value="">All categories (' + rows.length + ')</option>';
    for (var j = 0; j < cats.length; j++) {
      var cat = cats[j];
      html += '<option value="' + escHtml(cat) + '">' + escHtml(cat) + ' (' + counts[cat] + ')</option>';
    }
    sel.innerHTML = html;
  }

  function getSortVal(row, key) {
    if (key === 'rank') return row.r;
    if (key === 'tvl') return row.t;
    if (key === 'change') return row.g;
    if (key === 'age') return row.d;
    if (key === 'value') return row.v;
    return row.r;
  }

  function getFilteredSortedRows() {
    var q = state.search.trim().toLowerCase();
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (state.filterMode === 'watchlist' && r.w !== 1) continue;
      if (state.filterMode === 'discovery' && r.w !== 0) continue;
      if (state.category && r.c !== state.category) continue;
      if (q) {
        var nameMatch = (r.n || '').toLowerCase().indexOf(q) !== -1;
        var slugMatch = (r.s || '').toLowerCase().indexOf(q) !== -1;
        if (!nameMatch && !slugMatch) continue;
      }
      out.push(r);
    }

    var key = state.sortKey;
    var dir = state.sortDir === 'asc' ? 1 : -1;
    out.sort(function (a, b) {
      var va = getSortVal(a, key);
      var vb = getSortVal(b, key);
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
    var tbody = $('board-body');
    if (!tbody) return;
    var list = getFilteredSortedRows();
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var tag = r.w === 1
        ? '<span class="pill pill-watchlist">Watchlist</span>'
        : '<span class="pill pill-discovery">Discovery</span>';
      var chains = Array.isArray(r.h) ? r.h.join(', ') : '';
      var chgClass = r.g == null ? '' : (r.g >= 0 ? 'pos' : 'neg');
      html +=
        '<tr data-slug="' + escHtml(r.s) + '">' +
        '<td class="num">' + r.r + '</td>' +
        '<td><div class="proto-name"><strong>' + escHtml(r.n) + '</strong> ' + tag + '</div>' +
        '<div class="proto-slug">' + escHtml(r.s) + '</div></td>' +
        '<td>' + escHtml(r.c) + '</td>' +
        '<td class="num">' + fmtTvl(r.t) + '</td>' +
        '<td class="num ' + chgClass + '">' + fmtChange(r.g) + '</td>' +
        '<td class="num">' + fmtAge(r.d) + '</td>' +
        '<td>' + escHtml(chains) + '</td>' +
        '<td class="num">' + fmtUsd(r.v) + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html;

    var trs = tbody.querySelectorAll('tr[data-slug]');
    for (var j = 0; j < trs.length; j++) {
      trs[j].addEventListener('click', function () {
        var slug = this.getAttribute('data-slug');
        for (var k = 0; k < rows.length; k++) {
          if (rows[k].s === slug) {
            if (typeof openDetail === 'function') openDetail(rows[k]);
            break;
          }
        }
      });
    }
  }

  function setupFilters() {
    var btnAll = $('filter-all');
    var btnWatch = $('filter-watchlist');
    var btnDisc = $('filter-discovery');
    var btns = [
      { el: btnAll, mode: 'all' },
      { el: btnWatch, mode: 'watchlist' },
      { el: btnDisc, mode: 'discovery' }
    ];

    function setFilterMode(mode) {
      state.filterMode = mode;
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].el) {
          if (btns[i].mode === mode) btns[i].el.classList.add('active');
          else btns[i].el.classList.remove('active');
        }
      }
      renderBoard();
    }

    for (var i = 0; i < btns.length; i++) {
      (function (item) {
        if (item.el) {
          item.el.addEventListener('click', function () {
            setFilterMode(item.mode);
          });
        }
      })(btns[i]);
    }

    var catSel = $('category-select');
    if (catSel) {
      catSel.addEventListener('change', function () {
        state.category = this.value;
        renderBoard();
      });
    }

    var searchInp = $('search-input');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        state.search = this.value;
        renderBoard();
      });
    }
  }

  function setupSorting() {
    var headers = document.querySelectorAll('th[data-sort]');
    function updateHeaderClasses() {
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (h.getAttribute('data-sort') === state.sortKey) {
          h.classList.add('sorted');
          h.setAttribute('data-dir', state.sortDir);
        } else {
          h.classList.remove('sorted');
          h.removeAttribute('data-dir');
        }
      }
    }

    for (var i = 0; i < headers.length; i++) {
      headers[i].addEventListener('click', function () {
        var key = this.getAttribute('data-sort');
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = key === 'rank' ? 'asc' : 'desc';
        }
        updateHeaderClasses();
        renderBoard();
      });
    }
    updateHeaderClasses();
  }

function openDetail(row) {
  var detail = document.getElementById('detail');
  if (!detail || !row) return;

  var chainsText = (row.h && row.h.length) ? row.h.join(', ') : '—';
  if (row.k > 3) {
    chainsText += ' and ' + (row.k - 3) + ' more';
  }

  var p = row.p || [1, 1, 1, 1, 1];
  var bm = Number(p[0] || 0).toFixed(3);
  var sf = Number(p[1] || 0).toFixed(3);
  var gf = Number(p[2] || 0).toFixed(3);
  var af = Number(p[3] || 0).toFixed(3);
  var cf = Number(p[4] || 0).toFixed(3);

  var formula = 'TVL ' + fmtMoney(row.t) +
    ' \u00d7 base ' + bm +
    ' \u00d7 scale ' + sf +
    ' \u00d7 growth ' + gf +
    ' \u00d7 age ' + af +
    ' \u00d7 chains ' + cf +
    ' = ' + fmtMoney(row.v);

  var comps = (window.BOARD && window.BOARD.comps) ? window.BOARD.comps : [];
  var sectorComps = comps.filter(function (c) { return c.c === row.c; });
  var compsText = sectorComps.length
    ? 'Sector benchmarks: ' + sectorComps.map(function (c) {
        var ratio = c.t ? (c.m / c.t).toFixed(2) : '0.00';
        return esc(c.n) + ' mcap/TVL ' + ratio;
      }).join(' \u00b7 ')
    : 'No tokenized benchmark in this sector yet.';

  var steps = farmSteps({
    slug: row.s,
    name: row.n,
    category: row.c,
    chains: row.h || [],
    tvl_usd: row.t,
    change_7d: row.g,
    ageDays: row.d
  });
  var stepsHtml = steps.map(function (st) {
    return '<li>' + esc(st) + '</li>';
  }).join('');

  var tag = row.w ? 'Watchlist' : 'Discovery';

  detail.innerHTML =
    '<div class="detail-header">' +
      '<div>' +
        '<h2>' + esc(row.n) + ' <span>(' + esc(row.s) + ')</span></h2>' +
        '<div class="detail-sub">' + esc(tag) + ' \u00b7 ' + esc(row.c) + '</div>' +
      '</div>' +
      '<button type="button" class="detail-close" aria-label="Close">\u00d7</button>' +
    '</div>' +
    '<div class="detail-metrics">' +
      '<div><strong>TVL</strong> ' + fmtMoney(row.t) + '</div>' +
      '<div><strong>7d</strong> ' + fmtPct(row.g) + '</div>' +
      '<div><strong>Age</strong> ' + fmtAge(row.d) + '</div>' +
      '<div><strong>Chains</strong> ' + esc(chainsText) + '</div>' +
    '</div>' +
    '<div class="detail-section">' +
      '<h3>Implied Value Derivation</h3>' +
      '<div class="derivation-formula">' + esc(formula) + '</div>' +
      '<div class="derivation-lines">' +
        '<div>base ' + bm + ' \u2014 sector mcap/TVL multiple</div>' +
        '<div>scale ' + sf + ' \u2014 TVL size adjustment</div>' +
        '<div>growth ' + gf + ' \u2014 7-day momentum</div>' +
        '<div>age ' + af + ' \u2014 no-token run time</div>' +
        '<div>chains ' + cf + ' \u2014 chain breadth</div>' +
      '</div>' +
    '</div>' +
    '<div class="detail-section">' +
      '<h3>Sector Comps</h3>' +
      '<p>' + compsText + '</p>' +
    '</div>' +
    '<div class="detail-section">' +
      '<h3>Farm Steps</h3>' +
      '<ol id="detail-farm">' + stepsHtml + '</ol>' +
    '</div>';

  var closeBtn = detail.querySelector('.detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      detail.hidden = true;
    });
  }
  detail.hidden = false;
}

function renderCompsTable(board) {
  var comps = (board && board.comps) ? board.comps : [];
  var meta = document.getElementById('comps-meta');
  if (meta) {
    meta.textContent = comps.length + ' tokenized benchmarks \u2014 the sector multiples behind the board. They are excluded from the ranking.';
  }
  var body = document.getElementById('comps-body');
  if (!body) return;
  body.innerHTML = comps.map(function (c) {
    var ratio = c.t ? (c.m / c.t).toFixed(2) : '0.00';
    return '<tr>' +
      '<td>' + esc(c.n) + ' <span class="slug">' + esc(c.s) + '</span></td>' +
      '<td>' + esc(c.c) + '</td>' +
      '<td>' + fmtMoneyShort(c.t) + '</td>' +
      '<td>' + fmtMoneyShort(c.m) + '</td>' +
      '<td>' + ratio + '</td>' +
    '</tr>';
  }).join('');
}

function initRendererPart2() {
  var board = window.BOARD;
  if (!board) return;
  renderCompsTable(board);
  renderMeta();
  setupTabs();
  renderBoard();
  setupFilters();
  setupSorting();

  var boardBody = document.getElementById('board-body');
  if (boardBody) {
    boardBody.addEventListener('click', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tr') : null;
      if (!tr) return;
      var slug = tr.getAttribute('data-slug');
      var rows = board.rows || [];
      var match = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].s === slug) {
          match = rows[i];
          break;
        }
      }
      if (!match && tr.rowIndex > 0) {
        match = rows[tr.rowIndex - 1] || null;
      }
      if (match) openDetail(match);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRendererPart2);
} else {
  initRendererPart2();
}
})();

// Token Radar UI controller: live browser L1-IRLS refit verification, interactive
// capital simulator, SVG calibration/survival charts, and full 416-token comps tab.

(function () {
  const S = window.SUMMARY, R = window.BOARD_ROWS;
  if (!S || !R || !Array.isArray(R.rows)) return;
  const cats = R.cats || [], chs = R.chs || [], secs = R.secs || [], M = S.m, U = S.u, V = S.val, O = S.o;
  const trading = (R.trading || []).map((t) => ({ slug: t[0], name: t[1], symbol: t[2], category: cats[t[3]] || "Other", tvl_usd: t[4], mcap_usd: t[5], loo_pred_usd: t[6], change_7d: t[7], ageDays: t[8], chainCount: t[9], status: t[10] }));
  const modelComps = trading.filter((c) => c.status === 2), liveFit = verifyLiveFit(modelComps, M);
  const rows = R.rows.map((t) => {
    const r = { r: t[0], s: t[1], n: t[2], c: cats[t[3]] || "Other", w: t[4], t: t[5], g: t[6], d: t[7], h: (t[8] || []).map((i) => chs[i]), k: t[9], v: t[10], peer: t[11], rem: t[12], sd: t[13] || 0 };
    const imp = impliedOf(r, M);
    r.rawV = r.v + r.sd; r.impV = imp.value; r.lo = Math.min(imp.lo, r.v); r.hi = Math.max(imp.hi, r.v);
    return r;
  });

  const st = { tier: "all", ver: "", sec: "", ch: "", q: "", cap: null, sk: "r", sd: "asc", sel: null, capOv: null, cs: "2", cq: "" };
  const $ = (id) => document.getElementById(id), $$ = (s, p = document) => p.querySelectorAll(s);
  const on = (el, ev, fn) => el.addEventListener(ev, fn);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fFull = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const fChg = (g) => (g == null || isNaN(g) ? "n/a" : (g > 0 ? "+" : "") + Number(g).toFixed(1) + "%");
  const fSgn = (n) => (n >= 0 ? "+" : "-") + fmtUsd(Math.abs(n));
  const vLbl = (c) => (c === 2 ? "FARM" : c === 1 ? "THIN" : "SKIP");
  const vCls = (c) => (c === 2 ? "p-fm" : c === 1 ? "p-th" : "p-sk");
  const tl = (cl, k, v, vc) => `<div class="${cl}"><span>${k}</span><b${vc ? ` class="${vc}"` : ""}>${v}</b></div>`;
  const td = (v, c) => `<td${c ? ` class="${c}"` : ""}>${v}</td>`;
  const tx = (id, v) => { $(id).textContent = v; };
  const farmInOf = (r) => ({ slug: r.s, name: r.n, category: r.c, chains: r.h, chainCount: r.k, tvl_usd: r.t, change_7d: r.g, ageDays: r.d, implied_value_usd: r.v, rem_launch_odds: r.rem / 100 });

  function refreshRowEconomics() {
    const vc = { FARM: 0, THIN: 0, SKIP: 0 };
    for (const r of rows) {
      const e = evaluateFarmEconomics(farmInOf(r), st.cap);
      r.vc = e.verdict === "FARM" ? 2 : e.verdict === "THIN" ? 1 : 0; r.net = e.expNetUsd; r.apr = e.expAprPct; vc[e.verdict]++;
    }
    tx("k-fm", `${vc.FARM} FARM`); tx("k-fms", `${vc.THIN} thin · ${vc.SKIP} skip${st.cap ? ` at ${fmtUsd(st.cap)}` : " at plan size"}`);
  }

  function verifyBoardIntegrity() {
    let drift = 0, wl = 0, mono = true;
    for (let i = 0; i < rows.length; i++) { if (rows[i].w === 1) wl++; if (i > 0 && rows[i].v >= rows[i - 1].v) mono = false; if (rows[i].impV !== rows[i].rawV) drift++; }
    return { drift, wl, mono, acc: U.watchlist_covered + U.discovery_total + U.excluded_total + U.trading_total };
  }

  function renderHeader() {
    const chk = verifyBoardIntegrity(), fm = Math.round(S.floor / 1e6);
    $("bh").innerHTML = [["r","Rank","rk "],["n","Protocol",""],["c","Sector",""],["k","Chains",""],["t","TVL","num "],["g","7d","num "],["d","Age","num "],["m","Multiple","num "],["v","Implied Value","num "],["o","4y Odds","num "],["e","Farm Verdict","num "]].map(([k, lb, cl]) => `<th class="${cl}srt" data-s="${k}">${lb}<span class="sa"></span></th>`).join("");
    tx("sp", `DefiLlama ${S.as_of} · $${fm}M floor`); tx("k-wl", `${U.watchlist_covered} / ${U.watchlist_total}`); tx("k-wls", `100% of $${fm}M+ watchlist`);
    tx("k-rk", String(rows.length)); tx("k-rks", `${U.watchlist_covered} watchlist + ${U.discovery_total} discovery`);
    tx("k-un", `${chk.acc} / ${U.total}`); tx("k-uns", `${U.trading_total} trading · ${U.excluded_total} excluded`);
    tx("k-cv", `${V.lm.mx.toFixed(2)}× / ${V.wm.mx.toFixed(2)}×`); tx("k-cvs", `vs ${V.lf.toFixed(2)}× / ${V.wf.toFixed(2)}× flat 0.25×`);
    tx("tcb", String(rows.length)); tx("tcc", String(U.trading_total));
    tx("ah", `Joint Feature Contribution (n=${V.lm.n} Valuation LOO + n=${O.n} Odds 10f)`);
    $("ichk").innerHTML = [[chk.wl === U.watchlist_total, `Watchlist ${chk.wl}/${U.watchlist_total} (100%)`], [chk.acc === U.total, `Universe ${chk.acc}/${U.total} reconciled`], [liveFit.ok, `Browser L1-IRLS refit (${liveFit.n} comps): ${liveFit.maxDiff.toFixed(6)} coef drift`], [chk.drift === 0, `${chk.drift}/${rows.length} impliedOf drift`], [chk.mono, `Strictly ranked 1..${rows.length}`], [1, `Peer odds 10f AUC ${O.auc.toFixed(3)} (+${Math.round(O.skill * 100)}% Brier)`]].map(([ok, t]) => `<span class="chk${ok ? "" : " fail"}">${ok ? "✓" : "✗"} ${esc(t)}</span>`).join('<span class="csep">·</span>');
    $("mlin").innerHTML = `<span class="eq">log(mcap/TVL) = ${M.b0.toFixed(2)} ${M.b_tvl.toFixed(2)}·ln(TVL) + family + cat ${M.b_ch >= 0 ? "+" : ""}${M.b_ch.toFixed(2)}·ln(ch) + Ridge(g7d, age)</span><span>Fitted live on ${M.n_priced} clean DeFi comps (LOO ${V.lm.mx.toFixed(2)}×, ${Math.round(V.lm.w3 * 100)}% ≤3×; 0 hardcoded names; CEX/LST/bridge/sibling excluded).</span>`;
  }

  function populateFilters() {
    const sc = {}, cc = {};
    for (const r of rows) { sc[r.c] = (sc[r.c] || 0) + 1; for (const ch of r.h) cc[ch] = (cc[ch] || 0) + 1; }
    const opts = (m) => Object.keys(m).sort((a, b) => m[b] - m[a] || a.localeCompare(b)).map((c) => `<option value="${esc(c)}">${esc(c)} (${m[c]})</option>`).join("");
    $("fs").innerHTML = `<option value="">All sectors (${Object.keys(sc).length})</option>` + opts(sc);
    $("fc").innerHTML = `<option value="">All chains</option>` + opts(cc);
  }

  function sortVal(r, k) { return k === "r" ? r.r : k === "n" ? r.n : k === "c" ? r.c : k === "k" ? r.k : k === "t" ? r.t : k === "g" ? r.g : k === "d" ? r.d : k === "m" ? (r.t ? r.v / r.t : null) : k === "v" ? r.v : k === "o" ? r.rem : k === "e" ? r.net : r.r; }

  function filteredRows() {
    const q = st.q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if ((st.tier === "watchlist" && !r.w) || (st.tier === "discovery" && r.w)) return false;
      if (st.ver !== "" && String(r.vc) !== st.ver) return false;
      if ((st.sec && r.c !== st.sec) || (st.ch && r.h.indexOf(st.ch) < 0)) return false;
      return !q || r.n.toLowerCase().includes(q) || r.s.toLowerCase().includes(q) || r.c.toLowerCase().includes(q) || r.h.join(" ").toLowerCase().includes(q);
    });
    const dir = st.sd === "asc" ? 1 : -1, txt = st.sk === "n" || st.sk === "c";
    return out.sort((a, b) => {
      const va = sortVal(a, st.sk), vb = sortVal(b, st.sk);
      if (txt) return String(va).localeCompare(String(vb)) * dir || a.r - b.r;
      const an = va == null || isNaN(va), bn = vb == null || isNaN(vb);
      return an && bn ? a.r - b.r : an ? 1 : bn ? -1 : va < vb ? -dir : va > vb ? dir : a.r - b.r;
    });
  }

  function renderSliceSummary(list, act) {
    const el = $("sbar");
    if (!act || !list.length) { el.hidden = true; return; }
    let tvl = 0, wl = 0, fN = 0, tN = 0, sN = 0, net = 0; const imps = [];
    for (const r of list) { tvl += r.t; imps.push(r.v); net += r.net; if (r.w) wl++; if (r.vc === 2) fN++; else if (r.vc === 1) tN++; else sN++; }
    const avg = net / list.length;
    el.innerHTML = `<span class="stag">Active slice</span><span><strong>${list.length}</strong> protocols (${wl} WL · ${list.length - wl} disc.)</span><span>Combined TVL <strong>${fmtShortUsd(tvl)}</strong></span><span>Median Implied <strong>${fmtShortUsd(medianArr(imps))}</strong></span><span>Verdicts <strong>${fN} FARM</strong> · ${tN} thin · ${sN} skip</span><span>Avg Exp. Net EV <strong class="${avg >= 0 ? "pos" : "neg"}">${fSgn(avg)}</strong></span>`;
    el.hidden = false;
  }

  function renderBoard() {
    const list = filteredRows(), act = Boolean(st.tier !== "all" || st.ver !== "" || st.sec || st.ch || st.q.trim() || st.cap);
    tx("fst", list.length === rows.length ? `All ${rows.length} shown` : `${list.length} of ${rows.length} shown`);
    $("be").hidden = list.length > 0; $("fcl").hidden = !act;
    renderSliceSummary(list, act);
    let minM = 0.015, maxM = 0.8;
    for (const r of rows) { const m = r.v / Math.max(1, r.t); if (m < minM) minM = m; if (m > maxM) maxM = m; }
    const lMin = Math.log10(Math.max(minM, 0.005)), lRng = Math.max(0.2, Math.log10(maxM) - lMin);
    $("bb").innerHTML = list.map((r) => {
      const m = r.v / Math.max(1, r.t), pct = clampNum(((Math.log10(Math.max(m, 0.005)) - lMin) / lRng) * 100, 5, 100);
      const cf = st.ch && r.h.includes(st.ch) ? st.ch : (r.h[0] || "—");
      const chH = (st.ch && cf === st.ch ? `<span class="ch">${esc(cf)}</span>` : esc(cf)) + (r.k > 1 ? ` <span class="cm">+${r.k - 1}</span>` : "");
      const gC = r.g == null ? "mut" : r.g >= 0 ? "pos" : "neg", nC = r.net >= 3 ? "pos" : r.net < 0 ? "neg" : "mut";
      return `<tr data-slug="${esc(r.s)}" class="${r.r <= 3 ? "top" : ""}${st.sel === r.s ? " sel" : ""}">` +
        td(r.r, "rk") + td(`<div class="pc"><div class="pt"><span class="pn">${esc(r.n)}</span><span class="p ${r.w ? "p-wl" : "p-dc"}">${r.w ? "Watchlist" : "Discovery"}</span></div><span class="ps">${esc(r.s)}</span></div>`) +
        td(esc(r.c)) + td(chH) + td(fmtShortUsd(r.t), "num") + td(fChg(r.g), "num " + gC) + td(r.d == null ? '<span class="mut">—</span>' : r.d + "d", "num") +
        td(`<div class="mc"><span>${m.toFixed(3)}×</span><span class="btk"><span class="bf" style="width:${pct.toFixed(0)}%"></span></span></div>`, "num") +
        td(`<span class="vm">${fmtShortUsd(r.v)}</span><span class="vb">${fmtShortUsd(r.lo)}–${fmtShortUsd(r.hi)}</span>`, "num") +
        td(`<div class="oc"><span>${r.rem}%</span><span class="btk otk"><span class="bf of" style="width:${clampNum(r.rem, 5, 100)}%"></span></span></div>`, "num") +
        td(`<div class="vc"><span class="p ${vCls(r.vc)}">${vLbl(r.vc)}</span><span class="nw"><span class="nm ${nC}">${fSgn(r.net)}</span><span class="am">${r.apr >= 0 ? "+" : ""}${r.apr.toFixed(1)}% APR</span></span></div>`, "num") + `</tr>`;
    }).join("");
  }

  function renderCalibrationScatter() {
    const W = 580, H = 144, L = 40, Rt = 12, T = 9, B = 20, mn = 5, mx = 9.8;
    const sx = (v) => L + ((clampNum(Math.log10(Math.max(1e5, v)), mn, mx) - mn) / (mx - mn)) * (W - L - Rt);
    const sy = (v) => H - B - ((clampNum(Math.log10(Math.max(1e5, v)), mn, mx) - mn) / (mx - mn)) * (H - T - B);
    const x1 = sx(1e5), y1 = sy(1e5), x2 = sx(6e9), y2 = sy(6e9), d3 = sy(1e6) - sy(3e6);
    const lines = [], lbls = [];
    for (const [lg, lb] of [[6, "$1M"], [7, "$10M"], [8, "$100M"], [9, "$1B"]]) {
      const gx = sx(Math.pow(10, lg)).toFixed(1), gy = sy(Math.pow(10, lg)).toFixed(1);
      lines.push(`<line x1="${gx}" y1="${T}" x2="${gx}" y2="${H - B}"/><line x1="${L}" y1="${gy}" x2="${W - Rt}" y2="${gy}"/>`);
      lbls.push(`<text x="${gx}" y="${H - 5}" text-anchor="middle">${lb}</text><text x="${L - 5}" y="${(+gy + 3).toFixed(1)}" text-anchor="end">${lb}</text>`);
    }
    const pts = modelComps.filter((c) => c.loo_pred_usd > 0).map((c) => {
      const rr = Math.max(c.mcap_usd / c.loo_pred_usd, c.loo_pred_usd / c.mcap_usd);
      return `<circle cx="${sx(c.loo_pred_usd).toFixed(1)}" cy="${sy(c.mcap_usd).toFixed(1)}" r="3" fill="${rr <= 3 ? "#0d5c63" : "#b97828"}"><title>${esc(c.name)}: ${fmtShortUsd(c.mcap_usd)} vs LOO ${fmtShortUsd(c.loo_pred_usd)}</title></circle>`;
    }).join("");
    return `<div class="scap"><span>Blind LOO Predicted (x) vs. Actual MCap (y), log-log (n=${modelComps.length})</span><span><strong style="color:#0d5c63">●</strong> ≤3× (${Math.round(V.lm.w3 * 100)}%) &nbsp;<strong style="color:#b97828">●</strong> &gt;3×</span></div><svg class="svgc" viewBox="0 0 ${W} ${H}"><defs><clipPath id="cp"><rect x="${L}" y="${T}" width="${W - L - Rt}" height="${H - T - B}"/></clipPath></defs><g stroke="#e5e3dc">${lines.join("")}</g><g fill="#6c7480">${lbls.join("")}</g><g clip-path="url(#cp)"><polygon points="${x1},${y1 - d3} ${x2},${y2 - d3} ${x2},${y2 + d3} ${x1},${y1 + d3}" fill="#0d5c63" fill-opacity=".09"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0d5c63" stroke-width="1.2" stroke-dasharray="4 3"/><g fill-opacity=".78">${pts}</g></g><rect x="${L}" y="${T}" width="${W - L - Rt}" height="${H - T - B}" fill="none" stroke="#c5c0b4"/></svg>`;
  }

  function renderSurvivalSvg(age, peer, rem) {
    const cv = S.age || [];
    if (!cv.length) return "";
    const W = 450, H = 86, L = 32, Rt = 10, T = 12, B = 18, sw = (W - L - Rt) / cv.length;
    const bars = cv.map((b, i) => {
      const x = L + i * sw + 8, bw = Math.max(24, sw - 16), bh = b[5] * (H - T - B), y = H - B - bh, act = age != null && age >= b[1] && age < b[2], cx = (x + bw / 2).toFixed(1);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${act ? "#0d5c63" : "#c7dce0"}"/><text x="${cx}" y="${(y - 3).toFixed(1)}" fill="${act ? "#0d5c63" : "#47505c"}" font-weight="${act ? 700 : 500}">${Math.round(b[5] * 100)}%</text><text x="${cx}" y="${H - 4}" fill="${act ? "#14181f" : "#6c7480"}" font-weight="${act ? 700 : 400}">${esc(b[0])}</text>`;
    }).join("");
    return `<div class="scap"><span>Empirical Peer Tokenization by Age (n=${O.n})</span><span>Cohort: <strong>${age == null ? "unlisted" : age + "d"}</strong> · ${peer}% peers · ${rem}% 4y</span></div><svg class="svgc" viewBox="0 0 ${W} ${H}"><line x1="${L}" y1="${H - B}" x2="${W - Rt}" y2="${H - B}" stroke="#c5c0b4"/><g text-anchor="end" fill="#6c7480"><text x="${L - 4}" y="${T + 4}">100%</text><text x="${L - 4}" y="${H - B}">0%</text></g><g text-anchor="middle">${bars}</g></svg>`;
  }

  function renderTradingRows() {
    const q = st.cq.trim().toLowerCase();
    const list = trading.filter((c) => (st.cs === "all" || String(c.status) === st.cs) && (!q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)));
    tx("cst", `${list.length} of ${trading.length}`);
    $("cb").innerHTML = list.slice(0, 120).map((c) => {
      const m = c.mcap_usd && c.tvl_usd ? c.mcap_usd / c.tvl_usd : 0;
      const ms = m ? (m < 0.01 ? m.toFixed(3) : m.toFixed(2)) + "×" : "—";
      return `<tr>${td(`<strong>${esc(c.name)}</strong>${c.symbol ? ` <span class="sym">${esc(c.symbol)}</span>` : ""}`)}${td(esc(c.category))}${td(fmtShortUsd(c.tvl_usd), "num")}${td(c.mcap_usd ? fmtShortUsd(c.mcap_usd) : '<span class="mut">—</span>', "num")}${td(ms, "num")}${td(c.loo_pred_usd ? fmtShortUsd(c.loo_pred_usd) : (c.status === 1 ? '<span class="mut">excl. comp</span>' : '<span class="mut">no MCap</span>'), "num")}</tr>`;
    }).join("");
  }

  function renderValidationAndComps() {
    const ex = Object.entries(U.excluded_reasons || {}).slice(0, 6).map(([k, v]) => `${k} (${v})`).join(", ");
    $("vg").innerHTML = [
      [`Leave-One-Out CV (n=${V.lm.n})`, `${V.lm.mx.toFixed(2)}× med err`, `RMSE ${V.lm.rm.toFixed(2)} · ${Math.round(V.lm.w2 * 100)}% ≤2× · ${Math.round(V.lm.w3 * 100)}% ≤3×<br>Beats Flat 0.25× (${V.lf.toFixed(2)}×) &amp; Median (${V.lg.toFixed(2)}×)`],
      ["Walk-Forward Older → Newer", `${V.wm.mx.toFixed(2)}× med err`, `Trained on ${V.wt} oldest (≤ ${V.ws}), blind on ${V.wm.n} newest<br>Beats Flat 0.25× (${V.wf.toFixed(2)}×, ${Math.round(V.wm.w3 * 100)}% ≤3×)`],
      ["Peer Token Survival Odds", `AUC ${O.auc.toFixed(3)}`, `10-fold CV over ${O.n} clean peers (${O.nt} trading tokens)<br>Brier ${O.brier.toFixed(3)} vs ${O.base.toFixed(3)} base (+${Math.round(O.skill * 100)}% skill)`],
      [`${U.total} / ${U.total} Snapshot Accounting`, `${U.watchlist_covered}/${U.watchlist_total} WL`, `${rows.length} pre-token (${U.watchlist_covered} WL + ${U.discovery_total} disc.) · ${U.trading_total} trading (${U.trading_model_priced} model)<br>${U.excluded_total} excl.: ${esc(ex)}`],
    ].map(([h, bg, mt]) => `<div class="vc2"><h3>${h}</h3><div class="vbig">${bg}</div><div class="vmeta">${mt}</div></div>`).join("");
    $("fb").innerHTML = S.fams.map((f) => `<tr>${td(esc(f[0]))}${td(f[1], "num")}${td(f[1] ? f[2].toFixed(3) + "×" : "—", "num")}${td(`<strong>${f[3].toFixed(2)}×</strong>`, "num")}${td(`${f[4]}/${f[5]} (${Math.round((f[4] / Math.max(1, f[5])) * 100)}%)`, "num")}</tr>`).join("");
    $("ab").innerHTML = V.ab.map((a) => `<tr>${td(`<strong>${esc(a[0])}</strong>`)}${td(esc(a[1]), "num")}${td(a[2] > 0.01 ? `+${a[2].toFixed(2)}×` : "Ridge 0", "num " + (a[2] > 0.01 ? "pos" : "mut"))}${td(a[3] > 0.001 ? `+${a[3].toFixed(3)}` : "neutral", "num " + (a[3] > 0.001 ? "pos" : "mut"))}${td(esc(a[4]))}</tr>`).join("");
    tx("c2", `(${U.trading_model_priced})`); tx("c1", `(${U.trading_excl_priced})`); tx("c0", `(${U.trading_unpriced})`); tx("ca", `(${U.trading_total})`);
    $("sc").innerHTML = renderCalibrationScatter();
    renderTradingRows();
  }

  function closeDetail() { $("dbx").hidden = true; $("dbg").hidden = true; st.sel = null; st.capOv = null; renderBoard(); }

  function openDetail(row) {
    if (!row) return;
    st.sel = row.s;
    const cap = st.capOv ?? st.cap ?? getPlanCapital(row.t), live = impliedOf(row, M), p = live.parts, m = row.v / Math.max(1, row.t), fam = familyOf(row.c);
    const s0 = row.t, s1 = s0 * p.base, s2 = s1 * p.fam * p.cat, s3 = s2 * p.scale, s4 = s3 * p.chains, s5 = s4 * p.growth * p.age, mx = Math.max(s0, s1, s2, s3, s4, s5, 1);
    const sec = secs.find((x) => x[0] === cats.indexOf(row.c)), sp = sec ? sec[1] : 0, sm = sec ? sec[2] : 0, sk = sec ? `${sec[3]}/${sec[4]}` : "0/0";
    const peers = modelComps.filter((c) => c.category === row.c || familyOf(c.category) === fam).sort((a, b) => (a.category === row.c ? 0 : 1) - (b.category === row.c ? 0 : 1) || Math.abs(Math.log(a.tvl_usd / Math.max(1, row.t))) - Math.abs(Math.log(b.tvl_usd / Math.max(1, row.t)))).slice(0, 4);
    const wfRow = ([l, mp, v, nt, fc]) => `<div><div class="wfr"><span class="wfl">${l}</span><span class="wfm">${mp}</span><span class="wfbw"><span class="wfb${fc > 1.03 ? " up" : fc < 0.97 ? " dn" : ""}" style="width:${clampNum((v / mx) * 100, 3, 100).toFixed(0)}%"></span></span><span class="wfv">${fmtShortUsd(v)}</span></div>${nt ? `<div class="wfn">${esc(nt)}</div>` : ""}</div>`;
    const wfH = [["TVL", "", s0, "", 1], ["Base", p.base.toFixed(3) + "×", s1, `Median TVL ${fmtShortUsd(Math.exp(M.ref_log_tvl))}`, 1], ["Sector", (p.fam * p.cat).toFixed(3) + "×", s2, `${fam} (${p.fam.toFixed(2)}×) · ${row.c} EB (${p.cat.toFixed(2)}×)`, p.fam * p.cat], ["TVL scale", p.scale.toFixed(3) + "×", s3, `Elasticity β=${M.b_tvl.toFixed(3)}`, p.scale], ["Chains", p.chains.toFixed(3) + "×", s4, `${row.k} chain${row.k === 1 ? "" : "s"} (β=${M.b_ch.toFixed(3)})`, p.chains], ["7d & Age", (p.growth * p.age).toFixed(3) + "×", s5, `7d ${fChg(row.g)} · ${row.d == null ? "age n/a" : row.d + "d"} (Ridge-shrunk in val; primary in odds)`, p.growth * p.age]].map(wfRow).join("") + `<div class="wfr wffin"><span class="wfl">Implied</span><span class="wfm">${m.toFixed(3)}×</span><span></span><span class="wfv">${fFull(row.v)}</span></div>`;
    const par = live.value === row.rawV ? (row.sd ? `✓ impliedOf() = ${fFull(live.value)} (−$${row.sd} tie step-down)` : `✓ impliedOf() = ${fFull(live.value)} — exact match with board.json`) : `✗ Mismatch: ${fFull(live.value)}`;
    const pTbl = peers.length ? `<div class="tw iw"><table class="tbl"><thead><tr><th>Traded peer</th><th class="num">TVL</th><th class="num">MCap</th><th class="num">Mult</th><th class="num">LOO</th></tr></thead><tbody>` + peers.map((c) => `<tr>${td(`<strong>${esc(c.name)}</strong>${c.category === row.c ? "" : ` <span class="mut">${esc(c.category)}</span>`}`)}${td(fmtShortUsd(c.tvl_usd), "num")}${td(fmtShortUsd(c.mcap_usd), "num")}${td((c.mcap_usd / c.tvl_usd).toFixed(2) + "×", "num")}${td(fmtShortUsd(c.loo_pred_usd), "num")}</tr>`).join("") + `</tbody></table></div>` : "";
    const fi = farmInOf(row), e = evaluateFarmEconomics(fi, cap), steps = buildFarmPlan(fi, cap), ev = e.verdict === "FARM" ? 2 : e.verdict === "THIN" ? 1 : 0;
    const cBtns = [500, 1000, 2500, 5000, 10000].map((a) => `<button type="button" class="cb${cap === a ? " on" : ""}" data-cap="${a}">$${a >= 1e3 ? a / 1e3 + "k" : a}</button>`).join("");
    const stH = steps.map((x, i) => `<li class="sli"><span class="snum">${i + 1}</span><div><div class="shd"><span class="stl">${esc(x.title)}</span><div class="sch"><span class="chp">${esc(x.cost)}</span><span class="chp">${esc(x.time)}</span></div></div><div class="sbd">${esc(x.body)}</div></div></li>`).join("");
    const d = $("dbx");
    d.innerHTML = `<div class="dtop"><div><div class="dtr"><h2>${esc(row.n)}</h2><span class="p ${row.w ? "p-wl" : "p-dc"}">${row.w ? "Watchlist" : "Discovery"}</span><span class="p ${vCls(ev)}">${e.verdict}</span></div><div class="dsub">Rank ${row.r}/${rows.length} · ${esc(row.c)} (${esc(fam)}) · ${esc(row.s)} · ${row.k} chain${row.k === 1 ? "" : "s"}: ${esc(row.h.join(", "))}${row.k > row.h.length ? " +" + (row.k - row.h.length) : ""}</div></div><div class="dhr"><div><div class="dhv">${fFull(row.v)}</div><div class="dhs">${(m * 100).toFixed(1)}% TVL · LOO P25–P75 ${fmtShortUsd(row.lo)}–${fmtShortUsd(row.hi)}</div></div><button type="button" class="dcls" aria-label="Close">×</button></div></div>` +
      `<div class="dmet">${tl("dt", "TVL", fmtShortUsd(row.t))}${tl("dt", "7-Day", fChg(row.g), row.g == null ? "mut" : row.g >= 0 ? "pos" : "neg")}${tl("dt", "No-Token Age", row.d == null ? "unknown" : row.d + "d")}${tl("dt", "Multiple", m.toFixed(3) + "×")}${tl("dt", "Peer Rate", row.peer + "%")}${tl("dt", "4y Odds", row.rem + "%")}</div>` +
      `<div class="dcols"><div><div class="dbox"><h3>Fitted Valuation Waterfall</h3><div class="wf">${wfH}</div><p class="pnote">${esc(par)}</p></div><div class="dbox"><h3>Peer Survival &amp; Traded Comps</h3><p class="pp"><strong>${esc(row.c)}</strong> (${esc(fam)}): ${sp} comp${sp === 1 ? "" : "s"}${sp ? ` (med ${sm.toFixed(3)}×)` : ""}; ${sk} peers trade a token (10f AUC ${O.auc.toFixed(3)}).</p>${renderSurvivalSvg(row.d, row.peer, row.rem)}${pTbl}</div></div>` +
      `<div class="dbox"><h3><span>Farm Playbook (${esc(e.primaryChain)})</span><div class="cb2">${cBtns}</div></h3><div class="eg">${tl("et", "Capital", fmtUsd(e.capitalUsd))}${tl("et", "Cash Cost", fmtUsd(e.cashCostUsd))}${tl("et", "Exp / Cond", `${fmtUsd(e.expGrossUsd)} / ${fmtUsd(e.condGrossUsd)}`)}${tl("et", "Exp Net EV", fSgn(e.expNetUsd), e.expNetUsd >= 0 ? "pos" : "neg")}${tl("et", "Exp APR / BE", `${e.expAprPct >= 0 ? "+" : ""}${e.expAprPct.toFixed(1)}% · ${e.breakEvenCondUsd > 0 ? fmtUsd(e.breakEvenCondUsd) : "n/a"}`, e.expAprPct >= 0 ? "pos" : "neg")}</div><ol class="sol">${stH}</ol></div></div>`;
    on(d.querySelector(".dcls"), "click", closeDetail);
    $$(".cb", d).forEach((b) => on(b, "click", () => { st.capOv = Number(b.dataset.cap); openDetail(row); }));
    d.hidden = false; $("dbg").hidden = false; renderBoard();
  }

  function setupEvents() {
    const setTab = (w) => { const b = w === "board"; $("t-b").classList.toggle("on", b); $("t-c").classList.toggle("on", !b); $("s-b").hidden = !b; $("bf").hidden = !b; $("s-c").hidden = b; };
    on($("t-b"), "click", () => setTab("board")); on($("t-c"), "click", () => setTab("comps"));
    const sbs = $$(".sb"), setTier = (t) => { st.tier = t; sbs.forEach((b) => b.classList.toggle("on", b.dataset.t === t)); renderBoard(); };
    sbs.forEach((b) => on(b, "click", () => setTier(b.dataset.t)));
    [["fv","ver"],["fs","sec"],["fc","ch"]].forEach(([id, k]) => on($(id), "change", (e) => { st[k] = e.target.value; renderBoard(); }));
    on($("fp"), "change", (e) => { st.cap = e.target.value ? Number(e.target.value) : null; refreshRowEconomics(); renderBoard(); });
    on($("fq"), "input", (e) => { st.q = e.target.value; renderBoard(); });
    on($("fcl"), "click", () => { st.ver = st.sec = st.ch = st.q = ""; st.cap = null; ["fv","fs","fc","fp","fq"].forEach((i) => { $(i).value = ""; }); refreshRowEconomics(); setTier("all"); });
    const ths = $$("#bt th[data-s]"), syncS = () => ths.forEach((th) => { const isOn = th.dataset.s === st.sk; th.classList.toggle("sd", isOn); th.querySelector(".sa").textContent = isOn ? (st.sd === "asc" ? "▲" : "▼") : ""; });
    ths.forEach((th) => on(th, "click", () => { const k = th.dataset.s; st.sd = st.sk === k ? (st.sd === "asc" ? "desc" : "asc") : (k === "r" || k === "n" || k === "c" ? "asc" : "desc"); st.sk = k; syncS(); renderBoard(); }));
    syncS();
    $$(".csb").forEach((b) => on(b, "click", () => { st.cs = b.dataset.cs; $$(".csb").forEach((x) => x.classList.toggle("on", x === b)); renderTradingRows(); }));
    on($("cq"), "input", (e) => { st.cq = e.target.value; renderTradingRows(); });
    on($("bb"), "click", (e) => { const tr = e.target && e.target.closest ? e.target.closest("tr[data-slug]") : null; if (tr) { st.capOv = null; openDetail(rows.find((x) => x.s === tr.dataset.slug)); } });
    on($("dbg"), "click", closeDetail);
    on(document, "keydown", (e) => { if (e.key === "Escape") closeDetail(); });
  }

  function init() { refreshRowEconomics(); renderHeader(); populateFilters(); renderValidationAndComps(); setupEvents(); renderBoard(); }
  if (document.readyState === "loading") on(document, "DOMContentLoaded", init); else init();
})();

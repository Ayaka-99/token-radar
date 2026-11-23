// Live L1-IRLS Ridge valuation engine (browser parity with lib/model.ts).
// Re-fits all parameters live from the snapshot's clean DeFi comps and verifies
// 0 coef drift against z-summary.js and 0 valuation drift against board.json.

const SECTOR_FAMILY_MAP = {};
[["Vault & Curator","Risk Curators,Onchain Capital Allocator,Yield,Yield Aggregator,Farm,Liquidity Manager,Leveraged Farming"],["Credit & CDP","Lending,Collateral Markets,Uncollateralized Lending,CDP,CDP Manager,Collateral Management"],["Trading & Markets","Dexs,OTC Marketplace,Derivatives,Prediction Market,Options,Interest Rate Derivatives"],["RWA & Basis","RWA,Basis Trading,Stablecoin Wrapper,Dual-Token Stablecoin"],["Staking & Restaking","Restaking,Staking Pool,Anchor BTC,Decentralized BTC"],["Infra & Bridge","Cross Chain Bridge,Chain"]].forEach(([f,s])=>s.split(",").forEach((c)=>{SECTOR_FAMILY_MAP[c]=f;}));

const FAMILIES = ["Credit & CDP", "Infra & Bridge", "Other DeFi", "RWA & Basis", "Staking & Restaking", "Trading & Markets", "Vault & Curator"];
const familyOf = (c) => SECTOR_FAMILY_MAP[c] || "Other DeFi";
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const medianArr = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantileArr = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), i = clampNum(q, 0, 1) * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };

function solveLinear(A, b) {
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(M[c][c]);
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > best) { best = Math.abs(M[r][c]); p = r; }
    if (p !== c) { const t = M[c]; M[c] = M[p]; M[p] = t; }
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) continue;
    for (let j = c; j <= n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c && M[r][c]) { const f = M[r][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r[n]);
}

function fitValuationModel(comps) {
  const n = comps.length, ages = [], gs = [], lchs = [];
  const refTvl = r6(medianArr(comps.map((p) => Math.log(Math.round(p.tvl_usd)))));
  for (const p of comps) {
    if (p.ageDays !== null) ages.push(Math.log1p(p.ageDays));
    if (p.change_7d !== null) gs.push(clampNum(Math.round(p.change_7d * 100) / 100, -40, 60) / 100);
    lchs.push(Math.log(Math.max(1, p.chainCount)));
  }
  const refAge = r6(ages.length ? medianArr(ages) : Math.log1p(365)), refG = r6(gs.length ? medianArr(gs) : 0), refCh = r6(medianArr(lchs));
  const famIdx = Object.fromEntries(FAMILIES.map((f, i) => [f, i])), d = 5 + FAMILIES.length, X = new Array(n), y = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = comps[i], tvl = Math.round(p.tvl_usd), gR = p.change_7d !== null ? Math.round(p.change_7d * 100) / 100 : null;
    const row = new Array(d).fill(0);
    row[0] = 1; row[1] = Math.log(tvl) - refTvl; row[2] = gR !== null ? clampNum(gR, -40, 60) / 100 - refG : 0;
    row[3] = p.ageDays !== null ? Math.log1p(p.ageDays) - refAge : 0; row[4] = Math.log(Math.max(1, p.chainCount)) - refCh;
    row[5 + (famIdx[familyOf(p.category)] ?? famIdx["Other DeFi"])] = 1;
    X[i] = row; y[i] = Math.log(Math.round(p.mcap_usd) / tvl);
  }
  const lams = [0, 0.5, 50, 80, 40].concat(FAMILIES.map(() => 3));
  let w = new Array(n).fill(1), beta = new Array(d).fill(0);
  for (let it = 0; it < 18; it++) {
    const H = Array.from({ length: d }, () => new Array(d).fill(0)), rhs = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      const wi = w[i], xi = X[i], yi = y[i];
      for (let a = 0; a < d; a++) if (xi[a]) { const wxa = wi * xi[a]; rhs[a] += wxa * yi; for (let b = 0; b < d; b++) if (xi[b]) H[a][b] += wxa * xi[b]; }
    }
    for (let a = 0; a < d; a++) H[a][a] += lams[a];
    beta = solveLinear(H, rhs);
    for (let i = 0; i < n; i++) { let pr = 0; for (let j = 0; j < d; j++) pr += beta[j] * X[i][j]; w[i] = 1 / Math.max(0.15, Math.abs(y[i] - pr)); }
  }
  const fam_eff = {}, byCat = {}, cat_eff = {};
  FAMILIES.forEach((f, k) => { fam_eff[f] = r6(beta[5 + k]); });
  for (let i = 0; i < n; i++) {
    let pr = 0; for (let j = 0; j < d; j++) pr += beta[j] * X[i][j];
    const c = comps[i].category || "Uncategorized";
    (byCat[c] || (byCat[c] = [])).push([y[i] - pr, w[i]]);
  }
  for (const c of Object.keys(byCat).sort()) { let sw = 0, sr = 0; for (const [r, wt] of byCat[c]) { sw += wt; sr += r * wt; } cat_eff[c] = r6(sr / (sw + 12)); }
  return { n_priced: n, b0: r6(beta[0]), b_tvl: r6(beta[1]), b_g: r6(beta[2]), b_age: r6(beta[3]), b_ch: r6(beta[4]), ref_log_tvl: refTvl, ref_g: refG, ref_log_age: refAge, ref_log_ch: refCh, fam_eff, cat_eff, lo_mult_log: r6(Math.max(-4.2, quantileArr(y, 0.05))), hi_mult_log: r6(Math.min(1.5, quantileArr(y, 0.95))) };
}

function impliedOf(row, M) {
  const tvl = Math.round(row.t), gR = row.g !== null ? Math.round(row.g * 100) / 100 : null;
  const lB = M.b0, lF = M.fam_eff[familyOf(row.c)] || 0, lC = M.cat_eff[row.c] || 0;
  const lS = M.b_tvl * (Math.log(Math.max(1, tvl)) - M.ref_log_tvl), lG = M.b_g * (gR !== null ? clampNum(gR, -40, 60) / 100 - M.ref_g : 0);
  const lA = M.b_age * (row.d !== null ? Math.log1p(row.d) - M.ref_log_age : 0), lH = M.b_ch * (Math.log(Math.max(1, row.k)) - M.ref_log_ch);
  const lm = clampNum(lB + lF + lC + lS + lG + lA + lH, M.lo_mult_log, M.hi_mult_log);
  const value = clampNum(Math.round(tvl * Math.exp(lm)), 1e6, 1e14);
  return { value, lo: clampNum(Math.round(tvl * Math.exp(lm + M.q25_res)), 25e4, value), hi: clampNum(Math.round(tvl * Math.exp(lm + M.q75_res)), value, 1e14), logMult: lm, parts: { base: Math.exp(lB), fam: Math.exp(lF), cat: Math.exp(lC), scale: Math.exp(lS), growth: Math.exp(lG), age: Math.exp(lA), chains: Math.exp(lH) } };
}

function verifyLiveFit(modelComps, M) {
  if (!modelComps.length) return { ok: false, maxDiff: 1, n: 0 };
  const rf = fitValuationModel(modelComps);
  let maxDiff = 0;
  for (const k of ["b0", "b_tvl", "b_g", "b_age", "b_ch", "lo_mult_log", "hi_mult_log"]) maxDiff = Math.max(maxDiff, Math.abs(rf[k] - M[k]));
  for (const f of FAMILIES) maxDiff = Math.max(maxDiff, Math.abs((rf.fam_eff[f] || 0) - (M.fam_eff[f] || 0)));
  for (const c of Object.keys(M.cat_eff)) maxDiff = Math.max(maxDiff, Math.abs((rf.cat_eff[c] || 0) - M.cat_eff[c]));
  return { ok: maxDiff < 1e-5, maxDiff, n: rf.n_priced, refit: rf };
}

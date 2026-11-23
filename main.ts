// Token-launch radar entry point (make.fun bounty token-radar-01).
// Reads /input/snapshot.json, fits the valuation & peer-odds models from the snapshot's
// own traded tokens, validates held-out twice (LOO-CV + walk-forward), writes board.json,
// copies dashboard/ + screenshots/ + z-data.js, and builds dossier.json deterministically.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, buildRadar, boardIssue } from './lib/model.ts';
import { buildSummaryScript, buildRowsScript } from './lib/farm.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const REPO_DIR = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_FILES = ['index.html', 'style.css', 'ui.js'] as const;
const IMAGE_RE = /\.(png|jpe?g)$/i;

function parseFlag(argv: string[], name: string, fallback: string): string {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  let result = fallback;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === flag && i + 1 < argv.length) {
      result = argv[i + 1]!;
      i++;
    } else if (arg.startsWith(prefix)) {
      result = arg.slice(prefix.length);
    }
  }
  return result;
}

function resolveSnapshotPath(inputArg: string): string {
  try {
    if (fs.statSync(inputArg).isDirectory()) {
      return path.join(inputArg, 'snapshot.json');
    }
  } catch {
    // Let readFileSync report the missing path.
  }
  return inputArg;
}

function copyDashboard(repoDir: string, outDir: string, summaryScript: string, rowsScript: string): void {
  const srcDir = path.join(repoDir, 'dashboard');
  for (const file of DASHBOARD_FILES) {
    const srcPath = path.join(srcDir, file);
    if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
      process.stderr.write(`token radar: missing dashboard source file ${srcPath}\n`);
      process.exit(1);
    }
  }
  const destDir = path.join(outDir, 'dashboard');
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of DASHBOARD_FILES) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
  fs.writeFileSync(path.join(destDir, 'z-summary.js'), summaryScript, 'utf8');
  fs.writeFileSync(path.join(outDir, 'data.js'), rowsScript, 'utf8');
}

function copyScreenshots(repoDir: string, outDir: string): number {
  const srcDir = path.join(repoDir, 'screenshots');
  const destDir = path.join(outDir, 'screenshots');
  fs.mkdirSync(destDir, { recursive: true });
  // Remove stale screenshots from destDir if re-running into an existing folder
  for (const old of fs.readdirSync(destDir)) {
    fs.unlinkSync(path.join(destDir, old));
  }
  let imageCount = 0;
  if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
    const entries = fs
      .readdirSync(srcDir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.') && IMAGE_RE.test(entry.name)) {
        fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
        imageCount++;
      }
    }
  }
  if (imageCount === 0) {
    process.stderr.write(`token radar: warning: no screenshot image files found in ${srcDir}\n`);
  }
  return imageCount;
}

function main(): void {
  const argv = process.argv.slice(2);
  const inputArg = parseFlag(argv, 'input', '/input');
  const outDir = parseFlag(argv, 'output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshotPath = resolveSnapshotPath(inputArg);
  let rawSnapshot: string;
  try {
    rawSnapshot = fs.readFileSync(snapshotPath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`token radar: failed to read snapshot ${snapshotPath}: ${msg}\n`);
    process.exit(1);
  }

  let snapshot: ReturnType<typeof parseSnapshot>;
  try {
    snapshot = parseSnapshot(rawSnapshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`token radar: ${msg}\n`);
    process.exit(1);
  }

  const { board, summary } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    process.stderr.write(`token radar: ${issue}\n`);
    process.exit(1);
  }

  const summaryScript = buildSummaryScript(board, summary);
  const rowsScript = buildRowsScript(board, summary);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'board.json'),
    `${JSON.stringify({ rows: board }, null, 2)}\n`,
    'utf8'
  );

  copyDashboard(REPO_DIR, outDir, summaryScript, rowsScript);
  const shotCount = copyScreenshots(REPO_DIR, outDir);

  let dossierBytes: Uint8Array;
  try {
    dossierBytes = buildDossier(outDir, {
      text_max_bytes: 65_536,
      screenshots: { max: 4, max_bytes: 524_288 },
      dashboard: { max_files: 400, max_bytes: 4_194_304 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(outDir, 'dossier.json'), dossierBytes);

  const u = summary.universe;
  const v = summary.validation;
  process.stdout.write(
    `token radar: ${board.length} rows (${u.watchlist_covered}/${u.watchlist_total} watchlist + ${u.discovery_total} discovery; ${u.total}/${u.total} accounted: ${u.trading_total} trading, ${u.excluded_total} excl), LOO ${v.loo_model.med_x}x vs ${v.loo_flat25.med_x}x flat, WF ${v.wf_model.med_x}x vs ${v.wf_flat25.med_x}x flat, ${shotCount} shots, dossier ${dossierBytes.byteLength} bytes\n`
  );
}

main();

// Token-launch radar entry point (make.fun bounty token-radar-01).
// Builds board.json, static dashboard, screenshots, and dossier.json from a snapshot.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, buildRadar, boardIssue } from './lib/model.ts';
import { selectComps, buildDataScript } from './lib/farm.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const REPO_DIR = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_FILES = ['index.html', 'style.css', 'ui.js'] as const;
const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

function parseFlag(argv: string[], name: string, fallback: string): string {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  let result = fallback;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === flag && i + 1 < argv.length) {
      result = argv[i + 1];
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
    // Let readFileSync report missing path if it does not exist.
  }
  return inputArg;
}

function copyDashboard(repoDir: string, outDir: string, dataScript: string): void {
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
  fs.writeFileSync(path.join(destDir, 'z-data.js'), dataScript, 'utf8');
}

function copyScreenshots(repoDir: string, outDir: string): void {
  const srcDir = path.join(repoDir, 'screenshots');
  const destDir = path.join(outDir, 'screenshots');
  fs.mkdirSync(destDir, { recursive: true });
  let imageCount = 0;
  if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      if (entry.isFile()) {
        fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
        if (IMAGE_RE.test(entry.name)) {
          imageCount++;
        }
      }
    }
  }
  if (imageCount === 0) {
    process.stderr.write(`token radar: warning: no screenshot image files found in ${srcDir}\n`);
  }
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

  const comps = selectComps(snapshot);
  const dataScript = buildDataScript(board, comps, summary.as_of);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'board.json'),
    `${JSON.stringify({ rows: board }, null, 2)}\n`,
    'utf8'
  );

  copyDashboard(REPO_DIR, outDir, dataScript);
  copyScreenshots(REPO_DIR, outDir);

  let dossierBytes: string | Uint8Array;
  try {
    dossierBytes = buildDossier(outDir, { text_max_bytes: 65_536 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(outDir, 'dossier.json'), dossierBytes);

  const byteLen =
    typeof dossierBytes === 'string'
      ? Buffer.byteLength(dossierBytes, 'utf8')
      : dossierBytes.byteLength;
  const watchlistCount = board.filter((r) => r.watchlist).length;
  const discoveryCount = board.length - watchlistCount;

  process.stdout.write(
    `token radar: ${board.length} rows (${watchlistCount} watchlist + ${discoveryCount} discovery), ${comps.length} comps, dossier ${byteLen} bytes\n`
  );
}

main();

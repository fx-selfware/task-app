import fs from 'node:fs';
import path from 'node:path';

/**
 * Diffs two benchmark reports:
 *   npx tsx tests/perf/compare.ts before after
 */

interface Report {
  label: string;
  createdAt: string;
  config: { netMs: number; dbMs: number; repeats: number; device: string };
  scenarios: { name: string; description: string; perceivedMs: number; settledMs: number; apiCalls: number }[];
}

const resolve = (nameOrPath: string): Report => {
  const file = nameOrPath.endsWith('.json') ? nameOrPath : path.join('.perf', `${nameOrPath}.json`);
  if (!fs.existsSync(file)) throw new Error(`no report at ${file} — run PERF_LABEL=${nameOrPath} npm run test:perf`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Report;
};

const [beforeArg, afterArg] = process.argv.slice(2);
if (!beforeArg || !afterArg) {
  console.error('usage: tsx tests/perf/compare.ts <before> <after>');
  process.exit(1);
}

const before = resolve(beforeArg);
const after = resolve(afterArg);

if (JSON.stringify(before.config) !== JSON.stringify(after.config)) {
  console.warn('warning: reports were produced with different settings; the deltas are not comparable.');
  console.warn(`  ${before.label}: ${JSON.stringify(before.config)}`);
  console.warn(`  ${after.label}:  ${JSON.stringify(after.config)}\n`);
}

const delta = (from: number, to: number): string => {
  if (from === to) return '=';
  if (from === 0) return `+${to}`;
  const pct = Math.round(((to - from) / from) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

const rows = after.scenarios.map((a) => {
  const b = before.scenarios.find((s) => s.name === a.name);
  if (!b) return [a.name, '—', `${a.perceivedMs}`, 'new', '—', `${a.settledMs}`, 'new', '—', `${a.apiCalls}`];
  return [
    a.name,
    `${b.perceivedMs}`,
    `${a.perceivedMs}`,
    delta(b.perceivedMs, a.perceivedMs),
    `${b.settledMs}`,
    `${a.settledMs}`,
    delta(b.settledMs, a.settledMs),
    `${b.apiCalls}`,
    `${a.apiCalls}`,
  ];
});

const header = ['scenario', 'perc.before', 'perc.after', 'Δ', 'settl.before', 'settl.after', 'Δ', 'api.before', 'api.after'];
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (cells: string[]) =>
  cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');

console.log(`\n${before.label} → ${after.label}`);
console.log(
  `net ${after.config.netMs}ms/request · db ${after.config.dbMs}ms/round trip · ${after.config.device} · median of ${after.config.repeats}\n`,
);
console.log(line(header));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
for (const row of rows) console.log(line(row));
console.log('\nperceived = click → UI updated · settled = click → last request done · api = requests per interaction\n');

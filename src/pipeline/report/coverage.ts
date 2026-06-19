import type { Coverage, CoverageBucket } from '../../core/index-build/buildIndex';

function pct(n: number, d: number): string {
  return (d ? `${((n / d) * 100).toFixed(1)}%` : '0%').padStart(7);
}

function line(name: string, b: CoverageBucket): string {
  return (
    `${name.padEnd(10)} total ${String(b.total).padStart(5)}` +
    `   exact ${pct(b.exact, b.total)}` +
    `   approx ${pct(b.approximate, b.total)}` +
    `   unparsed ${pct(b.unparsed, b.total)}`
  );
}

/** Fraction of monsters whose materials parsed at least approximately. */
export function coveragePassRate(c: Coverage): number {
  const { exact, approximate, total } = c.overall;
  return total ? (exact + approximate) / total : 1;
}

export function formatCoverage(c: Coverage): string {
  const rows = [line('ALL', c.overall)];
  for (const [type, bucket] of Object.entries(c.byType)) {
    if (bucket.total > 0) rows.push(line(type, bucket));
  }
  return ['Parse coverage:', ...rows.map((r) => `  ${r}`)].join('\n');
}

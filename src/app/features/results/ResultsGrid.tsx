import type { BanRegion } from '@core';
import type { MatchResult } from '../../data/types';
import { ResultCard } from './ResultCard';

export function ResultsGrid({
  results,
  onSelect,
  region,
}: {
  results: MatchResult[];
  onSelect: (r: MatchResult) => void;
  region: BanRegion;
}) {
  return (
    <div className="grid">
      {results.map((r) => (
        <ResultCard key={r.monster.id} result={r} onSelect={onSelect} region={region} />
      ))}
    </div>
  );
}

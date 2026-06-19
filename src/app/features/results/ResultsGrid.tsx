import type { MatchResult } from '../../data/types';
import { ResultCard } from './ResultCard';

export function ResultsGrid({ results }: { results: MatchResult[] }) {
  return (
    <div className="grid">
      {results.map((r) => (
        <ResultCard key={r.monster.id} result={r} />
      ))}
    </div>
  );
}

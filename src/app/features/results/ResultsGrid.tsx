import type { MatchResult, ResultMonster } from '../../data/types';
import { ResultCard } from './ResultCard';

export function ResultsGrid({
  results,
  onSelect,
}: {
  results: MatchResult[];
  onSelect: (m: ResultMonster) => void;
}) {
  return (
    <div className="grid">
      {results.map((r) => (
        <ResultCard key={r.monster.id} result={r} onSelect={onSelect} />
      ))}
    </div>
  );
}

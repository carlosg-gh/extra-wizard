export function ResultsEmptyState({
  hasInput,
  loading,
}: {
  hasInput: boolean;
  loading: boolean;
}) {
  let message: string;
  if (loading) message = 'Searching…';
  else if (!hasInput) message = 'Add the monsters you control to see what you can summon.';
  else message = 'No Extra Deck monsters can be made from these cards. Try adding more materials, or switch to "Any subset".';

  return (
    <div className="empty">
      <div className="empty__glyph" aria-hidden>
        ✦
      </div>
      <p>{message}</p>
    </div>
  );
}

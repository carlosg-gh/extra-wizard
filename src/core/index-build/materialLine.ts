/**
 * Extract the summon-material line from a card's text.
 *
 * YGOPRODeck concatenates Pendulum monsters' text as
 * `[ Pendulum Effect ]\n…\n----\n[ Monster Effect ]\n<materials>\n…`, so the first
 * line is the Pendulum-effect header, not the materials. When a `[ Monster Effect ]`
 * marker is present (only Pendulum cards have it) we read the first real line after
 * it; otherwise the materials are the first non-empty line.
 */
export function materialLineFromText(text: string | null | undefined): string {
  const lines = (text ?? '').split('\n');
  const monsterIdx = lines.findIndex((l) => /\[\s*Monster Effect\s*\]/i.test(l));
  const start = monsterIdx >= 0 ? monsterIdx + 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const t = lines[i].trim();
    // Skip blank lines and pure separator rules (e.g. "------").
    if (t && !/^[-—–_]+$/.test(t)) return t;
  }
  return lines[0]?.trim() ?? '';
}

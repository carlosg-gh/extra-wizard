// Build the few non-ASCII characters we normalize from char codes, so this
// source file stays pure ASCII (no irregular-whitespace / smart-quote glyphs).
const NBSP = String.fromCharCode(0xa0);
const LEFT_QUOTE = String.fromCharCode(0x201c);
const RIGHT_QUOTE = String.fromCharCode(0x201d);
const UNICODE_MINUS = String.fromCharCode(0x2212);

/** Normalize a raw material string: unify quotes/whitespace, trim. */
export function normalize(s: string): string {
  return s
    .split(NBSP)
    .join(' ')
    .split(LEFT_QUOTE)
    .join('"')
    .split(RIGHT_QUOTE)
    .join('"')
    .split(UNICODE_MINUS)
    .join('-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a material string into top-level segments on " + ", without splitting
 * inside quoted card names (e.g. "Sanga of the Thunder").
 */
export function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote && s.startsWith(' + ', i)) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      i += 2; // skip "+ "; the loop's i++ skips the leading space
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

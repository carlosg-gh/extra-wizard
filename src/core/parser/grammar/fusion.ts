import type { MaterialConstraint, MaterialGroup } from '../../domain/types';
import { buildConstraint, parseCount, parseFilters, totals } from './shared';

/**
 * Fusion: a "+"-joined list of NAMED materials (quoted, e.g. `"Trakodon"`),
 * archetype materials (`1 "Despia" monster`), and generic materials
 * (`1 LIGHT or DARK monster`). Standalone quoted segments are named cards;
 * counted segments go through the generic filter grammar.
 */
export function parseFusion(segments: string[]): { group: MaterialGroup; exact: boolean } {
  const constraints: MaterialConstraint[] = [];
  let exact = true;

  for (const seg of segments) {
    const { min, max, rest, hadCount } = parseCount(seg);
    const isStandaloneNamed = !hadCount && seg.includes('"');

    if (isStandaloneNamed) {
      const names = [...seg.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      const xMatch = seg.match(/x\s*([2-9])/i);
      const sameName = /same name/i.test(seg);
      if (names.length > 1 && !xMatch) {
        // e.g. `"Suijin" + "Sanga of the Thunder"` collapsed into one segment.
        for (const n of names) constraints.push({ min: 1, max: 1, namedCards: [n], raw: seg });
      } else {
        const cnt = xMatch ? parseInt(xMatch[1], 10) : 1;
        constraints.push({ min: cnt, max: cnt, namedCards: [names[0]], raw: seg });
        if (sameName) exact = false;
      }
    } else {
      const f = parseFilters(rest);
      if (!f.exact) exact = false;
      constraints.push(buildConstraint(min, max, f, seg));
    }
  }

  const group: MaterialGroup = { constraints, ...totals(constraints) };
  return { group, exact };
}

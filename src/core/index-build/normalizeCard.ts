import type { Attribute, LinkArrow, SummonType } from '../domain/enums';
import { ATTRIBUTES } from '../domain/enums';
import type { Card } from '../domain/types';
import { FUSION_SUBSTITUTE_IDS } from '../parser/lexicon';
import { materialLineFromText } from './materialLine';

/** The subset of a yaml-yugi card record this project consumes. */
export interface RawCard {
  konami_id?: number | null;
  password?: number | null;
  name?: { en?: string | null } | string | null;
  text?: { en?: string | null } | string | null;
  card_type?: string | null;
  monster_type_line?: string | null;
  attribute?: string | null;
  level?: number | null;
  rank?: number | null;
  link_arrows?: string[] | null;
  atk?: number | string | null;
  def?: number | string | null;
  series?: string[] | null;
  materials?: string | Record<string, unknown> | null;
}

const ARROW_MAP: Record<string, LinkArrow> = {
  '↖': 'TL',
  '⬆': 'T',
  '↗': 'TR',
  '⬅': 'L',
  '➡': 'R',
  '↙': 'BL',
  '⬇': 'B',
  '↘': 'BR',
  '↑': 'T',
  '←': 'L',
  '→': 'R',
  '↓': 'B',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function enStr(v: RawCard['name'] | RawCard['text']): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof v.en === 'string') return v.en;
  return '';
}

/**
 * Normalize a raw yaml-yugi record into a {@link Card}. Returns `null` for
 * non-monsters, Rush cards, and anything missing the data we need.
 */
export function normalizeCard(raw: RawCard): Card | null {
  if (raw.card_type !== 'Monster') return null;
  // Rush Duel records carry `materials` as an object; skip them defensively.
  if (raw.materials != null && typeof raw.materials === 'object') return null;
  if (typeof raw.monster_type_line !== 'string') return null;

  const tags = raw.monster_type_line
    .split('/')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length < 2) return null;

  const race = tags[0];
  const rest = tags.slice(1);

  const konamiId = num(raw.konami_id) ?? 0;
  const password = num(raw.password);
  const id = String(password ?? konamiId);
  if (id === '0') return null;

  const name = enStr(raw.name);
  if (!name) return null;

  let summonType: SummonType | null = null;
  if (rest.includes('Fusion')) summonType = 'Fusion';
  else if (rest.includes('Synchro')) summonType = 'Synchro';
  else if (rest.includes('Xyz')) summonType = 'Xyz';
  else if (rest.includes('Link')) summonType = 'Link';

  let level: number | null = null;
  let rank: number | null = null;
  let linkRating: number | null = null;
  let linkArrows: LinkArrow[] | null = null;

  if (summonType === 'Link') {
    const arrows = Array.isArray(raw.link_arrows) ? raw.link_arrows : [];
    linkRating = arrows.length || null;
    const mapped = arrows.map((g) => ARROW_MAP[g]).filter(Boolean) as LinkArrow[];
    linkArrows = mapped.length ? mapped : null;
  } else if (summonType === 'Xyz') {
    rank = num(raw.rank);
  } else {
    level = num(raw.level);
  }

  const attrRaw = (raw.attribute ?? '').toString().toUpperCase();
  const attribute = (ATTRIBUTES as readonly string[]).includes(attrRaw) ? (attrRaw as Attribute) : null;

  return {
    id,
    password: password ?? null,
    konamiId,
    name,
    race,
    typeLineTags: rest,
    attribute,
    level,
    rank,
    linkRating,
    linkArrows,
    atk: num(raw.atk),
    def: num(raw.def),
    series: Array.isArray(raw.series) ? raw.series : [],
    isTuner: rest.includes('Tuner'),
    isEffect: rest.includes('Effect'),
    isToken: rest.includes('Token'),
    isPendulum: rest.includes('Pendulum'),
    ocgOnly: false, // yaml-yugi fallback path; the OCG ribbon is accurate on the YGOPRODeck dataset
    isFusionSubstitute: FUSION_SUBSTITUTE_IDS.has(id),
    summonType,
    imageId: id,
  };
}

/** The material string to parse: prefer the dedicated field, else the first line of effect text. */
export function pickMaterials(raw: RawCard): string {
  if (typeof raw.materials === 'string' && raw.materials.trim()) return raw.materials.trim();
  return materialLineFromText(enStr(raw.text));
}

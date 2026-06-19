import type { Attribute, LinkArrow, SummonType } from '../domain/enums';
import { ATTRIBUTES } from '../domain/enums';
import type { Card } from '../domain/types';
import { FUSION_SUBSTITUTE_IDS } from '../parser/lexicon';

/** The subset of a YGOPRODeck `cardinfo.php` record this project consumes. */
export interface YgoprodeckRaw {
  id?: number;
  name?: string;
  /** e.g. "Synchro Tuner Monster", "Pendulum Effect Fusion Monster", "Flip Effect Monster". */
  type?: string;
  /** e.g. "fusion", "synchro", "xyz", "link", "effect", "normal_pendulum", "token". */
  frameType?: string;
  desc?: string;
  race?: string;
  attribute?: string;
  atk?: number | null;
  def?: number | null;
  /** For Xyz monsters this holds the Rank. */
  level?: number | null;
  linkval?: number | null;
  linkmarkers?: string[] | null;
  scale?: number | null;
  /** YGOPRODeck exposes a single archetype string (vs yaml-yugi's multi-value series). */
  archetype?: string;
}

const LINK_MARKER_MAP: Record<string, LinkArrow> = {
  Top: 'T',
  Bottom: 'B',
  Left: 'L',
  Right: 'R',
  'Top-Left': 'TL',
  'Top-Right': 'TR',
  'Bottom-Left': 'BL',
  'Bottom-Right': 'BR',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Map a YGOPRODeck record to our normalized {@link Card}. Returns `null` for
 * non-monsters (spell/trap/skill) and records missing id/name/type.
 */
export function normalizeYgoprodeckCard(raw: YgoprodeckRaw): Card | null {
  const frameType = (raw.frameType ?? '').toLowerCase();
  if (!frameType || frameType === 'spell' || frameType === 'trap' || frameType === 'skill') {
    return null;
  }
  const type = raw.type ?? '';
  if (!type) return null;
  const id = raw.id != null ? String(raw.id) : '';
  if (!id) return null;
  const name = raw.name ?? '';
  if (!name) return null;

  // Tokens of the `type` string become typeLineTags (powers the ability filter):
  // drop "Monster", normalize "XYZ" -> "Xyz".
  const typeLineTags = type
    .split(/\s+/)
    .filter((w) => w && w !== 'Monster')
    .map((w) => (w === 'XYZ' ? 'Xyz' : w));

  let summonType: SummonType | null = null;
  if (frameType.includes('fusion')) summonType = 'Fusion';
  else if (frameType.includes('synchro')) summonType = 'Synchro';
  else if (frameType.includes('xyz')) summonType = 'Xyz';
  else if (frameType.includes('link')) summonType = 'Link';

  const isToken = frameType === 'token' || /\bToken\b/.test(type);
  const isPendulum = frameType.includes('pendulum') || /\bPendulum\b/.test(type);
  const isTuner = /\bTuner\b/.test(type);
  // Everything that isn't explicitly Normal (and isn't a Token) is an Effect monster.
  const isEffect = !/\bNormal\b/i.test(type) && !isToken;

  let level: number | null = null;
  let rank: number | null = null;
  let linkRating: number | null = null;
  let linkArrows: LinkArrow[] | null = null;

  if (summonType === 'Link') {
    const markers = Array.isArray(raw.linkmarkers) ? raw.linkmarkers : [];
    linkRating = num(raw.linkval) ?? (markers.length || null);
    const mapped = markers.map((m) => LINK_MARKER_MAP[m]).filter(Boolean) as LinkArrow[];
    linkArrows = mapped.length ? mapped : null;
  } else if (summonType === 'Xyz') {
    rank = num(raw.level);
  } else {
    level = num(raw.level);
  }

  const attrRaw = (raw.attribute ?? '').toUpperCase();
  const attribute = (ATTRIBUTES as readonly string[]).includes(attrRaw) ? (attrRaw as Attribute) : null;

  return {
    id,
    password: raw.id ?? null,
    konamiId: 0,
    name,
    race: raw.race ?? '',
    typeLineTags,
    attribute,
    level,
    rank,
    linkRating,
    linkArrows,
    atk: num(raw.atk),
    def: num(raw.def),
    series: raw.archetype ? [raw.archetype] : [],
    isTuner,
    isEffect,
    isToken,
    isPendulum,
    isFusionSubstitute: FUSION_SUBSTITUTE_IDS.has(id),
    summonType,
    imageId: id,
  };
}

/** Material text = first line of the card description (matches yaml-yugi behavior). */
export function ygoprodeckMaterials(raw: YgoprodeckRaw): string {
  return (raw.desc ?? '').split('\n')[0]?.trim() ?? '';
}

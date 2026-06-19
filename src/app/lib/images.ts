/**
 * Card thumbnail URLs. YGOPRODeck hosts images keyed by passcode, but asks
 * consumers not to continuously hotlink — in production, route these through an
 * edge proxy / re-host (see CLAUDE.md "image strategy"). For local dev we point
 * at the CDN directly and degrade gracefully when an image is unavailable.
 */
export function cardImageUrl(
  imageId: string,
  size: 'small' | 'cropped' | 'full' = 'small',
): string {
  const folder = size === 'cropped' ? 'cards_cropped' : size === 'full' ? 'cards' : 'cards_small';
  return `https://images.ygoprodeck.com/images/${folder}/${imageId}.jpg`;
}

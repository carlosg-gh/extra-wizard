/**
 * Minimal YDKE decoder. A YDKE URL looks like
 * `ydke://<main>!<extra>!<side>!` where each section is base64 of little-endian
 * uint32 passcodes. Returns all passcodes found (across sections).
 */
export function parseYdke(url: string): number[] {
  const m = url.trim().match(/^ydke:\/\/(.*)$/);
  if (!m) return [];
  const ids: number[] = [];
  for (const section of m[1].split('!')) {
    if (!section) continue;
    let binary: string;
    try {
      binary = atob(section);
    } catch {
      continue;
    }
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    const view = new DataView(buf.buffer);
    for (let i = 0; i + 4 <= buf.length; i += 4) ids.push(view.getUint32(i, true));
  }
  return ids;
}

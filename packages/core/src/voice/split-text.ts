/**
 * Split a line into chunks of at most `maxChars`, at sentence ends first, then
 * at commas/semicolons/dashes, then at spaces. Kokoro tokenises with
 * truncation on (~510 phonemes), so anything longer is silently cut off.
 */
export function splitForSpeech(text: string, maxChars = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];
  const pieces = clean.split(/(?<=[.!?…])\s+/).flatMap((sentence) => splitLong(sentence, maxChars));
  // Re-join short neighbours so prosody isn't chopped into fragments.
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last !== undefined && last.length + 1 + piece.length <= maxChars) chunks[chunks.length - 1] = `${last} ${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

function splitLong(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];
  for (const pattern of [/(?<=[,;:])\s+/, /\s+(?=[—–-]\s)/]) {
    const parts = sentence.split(pattern);
    if (parts.length > 1) return parts.flatMap((p) => splitLong(p, maxChars));
  }
  const words = sentence.split(" ");
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + 1 + word.length > maxChars) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}

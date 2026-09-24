const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

// Splits text into overlapping chunks, breaking on paragraph/sentence boundaries where possible
// so a sentence spanning a naive cut point doesn't lose meaning in both halves.
export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      // Only accept a boundary from the back half of the window — a boundary near `start`
      // would cut the chunk down to almost nothing and, worse, could leave `start` unable
      // to advance past it once overlap is subtracted, looping forever on the same slice.
      const searchFloor = start + Math.floor(chunkSize / 2);
      const boundary = normalized.lastIndexOf('\n\n', end);
      const sentenceBoundary = normalized.lastIndexOf('. ', end);
      const cut = boundary > searchFloor ? boundary : sentenceBoundary > searchFloor ? sentenceBoundary + 1 : -1;
      if (cut > start) end = cut;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    // Guarantee forward progress every iteration, no matter what `end` ended up being.
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

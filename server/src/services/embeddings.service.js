const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
const EMBEDDING_DIMENSIONS = 768; // must match the `vector(768)` column in schema.sql

// Calls Gemini's embedding endpoint for a single string and returns a number[] vector.
export async function embedText(text) {
  const res = await fetch(`${EMBEDDING_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

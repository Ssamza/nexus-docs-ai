import { VoyageAIClient } from "voyageai";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

// Splits text into chunks of ~500 tokens (roughly 2000 chars)
export function chunkText(text: string, chunkSize = 2000): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + paragraph).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current += (current ? "\n\n" : "") + paragraph;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embedWithRetry(input: string | string[], retries = 3): Promise<number[][]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await voyage.embed({ input, model: "voyage-3-lite" });
      return response.data!.map((d: any) => d.embedding as number[]);
    } catch (err: any) {
      if (err?.statusCode === 429 && attempt < retries) {
        const delay = 20_000 * (attempt + 1);
        console.log(`  Rate limited, esperando ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("embedWithRetry: max retries exceeded");
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedWithRetry(text);
  return results[0];
}

// Voyage AI supports up to 128 texts per call — use for bulk ingestion.
// Set VOYAGE_FREE_TIER=true to add a 21s proactive delay between batches (3 RPM limit).
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 128;
  const FREE_TIER_DELAY = 21_000;
  const isFreeTier = process.env.VOYAGE_FREE_TIER === "true";
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (isFreeTier && i > 0) {
      await new Promise((r) => setTimeout(r, FREE_TIER_DELAY));
    }
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedWithRetry(batch);
    results.push(...embeddings);
  }
  return results;
}

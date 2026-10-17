import axios from 'axios';
import { ChromaClient, Collection } from 'chromadb';
import { generateEmbedding } from '../adapters/ModelAdapter';

const isPythonRagEnabled = () => process.env.USE_PYTHON_RAG === 'true';
const getPythonRagUrl = () => process.env.PYTHON_RAG_URL || 'http://localhost:8002';

/**
 * VetKnowledge RAG — Retrieval module.
 * 
 * Queries ChromaDB for relevant veterinary passages using
 * semantic embeddings. Returns passages + source metadata.
 */

export interface RetrievedPassage {
  id: string;
  text: string;
  sourceTitle: string;
  sourceUrl?: string;
  category: string;
  score: number;          // similarity score (0-1)
  pageNumber?: number;
}

const COLLECTION_NAME = process.env.CHROMA_COLLECTION || 'vetknowledge';
const TOP_K = 5;
const MIN_SCORE = 0.3;   // minimum relevance threshold

let chromaClient: ChromaClient | null = null;
let vetCollection: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (vetCollection) return vetCollection;

  const url = process.env.CHROMADB_URL || 'http://localhost:8000';

  if (!chromaClient) {
    chromaClient = new ChromaClient({ path: url });
  }

  try {
    vetCollection = await chromaClient.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'Veterinary knowledge base for PetCare AI' },
    });
    return vetCollection;
  } catch (err) {
    throw new Error(`ChromaDB connection failed at ${url}. Is ChromaDB running? (docker run -p 8000:8000 chromadb/chroma)`);
  }
}

export async function retrievePassages(
  query: string,
  filterCategory?: string,
): Promise<RetrievedPassage[]> {
  if (isPythonRagEnabled()) {
    try {
      const res = await axios.post<RetrievedPassage[]>(
        `${getPythonRagUrl()}/rag/retrieve`,
        {
          query,
          filterCategory,
          topK: TOP_K,
          minScore: MIN_SCORE,
          useBm25: true,
        },
        { timeout: 35000 }
      );
      if (Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err: any) {
      console.warn(`[Python RAG] Call to ${getPythonRagUrl()} failed (${err.message}). Falling back to TypeScript VetKnowledgeRAG.`);
    }
  }

  let collection: Collection;
  try {
    collection = await getCollection();
  } catch (err) {
    console.error('RAG: ChromaDB unavailable —', (err as Error).message);
    return [];  // Graceful fallback: no RAG, VetSage will acknowledge
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (err) {
    console.error('RAG: Embedding generation failed —', (err as Error).message);
    return [];
  }

  try {
    const whereClause = filterCategory
      ? { category: { $eq: filterCategory } }
      : undefined;

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: TOP_K,
      where: whereClause,
      include: ['documents', 'metadatas', 'distances'] as any,
    });

    const passages: RetrievedPassage[] = [];
    const docs      = results.documents?.[0] ?? [];
    const metas     = results.metadatas?.[0] ?? [];
    const distances = results.distances?.[0]  ?? [];
    const ids       = results.ids?.[0]        ?? [];

    for (let i = 0; i < docs.length; i++) {
      const doc  = docs[i];
      const meta = metas[i] as Record<string, any>;
      const dist = distances[i] as number;

      if (!doc) continue;

      // ChromaDB returns L2 distance; convert to 0-1 similarity
      const score = Math.max(0, 1 - dist / 2);
      if (score < MIN_SCORE) continue;

      passages.push({
        id:          ids[i] as string,
        text:        doc,
        sourceTitle: meta?.source_title  ?? 'Veterinary Reference',
        sourceUrl:   meta?.source_url    ?? undefined,
        category:    meta?.category      ?? 'general',
        pageNumber:  meta?.page_number   ?? undefined,
        score:       Math.round(score * 100) / 100,
      });
    }

    return passages.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.error('RAG: Query failed —', (err as Error).message);
    return [];
  }
}

/** Check if ChromaDB is reachable and has documents */
export async function checkRagHealth(): Promise<{ available: boolean; documentCount: number }> {
  if (isPythonRagEnabled()) {
    try {
      const res = await axios.get(`${getPythonRagUrl()}/health`, { timeout: 4000 });
      const rag = res.data?.rag;
      if (rag) {
        return { available: !!rag.available, documentCount: rag.documentCount || 0 };
      }
    } catch {
      // Fall through to local Chroma check
    }
  }

  try {
    const collection = await getCollection();
    const count = await collection.count();
    return { available: true, documentCount: count };
  } catch {
    return { available: false, documentCount: 0 };
  }
}

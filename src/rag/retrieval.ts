import { db } from "../db/schema";
import { llm } from "../llm/client";

function cosineSimilarity(vecA: Float32Array, vecB: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveContext(query: string, topK = 3) {
  const queryEmbedding = await llm.generateEmbedding(query);
  const queryFloat32 = new Float32Array(queryEmbedding);

  // Fetch all active chunks
  const chunks = db.query(`
    SELECT c.id, c.content, c.embedding, c.chunk_index, c.document_id, d.name as document_name 
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.status = 'active'
  `).all() as { id: string, content: string, embedding: Uint8Array, chunk_index: number, document_id: string, document_name: string }[];

  const scoredChunks = chunks.map(chunk => {
    // Reconstruct Float32Array from BLOB (Uint8Array)
    const chunkEmbedding = new Float32Array(
      chunk.embedding.buffer, 
      chunk.embedding.byteOffset, 
      chunk.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
    );
    
    const score = cosineSimilarity(queryFloat32, chunkEmbedding);
    return { ...chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks.slice(0, topK);

  // Expand Context Windows (Fetch neighbors to fix broken tables/paragraphs)
  const expandedResults = [];
  for (const tc of topChunks) {
    const neighbors = chunks.filter(c => 
      c.document_id === tc.document_id && 
      (c.chunk_index === tc.chunk_index - 1 || c.chunk_index === tc.chunk_index + 1)
    );
    
    const contextualSet = [tc, ...neighbors].sort((a, b) => a.chunk_index - b.chunk_index);
    const combinedContent = contextualSet.map(c => c.content).join("\n...\n");
    
    expandedResults.push({
      score: tc.score,
      document_name: tc.document_name,
      content: combinedContent
    });
  }

  return expandedResults;
}

import { db } from "../db/schema";
import { llm } from "../llm/client";

export async function ingestDocument(id: string, name: string, chunks: string[]) {
  // Insert document
  db.query("INSERT INTO documents (id, name, status) VALUES ($id, $name, 'active')").run({
      $id: id,
      $name: name
  });

  // Prepare chunk insert statement
  const insertChunk = db.prepare(
    "INSERT INTO chunks (id, document_id, content, embedding, chunk_index) VALUES ($id, $document_id, $content, $embedding, $chunk_index)"
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const embeddingArray = await llm.generateEmbedding(chunkText);
    
    // Convert to Float32Array and then to Uint8Array for SQLite BLOB storage
    const float32Array = new Float32Array(embeddingArray);
    const uint8Array = new Uint8Array(float32Array.buffer);

    insertChunk.run({
        $id: crypto.randomUUID(),
        $document_id: id,
        $content: chunkText,
        $embedding: uint8Array,
        $chunk_index: i
    });
  }
  
  console.log(`Ingested document ${name} with ${chunks.length} chunks.`);
}

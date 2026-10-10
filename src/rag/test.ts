import { parseDocument } from "./parser";
import { chunkText } from "./chunker";
import { ingestDocument } from "./embeddings";
import { retrieveContext } from "./retrieval";
import { initDb } from "../db/schema";

async function test() {
  console.log("Initializing DB...");
  await initDb();

  const sampleText = `Penerimaan Mahasiswa Baru (PK2MB) tahun 2026 akan dilaksanakan secara hybrid.
  
Seluruh mahasiswa baru diwajibkan untuk mengumpulkan dokumen pendaftaran di gedung rektorat lantai 3.
Jadwal pendaftaran ulang dimulai dari tanggal 1 Agustus 2026 hingga 15 Agustus 2026.
Bagi mahasiswa yang berasal dari luar kota, disediakan asrama dengan biaya subsidi.
Hubungi panitia pendaftaran di nomor 08123456789 untuk informasi lebih lanjut mengenai asrama.`;

  console.log("1. Parsing document...");
  const buffer = new TextEncoder().encode(sampleText);
  const text = await parseDocument("dummy.txt", "text/plain", buffer.buffer);
  
  console.log("2. Chunking text...");
  const chunks = chunkText(text, 200, 20); 
  console.log(`Generated ${chunks.length} chunks`);

  console.log("3. Ingesting chunks to database...");
  await ingestDocument("doc-test-123", "Panduan_PK2MB_2026.txt", chunks);

  console.log("\n4. Retrieving context for query: 'Kapan jadwal pendaftaran ulang?'");
  const results = await retrieveContext("Kapan jadwal pendaftaran ulang?", 2);
  
  console.log("\n--- Top Results ---");
  for (const res of results) {
    console.log(`Score: ${res.score.toFixed(4)} | Document: ${res.document_name}`);
    console.log(`Content: ${res.content}\n`);
  }
}

test().catch(console.error);

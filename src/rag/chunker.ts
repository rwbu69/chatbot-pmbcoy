export function chunkText(text: string, maxChunkSize = 800, overlap = 100): string[] {
  // Clean up PDF artifacts (e.g. hyphens at end of lines)
  text = text.replace(/-\s*\n\s*/g, ""); 
  text = text.replace(/  +/g, " ");

  // Simple chunking by paragraphs first, then by size
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  
  let currentChunk = "";
  
  for (const p of paragraphs) {
    const cleanedParagraph = p.trim();
    if (!cleanedParagraph) continue;
    
    if (currentChunk.length + cleanedParagraph.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      // If a single paragraph is larger than maxChunkSize, split by sentences
      if (cleanedParagraph.length > maxChunkSize) {
        let tempChunk = "";
        const sentences = cleanedParagraph.match(/[^.!?]+[.!?]+/g) || [cleanedParagraph];
        for (const sentence of sentences) {
          if (tempChunk.length + sentence.length > maxChunkSize) {
            if (tempChunk.length > 0) chunks.push(tempChunk.trim());
            tempChunk = sentence;
          } else {
            tempChunk += " " + sentence;
          }
        }
        if (tempChunk.length > 0) {
          currentChunk = tempChunk.trim();
        }
      } else {
        currentChunk = cleanedParagraph;
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? "\n\n" : "") + cleanedParagraph;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

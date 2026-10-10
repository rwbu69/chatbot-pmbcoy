import { extractText } from "unpdf";
import * as mammoth from "mammoth";

export async function parseDocument(filePath: string, mimeType: string, buffer: ArrayBuffer): Promise<string> {
  if (mimeType === "application/pdf" || filePath.endsWith(".pdf")) {
    const uint8Array = new Uint8Array(buffer);
    const result = await extractText(uint8Array) as any;
    if (typeof result === 'string') return result;
    if (result.text && Array.isArray(result.text)) return result.text.join("\n");
    return String(result.text || result);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
    filePath.endsWith(".docx")
  ) {
    const nodeBuffer = Buffer.from(buffer);
    const result = await mammoth.extractRawText({ buffer: nodeBuffer });
    return result.value;
  } else if (mimeType.startsWith("text/") || filePath.endsWith(".txt") || filePath.endsWith(".md")) {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

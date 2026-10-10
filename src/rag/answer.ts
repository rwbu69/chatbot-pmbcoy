import { retrieveContext } from "./retrieval";
import { llm } from "../llm/client";
import { getContactString } from "../db/schema";

// Guardrail constants
const SIMILARITY_THRESHOLD = 0.2; // Adjust based on your embedding model's characteristics

export async function composeAnswer(question: string, chatHistory: { role: string, content: string }[] = []): Promise<{ answer: string, score: number, flag: boolean, source: string | null }> {
  // 1. Retrieve Context
  const contextChunks = await retrieveContext(question, 3);
  
  const fallbackMessage = `Maaf, saya tidak menemukan informasi spesifik mengenai hal tersebut di dalam panduan resmi PK2MB.\n\n${getContactString()}`;

  if (contextChunks.length === 0) {
    return { answer: fallbackMessage, score: 0, flag: true, source: null };
  }

  const highestScore = contextChunks[0].score;
  const sourceDoc = contextChunks[0].document_name;

  // 2. Similarity Threshold Check (Guardrail)
  if (highestScore < SIMILARITY_THRESHOLD) {
    console.log(`Query: "${question}" is below the similarity threshold (Score: ${highestScore.toFixed(4)}). Returning fallback.`);
    return { answer: fallbackMessage, score: highestScore, flag: true, source: sourceDoc };
  }

  // 3. Prepare Prompt
  const hariIni = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full' });
  const contextString = contextChunks.map(c => `[Dokumen: ${c.document_name}]\n${c.content}`).join("\n\n");

  const systemPrompt = `You are an official virtual assistant for New Student Admissions (PK2MB).
Your primary goal is to answer questions from new students/parents based STRICTLY on the provided context.
Sekarang adalah ${hariIni}. Gunakan ini sebagai acuan waktu saat pengguna menanyakan waktu relatif seperti "besok", "lusa", atau "kemarin".

RULES:
1. Answer directly and concisely. Start your answer immediately without any pleasantries (e.g., do not say 'Tentu', 'Halo', or 'Berdasarkan dokumen').
2. Provide ONLY the specific information requested + a maximum of ONE highly relevant extra detail. Do not over-explain.
3. NEVER mention the name of the source document or say 'According to the guide'.
4. Do NOT use any Markdown formatting (no asterisks, no hashes, no bold/italic). Use plain text and line breaks for structure.
5. If the context does not contain the information needed to answer the question, you MUST reply EXACTLY with the word "UNANSWERABLE" and nothing else. Do not apologize, do not explain why, just output UNANSWERABLE.
6. If the user's question is entirely OFF-TOPIC (not related to university admissions, PK2MB, or campus), politely decline to answer and steer them back to PK2MB topics.
7. Reply in natural, polite Indonesian.
8. If the user asks for a complete schedule, list, or breakdown, you MUST output all items in sequence exactly as they appear in the context without skipping any entry or day. For schedules, use format: HH.MM - Activity Name. One activity per line.
9. If the user asks multiple questions in one message, answer all of them concisely and sequentially.

CONTEXT DOCUMENTS:
${contextString}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
    { role: "user", content: question }
  ];

  // 4. Generate Answer
  const answerText = await llm.generateChatCompletion(messages, 0.2);

  // 5. LLM Guardrail Check
  if (answerText.trim().includes("UNANSWERABLE")) {
    return { answer: fallbackMessage, score: highestScore, flag: true, source: sourceDoc };
  }

  return { answer: answerText, score: highestScore, flag: false, source: sourceDoc };
}

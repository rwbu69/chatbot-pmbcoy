export class LLMClient {
  private baseUrl: string;
  private apiKey: string;
  public model: string;

  constructor() {
    this.baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
    this.apiKey = process.env.LLM_API_KEY || "";
    this.model = process.env.LLM_MODEL || "gpt-4o-mini";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      console.warn("LLM_API_KEY is not set. Returning dummy embeddings for testing.");
      return new Array(1536).fill(0).map(() => Math.random());
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "PK2MB Chatbot"
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small" // Adjust according to provider (e.g. text-embedding-004 for Gemini)
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embedding: ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    return data.data[0].embedding;
  }

  async generateChatCompletion(messages: { role: string, content: string }[], temperature = 0.3): Promise<string> {
    if (!this.apiKey) {
      console.warn("LLM_API_KEY is not set. Returning dummy chat response.");
      return "Ini adalah balasan percobaan (dummy response) karena API Key LLM belum diatur.";
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "PK2MB Chatbot"
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: temperature,
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate chat completion: ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    return data.choices[0].message.content;
  }
}

export const llm = new LLMClient();

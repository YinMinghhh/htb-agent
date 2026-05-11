import { getConfig, type AppConfig } from "../config.js";
import type { ChatMessage } from "../types.js";

interface ChatOptions {
  config?: AppConfig;
  fetchImpl?: typeof fetch;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const config = options.config ?? getConfig();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required");
  if (!config.openaiModel) throw new Error("OPENAI_MODEL is required");

  const response = await fetchImpl(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      temperature: options.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed with ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error("LLM response did not include assistant content");
  return answer;
}
